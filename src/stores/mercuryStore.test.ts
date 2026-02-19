/**
 * Store-level tests for mercuryStore.
 *
 * These tests verify payload shape and state transitions via mocked fetch.
 * They do NOT exercise actual API route processing. For backend route coverage,
 * see src/app/api/documents/[id]/privilege/route.test.ts.
 */
import { useMercuryStore } from './mercuryStore'
import { executeTool } from '@/lib/mercury/toolExecutor'

jest.mock('@/lib/mercury/toolExecutor', () => ({
  executeTool: jest.fn(),
}))

const mockExecuteTool = executeTool as jest.MockedFunction<typeof executeTool>

// ── Helpers ──────────────────────────────────────────────────

/** Encode a series of SSE messages into a single ReadableStream.
 *  Each frame is an object { event, data } matching standard SSE format:
 *  "event: <type>\ndata: <json>\n\n"
 */
function sseStream(frames: Array<{ event: string; data: string }>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const payload = frames.map(f => `event: ${f.event}\ndata: ${f.data}\n\n`).join('')
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(payload))
      controller.close()
    },
  })
}

/** Build a minimal Response-like object for mocking fetch. */
function mockResponse(
  body: ReadableStream<Uint8Array> | null,
  opts: { ok?: boolean; contentType?: string } = {},
) {
  const { ok = true, contentType = 'text/event-stream' } = opts
  return {
    ok,
    headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? contentType : null) },
    body,
    json: async () => {
      // Only used for JSON fallback path
      const reader = body?.getReader()
      if (!reader) return {}
      const { value } = await reader.read()
      reader.releaseLock()
      return JSON.parse(new TextDecoder().decode(value))
    },
  }
}

function jsonResponse(payload: object) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(encoder.encode(JSON.stringify(payload)))
      c.close()
    },
  })
  return mockResponse(stream, { contentType: 'application/json' })
}

// ── Setup / Teardown ─────────────────────────────────────────

const originalFetch = global.fetch

/** Default fetch mock that satisfies fire-and-forget calls (persistToThread, etc.) */
const defaultFetchResponse = { ok: true, json: async () => ({}) }

beforeEach(() => {
  // Reset Zustand store between tests
  useMercuryStore.setState({
    messages: [],
    inputValue: '',
    isStreaming: false,
    streamingContent: '',
    abortController: null,
    temperaturePreset: 'executive-cpo',
  })
  global.fetch = jest.fn().mockResolvedValue(defaultFetchResponse)
})

afterAll(() => {
  global.fetch = originalFetch
})

// ── Tests ────────────────────────────────────────────────────

