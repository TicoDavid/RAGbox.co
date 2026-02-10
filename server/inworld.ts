/**
 * Inworld Integration - RAGbox.co
 *
 * Full integration with Inworld AI Runtime for voice agent capabilities.
 * Uses the graph-based Runtime SDK for STT, LLM, and TTS processing.
 * Now with function calling support for tool execution.
 */

import 'dotenv/config'
import { stopInworldRuntime } from '@inworld/runtime'
import {
  GraphBuilder,
  GraphTypes,
  RemoteLLMChatNode,
  RemoteSTTNode,
  RemoteTTSNode,
  RemoteTTSComponent,
} from '@inworld/runtime/graph'
import { TOOL_DEFINITIONS, executeTool, type ToolContext, type ToolCall } from './tools'

// ============================================================================
// TYPES
// ============================================================================

export interface InworldSessionConfig {
  apiKey: string
  toolContext?: ToolContext
  onTranscriptPartial?: (text: string) => void
  onTranscriptFinal?: (text: string) => void
  onAgentTextPartial?: (text: string) => void
  onAgentTextFinal?: (text: string) => void
  onTTSChunk?: (audioBase64: string) => void
  onToolCall?: (toolName: string, args: Record<string, unknown>) => void
  onToolResult?: (toolName: string, result: unknown) => void
  onUIAction?: (action: unknown) => void
  onError?: (error: Error) => void
  onDisconnect?: () => void
}

// OpenAI function calling format
interface OpenAIFunction {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string; enum?: string[] }>
    required: string[]
  }
}

// Convert our tool definitions to OpenAI function format
function getOpenAIFunctions(): OpenAIFunction[] {
  return TOOL_DEFINITIONS.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(tool.parameters).map(([key, param]) => [
          key,
          {
            type: param.type,
            description: param.description,
            ...(param.enum ? { enum: param.enum } : {}),
          },
        ])
      ),
      required: Object.entries(tool.parameters)
        .filter(([, param]) => param.required)
        .map(([key]) => key),
    },
  }))
}

export interface InworldSession {
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

const SAMPLE_RATE = 48000
const DEFAULT_TTS_MODEL_ID = 'inworld-tts-1-max'
const DEFAULT_VOICE_ID = 'Ashley'

// Convert Float32 PCM (from Inworld TTS) to Int16 PCM (for browser playback)
function float32ToInt16Base64(float32Base64: string): string {
  // Decode base64 to buffer
  const buffer = Buffer.from(float32Base64, 'base64')

  // Interpret as Float32Array
  const float32 = new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.length / 4
  )

  // Convert to Int16
  const int16 = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i++) {
    // Clamp and convert
    const sample = Math.max(-1, Math.min(1, float32[i]))
    int16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
  }

  // Return as base64
  return Buffer.from(int16.buffer).toString('base64')
}

// ============================================================================
// INWORLD SESSION FACTORY
// ============================================================================

