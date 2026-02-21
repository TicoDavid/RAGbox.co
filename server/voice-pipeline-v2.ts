/**
 * Voice Pipeline v2 — Deepgram STT + Go Backend LLM + Inworld TTS (Deepgram fallback)
 *
 * Hybrid pipeline: uses the best provider for each stage:
 *   STT:  Deepgram Nova-2 (proven, working)
 *   LLM:  Go backend /api/chat (RAG + tools + Mercury persona)
 *   TTS:  Inworld REST API primary, Deepgram Aura automatic fallback
 *
 * Flow:
 *   Browser mic → PCM Int16 48kHz → WebSocket →
 *     Deepgram Nova-2 STT (REST) →
 *     Go backend /api/chat (RAG + tools + Mercury persona) →
 *     Inworld TTS REST API (primary) || Deepgram Aura TTS (fallback) →
 *     PCM Int16 48kHz → WebSocket → Browser speaker
 *
 * Same session interface as voice-pipeline.ts — drop-in replacement.
 */

import type { ToolContext } from './tools'

// ============================================================================
// TEXT CHUNKING (inlined — server/ can't import from src/ in Docker build)
// ============================================================================

const MAX_CHARS_PER_CHUNK = 2000

/** Split text into chunks of at most maxChars, breaking at sentence/word boundaries. */
function chunkText(text: string, maxChars: number = MAX_CHARS_PER_CHUNK): string[] {
  if (text.length <= maxChars) return [text]

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      chunks.push(remaining)
      break
    }

    const searchRegion = remaining.slice(0, maxChars)

    // Try to split at the last sentence-ending punctuation followed by a space
    const sentenceEnd = searchRegion.lastIndexOf('. ')
    const questionEnd = searchRegion.lastIndexOf('? ')
    const exclamEnd = searchRegion.lastIndexOf('! ')
    let splitIndex = Math.max(sentenceEnd, questionEnd, exclamEnd)

    if (splitIndex > 0) {
      splitIndex += 2 // include punctuation + space
    } else {
      splitIndex = searchRegion.lastIndexOf(' ')
    }

    if (splitIndex <= 0) {
      splitIndex = maxChars
    }

    chunks.push(remaining.slice(0, splitIndex).trim())
    remaining = remaining.slice(splitIndex).trim()
  }

  return chunks.filter(c => c.length > 0)
}

// ============================================================================
// TYPES (identical to voice-pipeline.ts)
// ============================================================================

export interface VoiceSession {
  sendAudio(pcmBuffer: Buffer): Promise<void>
  startAudioSession(): Promise<void>
  endAudioSession(): Promise<void>
  cancelResponse(): Promise<void>
  sendText(text: string): Promise<void>
  triggerGreeting(): Promise<void>
  close(): void
}

