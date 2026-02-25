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

// Convert Float32 PCM (from Inworld TTS) to Int16 PCM (for browser playback)
function float32ToInt16Base64(float32Base64: string): string {
  const buffer = Buffer.from(float32Base64, 'base64')
  const float32 = new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.length / 4
  )
  const int16 = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i++) {
    const sample = Math.max(-1, Math.min(1, float32[i]))
    int16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
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

      console.info('[VoicePipeline-v3] LLM answer', { preview: answer.substring(0, 100) })

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
      console.info('[VoicePipeline-v3] TTS request', { preview: text.substring(0, 50) })

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

      const { outputStream } = await ttsGraph.start(text)

      for await (const result of outputStream) {
        await result.processResponse({
          default: async (output: unknown) => {
            const ttsOutput = output as { audio?: { data?: string } }
            if (ttsOutput.audio?.data) {
              const int16Base64 = float32ToInt16Base64(ttsOutput.audio.data)
              onTTSChunk?.(int16Base64)
            }
          },
          error: (error: GraphTypes.GraphError) => {
            console.error('[VoicePipeline-v3] TTS Error:', error.message)
            onError?.(new Error(error.message))
          },
        })
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
