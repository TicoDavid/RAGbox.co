/**
 * Voice Pipeline — Deepgram STT + Go Backend LLM + Deepgram TTS
 *
 * Replaces the Inworld Graph Runtime pipeline which has non-functional TTS.
 * Same session interface so agent-ws.ts can swap with minimal changes.
 *
 * Flow:
 *   Browser mic → PCM Int16 → WebSocket → Deepgram STT → Go backend /api/chat
 *   → LLM answer → Deepgram TTS → PCM Int16 → WebSocket → Browser speaker
 */

import { executeTool, type ToolContext, type ToolResult, TOOL_DEFINITIONS } from './tools'

// ============================================================================
// TYPES (mirrors InworldSession interface)
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
  onError?: (error: Error) => void
  onDisconnect?: () => void
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SAMPLE_RATE = 48000
const DEEPGRAM_STT_URL = 'https://api.deepgram.com/v1/listen'
const DEEPGRAM_TTS_URL = 'https://api.deepgram.com/v1/speak'
const TTS_MODEL = 'aura-asteria-en'
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
    onError,
    onDisconnect,
  } = config

  const deepgramKey = process.env.DEEPGRAM_API_KEY
  if (!deepgramKey) {
    throw new Error('Missing DEEPGRAM_API_KEY environment variable')
  }

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
  // ------------------------------------------------------------------
  async function speechToText(pcmBuffer: Buffer): Promise<string> {
    try {
      console.log(`[VoicePipeline] STT: sending ${pcmBuffer.length} bytes`)

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
      console.log(`[VoicePipeline] STT transcript: "${transcript}"`)
      return transcript
    } catch (error) {
      console.error('[VoicePipeline] STT error:', error)
      onError?.(error instanceof Error ? error : new Error(String(error)))
      return ''
    }
  }

  // ------------------------------------------------------------------
  // Go Backend LLM (RAG pipeline — same as Mercury text chat)
  // ------------------------------------------------------------------
  async function queryLLM(text: string): Promise<string> {
    try {
      console.log(`[VoicePipeline] LLM: querying "${text.substring(0, 80)}..."`)

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

      // The Go backend may return SSE format (event: ...\ndata: ...\n\n)
      // or plain JSON depending on configuration. Handle both.
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
        // SSE format: event type on `event:` line, payload on `data:` line
        // Example:
        //   event: token
        //   data: {"text":"Hello "}
        //
        //   event: done
        //   data: {}
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
                // Raw text fallback
                if (dataStr !== '[DONE]') tokens.push(dataStr)
              }
            } else if (currentEventType === 'done') {
              // done event — finalize with collected tokens
              if (!answer) answer = tokens.join('')
            }
            // Ignore status, citations, confidence events for voice output
            currentEventType = ''
          }
        }
        if (!answer) answer = tokens.join('')
      }

      console.log(`[VoicePipeline] LLM answer: "${answer.substring(0, 80)}..."`)

      // Add assistant response to history
      conversationHistory.push({ role: 'assistant', content: answer })

      return answer
    } catch (error) {
      console.error('[VoicePipeline] LLM error:', error)
      onError?.(error instanceof Error ? error : new Error(String(error)))
      return "I'm sorry, I couldn't process that request. Please try again."
    }
  }

  // ------------------------------------------------------------------
  // Deepgram TTS (Aura — send text, get PCM audio back)
  // ------------------------------------------------------------------
  async function textToSpeech(text: string): Promise<void> {
    if (cancelled) return

    try {
      console.log(`[VoicePipeline] TTS: converting "${text.substring(0, 50)}..."`)

      const params = new URLSearchParams({
        model: TTS_MODEL,
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

      // Read entire response as ArrayBuffer then chunk it
      const audioArrayBuffer = await res.arrayBuffer()
      const audioBuffer = Buffer.from(audioArrayBuffer)

      console.log(`[VoicePipeline] TTS: received ${audioBuffer.length} bytes of audio`)

      // Send in chunks to avoid oversized WebSocket frames
      for (let offset = 0; offset < audioBuffer.length; offset += TTS_CHUNK_SIZE) {
        if (cancelled) break
        const chunk = audioBuffer.subarray(offset, offset + TTS_CHUNK_SIZE)
        onTTSChunk?.(chunk.toString('base64'))
      }
    } catch (error) {
      console.error('[VoicePipeline] TTS error:', error)
      onError?.(error instanceof Error ? error : new Error(String(error)))
    }
  }

  // ------------------------------------------------------------------
  // Process buffered audio: STT → LLM → TTS
  // ------------------------------------------------------------------
  async function processAudio(): Promise<void> {
    if (audioChunks.length === 0) return

    // Merge all audio chunks into one buffer
    const totalLength = audioChunks.reduce((acc, buf) => acc + buf.length, 0)
    if (totalLength === 0) return

    const merged = Buffer.concat(audioChunks)
    audioChunks = []
    cancelled = false

    // Step 1: Speech-to-Text
    const transcript = await speechToText(merged)
    if (!transcript.trim()) {
      console.log('[VoicePipeline] Empty transcript — skipping')
      return
    }

    onTranscriptFinal?.(transcript)

    // Step 2: LLM (Go backend RAG)
    onAgentTextPartial?.('Thinking...')
    const answer = await queryLLM(transcript)

    if (cancelled) return
    onAgentTextFinal?.(answer)

    // Step 3: Text-to-Speech
    if (answer && !cancelled) {
      await textToSpeech(answer)
    }
  }

  // ------------------------------------------------------------------
  // Process direct text input: LLM → TTS
  // ------------------------------------------------------------------
  async function processText(text: string): Promise<void> {
    cancelled = false

    onAgentTextPartial?.('Thinking...')
    const answer = await queryLLM(text)

    if (cancelled) return
    onAgentTextFinal?.(answer)

    if (answer && !cancelled) {
      await textToSpeech(answer)
    }
  }

  console.log('[VoicePipeline] Session created (Deepgram STT + Go Backend + Deepgram TTS)')

  return {
    async sendAudio(pcmBuffer: Buffer): Promise<void> {
      if (!isActive) return
      audioChunks.push(Buffer.from(pcmBuffer))
    },

    async startAudioSession(): Promise<void> {
      console.log('[VoicePipeline] Starting audio session')
      isActive = true
      audioChunks = []
      cancelled = false
    },

    async endAudioSession(): Promise<void> {
      console.log('[VoicePipeline] Ending audio session')
      isActive = false
      await processAudio()
    },

    async cancelResponse(): Promise<void> {
      console.log('[VoicePipeline] Cancelling response')
      cancelled = true
      audioChunks = []
    },

    async sendText(text: string): Promise<void> {
      console.log('[VoicePipeline] Sending text:', text)
      await processText(text)
    },

    async triggerGreeting(): Promise<void> {
      const greeting = 'Hello! Welcome to RAGbox. How may I assist you today?'
      console.log('[VoicePipeline] Triggering greeting')

      conversationHistory.push({ role: 'assistant', content: greeting })
      onAgentTextFinal?.(greeting)
      await textToSpeech(greeting)
    },

    close(): void {
      console.log('[VoicePipeline] Closing session')
      isActive = false
      cancelled = true
      audioChunks = []
      onDisconnect?.()
    },
  }
}