export interface VoiceSessionConfig {
  toolContext: ToolContext
  onTranscriptPartial?: (text: string) => void
  onTranscriptFinal?: (text: string) => void
  onAgentTextPartial?: (text: string) => void
  onAgentTextFinal?: (text: string) => void
  onTTSChunk?: (audioBase64: string) => void
  onToolCall?: (name: string, args: Record<string, unknown>) => void
  onToolResult?: (name: string, result: unknown) => void
  onUIAction?: (action: unknown) => void
  onNoSpeech?: () => void
  onSpeakingComplete?: () => void
  onError?: (error: Error) => void
  onDisconnect?: () => void
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SAMPLE_RATE = 48000
const DEEPGRAM_STT_URL = 'https://api.deepgram.com/v1/listen'
const DEEPGRAM_TTS_URL = 'https://api.deepgram.com/v1/speak'
const INWORLD_TTS_URL = 'https://api.inworld.ai/tts/v1/voice'
const TTS_MODEL_DEEPGRAM = 'aura-asteria-en'
const TTS_MODEL_INWORLD = 'inworld-tts-1.5-max'
const TTS_VOICE_INWORLD = 'Ashley'
const STT_MODEL = 'nova-2'
const TTS_CHUNK_SIZE = 16384 // 16KB chunks for WebSocket

// ============================================================================
// SESSION FACTORY
// ============================================================================

export async function createVoiceSession(config: VoiceSessionConfig): Promise<VoiceSession> {
  const {
    toolContext,
    onTranscriptPartial,
    onTranscriptFinal,
    onAgentTextPartial,
    onAgentTextFinal,
    onTTSChunk,
    onToolCall,
    onToolResult,
    onUIAction,
    onNoSpeech,
    onSpeakingComplete,
    onError,
    onDisconnect,
  } = config

  const deepgramKey = process.env.DEEPGRAM_API_KEY
  if (!deepgramKey) {
    throw new Error('Missing DEEPGRAM_API_KEY environment variable')
  }

  const inworldKey = process.env.INWORLD_API_KEY || ''

  const goBackendUrl = process.env.GO_BACKEND_URL
    || process.env.NEXT_PUBLIC_API_URL
    || 'http://localhost:8080'
  const internalAuth = process.env.INTERNAL_AUTH_SECRET || ''

  let isActive = false
  let audioChunks: Buffer[] = []
  let cancelled = false

  // Conversation history for multi-turn context
  const conversationHistory: Array<{ role: string; content: string }> = []

  // ------------------------------------------------------------------
  // Deepgram STT (REST — send buffered audio, get transcript)
  // Copied from voice-pipeline.ts — proven working, do not modify
  // ------------------------------------------------------------------
  async function speechToText(pcmBuffer: Buffer): Promise<string> {
    try {
      console.info('[VoicePipeline-v2] STT request', { bytes: pcmBuffer.length })

      const params = new URLSearchParams({
        model: STT_MODEL,
        language: 'en-US',
        smart_format: 'true',
        punctuate: 'true',
      })

      const res = await fetch(`${DEEPGRAM_STT_URL}?${params}`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${deepgramKey}`,
          'Content-Type': `audio/raw;encoding=linear16;sample_rate=${SAMPLE_RATE};channels=1`,
        },
        body: pcmBuffer as unknown as BodyInit,
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Deepgram STT error ${res.status}: ${text}`)
      }

      const data = await res.json() as {
        results?: {
          channels?: Array<{
            alternatives?: Array<{ transcript?: string; confidence?: number }>
          }>
        }
      }

      const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || ''
      console.info('[VoicePipeline-v2] STT transcript', { transcript })
      return transcript
    } catch (error) {
      console.error('[VoicePipeline-v2] STT error:', error)
      onError?.(error instanceof Error ? error : new Error(String(error)))
      return ''
    }
  }

