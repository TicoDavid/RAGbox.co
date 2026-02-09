/**
 * Inworld Integration - RAGbox.co
 *
 * Full integration with Inworld AI Runtime for voice agent capabilities.
 * Uses the graph-based Runtime SDK for STT, LLM, and TTS processing.
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

// ============================================================================
// TYPES
// ============================================================================

export interface InworldSessionConfig {
  apiKey: string
  onTranscriptPartial?: (text: string) => void
  onTranscriptFinal?: (text: string) => void
  onAgentTextPartial?: (text: string) => void
  onAgentTextFinal?: (text: string) => void
  onTTSChunk?: (audioBase64: string) => void
  onError?: (error: Error) => void
  onDisconnect?: () => void
}

export interface InworldSession {
  sendAudio: (pcmBuffer: Buffer) => Promise<void>
  startAudioSession: () => Promise<void>
  endAudioSession: () => Promise<void>
  cancelResponse: () => Promise<void>
  sendText: (text: string) => Promise<void>
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
    onTranscriptPartial,
    onTranscriptFinal,
    onAgentTextPartial,
    onAgentTextFinal,
    onTTSChunk,
    onError,
    onDisconnect,
  } = config

  let isActive = false
  let audioBuffer: Float32Array[] = []
  let conversationHistory: Array<{ role: string; content: string }> = [
    {
      role: 'system',
      content: `You are Mercury, the AI assistant for RAGbox.co - a secure, compliance-ready RAG platform for legal, financial, and healthcare sectors. You help users navigate documents, search their knowledge base, and provide insights with verified citations. Keep responses concise and professional.`,
    },
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

  // Process text through LLM and TTS
  async function processWithLLM(userText: string): Promise<void> {
    try {
      console.log('[Inworld] Processing user message:', userText)
      onTranscriptFinal?.(userText)

      // Add user message to history
      conversationHistory.push({ role: 'user', content: userText })

      // Create LLM node (using OpenAI via Inworld proxy)
      const llmNode = new RemoteLLMChatNode({
        id: 'llm-node',
        provider: 'openai',
        modelName: 'gpt-4o-mini',
        stream: true,
        textGenerationConfig: {
          maxNewTokens: 500,
        },
      })

      // Create TTS node
      const ttsNode = new RemoteTTSNode({
        ttsComponent,
        speakerId: DEFAULT_VOICE_ID,
        languageCode: 'en-US',
        modelId: DEFAULT_TTS_MODEL_ID,
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
          Content: (response: GraphTypes.Content) => {
            fullResponse = response.content || ''
            console.log('[Inworld] LLM Response:', fullResponse)
            onAgentTextFinal?.(fullResponse)
            conversationHistory.push({ role: 'assistant', content: fullResponse })
          },
          ContentStream: async (stream: GraphTypes.ContentStream) => {
            for await (const chunk of stream) {
              if (chunk.text) {
                fullResponse += chunk.text
                onAgentTextPartial?.(fullResponse)
              }
            }
            console.log('[Inworld] LLM Streamed Response:', fullResponse)
            onAgentTextFinal?.(fullResponse)
            conversationHistory.push({ role: 'assistant', content: fullResponse })
          },
          error: (error: GraphTypes.GraphError) => {
            console.error('[Inworld] LLM Error:', error.message)
            onError?.(new Error(error.message))
          },
        })
      }

      // If we have a response, convert to speech
      if (fullResponse) {
        await textToSpeech(fullResponse)
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
        await result.processResponse({
          TTSOutput: async (output: GraphTypes.TTSOutput) => {
            if (output.audio?.data) {
              // Convert Float32 (from Inworld) to Int16 (for browser)
              const int16Base64 = float32ToInt16Base64(output.audio.data)
              onTTSChunk?.(int16Base64)
            }
          },
          TTSOutputStream: async (stream: GraphTypes.TTSOutputStream) => {
            for await (const chunk of stream) {
              if (chunk.audio?.data) {
                // Convert Float32 (from Inworld) to Int16 (for browser)
                const int16Base64 = float32ToInt16Base64(chunk.audio.data)
                onTTSChunk?.(int16Base64)
              }
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
