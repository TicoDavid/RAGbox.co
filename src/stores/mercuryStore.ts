import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { ChatMessage, Citation, TemperaturePreset } from '@/types/ragbox'
import { apiFetch } from '@/lib/api'

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

// Persona/Lens for Neural Shift
export type PersonaId = 'ceo' | 'cfo' | 'coo' | 'cpo' | 'cmo' | 'cto' | 'legal' | 'compliance' | 'auditor' | 'whistleblower'

interface MercuryState {
  // Conversation
  messages: ChatMessage[]
  inputValue: string
  isStreaming: boolean
  streamingContent: string
  abortController: AbortController | null

  // Ad-Hoc Attachments (Session only - "Read Once, Burn")
  attachments: SessionAttachment[]

  // Neural Shift (Persona/Lens)
  activePersona: PersonaId
  isRefocusing: boolean  // For lens animation

  // Session tracking
  activeSessionId: string | null
  sessionQueryCount: number
  sessionTopics: string[]

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

  // Neural Shift Actions
  setPersona: (persona: PersonaId) => void
  triggerRefocus: () => void
}

export const useMercuryStore = create<MercuryState>()(
  devtools((set, get) => ({
    messages: [],
    inputValue: '',
    isStreaming: false,
    streamingContent: '',
    abortController: null,
    attachments: [],
    activePersona: 'cpo',
    isRefocusing: false,
    activeSessionId: null,
    sessionQueryCount: 0,
    sessionTopics: [],
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
        const res = await apiFetch('/api/chat', {
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
          // Handle SSE streaming from Go backend
          // Backend sends standard SSE: "event: <type>\ndata: <json>\n\n"
          // Event types: status, token, citations, confidence, silence, done
          const reader = res.body?.getReader()
          if (!reader) throw new Error('No response body')

          const decoder = new TextDecoder()
          let buffer = ''

          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              buffer += decoder.decode(value, { stream: true })

              // Split on double-newline (SSE message boundary)
              const messages = buffer.split('\n\n')
              // Keep the last partial chunk in the buffer
              buffer = messages.pop() ?? ''

              for (const message of messages) {
                if (!message.trim()) continue

                // Parse event type and data from SSE message
                let eventType = ''
                let eventData = ''
                for (const line of message.split('\n')) {
                  if (line.startsWith('event: ')) {
                    eventType = line.slice(7).trim()
                  } else if (line.startsWith('data: ')) {
                    eventData = line.slice(6)
                  }
                }

                if (!eventData) continue

                try {
                  const data = JSON.parse(eventData)

                  switch (eventType) {
                    case 'token':
                      fullContent += data.text ?? ''
                      set({ streamingContent: fullContent })
                      break
                    case 'citations':
                      // Citations come as a raw array
                      citations = Array.isArray(data) ? data : data.citations
                      break
                    case 'confidence':
                      confidence = data.score ?? data.confidence
                      break
                    case 'silence':
                      // Silence Protocol: use the message as content
                      fullContent = data.message ?? 'Unable to provide a grounded answer.'
                      confidence = data.confidence ?? 0
                      break
                    case 'status':
                      // Ignore status events (retrieving, generating)
                      break
                    case 'done':
                      // Stream complete
                      break
                    default:
                      // Fallback: try known field names
                      if (data.text) {
                        fullContent += data.text
                        set({ streamingContent: fullContent })
                      }
                      break
                  }
                } catch (parseError) {
                  if (parseError instanceof SyntaxError) continue
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

        set((state) => {
          // Extract topic keywords from user query (words 4+ chars, deduped)
          const words = inputValue.toLowerCase().split(/\s+/)
            .filter((w) => w.length >= 4)
            .map((w) => w.replace(/[^a-z0-9]/g, ''))
            .filter(Boolean)
          const newTopics = [...new Set([...state.sessionTopics, ...words])].slice(0, 20)

          return {
            messages: [...state.messages, assistantMessage],
            isStreaming: false,
            streamingContent: '',
            abortController: null,
            sessionQueryCount: state.sessionQueryCount + 1,
            sessionTopics: newTopics,
          }
        })
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

    clearConversation: () => set({ messages: [], streamingContent: '', attachments: [], sessionQueryCount: 0, sessionTopics: [] }),

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

    // Neural Shift Actions
    setPersona: (persona) => {
      set({ activePersona: persona })
      // Trigger refocus animation
      get().triggerRefocus()
    },

    triggerRefocus: () => {
      set({ isRefocusing: true })
      // Auto-clear after animation duration
      setTimeout(() => {
        set({ isRefocusing: false })
      }, 600)
    },
  }))
)