  // ------------------------------------------------------------------
  // Go Backend LLM (RAG pipeline — same as Mercury text chat)
  // Copied from voice-pipeline.ts — proven working, do not modify
  // ------------------------------------------------------------------
  async function queryLLM(text: string): Promise<string> {
    try {
      console.info('[VoicePipeline-v2] LLM query', { preview: text.substring(0, 80) })

      // Add user message to history
      conversationHistory.push({ role: 'user', content: text })

      const res = await fetch(`${goBackendUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Auth': internalAuth,
          'X-User-ID': toolContext.userId || 'anonymous',
        },
        body: JSON.stringify({
          query: text,
          stream: false,
          privilegeMode: toolContext.privilegeMode || false,
          maxTier: 3,
          history: conversationHistory.slice(-10), // last 10 turns
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Backend error ${res.status}: ${errText.substring(0, 200)}`)
      }

      // The Go backend may return SSE format or plain JSON. Handle both.
      const rawText = await res.text()
      let answer = ''

      if (rawText.startsWith('{')) {
        // Plain JSON response
        const data = JSON.parse(rawText) as {
          data?: { answer?: string }
          answer?: string
        }
        answer = data.data?.answer || data.answer || ''
      } else {
        // SSE format
        const tokens: string[] = []
        let currentEventType = ''

        for (const line of rawText.split('\n')) {
          if (line.startsWith('event: ')) {
            currentEventType = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim()
            if (!dataStr) continue

            if (currentEventType === 'token') {
              try {
                const payload = JSON.parse(dataStr) as { text?: string }
                if (payload.text) tokens.push(payload.text)
              } catch {
                if (dataStr !== '[DONE]') tokens.push(dataStr)
              }
            } else if (currentEventType === 'silence') {
              // BUG-032: Go backend sends event:silence when no docs match
              try {
                const payload = JSON.parse(dataStr) as { message?: string }
                if (payload.message) answer = payload.message
              } catch {
                // Non-JSON silence data — use raw text
                if (dataStr) answer = dataStr
              }
            } else if (currentEventType === 'done') {
              if (!answer) answer = tokens.join('')
            }
            currentEventType = ''
          }
        }
        if (!answer) answer = tokens.join('')
      }

      console.info('[VoicePipeline-v2] LLM answer', { preview: answer.substring(0, 80) })

      // Add assistant response to history
      conversationHistory.push({ role: 'assistant', content: answer })

      return answer
    } catch (error) {
      console.error('[VoicePipeline-v2] LLM error:', error)
      onError?.(error instanceof Error ? error : new Error(String(error)))
      return "I'm sorry, I couldn't process that request. Please try again."
    }
  }

  // ------------------------------------------------------------------
  // Inworld TTS (REST API — primary TTS provider)
  // Correct format: POST { text, voiceId, modelId }
  // Response: { audioContent: "<base64>" }
  // ------------------------------------------------------------------
  async function inworldTTS(text: string): Promise<void> {
    const chunks = chunkText(text, 2000)

    for (const chunk of chunks) {
      if (cancelled) return

      const res = await fetch(INWORLD_TTS_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${inworldKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: chunk,
          voiceId: TTS_VOICE_INWORLD,
          modelId: TTS_MODEL_INWORLD,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Inworld TTS ${res.status}: ${errText.substring(0, 200)}`)
      }

      const data = await res.json() as Record<string, unknown>
      const audioContent = data.audioContent as string | undefined
      if (!audioContent) throw new Error('No audio content in Inworld response')

      const audioBuffer = Buffer.from(audioContent, 'base64')
      console.info('[VoicePipeline-v2] Inworld TTS chunk', { bytes: audioBuffer.length })

      for (let offset = 0; offset < audioBuffer.length; offset += TTS_CHUNK_SIZE) {
        if (cancelled) return
        onTTSChunk?.(audioBuffer.subarray(offset, offset + TTS_CHUNK_SIZE).toString('base64'))
      }
    }
  }

  // ------------------------------------------------------------------
  // Deepgram TTS (Aura — fallback TTS provider)
  // ------------------------------------------------------------------
  async function deepgramTTS(text: string): Promise<void> {
    if (cancelled) return

    const params = new URLSearchParams({
      model: TTS_MODEL_DEEPGRAM,
      encoding: 'linear16',
      sample_rate: String(SAMPLE_RATE),
    })

    const res = await fetch(`${DEEPGRAM_TTS_URL}?${params}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${deepgramKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Deepgram TTS error ${res.status}: ${errText}`)
    }

    const audioArrayBuffer = await res.arrayBuffer()
    const audioBuffer = Buffer.from(audioArrayBuffer)

    console.info('[VoicePipeline-v2] Deepgram TTS fallback', { bytes: audioBuffer.length })

    for (let offset = 0; offset < audioBuffer.length; offset += TTS_CHUNK_SIZE) {
      if (cancelled) break
      const chunk = audioBuffer.subarray(offset, offset + TTS_CHUNK_SIZE)
      onTTSChunk?.(chunk.toString('base64'))
    }
  }

  // ------------------------------------------------------------------
  // TTS dispatcher — Inworld primary, Deepgram fallback
  // ------------------------------------------------------------------
  async function textToSpeech(text: string): Promise<void> {
    if (cancelled) return

    if (inworldKey) {
      try {
        await inworldTTS(text)
        return
      } catch (error) {
        console.warn('[VoicePipeline-v2] Inworld TTS failed, falling back to Deepgram:',
          error instanceof Error ? error.message : error)
      }
    } else {
      console.warn('[VoicePipeline-v2] No INWORLD_API_KEY — using Deepgram TTS directly')
    }

    // Fallback to Deepgram Aura
    try {
      await deepgramTTS(text)
    } catch (error) {
      console.error('[VoicePipeline-v2] TTS error (both providers failed):', error)
      onError?.(error instanceof Error ? error : new Error(String(error)))
    }
  }

  // ------------------------------------------------------------------
  // Process buffered audio: STT → LLM → TTS
  // ------------------------------------------------------------------
  async function processAudio(): Promise<void> {
    if (audioChunks.length === 0) return

    const totalLength = audioChunks.reduce((acc, buf) => acc + buf.length, 0)
    if (totalLength === 0) return

    const merged = Buffer.concat(audioChunks)
    audioChunks = []
    cancelled = false

    // Step 1: Speech-to-Text
    const transcript = await speechToText(merged)
    if (!transcript.trim()) {
      console.info('[VoicePipeline-v2] Empty transcript, skipping')
      onNoSpeech?.()
      return
    }

    onTranscriptFinal?.(transcript)

    // Step 2: LLM (Go backend RAG)
    onAgentTextPartial?.('Thinking...')
    let answer = await queryLLM(transcript)

    // BUG-033: fallback when LLM returns empty string
    if (!answer.trim()) {
      answer = "I don't have any documents to answer that question yet. Try uploading a document first."
    }

    if (cancelled) return
    onAgentTextFinal?.(answer)

    // Step 3: Text-to-Speech
    if (answer && !cancelled) {
      await textToSpeech(answer)
    }

    console.info('[VoicePipeline-v2] Pipeline complete (processAudio)')
    onSpeakingComplete?.()
  }

  // ------------------------------------------------------------------
  // Process direct text input: LLM → TTS
  // ------------------------------------------------------------------
  async function processText(text: string): Promise<void> {
    cancelled = false

    onAgentTextPartial?.('Thinking...')
    let answer = await queryLLM(text)

    // BUG-033: fallback when LLM returns empty string
    if (!answer.trim()) {
      answer = "I don't have any documents to answer that question yet. Try uploading a document first."
    }

    if (cancelled) return
    onAgentTextFinal?.(answer)

    if (answer && !cancelled) {
      await textToSpeech(answer)
    }

    console.info('[VoicePipeline-v2] Pipeline complete (processText)')
    onSpeakingComplete?.()
  }

  console.info('[VoicePipeline-v2] Session created', {
    tts: inworldKey ? 'inworld+deepgram-fallback' : 'deepgram-only',
  })

  return {
    async sendAudio(pcmBuffer: Buffer): Promise<void> {
      if (!isActive) return
      audioChunks.push(Buffer.from(pcmBuffer))
    },

    async startAudioSession(): Promise<void> {
      console.info('[VoicePipeline-v2] Audio session start')
      isActive = true
      audioChunks = []
      cancelled = false
    },

    async endAudioSession(): Promise<void> {
      console.info('[VoicePipeline-v2] Audio session end')
      isActive = false
      await processAudio()
    },

    async cancelResponse(): Promise<void> {
      console.info('[VoicePipeline-v2] Cancelling response')
      cancelled = true
      audioChunks = []
    },

    async sendText(text: string): Promise<void> {
      console.info('[VoicePipeline-v2] Sending text', { preview: text.substring(0, 80) })
      await processText(text)
    },

    async triggerGreeting(): Promise<void> {
      console.info('[VoicePipeline-v2] Triggering greeting')

      // Fetch agent config (best-effort — falls back to defaults)
      let agentName = 'Mercury'
      let greeting = "Hello, I'm Mercury. How can I help you today?"
      try {
        const res = await fetch(`${goBackendUrl}/api/mercury/config`, {
          headers: {
            'X-Internal-Auth': internalAuth,
            'X-User-ID': toolContext.userId || 'anonymous',
          },
        })
        if (res.ok) {
          const cfg = await res.json() as { name?: string; greeting?: string }
          if (cfg.name) agentName = cfg.name
          if (cfg.greeting) {
            greeting = cfg.greeting
          } else {
            greeting = `Hello, I'm ${agentName}. How can I help you today?`
          }
        }
      } catch {
        // Config endpoint unavailable — use defaults
      }

      console.info('[VoicePipeline-v2] Greeting:', greeting)
      conversationHistory.push({ role: 'assistant', content: greeting })
      onAgentTextPartial?.(greeting)
      onAgentTextFinal?.(greeting)
      await textToSpeech(greeting)

      console.info('[VoicePipeline-v2] Greeting TTS complete')
      onSpeakingComplete?.()
    },

    close(): void {
      console.info('[VoicePipeline-v2] Closing session')
      isActive = false
      cancelled = true
      audioChunks = []
      onDisconnect?.()
    },
  }
}