export async function createInworldSession(config: InworldSessionConfig): Promise<InworldSession> {
  const {
    apiKey,
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

  let isActive = false
  let audioBuffer: Float32Array[] = []

  // Build tool descriptions for the system prompt
  const toolDescriptions = TOOL_DEFINITIONS.map(t => {
    const params = Object.entries(t.parameters)
      .map(([k, v]) => `  - ${k}: ${v.description}${v.required ? ' (required)' : ''}`)
      .join('\n')
    return `**${t.name}**: ${t.description}${params ? '\n' + params : ''}`
  }).join('\n\n')

  const systemPrompt = `You are Mercury, the Virtual Representative (V-Rep) for RAGbox.co - a secure, compliance-ready RAG platform for legal, financial, and healthcare sectors.

You have access to the user's document vault and can help them navigate, search, and analyze their documents.

## Available Tools
When you need to access documents or perform actions, use these tools by outputting a JSON block:

\`\`\`tool
{"name": "tool_name", "arguments": {"arg1": "value1"}}
\`\`\`

${toolDescriptions}

## Important Rules
1. When users ask about their documents, USE the list_documents or search_documents tools - don't say you can't access them
2. When users want to read a document, USE the read_document tool
3. Only privileged documents require Privilege Mode - regular documents are always accessible
4. Keep responses concise and professional
5. After using a tool, explain the results naturally

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
    let match = toolPattern.exec(text)

    if (match) {
      try {
        const toolCall = JSON.parse(match[1].trim())
        const cleanText = text.replace(toolPattern, '').trim()
        return { toolCall, cleanText }
      } catch (e) {
        console.error('[Inworld] Failed to parse tool call:', e)
      }
    }

    return { toolCall: null, cleanText: text }
  }

  // Execute a tool and return result
  async function executeToolCall(name: string, args: Record<string, unknown>): Promise<string> {
    if (!toolContext) {
      return 'Error: No user context available for tool execution'
    }

    console.log(`[Inworld] Executing tool: ${name}`, args)
    onToolCall?.(name, args)

    try {
      const call: ToolCall = {
        id: `tool_${Date.now()}`,
        name,
        arguments: args,
      }

      const result = await executeTool(call, toolContext)
      onToolResult?.(name, result)

      // Handle UI actions
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

  // Process text through LLM and TTS
  async function processWithLLM(userText: string, isToolResult = false): Promise<void> {
    try {
      console.log('[Inworld] Processing:', isToolResult ? 'tool result' : 'user message', userText.substring(0, 100))

      if (!isToolResult) {
        onTranscriptFinal?.(userText)
        conversationHistory.push({ role: 'user', content: userText })
      } else {
        // Add tool result as a system message
        conversationHistory.push({ role: 'user', content: `[Tool Result]\n${userText}` })
      }

      // Create LLM node (using OpenAI via Inworld proxy)
      const llmNode = new RemoteLLMChatNode({
        id: 'llm-node',
        provider: 'openai',
        modelName: 'gpt-4o-mini',
        stream: true,
        textGenerationConfig: {
          maxNewTokens: 800,
        },
      })

      // Build LLM graph
      const llmGraph = new GraphBuilder({
        id: 'llm_graph',
        apiKey,
        enableRemoteConfig: false,
      })
        .addNode(llmNode)
        .setStartNode(llmNode)
        .setEndNode(llmNode)
        .build()

      // Send to LLM
      const { outputStream } = await llmGraph.start(
        new GraphTypes.LLMChatRequest({
          messages: conversationHistory,
        })
      )

      let fullResponse = ''

      for await (const result of outputStream) {
        await result.processResponse({
          Content: async (response: GraphTypes.Content) => {
            fullResponse = response.content || ''
            console.log('[Inworld] LLM Response:', fullResponse.substring(0, 100) + '...')

            // Check for tool calls
            const { toolCall, cleanText } = parseToolCalls(fullResponse)

            if (toolCall) {
              console.log('[Inworld] Tool call detected:', toolCall.name)
              conversationHistory.push({ role: 'assistant', content: fullResponse })

              // Execute the tool
              const toolResult = await executeToolCall(toolCall.name, toolCall.arguments)

              // Continue conversation with tool result
              await processWithLLM(toolResult, true)
              return
            }

            onAgentTextFinal?.(cleanText)
            conversationHistory.push({ role: 'assistant', content: fullResponse })
          },
          ContentStream: async (stream: GraphTypes.ContentStream) => {
            for await (const chunk of stream) {
              if (chunk.text) {
                fullResponse += chunk.text
                // Don't show partial tool calls to user
                if (!fullResponse.includes('```tool')) {
                  onAgentTextPartial?.(fullResponse)
                }
              }
            }
            console.log('[Inworld] LLM Streamed Response:', fullResponse.substring(0, 100) + '...')

            // Check for tool calls in streamed response
            const { toolCall, cleanText } = parseToolCalls(fullResponse)

            if (toolCall) {
              console.log('[Inworld] Tool call detected (stream):', toolCall.name)
              conversationHistory.push({ role: 'assistant', content: fullResponse })

              // Execute the tool
              const toolResult = await executeToolCall(toolCall.name, toolCall.arguments)

              // Continue conversation with tool result
              await processWithLLM(toolResult, true)
              return
            }

            onAgentTextFinal?.(cleanText)
            conversationHistory.push({ role: 'assistant', content: fullResponse })
          },
          error: (error: GraphTypes.GraphError) => {
            console.error('[Inworld] LLM Error:', error.message)
            onError?.(new Error(error.message))
          },
        })
      }

      // If we have a response (and no tool was called), convert to speech
      // Strip tool markup before TTS
      const { cleanText } = parseToolCalls(fullResponse)
      if (cleanText && !fullResponse.includes('```tool')) {
        await textToSpeech(cleanText)
      }
    } catch (error) {
      console.error('[Inworld] Processing error:', error)
      onError?.(error instanceof Error ? error : new Error(String(error)))
    }
  }

  // Convert text to speech
  async function textToSpeech(text: string): Promise<void> {
    try {
      console.log('[Inworld] Converting to speech:', text.substring(0, 50) + '...')

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
        // Use flexible response handling for TTS output
        await result.processResponse({
          default: async (output: unknown) => {
            const ttsOutput = output as { audio?: { data?: string } }
            if (ttsOutput.audio?.data) {
              // Convert Float32 (from Inworld) to Int16 (for browser)
              const int16Base64 = float32ToInt16Base64(ttsOutput.audio.data)
              onTTSChunk?.(int16Base64)
            }
          },
          error: (error: GraphTypes.GraphError) => {
            console.error('[Inworld] TTS Error:', error.message)
            onError?.(new Error(error.message))
          },
        })
      }
    } catch (error) {
      console.error('[Inworld] TTS error:', error)
      onError?.(error instanceof Error ? error : new Error(String(error)))
    }
  }

  // Process audio through STT
  async function processAudio(): Promise<void> {
    if (audioBuffer.length === 0) return

    try {
      console.log('[Inworld] Processing audio buffer...')

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
            console.error('[Inworld] STT Error:', error.message)
            onError?.(new Error(error.message))
          },
        })
      }

      if (transcription.trim()) {
        console.log('[Inworld] Transcription:', transcription)
        await processWithLLM(transcription)
      }
    } catch (error) {
      console.error('[Inworld] STT error:', error)
      onError?.(error instanceof Error ? error : new Error(String(error)))
    }
  }

  console.log('[Inworld] Session created')

  return {
    async sendAudio(pcmBuffer: Buffer): Promise<void> {
      if (!isActive) return

      // Convert PCM s16le to Float32
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
      console.log('[Inworld] Starting audio session')
      isActive = true
      audioBuffer = []
    },

    async endAudioSession(): Promise<void> {
      console.log('[Inworld] Ending audio session')
      isActive = false
      await processAudio()
    },

    async cancelResponse(): Promise<void> {
      console.log('[Inworld] Canceling response')
      // Reset buffers
      audioBuffer = []
    },

    async sendText(text: string): Promise<void> {
      console.log('[Inworld] Sending text:', text)
      await processWithLLM(text)
    },

    async triggerGreeting(): Promise<void> {
      const greeting = 'Hello! Welcome to RAGbox. How may I assist you today?'
      console.log('[Inworld] Triggering greeting:', greeting)

      // Add greeting to conversation history
      conversationHistory.push({ role: 'assistant', content: greeting })

      // Send text to client
      onAgentTextFinal?.(greeting)

      // Convert to speech
      await textToSpeech(greeting)
    },

    close(): void {
      console.log('[Inworld] Closing session')
      isActive = false
      audioBuffer = []
      // NOTE: Don't call stopInworldRuntime() here - it's a global shutdown
      // that would break other sessions. Only call it on server shutdown.
      onDisconnect?.()
    },
  }
}

// ============================================================================
// ENVIRONMENT HELPERS
// ============================================================================

export function getInworldConfig(): { apiKey: string } {
  const apiKey = process.env.INWORLD_API_KEY

  if (!apiKey) {
    throw new Error(
      'Missing Inworld configuration. Set INWORLD_API_KEY environment variable (base64 format)'
    )
  }

  return { apiKey }
}
