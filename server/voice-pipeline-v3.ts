/**
 * Voice Pipeline v3 — Hybrid: Inworld STT + TTS, Go Backend LLM
 *
 * BUG-038: Mercury voice hybrid v3.
 * - STT: Inworld RemoteSTTNode (proven, no format issues)
 * - LLM: Go backend /api/chat (AEGIS + RAG + persona + model routing)
 * - TTS: Inworld RemoteTTSNode + RemoteTTSComponent (proven)
 *
 * Based on server/inworld.ts with processWithLLM() rewritten to call
 * the Go backend instead of the Inworld GPT-4o-mini proxy.
 */

import 'dotenv/config'
import {
  GraphBuilder,
  GraphTypes,
  RemoteSTTNode,
  RemoteTTSNode,
  RemoteTTSComponent,
} from '@inworld/runtime/graph'
import { TOOL_DEFINITIONS, executeTool, type ToolContext, type ToolCall } from './tools'

// ============================================================================
// TYPES
// ============================================================================

export interface VoiceSessionConfig {
  toolContext?: ToolContext
  onTranscriptPartial?: (text: string) => void
  onTranscriptFinal?: (text: string) => void
  onAgentTextPartial?: (text: string) => void
  onAgentTextFinal?: (text: string) => void
  onTTSChunk?: (audioBase64: string) => void
  onToolCall?: (toolName: string, args: Record<string, unknown>) => void
  onToolResult?: (toolName: string, result: unknown) => void
  onUIAction?: (action: unknown) => void
  onNoSpeech?: () => void
  onSpeakingComplete?: () => void
  onError?: (error: Error) => void
  onDisconnect?: () => void
}

interface MercuryConfig {
  name?: string
  greeting?: string
  personalityPrompt?: string
}

export interface VoiceSession {
  sendAudio: (pcmBuffer: Buffer) => Promise<void>
  startAudioSession: () => Promise<void>
  endAudioSession: () => Promise<void>
  cancelResponse: () => Promise<void>
  sendText: (text: string) => Promise<void>
  triggerGreeting: () => Promise<void>
  close: () => void
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Audio format contract (must match browser AudioContext):
 *
 * Browser -> Server:  PCM Int16 (s16le), 48 kHz, mono
 * Server internal:    Float32 (Inworld Runtime native format)
 * Server -> Browser:  PCM Int16 (s16le), 48 kHz, mono
 */
const SAMPLE_RATE = 48000
const DEFAULT_TTS_MODEL_ID = 'inworld-tts-1-max'
const DEFAULT_VOICE_ID = 'Ashley'
const DEFAULT_GREETING = "Hello, I'm Mercury. How can I help you today?"

// BUG-042 Bug B: Grounding refusal patterns — RAG returns these when it can't
// find relevant documents. Mercury should respond conversationally instead.
// The user should NEVER hear a grounding refusal through the voice pipeline.
const GROUNDING_REFUSAL_PATTERNS = [
  'cannot provide a sufficiently grounded',
  'don\'t have enough information in the available documents',
  'not found in the available documents',
  'i don\'t have any documents',
  'no relevant documents',
  'unable to find relevant information',
  'i could not find',
  'no documents were found',
  'i don\'t have access to any documents',
  'based on the available documents, i cannot',
  'insufficient context to provide',
  'silence_protocol',
]

/**
 * Deterministic pick from response options based on query content.
 * Provides variety across different queries without randomness
 * (which would make testing non-deterministic).
 */
function pickResponse(options: string[], seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  }
  return options[Math.abs(hash) % options.length]
}

/**
 * BUG-042 Bug B: Detect and replace RAG grounding refusals with
 * a natural conversational response using the agent's persona.
 *
 * When AEGIS RAG triggers Silence Protocol (zero matching documents)
 * or returns a low-confidence refusal, this interceptor catches it
 * and returns a natural persona-driven response instead.
 */
