import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { ChatMessage, Citation, TemperaturePreset, MercuryChannel } from '@/types/ragbox'
import { apiFetch } from '@/lib/api'
import { detectToolIntent } from '@/lib/mercury/toolRouter'
import { executeTool, type ToolResult } from '@/lib/mercury/toolExecutor'
import { toCitationBlocks } from '@/lib/citations/transform'

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

// LLM selection for BYOLLM
export interface SelectedLlm {
  provider: 'aegis' | 'byollm'
  model: string // e.g., 'aegis-core' or 'openai/gpt-4o'
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

  // BYOLLM selection
  selectedLlm: SelectedLlm

  // Context
  temperaturePreset: TemperaturePreset

  // Tool Actions (pending UI-side effects from tool execution)
  pendingAction: { type: string; payload: Record<string, unknown> } | null

  // Pending confirmation for send_email / send_sms
  pendingConfirmation: { type: string; payload: Record<string, unknown> } | null

  // Unified Thread
  threadId: string | null
  threadLoaded: boolean
  titlePatched: boolean
  channelFilter: MercuryChannel | 'all'

  // Actions
  setInputValue: (value: string) => void
  sendMessage: (privilegeMode: boolean) => Promise<void>
  clearPendingAction: () => void
  stopStreaming: () => void
  clearConversation: () => void
  setTemperaturePreset: (preset: TemperaturePreset) => void

  // Attachment Actions
  addAttachment: (attachment: Omit<SessionAttachment, 'id' | 'status'>) => string
  removeAttachment: (id: string) => void
  updateAttachment: (id: string, updates: Partial<SessionAttachment>) => void
  clearAttachments: () => void

  // BYOLLM Actions
  setSelectedLlm: (llm: SelectedLlm) => void

  // Neural Shift Actions
  setPersona: (persona: PersonaId) => void
  triggerRefocus: () => void

  // Confirmation Actions (Email / SMS)
  clearPendingConfirmation: () => void
  confirmAction: () => Promise<void>
  denyAction: () => void

  // Unified Thread Actions
  loadThread: () => Promise<void>
  startNewThread: () => Promise<void>
  switchThread: (threadId: string) => Promise<void>
  patchThreadTitle: (title: string) => void
  setChannelFilter: (channel: MercuryChannel | 'all') => void
  filteredMessages: () => ChatMessage[]
}

// Fire-and-forget persist to Mercury Thread API
function persistToThread(
  threadId: string | null,
  role: 'user' | 'assistant',
  channel: MercuryChannel,
  content: string,
  confidence?: number,
  citations?: Citation[],
): void {
  if (!content.trim()) return
  const body: Record<string, unknown> = { role, channel, content }
  if (threadId) body.threadId = threadId
  if (confidence !== undefined) body.confidence = confidence
  if (citations) body.citations = citations

  fetch('/api/mercury/thread/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch((err) => {
    console.warn('[MercuryStore] Thread persist failed:', err)
  })
}

