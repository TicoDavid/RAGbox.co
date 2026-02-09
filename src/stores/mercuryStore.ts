import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { ChatMessage, Citation, TemperaturePreset } from '@/types/ragbox'

// Ad-Hoc Attachment (Session-only, not persisted to Vault)
export interface SessionAttachment {
  id: string
  name: string
  type: 'file' | 'image' | 'url'
  mimeType?: string
  size?: number
  content?: string          // Base64 for files/images, raw text for URLs
  extractedText?: string    // For processed documents
  url?: string              // For URL attachments
  status: 'pending' | 'processing' | 'ready' | 'error'
}

interface MercuryState {
  // Conversation
  messages: ChatMessage[]
  inputValue: string
  isStreaming: boolean
  streamingContent: string
  abortController: AbortController | null

  // Ad-Hoc Attachments (Session only - "Read Once, Burn")
  attachments: SessionAttachment[]

  // Context
  temperaturePreset: TemperaturePreset

  // Actions
  setInputValue: (value: string) => void
  sendMessage: (privilegeMode: boolean) => Promise<void>
  stopStreaming: () => void
  clearConversation: () => void
  setTemperaturePreset: (preset: TemperaturePreset) => void

  // Attachment Actions
  addAttachment: (attachment: Omit<SessionAttachment, 'id' | 'status'>) => string
  removeAttachment: (id: string) => void
  updateAttachment: (id: string, updates: Partial<SessionAttachment>) => void
  clearAttachments: () => void
}

export const useMercuryStore = create<MercuryState>()(
  devtools((set, get) => ({
    messages: [],
    inputValue: '',
    isStreaming: false,
    streamingContent: '',
    abortController: null,
    attachments: [],
    temperaturePreset: 'executive-cpo',

    setInputValue: (value) => set({ inputValue: value }),

    sendMessage: async (privilegeMode) => {
      const { inputValue, messages } = get()
      if (!inputValue.trim() || get().isStreaming) return

      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: inputValue,
        timestamp: new Date(),
      }

      const abortController = new AbortController()

      set({
        messages: [...messages, userMessage],
        inputValue: '',
        isStreaming: true,
        streamingContent: '',
        abortController,
      })

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: inputValue,
            stream: true,
            useVectorPipeline: true,
            privilegeMode,
            maxTier: 3,
            history: messages.map(m => ({ role: m.role, content: m.content })),
          }),
          signal: abortController.signal,
        })

        if (!res.ok) throw new Error('Chat request failed')

        const contentType = res.headers.get('content-type') ?? ''
        let fullContent = ''
        let confidence: number | undefined
        let citations: Citation[] | undefined

        // Handle non-streaming JSON fallback
        if (contentType.includes('application/json')) {
          const json = await res.json()
          fullContent = json.data?.answer ?? json.answer ?? 'No response generated.'
          confidence = json.data?.confidence ?? json.confidence
          citations = json.data?.citations ?? json.citations
        } else {
          // Handle SSE streaming
          const reader = res.body?.getReader()
          if (!reader) throw new Error('No response body')

          const decoder = new TextDecoder()

          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              const chunk = decoder.decode(value)
              const lines = chunk.split('\n').filter(line => line.startsWith('data: '))

              for (const line of lines) {
                const jsonStr = line.slice(6)
                if (jsonStr === '[DONE]') continue

                try {
                  const data = JSON.parse(jsonStr)

                  switch (data.type) {
                    case 'token':
                      fullContent += data.content
                      set({ streamingContent: fullContent })
                      break
                    case 'done':
                      fullContent = data.fullText ?? fullContent
                      break
                    case 'complete':
                      fullContent = data.answer ?? fullContent
                      confidence = data.confidence
                      citations = data.citations
                      break
                    case 'error':
                      throw new Error(data.message ?? 'Streaming error')
                    default:
                      // Legacy format fallback
                      if (data.content) {
                        fullContent += data.content
                        set({ streamingContent: fullContent })
                      }
                      if (data.confidence !== undefined) confidence = data.confidence
                      if (data.citations) citations = data.citations
                      break
                  }
                } catch (parseError) {
                  if (parseError instanceof SyntaxError) {
                    // Skip malformed JSON
                    continue
                  }
                  throw parseError
                }
              }
            }
          } finally {
            reader.releaseLock()
          }
        }

        const assistantMessage: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: fullContent || 'No response generated.',
          timestamp: new Date(),
          confidence,
          citations,
        }

        set((state) => ({
          messages: [...state.messages, assistantMessage],
          isStreaming: false,
          streamingContent: '',
          abortController: null,
        }))
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          set({ isStreaming: false, streamingContent: '', abortController: null })
          return
        }

        const errorMessage: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: 'An error occurred while processing your request.',
          timestamp: new Date(),
          isError: true,
        }

        set((state) => ({
          messages: [...state.messages, errorMessage],
          isStreaming: false,
          streamingContent: '',
          abortController: null,
        }))
      }
    },

    stopStreaming: () => {
      const { abortController, streamingContent, messages } = get()
      if (abortController) {
        abortController.abort()
      }

      if (streamingContent) {
        const partialMessage: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: streamingContent + '\n\n[Query stopped by user]',
          timestamp: new Date(),
        }
        set({
          messages: [...messages, partialMessage],
          isStreaming: false,
          streamingContent: '',
          abortController: null,
        })
      } else {
        set({ isStreaming: false, abortController: null })
      }
    },

    clearConversation: () => set({ messages: [], streamingContent: '', attachments: [] }),

    setTemperaturePreset: (preset) => set({ temperaturePreset: preset }),

    // Ad-Hoc Attachment Actions
    addAttachment: (attachment) => {
      const id = `attach-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      set((state) => ({
        attachments: [...state.attachments, { ...attachment, id, status: 'pending' as const }],
      }))
      return id
    },

    removeAttachment: (id) => {
      set((state) => ({
        attachments: state.attachments.filter((a) => a.id !== id),
      }))
    },

    updateAttachment: (id, updates) => {
      set((state) => ({
        attachments: state.attachments.map((a) =>
          a.id === id ? { ...a, ...updates } : a
        ),
      }))
    },

    clearAttachments: () => set({ attachments: [] }),
  }))
)