describe('mercuryStore', () => {
  describe('sendMessage – request payload', () => {
    test('sends correct API contract fields', async () => {
      const stream = sseStream([
        { event: 'token', data: JSON.stringify({ text: 'ok' }) },
        { event: 'done', data: '{}' },
      ])
      ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === '/api/chat') return Promise.resolve(mockResponse(stream))
        return Promise.resolve(defaultFetchResponse)
      })

      useMercuryStore.setState({ inputValue: 'hello' })
      await useMercuryStore.getState().sendMessage(true)

      const chatCall = (global.fetch as jest.Mock).mock.calls.find(
        (c: unknown[]) => c[0] === '/api/chat'
      )
      expect(chatCall).toBeDefined()

      const body = JSON.parse(chatCall[1].body)
      expect(body).toEqual({
        query: 'hello',
        stream: true,
        useVectorPipeline: true,
        privilegeMode: true,
        maxTier: 3,
        history: [],
      })
    })

    test('includes message history in request', async () => {
      const stream = sseStream([
        { event: 'token', data: JSON.stringify({ text: 'x' }) },
        { event: 'done', data: '{}' },
      ])
      ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === '/api/chat') return Promise.resolve(mockResponse(stream))
        return Promise.resolve(defaultFetchResponse)
      })

      useMercuryStore.setState({
        inputValue: 'follow-up',
        messages: [
          { id: '1', role: 'user', content: 'first', timestamp: new Date() },
          { id: '2', role: 'assistant', content: 'reply', timestamp: new Date() },
        ],
      })
      await useMercuryStore.getState().sendMessage(false)

      const chatCall = (global.fetch as jest.Mock).mock.calls.find(
        (c: unknown[]) => c[0] === '/api/chat'
      )
      const body = JSON.parse(chatCall[1].body)
      expect(body.history).toEqual([
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'reply' },
      ])
    })

    test('does not send when input is empty', async () => {
      useMercuryStore.setState({ inputValue: '   ' })
      await useMercuryStore.getState().sendMessage(false)
      expect(global.fetch).not.toHaveBeenCalled()
    })

    test('does not send when already streaming', async () => {
      useMercuryStore.setState({ inputValue: 'test', isStreaming: true })
      await useMercuryStore.getState().sendMessage(false)
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  describe('sendMessage – SSE event-based parsing', () => {
    test('accumulates token events into streaming content', async () => {
      const stream = sseStream([
        { event: 'token', data: JSON.stringify({ text: 'Hello' }) },
        { event: 'token', data: JSON.stringify({ text: ' world' }) },
        { event: 'done', data: '{}' },
      ])
      ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === '/api/chat') return Promise.resolve(mockResponse(stream))
        return Promise.resolve(defaultFetchResponse)
      })

      useMercuryStore.setState({ inputValue: 'hi' })
      await useMercuryStore.getState().sendMessage(false)

      const state = useMercuryStore.getState()
      const last = state.messages[state.messages.length - 1]
      expect(last.content).toBe('Hello world')
      expect(last.role).toBe('assistant')
      expect(state.isStreaming).toBe(false)
    })

    test('citations event extracts citation array', async () => {
      const citations = [
        { chunkId: 'c1', documentId: 'd1', excerpt: 'ex', relevance: 0.9, index: 1 },
      ]
      const stream = sseStream([
        { event: 'token', data: JSON.stringify({ text: 'RAG answer' }) },
        { event: 'citations', data: JSON.stringify(citations) },
        { event: 'confidence', data: JSON.stringify({ score: 0.92, iterations: 1 }) },
        { event: 'done', data: '{}' },
      ])
      ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === '/api/chat') return Promise.resolve(mockResponse(stream))
        return Promise.resolve(defaultFetchResponse)
      })

      useMercuryStore.setState({ inputValue: 'q' })
      await useMercuryStore.getState().sendMessage(false)

      const last = useMercuryStore.getState().messages.at(-1)
      expect(last?.content).toBe('RAG answer')
      expect(last?.confidence).toBe(0.92)
      expect(last?.citations).toEqual(citations)
    })

    test('silence event uses message as content', async () => {
      const stream = sseStream([
        { event: 'status', data: JSON.stringify({ stage: 'retrieving' }) },
        { event: 'silence', data: JSON.stringify({
          message: 'Cannot provide a grounded answer.',
          confidence: 0,
          suggestions: ['Upload more docs'],
          protocol: 'SILENCE_PROTOCOL',
        }) },
        { event: 'done', data: '{}' },
      ])
      ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === '/api/chat') return Promise.resolve(mockResponse(stream))
        return Promise.resolve(defaultFetchResponse)
      })

      useMercuryStore.setState({ inputValue: 'q' })
      await useMercuryStore.getState().sendMessage(false)

      const last = useMercuryStore.getState().messages.at(-1)
      expect(last?.content).toBe('Cannot provide a grounded answer.')
      expect(last?.confidence).toBe(0)
    })

    test('skips malformed JSON lines without crashing', async () => {
      const encoder = new TextEncoder()
      // Manually craft a stream with one bad and one good message
      const payload = 'event: token\ndata: {bad json\n\nevent: token\ndata: {"text":"ok"}\n\n'
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(payload))
          controller.close()
        },
      })
      ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === '/api/chat') return Promise.resolve(mockResponse(stream))
        return Promise.resolve(defaultFetchResponse)
      })

      useMercuryStore.setState({ inputValue: 'q' })
      await useMercuryStore.getState().sendMessage(false)

      const last = useMercuryStore.getState().messages.at(-1)
      expect(last?.content).toBe('ok')
    })
  })

  describe('sendMessage – JSON fallback', () => {
    test('parses nested data.answer from JSON response', async () => {
      ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === '/api/chat') return Promise.resolve(
          jsonResponse({ success: true, data: { answer: 'JSON answer', confidence: 0.88 } }),
        )
        return Promise.resolve(defaultFetchResponse)
      })

      useMercuryStore.setState({ inputValue: 'q' })
      await useMercuryStore.getState().sendMessage(false)

      const last = useMercuryStore.getState().messages.at(-1)
      expect(last?.content).toBe('JSON answer')
      expect(last?.confidence).toBe(0.88)
    })

    test('falls back to top-level answer when data wrapper missing', async () => {
      ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === '/api/chat') return Promise.resolve(
          jsonResponse({ answer: 'flat answer', confidence: 0.75 }),
        )
        return Promise.resolve(defaultFetchResponse)
      })

      useMercuryStore.setState({ inputValue: 'q' })
      await useMercuryStore.getState().sendMessage(false)

      const last = useMercuryStore.getState().messages.at(-1)
      expect(last?.content).toBe('flat answer')
    })
  })

  describe('sendMessage – error handling', () => {
    test('adds error message on non-ok response', async () => {
      ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === '/api/chat') return Promise.resolve(mockResponse(null, { ok: false }))
        return Promise.resolve(defaultFetchResponse)
      })

      useMercuryStore.setState({ inputValue: 'q' })
      await useMercuryStore.getState().sendMessage(false)

      const state = useMercuryStore.getState()
      expect(state.isStreaming).toBe(false)
      expect(state.messages.at(-1)?.isError).toBe(true)
    })
  })

  describe('state shape', () => {
    test('does not have openVaultIds or setOpenVaults', () => {
      const state = useMercuryStore.getState() as unknown as Record<string, unknown>
      expect(state).not.toHaveProperty('openVaultIds')
      expect(state).not.toHaveProperty('setOpenVaults')
    })
  })

  describe('startNewThread', () => {
    test('creates thread and resets state', async () => {
      const newThread = { id: 'thread-new', title: 'New Chat', createdAt: '2025-01-01', updatedAt: '2025-01-01' }

      ;(global.fetch as jest.Mock).mockImplementation((url: string, opts?: RequestInit) => {
        if (url === '/api/mercury/thread' && opts?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: newThread }),
          })
        }
        return Promise.resolve(defaultFetchResponse)
      })

      // Pre-populate state to verify reset
      useMercuryStore.setState({
        threadId: 'old-thread',
        messages: [{ id: '1', role: 'user', content: 'old', timestamp: new Date() }],
        sessionQueryCount: 5,
        sessionTopics: ['topic1'],
        titlePatched: true,
      })

      await useMercuryStore.getState().startNewThread()

      const state = useMercuryStore.getState()
      expect(state.threadId).toBe('thread-new')
      expect(state.messages).toEqual([])
      expect(state.sessionQueryCount).toBe(0)
      expect(state.sessionTopics).toEqual([])
      expect(state.titlePatched).toBe(false)
      expect(state.threadLoaded).toBe(true)
    })
  })

  describe('switchThread', () => {
    test('loads messages for target thread', async () => {
      const targetMessages = [
        { id: 'msg-1', role: 'user', channel: 'dashboard', content: 'hello', createdAt: '2025-01-01T00:00:00Z' },
        { id: 'msg-2', role: 'assistant', channel: 'dashboard', content: 'hi', createdAt: '2025-01-01T00:01:00Z' },
      ]

      ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.startsWith('/api/mercury/thread/messages?threadId=thread-target')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: { messages: targetMessages } }),
          })
        }
        return Promise.resolve(defaultFetchResponse)
      })

      useMercuryStore.setState({ threadId: 'thread-current' })

      await useMercuryStore.getState().switchThread('thread-target')

      const state = useMercuryStore.getState()
      expect(state.threadId).toBe('thread-target')
      expect(state.messages).toHaveLength(2)
      expect(state.messages[0].content).toBe('hello')
      expect(state.messages[1].content).toBe('hi')
      expect(state.titlePatched).toBe(true)
      expect(state.sessionQueryCount).toBe(0)
    })

    test('is no-op for active threadId', async () => {
      useMercuryStore.setState({ threadId: 'same-thread' })

      await useMercuryStore.getState().switchThread('same-thread')

      // fetch should not have been called (beyond default mock setup)
      const fetchCalls = (global.fetch as jest.Mock).mock.calls.filter(
        (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('thread/messages?threadId=same-thread'),
      )
      expect(fetchCalls).toHaveLength(0)
    })
  })

  describe('patchThreadTitle', () => {
    test('fires PATCH request and sets titlePatched', () => {
      useMercuryStore.setState({ threadId: 'thread-123', titlePatched: false })

      useMercuryStore.getState().patchThreadTitle('My First Chat')

      expect(useMercuryStore.getState().titlePatched).toBe(true)

      const patchCall = (global.fetch as jest.Mock).mock.calls.find(
        (c: unknown[]) => c[0] === '/api/mercury/thread' && (c[1] as RequestInit)?.method === 'PATCH',
      )
      expect(patchCall).toBeDefined()

      const body = JSON.parse((patchCall[1] as RequestInit).body as string)
      expect(body.threadId).toBe('thread-123')
      expect(body.title).toBe('My First Chat')
    })

    test('truncates title to 50 characters', () => {
      useMercuryStore.setState({ threadId: 'thread-123' })
      const longTitle = 'A'.repeat(80)

      useMercuryStore.getState().patchThreadTitle(longTitle)

      const patchCall = (global.fetch as jest.Mock).mock.calls.find(
        (c: unknown[]) => c[0] === '/api/mercury/thread' && (c[1] as RequestInit)?.method === 'PATCH',
      )
      const body = JSON.parse((patchCall[1] as RequestInit).body as string)
      expect(body.title).toHaveLength(50)
    })

    test('does nothing when threadId is null', () => {
      useMercuryStore.setState({ threadId: null, titlePatched: false })

      useMercuryStore.getState().patchThreadTitle('test')

      // titlePatched should remain false
      expect(useMercuryStore.getState().titlePatched).toBe(false)
      // No PATCH call should have been made
      const patchCalls = (global.fetch as jest.Mock).mock.calls.filter(
        (c: unknown[]) => (c[1] as RequestInit)?.method === 'PATCH',
      )
      expect(patchCalls).toHaveLength(0)
    })
  })

  describe('sendMessage – tool routing vs RAG dispatch (Silence Protocol bypass)', () => {
    test('"what files are in my vault?" routes to list_documents tool, NOT /api/chat', async () => {
      mockExecuteTool.mockResolvedValue({
        success: true,
        data: [],
        display: 'You have 3 documents in your vault.',
      })

      useMercuryStore.setState({ inputValue: 'what files are in my vault?' })
      await useMercuryStore.getState().sendMessage(false)

      // Tool executor was called with list_documents
      expect(mockExecuteTool).toHaveBeenCalledWith('list_documents', {}, expect.any(Object))

      // /api/chat was NOT called (tool-routed queries skip RAG entirely)
      const chatCalls = (global.fetch as jest.Mock).mock.calls.filter(
        (c: unknown[]) => c[0] === '/api/chat',
      )
      expect(chatCalls).toHaveLength(0)

      // Response is the tool result, not a RAG answer
      const last = useMercuryStore.getState().messages.at(-1)
      expect(last?.content).toBe('You have 3 documents in your vault.')
      expect(last?.role).toBe('assistant')
    })

    test('"tell me about contract terms" routes to /api/chat (normal RAG path)', async () => {
      const stream = sseStream([
        { event: 'token', data: JSON.stringify({ text: 'The contract terms state...' }) },
        { event: 'done', data: '{}' },
      ])
      ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === '/api/chat') return Promise.resolve(mockResponse(stream))
        return Promise.resolve(defaultFetchResponse)
      })

      mockExecuteTool.mockClear()

      useMercuryStore.setState({ inputValue: 'tell me about contract terms' })
      await useMercuryStore.getState().sendMessage(false)

      // Tool executor was NOT called
      expect(mockExecuteTool).not.toHaveBeenCalled()

      // /api/chat WAS called (normal RAG pipeline)
      const chatCalls = (global.fetch as jest.Mock).mock.calls.filter(
        (c: unknown[]) => c[0] === '/api/chat',
      )
      expect(chatCalls.length).toBeGreaterThan(0)

      // Response comes from the RAG pipeline
      const last = useMercuryStore.getState().messages.at(-1)
      expect(last?.content).toBe('The contract terms state...')
    })
  })
})
