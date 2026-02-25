/**
 * chatStore.ts — Independent Zustand store for Center Chat
 *
 * Completely separate from mercuryStore. Center chat is the RAGböx
 * knowledge chat — no persona selection, no channel switching, no
 * tool routing. Has safety mode toggle and model selector.
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { ChatMessage, Citation } from '@/types/ragbox'
import { apiFetch } from '@/lib/api'
import { toCitationBlocks } from '@/lib/citations/transform'

export interface ThreadSummary {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

export interface ChatState {
  // Thread
  threadId: string | null
  threadTitle: string
  messages: ChatMessage[]

  // Thread history
  threads: ThreadSummary[]
  threadsLoading: boolean
  isThreadLoading: boolean
  sidebarOpen: boolean

  // Input
  inputValue: string
  isStreaming: boolean
  streamingContent: string
  abortController: AbortController | null

  // Safety mode: true = vault only (default), false = can fetch URLs
  safetyMode: boolean

  // Model selector: 'aegis' or BYOLLM model string
  selectedModel: string

  // Document scope: when set, retrieval is filtered to this document only
  documentScope: string | null
  documentScopeName: string | null

  // Incognito mode: no persistence, no audit trail
  incognitoMode: boolean

  // Actions
  setInputValue: (value: string) => void
  sendMessage: (privilegeMode: boolean) => Promise<void>
  toggleSafetyMode: () => void
  setModel: (model: string) => void
  setDocumentScope: (docId: string | null) => void
  toggleIncognito: () => void
  startDocumentChat: (docId: string, docName: string) => Promise<void>
  stopStreaming: () => void
  clearThread: () => void
  fetchThreads: () => Promise<void>
  loadThread: (threadId: string) => Promise<void>
  setSidebarOpen: (open: boolean) => void
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

// ── DB persistence helpers (fire-and-forget) ──

async function createDbThread(): Promise<string | null> {
  try {
    const res = await fetch('/api/mercury/thread', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.data?.id || null
  } catch {
    return null
  }
}

function persistMessage(
  threadId: string,
  role: string,
  content: string,
  confidence?: number,
  citations?: Citation[],
) {
  fetch('/api/mercury/thread/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      threadId,
      role,
      channel: 'dashboard',
      content,
      confidence,
      citations,
    }),
  }).catch(() => {})
}

function patchThreadTitle(threadId: string, title: string) {
  fetch('/api/mercury/thread', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId, title }),
  }).catch(() => {})
}

export const useChatStore = create<ChatState>()(
  devtools(
    persist(
    (set, get) => ({
      threadId: null,
      threadTitle: 'New Chat',
      messages: [],
      threads: [],
      threadsLoading: false,
      isThreadLoading: false,
      sidebarOpen: false,
      inputValue: '',
      isStreaming: false,
      streamingContent: '',
      abortController: null,
      safetyMode: true,
      selectedModel: 'aegis',
      documentScope: null,
      documentScopeName: null,
      incognitoMode: false,

      setInputValue: (value) => set({ inputValue: value }),

      toggleSafetyMode: () =>
        set((state) => ({ safetyMode: !state.safetyMode })),

      setModel: (model) => set({ selectedModel: model }),

      setDocumentScope: (docId) => set({ documentScope: docId, documentScopeName: null }),

      toggleIncognito: () =>
        set((state) => ({ incognitoMode: !state.incognitoMode })),

      startDocumentChat: async (docId, docName) => {
        // Clear existing thread, scope to this document, and send initial query
        set({
          threadId: null,
          threadTitle: docName,
          messages: [],
          inputValue: `Summarize "${docName}" and provide a detailed outline.`,
          isStreaming: false,
          streamingContent: '',
          abortController: null,
          documentScope: docId,
          documentScopeName: docName,
        })
        // Fire off the initial query
        await get().sendMessage(false)
      },

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
          documentScope: null,
          documentScopeName: null,
        }),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      fetchThreads: async () => {
        set({ threadsLoading: true })
        try {
          const res = await fetch('/api/mercury/thread/list?limit=50')
          if (!res.ok) throw new Error('Failed to fetch threads')
          const data = await res.json()
          const threads: ThreadSummary[] = (data.data?.threads || []).map(
            (t: Record<string, unknown>) => ({
              id: t.id as string,
              title: (t.title as string) || 'Untitled',
              createdAt: t.createdAt as string,
              updatedAt: t.updatedAt as string,
              messageCount: (t._count as Record<string, number>)?.messages ?? 0,
            }),
          )
          set({ threads, threadsLoading: false })
        } catch {
          set({ threadsLoading: false })
        }
      },

      loadThread: async (threadId) => {
        set({ isThreadLoading: true })
        try {
          const res = await fetch(
            `/api/mercury/thread/messages?threadId=${threadId}&limit=200`,
          )
          if (!res.ok) throw new Error('Failed to load thread')
          const data = await res.json()
          const apiMessages = data.data?.messages || []
          const messages: ChatMessage[] = apiMessages.map(
            (m: Record<string, unknown>) => ({
              id: m.id as string,
              role: m.role as 'user' | 'assistant',
              content: m.content as string,
              timestamp: new Date(m.createdAt as string),
              confidence: m.confidence as number | undefined,
              citations: m.citations as Citation[] | undefined,
              channel: m.channel as string | undefined,
            }),
          )

          // Find thread title from thread list
          const thread = get().threads.find((t) => t.id === threadId)
          set({
            threadId,
            threadTitle: thread?.title || 'Chat',
            messages,
            inputValue: '',
            isStreaming: false,
            streamingContent: '',
            abortController: null,
            documentScope: null,
            documentScopeName: null,
            isThreadLoading: false,
          })
        } catch {
          set({ isThreadLoading: false })
        }
      },

      sendMessage: async (privilegeMode) => {
        const { inputValue, messages, safetyMode, selectedModel, documentScope, incognitoMode } = get()
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
            ...(documentScope ? { documentScope } : {}),
          }

          // BYOLLM routing
          if (selectedModel !== 'aegis') {
            chatBody.llmProvider = 'byollm'
            chatBody.llmModel = selectedModel
          }

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          }
          if (incognitoMode) headers['X-Incognito'] = 'true'

          const res = await apiFetch('/api/chat', {
            method: 'POST',
            headers,
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
          let doneMetadata: Record<string, unknown> = {}

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
                        // BUG-037: Don't display JSON-shaped streaming to user
                        // (backend sometimes sends structured JSON as tokens).
                        // User sees "Analyzing..." dots instead of raw JSON.
                        if (!fullContent.trim().startsWith('{')) {
                          set({ streamingContent: fullContent })
                        }
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
                      case 'error':
                        // BUG-036: Surface backend errors instead of showing "No response generated"
                        if (!fullContent && typeof data.message === 'string') {
                          fullContent = `⚠️ ${data.message}`
                        }
                        break
                      case 'done': {
                        // Unwrap: backend may send { answer, ... } or { data: { answer, ... } }
                        const d = data.data ?? data

                        // STORY-173 + HOTFIX: Use done.answer when either:
                        // (a) no tokens were streamed yet, OR
                        // (b) streamed content is raw JSON (backend streamed JSON chars as tokens)
                        const streamedIsJson = fullContent.trim().startsWith('{')
                        if (typeof d.answer === 'string' && (!fullContent || streamedIsJson)) {
                          fullContent = d.answer
                          set({ streamingContent: fullContent })
                        }

                        // Citations & confidence → top-level vars for message construction
                        const doneCit = d.citations
                        if (Array.isArray(doneCit)) citations = doneCit
                        if (d.confidence !== undefined) confidence = d.confidence

                        // Everything else → metadata (sources, evidence, model info).
                        // These are rendered by Sources/Evidence tabs, never by Answer tab.
                        if (d.sources) doneMetadata.sources = d.sources
                        if (d.evidence) {
                          doneMetadata.evidence = d.evidence
                          if (d.evidence.totalDocumentsSearched != null) doneMetadata.docsSearched = d.evidence.totalDocumentsSearched
                          if (d.evidence.totalChunksSearched != null) doneMetadata.chunksEvaluated = d.evidence.totalChunksSearched
                        }
                        if (d.model_used) { modelUsed = d.model_used; doneMetadata.modelUsed = d.model_used }
                        if (d.provider) { provider = d.provider; doneMetadata.provider = d.provider }
                        if (d.latency_ms != null) { latencyMs = d.latency_ms; doneMetadata.latencyMs = d.latency_ms }
                        break
                      }
                      case 'status':
                        break
                      default:
                        // Only append if data.text is a plain string token,
                        // not a structured object (prevents JSON leak from
                        // unlabelled done events hitting this fallback).
                        if (typeof data.text === 'string' && !data.answer && !data.data) {
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

          // BUG-037 safety net: if fullContent is still raw JSON after streaming,
          // extract the answer field so the message never stores raw JSON.
          if (fullContent && fullContent.trim().startsWith('{')) {
            try {
              const parsed = JSON.parse(fullContent.trim())
              const d = parsed.data ?? parsed
              if (typeof d.answer === 'string') {
                fullContent = d.answer
                if (Array.isArray(d.citations) && (!citations || citations.length === 0)) {
                  citations = d.citations
                }
                if (typeof d.confidence === 'number' && confidence === undefined) {
                  confidence = d.confidence
                }
              }
            } catch {
              // Not valid JSON — use as-is
            }
          }

          // Build citation blocks
          const blocks =
            citations && citations.length > 0
              ? toCitationBlocks(
                  citations.map((c, i) => {
                    // Go backend sends two citation shapes:
                    // SSE citations event: {index, excerpt, relevance}
                    // Done event: {chunkIndex, snippet, relevanceScore}
                    const raw = c as unknown as Record<string, unknown>
                    return {
                      citationIndex: c.citationIndex ?? (raw.index as number) ?? i,
                      documentId: c.documentId ?? '',
                      documentName: c.documentName ?? 'Document',
                      excerpt: c.excerpt ?? (raw.snippet as string) ?? '',
                      relevanceScore: c.relevanceScore ?? (raw.relevance as number) ?? 0,
                    }
                  }),
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
            ...(Object.keys(doneMetadata).length > 0
              ? { metadata: doneMetadata }
              : {}),
          }

          set((state) => ({
            messages: [...state.messages, assistantMessage],
            isStreaming: false,
            streamingContent: '',
            abortController: null,
          }))

          // Persist to database (fire-and-forget, skip in incognito)
          if (!incognitoMode) {
            ;(async () => {
              let tid = get().threadId
              if (!tid) {
                tid = await createDbThread()
                if (tid) set({ threadId: tid })
              }
              if (tid) {
                persistMessage(tid, 'user', inputValue)
                persistMessage(
                  tid,
                  'assistant',
                  fullContent,
                  confidence,
                  citations,
                )
              }
            })()
          }

          // Auto-title after first exchange (skip in incognito)
          if (isFirstMessage && !incognitoMode) {
            generateTitle(queryForTitle)
              .then((title) => {
                set({ threadTitle: title })
                const tid = get().threadId
                if (tid) patchThreadTitle(tid, title)
              })
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
    {
      name: 'ragbox-chat-storage',
      partialize: (state) =>
        state.incognitoMode
          ? { selectedModel: state.selectedModel }
          : {
              threadId: state.threadId,
              threadTitle: state.threadTitle,
              messages: state.messages,
              documentScope: state.documentScope,
              documentScopeName: state.documentScopeName,
              selectedModel: state.selectedModel,
              sidebarOpen: state.sidebarOpen,
            },
    },
    ),
    { name: 'chat-store' },
  ),
)