export const useMercuryStore = create<MercuryState>()(
  devtools((set, get) => ({
    messages: [],
    inputValue: '',
    isStreaming: false,
    streamingContent: '',
    abortController: null,
    attachments: [],
    selectedLlm: { provider: 'aegis', model: 'aegis-core' },
    activePersona: 'ceo',
    isRefocusing: false,
    activeSessionId: null,
    sessionQueryCount: 0,
    sessionTopics: [],
    temperaturePreset: 'executive-cpo',
    pendingAction: null,
    pendingConfirmation: null,
    threadId: null,
    threadLoaded: false,
    titlePatched: false,
    channelFilter: 'all',

    setInputValue: (value) => set({ inputValue: value }),

    sendMessage: async (privilegeMode) => {
      const { inputValue, messages } = get()
      if (!inputValue.trim() || get().isStreaming) return

      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: inputValue,
        timestamp: new Date(),
        channel: 'dashboard',
      }

      const abortController = new AbortController()

      set({
        messages: [...messages, userMessage],
        inputValue: '',
        isStreaming: true,
        streamingContent: '',
        abortController,
        pendingAction: null,
      })

      // Persist user message to thread (fire-and-forget)
      persistToThread(get().threadId, 'user', 'dashboard', inputValue)

      // Auto-title: use first message as thread title
      if (!get().titlePatched) {
        get().patchThreadTitle(inputValue.trim())
      }

      try {
        // Tool routing: check if message matches a tool pattern before hitting the backend
        const toolIntent = detectToolIntent(inputValue)
        if (toolIntent) {
          const authHeaders: HeadersInit = {}
          try {
            const { getSession } = await import('next-auth/react')
            const session = await getSession()
            const accessToken = (session as Record<string, unknown> | null)?.accessToken as string | undefined
            if (accessToken) {
              (authHeaders as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`
            }
          } catch {
            // cookies sent automatically for same-origin
          }

          const toolResult: ToolResult = await executeTool(toolIntent.tool, toolIntent.args, authHeaders)

          const assistantMessage: ChatMessage = {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: toolResult.display,
            timestamp: new Date(),
            channel: 'dashboard',
          }

          set((state) => ({
            messages: [...state.messages, assistantMessage],
            isStreaming: false,
            streamingContent: '',
            abortController: null,
            pendingAction: toolResult.action || null,
            pendingConfirmation: toolResult.requiresConfirmation && toolResult.confirmationPayload
              ? { type: toolResult.confirmationPayload.type as string, payload: toolResult.confirmationPayload }
              : null,
            sessionQueryCount: state.sessionQueryCount + 1,
          }))

          // Persist tool result to thread
          persistToThread(get().threadId, 'assistant', 'dashboard', toolResult.display)
          return
        }

        // Build request body with persona + optional BYOLLM routing
        const { selectedLlm, activePersona } = get()
        const chatBody: Record<string, unknown> = {
          query: inputValue,
          stream: true,
          useVectorPipeline: true,
          privilegeMode,
          maxTier: 3,
          personaId: activePersona,
          history: messages.map(m => ({ role: m.role, content: m.content })),
        }
        if (selectedLlm.provider === 'byollm') {
          chatBody.llmProvider = 'byollm'
          chatBody.llmModel = selectedLlm.model
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
                      modelUsed = data.modelUsed ?? modelUsed
                      provider = data.provider ?? provider
                      latencyMs = data.latencyMs ?? latencyMs
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

        // Build structured citation blocks from raw citations
        const blocks = citations && citations.length > 0
          ? toCitationBlocks(
              citations.map((c, i) => ({
                citationIndex: c.citationIndex ?? i,
                documentId: c.documentId ?? '',
                documentName: c.documentName ?? 'Document',
                excerpt: c.excerpt ?? '',
                relevanceScore: c.relevanceScore ?? 0,
              })),
              inputValue,
              fullContent
            )
          : undefined

        const assistantMessage: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: fullContent || 'No response generated.',
          timestamp: new Date(),
          confidence,
          citations,
          citationBlocks: blocks,
          channel: 'dashboard',
          modelUsed,
          provider,
          latencyMs,
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

        // Persist assistant response to thread
        persistToThread(get().threadId, 'assistant', 'dashboard', fullContent || 'No response generated.', confidence, citations)
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

    clearConversation: () => {
      const { threadId } = get()
      set({
        messages: [],
        streamingContent: '',
        attachments: [],
        sessionQueryCount: 0,
        sessionTopics: [],
        threadLoaded: false,
        titlePatched: false,
      })
      // Delete persisted messages from server, targeting current thread
      fetch('/api/mercury/thread/messages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId }),
      }).then(() => {
        // Re-arm loadThread so next mount fetches fresh (empty) state
        set({ threadLoaded: true })
      }).catch(() => {
        set({ threadLoaded: true })
      })
    },

    setTemperaturePreset: (preset) => set({ temperaturePreset: preset }),

    clearPendingAction: () => set({ pendingAction: null }),

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

    // BYOLLM Actions
    setSelectedLlm: (llm) => set({ selectedLlm: llm }),

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

    // Confirmation Actions (Email / SMS)
    clearPendingConfirmation: () => set({ pendingConfirmation: null }),

    confirmAction: async () => {
      const { pendingConfirmation } = get()
      if (!pendingConfirmation) return

      const payload = pendingConfirmation.payload
      const actionType = pendingConfirmation.type

      set({ pendingConfirmation: null })

      try {
        let endpoint = ''
        let body: Record<string, unknown> = {}

        if (actionType === 'send_email') {
          endpoint = '/api/mercury/actions/send-email'
          body = { to: payload.to, subject: payload.subject, body: payload.body }

          // Inject agentId if persona has email enabled
          try {
            const personaRes = await fetch('/api/persona')
            if (personaRes.ok) {
              const personaJson = await personaRes.json()
              const persona = personaJson.data?.persona
              if (persona?.emailEnabled && persona?.id) {
                body.agentId = persona.id
              }
            }
          } catch {
            // Non-fatal — falls back to legacy session-user mode
          }
        } else if (actionType === 'send_sms') {
          endpoint = '/api/mercury/actions/send-sms'
          body = { to: payload.to, body: payload.body }
        } else {
          return
        }

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        const data = await res.json()
        const label = actionType === 'send_email' ? 'Email' : 'SMS'
        const recipient = payload.to as string

        const resultMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: data.success
            ? `${label} sent to ${recipient}`
            : `Could not send ${label.toLowerCase()}: ${data.error || 'Unknown error'}`,
          timestamp: new Date(),
          channel: 'dashboard',
        }

        set((state) => ({
          messages: [...state.messages, resultMsg],
        }))

        persistToThread(get().threadId, 'assistant', 'dashboard', resultMsg.content)
      } catch (error) {
        const errMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: `Failed to send: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date(),
          channel: 'dashboard',
          isError: true,
        }
        set((state) => ({
          messages: [...state.messages, errMsg],
        }))
      }
    },

    denyAction: () => {
      const msg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'Action cancelled.',
        timestamp: new Date(),
        channel: 'dashboard',
      }
      set((state) => ({
        messages: [...state.messages, msg],
        pendingConfirmation: null,
      }))
    },

    // Unified Thread Actions
    loadThread: async () => {
      if (get().threadLoaded) return
      try {
        // 1. Get or create thread
        const threadRes = await fetch('/api/mercury/thread')
        if (!threadRes.ok) return
        const threadData = await threadRes.json()
        const threadId = threadData.data?.id
        if (!threadId) return

        set({ threadId })

        // 2. Load recent messages
        const msgRes = await fetch(`/api/mercury/thread/messages?threadId=${threadId}&limit=100`)
        if (!msgRes.ok) {
          set({ threadLoaded: true })
          return
        }
        const msgData = await msgRes.json()
        const serverMessages: ChatMessage[] = (msgData.data?.messages || []).map(
          (m: { id: string; role: string; channel: string; content: string; confidence?: number; citations?: unknown; metadata?: Record<string, unknown>; createdAt: string }) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: new Date(m.createdAt),
            confidence: m.confidence ?? undefined,
            citations: m.citations as Citation[] | undefined,
            channel: m.channel as MercuryChannel,
            metadata: m.metadata ?? undefined,
          })
        )

        // Merge with existing local messages, deduplicate by ID
        const existing = get().messages
        const seen = new Set<string>()
        const merged: ChatMessage[] = []
        for (const msg of [...serverMessages, ...existing]) {
          if (!seen.has(msg.id)) {
            seen.add(msg.id)
            merged.push(msg)
          }
        }
        merged.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
        set({ messages: merged, threadLoaded: true })
      } catch (error) {
        console.warn('[MercuryStore] Failed to load thread:', error)
        set({ threadLoaded: true })
      }
    },

    startNewThread: async () => {
      try {
        const res = await fetch('/api/mercury/thread', { method: 'POST' })
        if (!res.ok) throw new Error('Failed to create thread')
        const data = await res.json()
        const newId = data.data?.id
        if (!newId) throw new Error('No thread ID returned')

        set({
          threadId: newId,
          messages: [],
          attachments: [],
          sessionQueryCount: 0,
          sessionTopics: [],
          titlePatched: false,
          threadLoaded: true,
        })
      } catch (error) {
        console.warn('[MercuryStore] Failed to create new thread:', error)
      }
    },

    switchThread: async (targetThreadId) => {
      if (get().threadId === targetThreadId) return

      try {
        const res = await fetch(
          `/api/mercury/thread/messages?threadId=${targetThreadId}&limit=100`,
        )
        if (!res.ok) throw new Error('Failed to load thread messages')
        const data = await res.json()

        const serverMessages: ChatMessage[] = (data.data?.messages || []).map(
          (m: { id: string; role: string; channel: string; content: string; confidence?: number; citations?: unknown; metadata?: Record<string, unknown>; createdAt: string }) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: new Date(m.createdAt),
            confidence: m.confidence ?? undefined,
            citations: m.citations as Citation[] | undefined,
            channel: m.channel as MercuryChannel,
            metadata: m.metadata ?? undefined,
          }),
        )

        set({
          threadId: targetThreadId,
          messages: serverMessages,
          attachments: [],
          sessionQueryCount: 0,
          sessionTopics: [],
          titlePatched: true,
          threadLoaded: true,
        })
      } catch (error) {
        console.warn('[MercuryStore] Failed to switch thread:', error)
      }
    },

    patchThreadTitle: (title) => {
      const { threadId } = get()
      if (!threadId) return

      set({ titlePatched: true })

      // Fire-and-forget PATCH
      fetch('/api/mercury/thread', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, title: title.slice(0, 50) }),
      }).catch((err) => {
        console.warn('[MercuryStore] Thread title patch failed:', err)
      })
    },

    setChannelFilter: (channel) => set({ channelFilter: channel }),

    filteredMessages: () => {
      const { messages, channelFilter } = get()
      if (channelFilter === 'all') return messages
      return messages.filter((m) => m.channel === channelFilter)
    },
  }))
)
