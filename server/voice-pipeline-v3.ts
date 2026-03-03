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
import { PrismaClient } from '@prisma/client'
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
  onTTSChunk?: (pcmBuffer: Buffer) => void
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
  voiceId?: string
  greeting?: string
  personalityPrompt?: string  // free-text custom instructions for persona
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
 * Audio format contract:
 *
 * Browser -> Server:  PCM Int16 (s16le), 48 kHz, mono
 * Server internal:    Float32 (Inworld Runtime native format)
 * Server -> Browser:  Float32 PCM, 48 kHz, mono (raw Buffer from Inworld SDK)
 */
const SAMPLE_RATE = 48000
const DEFAULT_TTS_MODEL_ID = 'inworld-tts-1-max'
const DEFAULT_VOICE_ID = 'Ashley'
const DEFAULT_GREETING = "Hello! How can I help you today?"

// ============================================================================
// EPIC-023 / BUG-046: Two-mode query classification
// ============================================================================

// BUG-046: Conversational patterns — ONLY pure greetings and small talk
// bypass RAG. Everything else goes through the document pipeline.
// CPO directive: "She is the same as the chat window but uses her voice."
const CONVERSATIONAL_PATTERNS = [
  // Pure greetings (must be the whole utterance, not embedded in a longer query)
  /^(hi|hello|hey|howdy|greetings|good\s+(morning|afternoon|evening))[\s!?.]*$/,
  /^(how are you|how's it going|what's up)[\s!?.]*$/,
  // Acknowledgments and farewells (short utterances)
  /^(thank(s| you)|bye|goodbye|see you|take care)[\s!?.]*$/,
  /^(yes|no|ok|okay|sure|great|got it|perfect|awesome|cool|nice|right)[\s!?.]*$/,
  // Audio checks (can appear mid-sentence)
  /\b(can you hear|hear me|testing|is this working|are you there)\b/,
  // Identity questions about Mercury herself
  /\b(who are you|what's your name|what can you do|tell me about yourself|introduce yourself)\b/,
]

/**
 * Classify a voice query as conversational or document-related.
 * BUG-046 FIX: Document is the DEFAULT. Only pure greetings and small talk
 * are conversational. Any ambiguous query goes to RAG — Mercury voice must
 * have the same document access as Mercury text chat.
 */
export function classifyQuery(query: string): 'conversational' | 'document' {
  const q = query.toLowerCase().trim()

  for (const pattern of CONVERSATIONAL_PATTERNS) {
    if (pattern.test(q)) return 'conversational'
  }

  // Everything else → document query (let RAG handle it)
  return 'document'
}

// ============================================================================
// Conversational response generation (EPIC-023)
// ============================================================================

/**
 * Generate a persona-driven conversational response for non-document queries.
 * Used directly for conversational mode and as fallback for grounding refusals.
 */
export function generateConversationalResponse(
  userQuery: string,
  agentName: string,
  personality?: string,
): string {
  const q = userQuery.toLowerCase().trim()

  // Greeting
  if (/\b(hi|hello|hey|howdy|greetings|good\s*(morning|afternoon|evening)|what'?s\s*up)\b/.test(q)) {
    return pickResponse([
      `Hello! I'm ${agentName}. I can help you with your documents or just chat. What's on your mind?`,
      `Hey there! ${agentName} here, ready to help. What can I do for you?`,
      `Hi! I'm ${agentName}. Ask me anything about your documents, or let's just talk.`,
    ], q)
  }

  // Audio check / "can you hear me"
  if (/\b(can you hear|hear me|audio|testing|is this working|are you there)\b/.test(q)) {
    return pickResponse([
      `Yes, I can hear you! I'm ${agentName}. How can I help?`,
      `Loud and clear! ${agentName} here. What would you like to talk about?`,
    ], q)
  }

  // Identity
  if (/\b(who are you|what are you|what'?s your name|what can you do|tell me about yourself|introduce yourself)\b/.test(q)) {
    return `I'm ${agentName}, your AI assistant for RAGbox. I can search your documents, answer questions about your files, or just have a conversation. What would you like to know?`
  }

  // How are you / small talk
  if (/\b(how are you|how'?s it going|what'?s new|how do you feel|are you okay|you doing)\b/.test(q)) {
    return pickResponse([
      `I'm doing great, thanks for asking! What can I help you with?`,
      `All good here! I'm ready whenever you are. What's on your mind?`,
    ], q)
  }

  // Thank you
  if (/\b(thank you|thanks|appreciate it|grateful|thank)\b/.test(q)) {
    return pickResponse([
      `You're welcome! Let me know if there's anything else.`,
      `Happy to help! Anything else on your mind?`,
    ], q)
  }

  // Goodbye
  if (/\b(goodbye|bye|see you|talk later|that'?s all|i'?m done|signing off)\b/.test(q)) {
    return pickResponse([
      `Goodbye! I'll be here whenever you need me.`,
      `See you later! Come back anytime.`,
    ], q)
  }

  // Help / capabilities
  if (/\b(help|what can (i|you)|how do i|how does this)\b/.test(q)) {
    return `I'd love to help! I can search your documents, answer questions about your files, get summaries, or compare documents. You can also just chat with me. What would you like to try?`
  }

  // Feelings / empathy
  if (/\b(frustrated|confused|upset|worried|annoyed|stuck|lost)\b/.test(q)) {
    return pickResponse([
      `I understand that can be frustrating. Let me know what you're working on and I'll do my best to help.`,
      `I'm sorry to hear that. Tell me more about what you need and I'll see how I can assist.`,
    ], q)
  }

  // Opinions
  if (/\b(what do you think|your opinion|do you think|what would you)\b/.test(q)) {
    return `That's a great question! I'm best at helping with your documents, but I'm happy to chat about it. What would you like to explore?`
  }

  // Default conversational fallback
  return pickResponse([
    `I'm happy to chat! If you want to look into your documents, just ask me about any specific topic.`,
    `That's interesting! Want me to search through your documents, or is there something else I can help with?`,
    `I'm here to help! If it's related to your documents, I can search for information. Otherwise, let's keep talking.`,
  ], q)
}

// ============================================================================
// Grounding refusal interceptor (safety net for document queries)
// ============================================================================

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
 * Safety net for document queries that return Silence Protocol.
 * EPIC-023: Now delegates response generation to generateConversationalResponse().
 */
export function interceptGroundingRefusal(
  response: string,
  userQuery: string,
  agentName: string,
): string {
  const lower = response.toLowerCase().trim()

  const isRefusal = lower.length < 5
    || GROUNDING_REFUSAL_PATTERNS.some(p => lower.includes(p))

  if (!isRefusal) return response

  console.info('[VoicePipeline-v3] RAG grounding refusal intercepted', {
    refusalPreview: response.substring(0, 80),
    queryPreview: userQuery.substring(0, 80),
    agentName,
  })

  return generateConversationalResponse(userQuery, agentName)
}

// Go backend for LLM
const GO_BACKEND_URL = process.env.GO_BACKEND_URL
  || process.env.NEXT_PUBLIC_API_URL
  || 'http://localhost:8080'
const INTERNAL_AUTH = process.env.INTERNAL_AUTH_SECRET || ''

// BUG-047: Use Prisma to read MercuryPersona directly from the DB.
// The frontend saves settings to the Prisma MercuryPersona table, so the voice
// pipeline must read from the SAME table. The Go backend has a separate
// mercury_configs table that never receives frontend updates.
const prisma = new PrismaClient()
const DEFAULT_TENANT = 'default'

/**
 * Fetch Mercury persona config from Prisma MercuryPersona table (best-effort).
 * BUG-047 FIX: Reads from the same DB table the frontend Settings modal saves to.
 * Returns defaults if the query fails.
 */
async function fetchMercuryConfig(userId: string): Promise<MercuryConfig> {
  try {
    const persona = await prisma.mercuryPersona.findUnique({
      where: { tenantId: DEFAULT_TENANT },
    })
    if (persona) {
      const name = [persona.firstName, persona.lastName].filter(Boolean).join(' ')
      return {
        name: name || undefined,
        voiceId: persona.voiceId || undefined,
        greeting: persona.greeting || undefined,
        personalityPrompt: persona.personalityPrompt || undefined,
      }
    }
  } catch (err) {
    console.warn('[VoicePipeline-v3] Mercury config fetch failed, using defaults', err)
  }
  return {}
}

// BUG-045B: Inworld SDK's TTSOutputStream stores audio.data as a Buffer
// containing raw Float32 PCM bytes (4 bytes/sample, -1.0 to 1.0 range).
// tts_output.js line 205: Buffer.from(chunk.audio.data, 'base64')
// Audio constructor line 64: this.data = chunk.data  (stores Buffer directly)
// Browser Web Audio API uses Float32 natively — send the bytes directly.
// No conversion needed. Previous Int16 conversion was iterating raw bytes
// (0-255) as if they were float samples, producing only 0s and 32767s.

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
  const voiceId = mercuryConfig.voiceId || DEFAULT_VOICE_ID
  const personality = mercuryConfig.personalityPrompt || ''
  console.info('[VoicePipeline-v3] Session config', { agentName, voiceId, hasPersonality: !!personality })

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

  // Create TTS component — EPIC-023: temperature 1.1 for expressiveness
  const ttsComponent = new RemoteTTSComponent({
    id: 'tts_component',
    synthesisConfig: {
      type: 'inworld',
      config: {
        modelId: DEFAULT_TTS_MODEL_ID,
        inference: {
          temperature: 1.1,
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

        // EPIC-023: Two-mode query classification
        const queryMode = classifyQuery(userText)
        console.info('[VoicePipeline-v3] Query classified', { mode: queryMode, preview: userText.substring(0, 50) })

        if (queryMode === 'conversational') {
          // Bypass RAG — generate persona-driven conversational response
          const response = generateConversationalResponse(userText, agentName, personality)
          onAgentTextFinal?.(response)
          conversationHistory.push({ role: 'assistant', content: response })
          if (response) {
            await textToSpeech(response)
          }
          return
        }
        // Document query — fall through to Go backend RAG pipeline
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
        speakerId: voiceId,
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

      // Plain string input — RemoteTTSNode already has voice config
      // (speakerId, modelId, languageCode) in its executionConfig.
      // TTSRequest.withText() requires a voice param that toTaggedValue()
      // accesses without null check — passing string avoids this SDK bug.
      const { outputStream } = await ttsGraph.start(text)

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
                // chunk.audio.data is a Buffer of raw Float32 PCM bytes
                const rawBuffer = Buffer.isBuffer(chunk.audio.data)
                  ? chunk.audio.data
                  : Buffer.from(chunk.audio.data)
                const sampleCount = rawBuffer.length / 4 // 4 bytes per Float32

                if (chunkCount === 0) {
                  console.info('[VoicePipeline-v3] TTS audio format:', {
                    type: chunk.audio.data?.constructor?.name,
                    sampleRate: chunk.audio?.sampleRate,
                    samples: sampleCount,
                    format: 'float32',
                  })
                }

                chunkCount++
                totalBytes += rawBuffer.length
                console.info(`[VoicePipeline-v3] TTS chunk ${chunkCount} sent`, {
                  samples: sampleCount,
                  bytes: rawBuffer.length,
                })
                onTTSChunk?.(rawBuffer)
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