export function interceptGroundingRefusal(
  response: string,
  userQuery: string,
  agentName: string,
): string {
  const lower = response.toLowerCase().trim()

  // Empty or very short responses are treated as refusals
  const isRefusal = lower.length < 5
    || GROUNDING_REFUSAL_PATTERNS.some(p => lower.includes(p))

  if (!isRefusal) return response

  console.info('[VoicePipeline-v3] RAG grounding refusal intercepted', {
    refusalPreview: response.substring(0, 80),
    queryPreview: userQuery.substring(0, 80),
    agentName,
  })

  const q = userQuery.toLowerCase().trim()

  // Greeting patterns (word-boundary, not start-anchored)
  if (/\b(hi|hello|hey|howdy|greetings|good\s*(morning|afternoon|evening)|what'?s\s*up)\b/i.test(q)) {
    return pickResponse([
      `Hello! I'm ${agentName}, your AI assistant. I can help you search and analyze your documents, answer questions about your files, or just chat. What would you like to do?`,
      `Hey there! ${agentName} here. I'm ready to help you with your documents or answer any questions. What's on your mind?`,
      `Hi! I'm ${agentName}. I can search through your documents, answer questions, or just have a conversation. How can I help?`,
    ], q)
  }

  // Self-referential / identity questions
  if (/\b(who are you|what are you|tell me about yourself|what can you do|what do you do|your name|introduce yourself)\b/i.test(q)) {
    return `I'm ${agentName}, the AI assistant for RAGbox. I can search through your documents, answer questions based on your uploaded files, help you find specific information, and have a conversation. Try asking me about something in your vault!`
  }

  // How are you / feelings / small talk
  if (/\b(how are you|how'?s it going|what'?s new|how do you feel|are you okay|you doing)\b/i.test(q)) {
    return pickResponse([
      `I'm doing great, thanks for asking! I'm ready to help you with your documents and questions. What can I assist you with?`,
      `All good here! I'm ${agentName}, ready and waiting. What would you like to know about your documents?`,
    ], q)
  }

  // Thank you / gratitude
  if (/\b(thank you|thanks|appreciate it|grateful)\b/i.test(q)) {
    return pickResponse([
      `You're welcome! Let me know if there's anything else I can help with.`,
      `Happy to help! Is there anything else you'd like to know?`,
    ], q)
  }

  // Goodbye / farewell
  if (/\b(goodbye|bye|see you|talk later|that'?s all|i'?m done|signing off)\b/i.test(q)) {
    return pickResponse([
      `Goodbye! Feel free to come back anytime you need help with your documents.`,
      `See you later! I'll be here whenever you need me.`,
    ], q)
  }

  // Help / capabilities
  if (/\b(help me|can you help|what can i ask|how does this work|what should i ask)\b/i.test(q)) {
    return `I can help you in several ways! Ask me about the contents of your uploaded documents, search for specific information, get summaries, or compare documents. You can also just chat with me. What would you like to try?`
  }

  // Default conversational fallback
  return pickResponse([
    `That's an interesting question, but I don't have a specific document about it. I can help you search through your uploaded files, or you can ask me something else. What would you like to know?`,
    `I don't have a document that covers that topic, but I'm happy to help! Try asking about something in your vault, or rephrase your question.`,
    `I couldn't find that in your documents, but I'm here to help. Want to ask about something specific in your files?`,
  ], q)
}

// Go backend for LLM + Mercury config
const GO_BACKEND_URL = process.env.GO_BACKEND_URL
  || process.env.NEXT_PUBLIC_API_URL
  || 'http://localhost:8080'
const INTERNAL_AUTH = process.env.INTERNAL_AUTH_SECRET || ''

/**
 * Fetch Mercury persona config from Go backend (best-effort).
 * Returns defaults if the endpoint is unavailable.
 */
async function fetchMercuryConfig(userId: string): Promise<MercuryConfig> {
  try {
    const res = await fetch(`${GO_BACKEND_URL}/api/mercury/config`, {
      headers: {
        'X-Internal-Auth': INTERNAL_AUTH,
        'X-User-ID': userId,
      },
    })
    if (res.ok) {
      const json = await res.json() as {
        name?: string
        greeting?: string
        personalityPrompt?: string
        data?: {
          config?: {
            name?: string
            greeting?: string
            personalityPrompt?: string
          }
        }
      }
      const cfg = json.data?.config ?? json
      return {
        name: cfg.name || undefined,
        greeting: cfg.greeting || undefined,
        personalityPrompt: cfg.personalityPrompt || undefined,
      }
    }
  } catch {
    console.warn('[VoicePipeline-v3] Mercury config fetch failed, using defaults')
  }
  return {}
}

// Convert Float32 PCM samples (number[] from Inworld SDK) to Int16 PCM base64
// for browser playback. Inworld TTSOutputStream yields chunks with audio.data
// as Float32 samples in [-1.0, 1.0] range. Browser AudioContext expects Int16 PCM.
function float32SamplesToInt16Base64(samples: ArrayLike<number>): string {
  const int16 = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }
  return Buffer.from(int16.buffer).toString('base64')
}

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

  // Inworld API key — required for STT + TTS graphs
  const apiKey = process.env.INWORLD_API_KEY
  if (!apiKey) {
    throw new Error('Missing INWORLD_API_KEY — required for STT + TTS')
  }

  let isActive = false
  let audioBuffer: Float32Array[] = []

  // Fetch Mercury persona config (best-effort, falls back to defaults)
  const mercuryConfig = await fetchMercuryConfig(toolContext?.userId || 'anonymous')
  const agentName = mercuryConfig.name || 'Mercury'

  // Build tool descriptions for system context (sent to Go backend via history)
  const toolDescriptions = TOOL_DEFINITIONS.map(t => {
    const params = Object.entries(t.parameters)
      .map(([k, v]) => `  - ${k}: ${v.description}${v.required ? ' (required)' : ''}`)
      .join('\n')
    return `**${t.name}**: ${t.description}${params ? '\n' + params : ''}`
  }).join('\n\n')

  const systemPrompt = `You are ${agentName}, the Virtual Representative (V-Rep) for RAGbox.co.

Keep responses concise and professional - you are speaking aloud, so be conversational but precise.
After using a tool, explain the results naturally in spoken language.

## Available Tools
When you need to access documents or perform actions, use these tools by outputting a JSON block:

\`\`\`tool
{"name": "tool_name", "arguments": {"arg1": "value1"}}
\`\`\`

${toolDescriptions}

Current user context:
- User ID: ${toolContext?.userId || 'unknown'}
- Role: ${toolContext?.role || 'User'}
- Privilege Mode: ${toolContext?.privilegeMode ? 'ENABLED' : 'disabled'}`

  let conversationHistory: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
  ]

  // Create TTS component
  const ttsComponent = new RemoteTTSComponent({
    id: 'tts_component',
    synthesisConfig: {
      type: 'inworld',
      config: {
        modelId: DEFAULT_TTS_MODEL_ID,
        inference: {
          temperature: 0.8,
          speakingRate: 1.0,
        },
        postprocessing: {
          sampleRate: SAMPLE_RATE,
        },
      },
    },
  })

  // Parse tool calls from response
  function parseToolCalls(text: string): { toolCall: { name: string; arguments: Record<string, unknown> } | null; cleanText: string } {
    const toolPattern = /```tool\s*\n?([\s\S]*?)\n?```/g
    const match = toolPattern.exec(text)

    if (match) {
      try {
        const toolCall = JSON.parse(match[1].trim())
        const cleanText = text.replace(toolPattern, '').trim()
        return { toolCall, cleanText }
      } catch (e) {
        console.error('[VoicePipeline-v3] Failed to parse tool call:', e)
      }
    }

    return { toolCall: null, cleanText: text }
  }

  // Execute a tool and return result
  async function executeToolCall(name: string, args: Record<string, unknown>): Promise<string> {
    if (!toolContext) {
      return 'Error: No user context available for tool execution'
    }

    console.info('[VoicePipeline-v3] Executing tool', { name, args })
    onToolCall?.(name, args)

    try {
      const call: ToolCall = {
        id: `tool_${Date.now()}`,
        name,
        arguments: args,
      }

      const result = await executeTool(call, toolContext)
      onToolResult?.(name, result)

      if (result.uiAction) {
        onUIAction?.(result.uiAction)
      }

      if (result.success) {
        return JSON.stringify(result.result, null, 2)
      } else {
        return `Error: ${result.error}`
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      return `Error executing tool: ${errorMsg}`
    }
  }

  // ==========================================================================
  // LLM: Go Backend /api/chat (replaces Inworld GPT-4o-mini proxy)
  // ==========================================================================

  async function processWithLLM(userText: string, isToolResult = false): Promise<void> {
    try {
      console.info('[VoicePipeline-v3] Processing', {
        type: isToolResult ? 'tool_result' : 'user_message',
        preview: userText.substring(0, 100),
      })

      if (!isToolResult) {
        onTranscriptFinal?.(userText)
        conversationHistory.push({ role: 'user', content: userText })
      } else {
        conversationHistory.push({ role: 'user', content: `[Tool Result]\n${userText}` })
      }

      // Call Go backend /api/chat directly
      const res = await fetch(`${GO_BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Auth': INTERNAL_AUTH,
          'X-User-ID': toolContext?.userId || 'anonymous',
        },
        body: JSON.stringify({
          query: userText,
          stream: false,
          privilegeMode: toolContext?.privilegeMode || false,
          maxTier: 3,
          persona: 'mercury',
          history: conversationHistory.slice(-10), // last 10 turns
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Backend error ${res.status}: ${errText.substring(0, 200)}`)
      }

      // Go backend returns SSE (text/event-stream). Parse to extract answer.
      const rawText = await res.text()
      let answer = ''

      if (rawText.startsWith('{')) {
        // Plain JSON response (future-proofing)
        const data = JSON.parse(rawText) as {
          data?: { answer?: string }
          answer?: string
        }
        answer = data.data?.answer || data.answer || ''
      } else {
        // SSE format — extract tokens and done payload
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
              try {
                const payload = JSON.parse(dataStr) as { message?: string }
                if (payload.message) answer = payload.message
              } catch {
                if (dataStr) answer = dataStr
              }
            } else if (currentEventType === 'done') {
              // Extract answer from done payload
              try {
                const payload = JSON.parse(dataStr) as {
                  data?: { answer?: string }
                  answer?: string
                }
                const d = payload.data ?? payload
                if (typeof d.answer === 'string' && d.answer) answer = d.answer
              } catch { /* ignore */ }
              if (!answer) answer = tokens.join('')
            }
            currentEventType = ''
          }
        }
        if (!answer) answer = tokens.join('')
      }

      // Strip JSON wrapper if model returned structured JSON
      if (answer.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(answer.trim()) as { answer?: string }
          if (typeof parsed.answer === 'string') answer = parsed.answer
        } catch { /* not JSON, use as-is */ }
      }

      if (!answer) {
        answer = "I'm sorry, I couldn't process that request. Please try again."
      }

      console.info('[VoicePipeline-v3] LLM answer', { chars: answer.length, preview: answer.substring(0, 100) })

      // BUG-042 Bug B: Intercept grounding refusals before TTS
      answer = interceptGroundingRefusal(answer, userText, agentName)

      // Check for tool calls in response
      const { toolCall, cleanText } = parseToolCalls(answer)

      if (toolCall) {
        console.info('[VoicePipeline-v3] Tool call detected', { name: toolCall.name })
        conversationHistory.push({ role: 'assistant', content: answer })

        const toolResult = await executeToolCall(toolCall.name, toolCall.arguments)
        await processWithLLM(toolResult, true)
        return
      }

      onAgentTextFinal?.(cleanText)
      conversationHistory.push({ role: 'assistant', content: answer })

      // Convert to speech (strip tool markup before TTS)
      if (cleanText) {
        await textToSpeech(cleanText)
      }
    } catch (error) {
      console.error('[VoicePipeline-v3] Processing error:', error)
      onError?.(error instanceof Error ? error : new Error(String(error)))
    }
  }

  // ==========================================================================
  // TTS: Inworld RemoteTTSNode (unchanged from inworld.ts)
  // ==========================================================================

  async function textToSpeech(text: string): Promise<void> {
    try {
      console.info('[VoicePipeline-v3] TTS request', { chars: text.length, preview: text.substring(0, 50) })

      const ttsNode = new RemoteTTSNode({
        ttsComponent,
        speakerId: DEFAULT_VOICE_ID,
        languageCode: 'en-US',
        modelId: DEFAULT_TTS_MODEL_ID,
      })

      const ttsGraph = new GraphBuilder({
        id: 'tts_graph',
        apiKey,
        enableRemoteConfig: false,
      })
        .addComponent(ttsComponent)
        .addNode(ttsNode)
        .setStartNode(ttsNode)
        .setEndNode(ttsNode)
        .build()

      // BUG-042 FIX: Use TTSRequest wrapper per SDK docs
      const ttsInput = GraphTypes.TTSRequest.withText(text)
      const { outputStream } = await ttsGraph.start(ttsInput)

      console.info('[VoicePipeline-v3] TTS graph started, awaiting audio stream')

      let chunkCount = 0
      let totalBytes = 0

      for await (const result of outputStream) {
        await result.processResponse({
          // BUG-042 FIX: Use TTSOutputStream handler — NOT 'default'.
          // The Inworld SDK visitor pattern requires the exact type name.
          // 'default' received the TTSOutputStream object but never iterated
          // it, so .audio.data was always undefined → zero audio chunks.
          // TTSOutputStream is itself an async iterator yielding individual
          // audio chunks that must be consumed with a nested for-await loop.
          TTSOutputStream: async (ttsStream) => {
            console.info('[VoicePipeline-v3] TTSOutputStream handler entered')
            for await (const chunk of ttsStream) {
              if (chunk.audio?.data) {
                const audioData = chunk.audio.data as ArrayLike<number>
                const int16Base64 = float32SamplesToInt16Base64(audioData)
                chunkCount++
                totalBytes += int16Base64.length
                console.info(`[VoicePipeline-v3] TTS chunk ${chunkCount} sent`, {
                  samples: audioData.length,
                  bytes: int16Base64.length,
                })
                onTTSChunk?.(int16Base64)
              }
            }
          },
          error: (error: GraphTypes.GraphError) => {
            console.error('[VoicePipeline-v3] TTS graph error:', error.message)
            onError?.(new Error(error.message))
          },
        })
      }

      console.info(`[VoicePipeline-v3] TTS complete, ${chunkCount} chunks delivered`, { totalBytes })

      if (chunkCount === 0) {
        console.warn('[VoicePipeline-v3] TTS produced zero audio chunks — Inworld API may have returned empty')
      }
    } catch (error) {
      console.error('[VoicePipeline-v3] TTS error:', error)
      onError?.(error instanceof Error ? error : new Error(String(error)))
    }
  }

  // ==========================================================================
  // STT: Inworld RemoteSTTNode (unchanged from inworld.ts)
  // ==========================================================================

  async function processAudio(): Promise<void> {
    if (audioBuffer.length === 0) return

    try {
      console.info('[VoicePipeline-v3] Processing audio buffer')

      // Merge audio buffers
      const totalLength = audioBuffer.reduce((acc, buf) => acc + buf.length, 0)
      const mergedAudio = new Float32Array(totalLength)
      let offset = 0
      for (const buf of audioBuffer) {
        mergedAudio.set(buf, offset)
        offset += buf.length
      }
      audioBuffer = []

      // Create STT node
      const sttNode = new RemoteSTTNode({
        sttConfig: {
          languageCode: 'en-US',
        },
      })

      const sttGraph = new GraphBuilder({
        id: 'stt_graph',
        apiKey,
        enableRemoteConfig: false,
      })
        .addNode(sttNode)
        .setStartNode(sttNode)
        .setEndNode(sttNode)
        .build()

      const { outputStream } = await sttGraph.start(
        new GraphTypes.Audio({
          data: Array.from(mergedAudio),
          sampleRate: SAMPLE_RATE,
        })
      )

      let transcription = ''

      for await (const result of outputStream) {
        await result.processResponse({
          string: (text: string) => {
            transcription += text
          },
          TextStream: async (stream: any) => {
            for await (const chunk of stream) {
              if (chunk.text) {
                transcription += chunk.text
                onTranscriptPartial?.(transcription)
              }
            }
          },
          error: (error: GraphTypes.GraphError) => {
            console.error('[VoicePipeline-v3] STT Error:', error.message)
            onError?.(new Error(error.message))
          },
        })
      }

      if (transcription.trim()) {
        console.info('[VoicePipeline-v3] Transcription', { transcription })
        await processWithLLM(transcription)
        onSpeakingComplete?.()
      } else {
        console.info('[VoicePipeline-v3] No speech detected')
        onNoSpeech?.()
      }
    } catch (error) {
      console.error('[VoicePipeline-v3] STT error:', error)
      onError?.(error instanceof Error ? error : new Error(String(error)))
    }
  }

  // ==========================================================================
  // SESSION INTERFACE
  // ==========================================================================

  console.info('[VoicePipeline-v3] Session created', { agentName })

  return {
    async sendAudio(pcmBuffer: Buffer): Promise<void> {
      if (!isActive) return

      // Convert PCM s16le to Float32 (Inworld native)
      const int16Array = new Int16Array(
        pcmBuffer.buffer,
        pcmBuffer.byteOffset,
        pcmBuffer.length / 2
      )
      const float32Array = new Float32Array(int16Array.length)
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0
      }
      audioBuffer.push(float32Array)
    },

    async startAudioSession(): Promise<void> {
      console.info('[VoicePipeline-v3] Audio session start')
      isActive = true
      audioBuffer = []
    },

    async endAudioSession(): Promise<void> {
      console.info('[VoicePipeline-v3] Audio session end')
      isActive = false
      await processAudio()
    },

    async cancelResponse(): Promise<void> {
      console.info('[VoicePipeline-v3] Cancelling response')
      audioBuffer = []
    },

    async sendText(text: string): Promise<void> {
      console.info('[VoicePipeline-v3] Sending text', { preview: text.substring(0, 80) })
      await processWithLLM(text)
      onSpeakingComplete?.()
    },

    async triggerGreeting(): Promise<void> {
      let greeting: string
      if (mercuryConfig.greeting) {
        greeting = mercuryConfig.greeting
      } else if (agentName !== 'Mercury') {
        greeting = `Hello, I'm ${agentName}. How can I help you today?`
      } else {
        greeting = DEFAULT_GREETING
      }
      console.info('[VoicePipeline-v3] Triggering greeting', { agentName })

      conversationHistory.push({ role: 'assistant', content: greeting })
      onAgentTextFinal?.(greeting)
      await textToSpeech(greeting)
      onSpeakingComplete?.()
    },

    close(): void {
      console.info('[VoicePipeline-v3] Closing session')
      isActive = false
      audioBuffer = []
      onDisconnect?.()
    },
  }
}
