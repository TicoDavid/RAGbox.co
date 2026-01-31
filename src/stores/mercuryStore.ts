import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { ChatMessage, Citation, TemperaturePreset } from '@/types/ragbox'

interface MercuryState {
  // Conversation
  messages: ChatMessage[]
  inputValue: string
  isStreaming: boolean
  streamingContent: string
  abortController: AbortController | null

  // Context
  openVaultIds: string[]
  temperaturePreset: TemperaturePreset

  // Actions
  setInputValue: (value: string) => void
  sendMessage: (privilegeMode: boolean) => Promise<void>
  stopStreaming: () => void
  clearConversation: () => void
  setOpenVaults: (vaultIds: string[]) => void
  setTemperaturePreset: (preset: TemperaturePreset) => void
}

export const useMercuryStore = create<MercuryState>()(
  devtools((set, get) => ({
    messages: [],
    inputValue: '',
    isStreaming: false,
    streamingContent: '',
    abortController: null,
    openVaultIds: [],
    temperaturePreset: 'executive-cpo',

    setInputValue: (value) => set({ inputValue: value }),

    sendMessage: async (privilegeMode) => {
      const { inputValue, messages, openVaultIds } = get()
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
            message: inputValue,
            privilegeMode,
            vaultIds: openVaultIds,
            history: messages.map(m => ({ role: m.role, content: m.content })),
          }),
          signal: abortController.signal,
        })

        if (!res.ok) throw new Error('Chat request failed')

        const reader = res.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let fullContent = ''
        let confidence: number | undefined
        let citations: Citation[] | undefined

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
                if (data.content) {
                  fullContent += data.content
                  set({ streamingContent: fullContent })
                }
                if (data.confidence !== undefined) {
                  confidence = data.confidence
                }
                if (data.citations) {
                  citations = data.citations
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
        } finally {
          reader.releaseLock()
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

    clearConversation: () => set({ messages: [], streamingContent: '' }),

    setOpenVaults: (vaultIds) => set({ openVaultIds: vaultIds }),

    setTemperaturePreset: (preset) => set({ temperaturePreset: preset }),
  }))
)
