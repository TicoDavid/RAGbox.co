/**
 * chatStore.ts — Independent Zustand store for Center Chat
 *
 * Completely separate from mercuryStore. Center chat is the RAGböx
 * knowledge chat — no persona selection, no channel switching, no
 * tool routing. Has safety mode toggle and model selector.
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { ChatMessage, Citation } from '@/types/ragbox'
import { apiFetch } from '@/lib/api'
import { toCitationBlocks } from '@/lib/citations/transform'

export interface ChatState {
  // Thread
  threadId: string | null
  threadTitle: string
  messages: ChatMessage[]

  // Input
  inputValue: string
  isStreaming: boolean
  streamingContent: string
  abortController: AbortController | null

  // Safety mode: true = vault only (default), false = can fetch URLs
  safetyMode: boolean

  // Model selector: 'aegis' or BYOLLM model string
  selectedModel: string

  // Actions
  setInputValue: (value: string) => void
  sendMessage: (privilegeMode: boolean) => Promise<void>
  toggleSafetyMode: () => void
  setModel: (model: string) => void
  stopStreaming: () => void
  clearThread: () => void
}

// Generate a short thread title from the first query
async function generateTitle(query: string): Promise<string> {
  try {
    const res = await fetch('/api/mercury/thread/generate-title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    if (!res.ok) return query.slice(0, 50)
    const data = await res.json()
    return data.title || query.slice(0, 50)
  } catch {
    return query.slice(0, 50)
  }
}

export const useChatStore = create<ChatState>()(
  devtools(
    (set, get) => ({
      threadId: null,
      threadTitle: 'New Chat',
      messages: [],
      inputValue: '',
      isStreaming: false,
      streamingContent: '',
      abortController: null,
      safetyMode: true,
      selectedModel: 'aegis',

      setInputValue: (value) => set({ inputValue: value }),

      toggleSafetyMode: () =>
        set((state) => ({ safetyMode: !state.safetyMode })),

      setModel: (model) => set({ selectedModel: model }),

      stopStreaming: () => {
        const { abortController } = get()
        if (abortController) abortController.abort()
        set({ isStreaming: false, streamingContent: '', abortController: null })
      },

      clearThread: () =>
        set({
          threadId: null,
          threadTitle: 'New Chat',
          messages: [],
          inputValue: '',
          isStreaming: false,
          streamingContent: '',
          abortController: null,
        }),

      sendMessage: async (privilegeMode) => {
        const { inputValue, messages, safetyMode, selectedModel } = get()
        if (!inputValue.trim() || get().isStreaming) return

        const userMessage: ChatMessage = {
          id: `chat-${Date.now()}`,
          role: 'user',
          content: inputValue,
          timestamp: new Date(),
        }

        const abortController = new AbortController()
        const isFirstMessage = messages.length === 0
        const queryForTitle = inputValue.trim()

        set({
          messages: [...messages, userMessage],
          inputValue: '',
          isStreaming: true,
          streamingContent: '',
          abortController,
        })

        try {
          // Build request body
          const chatBody: Record<string, unknown> = {
            query: inputValue,
            stream: true,
            useVectorPipeline: true,
            privilegeMode,
            maxTier: 3,
            safetyMode,
            history: messages.map((m) => ({ role: m.role, content: m.content })),
          }

          // BYOLLM routing
          if (selectedModel !== 'aegis') {
            chatBody.llmProvider = 'byollm'
            chatBody.llmModel = selectedModel
          }

          const res = await apiFetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chatBody),
            signal: abortController.signal,
          })

          if (!res.ok) throw new Error('Chat request failed')

          const contentType = res.headers.get('content-type') ?? ''
          let fullContent = ''
          let confidence: number | undefined
          let citations: Citation[] | undefined
          let modelUsed: string | undefined
          let provider: string | undefined
          let latencyMs: number | undefined

          // JSON fallback (non-streaming or cached)
          if (contentType.includes('application/json')) {
            const json = await res.json()
            fullContent =
              json.data?.answer ?? json.answer ?? 'No response generated.'
            confidence = json.data?.confidence ?? json.confidence
            citations = json.data?.citations ?? json.citations
          } else {
            // SSE streaming from Go backend
            const reader = res.body?.getReader()
            if (!reader) throw new Error('No response body')

            const decoder = new TextDecoder()
            let buffer = ''

            try {
              while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const sseMessages = buffer.split('\n\n')
                buffer = sseMessages.pop() ?? ''

                for (const message of sseMessages) {
                  if (!message.trim()) continue

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
                        citations = Array.isArray(data)
                          ? data
                          : data.citations
                        break
                      case 'confidence':
                        confidence = data.score ?? data.confidence
                        modelUsed = data.modelUsed ?? modelUsed
                        provider = data.provider ?? provider
                        latencyMs = data.latencyMs ?? latencyMs
                        break
                      case 'silence':
                        fullContent =
                          data.message ??
                          'Unable to provide a grounded answer.'
                        confidence = data.confidence ?? 0
                        break
                      case 'status':
                      case 'done':
                        break
                      default:
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

          // Build citation blocks
          const blocks =
            citations && citations.length > 0
              ? toCitationBlocks(
                  citations.map((c, i) => ({
                    citationIndex: c.citationIndex ?? i,
                    documentId: c.documentId ?? '',
                    documentName: c.documentName ?? 'Document',
                    excerpt: c.excerpt ?? '',
                    relevanceScore: c.relevanceScore ?? 0,
                  })),
                  inputValue,
                  fullContent,
                )
              : undefined

          const assistantMessage: ChatMessage = {
            id: `chat-${Date.now()}`,
            role: 'assistant',
            content: fullContent || 'No response generated.',
            timestamp: new Date(),
            confidence,
            citations,
            citationBlocks: blocks,
            modelUsed,
            provider,
            latencyMs,
          }

          set((state) => ({
            messages: [...state.messages, assistantMessage],
            isStreaming: false,
            streamingContent: '',
            abortController: null,
          }))

          // Auto-title after first exchange
          if (isFirstMessage) {
            generateTitle(queryForTitle)
              .then((title) => set({ threadTitle: title }))
              .catch(() => set({ threadTitle: queryForTitle.slice(0, 50) }))
          }
        } catch (error) {
          if ((error as Error).name === 'AbortError') {
            set({
              isStreaming: false,
              streamingContent: '',
              abortController: null,
            })
            return
          }

          const errorMessage: ChatMessage = {
            id: `chat-${Date.now()}`,
            role: 'assistant',
            content:
              'An error occurred while processing your request. Please try again.',
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
    }),
    { name: 'chat-store' },
  ),
)
