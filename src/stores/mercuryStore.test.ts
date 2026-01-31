/**
 * Store-level tests for mercuryStore.
 *
 * These tests verify payload shape and state transitions via mocked fetch.
 * They do NOT exercise actual API route processing. For backend route coverage,
 * see src/app/api/documents/[id]/privilege/route.test.ts.
 */
import { useMercuryStore } from './mercuryStore'

// ── Helpers ──────────────────────────────────────────────────

/** Encode a series of SSE `data:` frames into a single ReadableStream. */
function sseStream(frames: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const payload = frames.map(f => `data: ${f}\n\n`).join('')
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
  global.fetch = jest.fn()
})

afterAll(() => {
  global.fetch = originalFetch
})

// ── Tests ────────────────────────────────────────────────────

describe('mercuryStore', () => {
  describe('sendMessage – request payload', () => {
    test('sends correct API contract fields', async () => {
      const stream = sseStream([
        JSON.stringify({ type: 'token', content: 'ok' }),
        '[DONE]',
      ])
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(stream))

      useMercuryStore.setState({ inputValue: 'hello' })
      await useMercuryStore.getState().sendMessage(true)

      const call = (global.fetch as jest.Mock).mock.calls[0]
      expect(call[0]).toBe('/api/chat')

      const body = JSON.parse(call[1].body)
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
      const stream = sseStream([JSON.stringify({ type: 'done', fullText: 'x' })])
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(stream))

      useMercuryStore.setState({
        inputValue: 'follow-up',
        messages: [
          { id: '1', role: 'user', content: 'first', timestamp: new Date() },
          { id: '2', role: 'assistant', content: 'reply', timestamp: new Date() },
        ],
      })
      await useMercuryStore.getState().sendMessage(false)

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
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

  describe('sendMessage – SSE type-based parsing', () => {
    test('accumulates token events into streaming content', async () => {
      const stream = sseStream([
        JSON.stringify({ type: 'token', content: 'Hello' }),
        JSON.stringify({ type: 'token', content: ' world' }),
        '[DONE]',
      ])
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(stream))

      useMercuryStore.setState({ inputValue: 'hi' })
      await useMercuryStore.getState().sendMessage(false)

      const state = useMercuryStore.getState()
      const last = state.messages[state.messages.length - 1]
      expect(last.content).toBe('Hello world')
      expect(last.role).toBe('assistant')
      expect(state.isStreaming).toBe(false)
    })

    test('done event overwrites accumulated content with fullText', async () => {
      const stream = sseStream([
        JSON.stringify({ type: 'token', content: 'partial' }),
        JSON.stringify({ type: 'done', fullText: 'Final complete answer.' }),
      ])
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(stream))

      useMercuryStore.setState({ inputValue: 'q' })
      await useMercuryStore.getState().sendMessage(false)

      const last = useMercuryStore.getState().messages.at(-1)
      expect(last?.content).toBe('Final complete answer.')
    })

    test('complete event extracts answer, confidence, and citations', async () => {
      const citations = [
        { citationIndex: 1, documentId: 'd1', documentName: 'doc.pdf', excerpt: 'ex', relevanceScore: 0.9 },
      ]
      const stream = sseStream([
        JSON.stringify({ type: 'complete', answer: 'RAG answer', confidence: 0.92, citations }),
      ])
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(stream))

      useMercuryStore.setState({ inputValue: 'q' })
      await useMercuryStore.getState().sendMessage(false)

      const last = useMercuryStore.getState().messages.at(-1)
      expect(last?.content).toBe('RAG answer')
      expect(last?.confidence).toBe(0.92)
      expect(last?.citations).toEqual(citations)
    })

    test('error event surfaces as error message', async () => {
      const stream = sseStream([
        JSON.stringify({ type: 'error', message: 'Rate limited' }),
      ])
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(stream))

      useMercuryStore.setState({ inputValue: 'q' })
      await useMercuryStore.getState().sendMessage(false)

      const state = useMercuryStore.getState()
      const last = state.messages.at(-1)
      expect(last?.isError).toBe(true)
      expect(state.isStreaming).toBe(false)
    })

    test('skips malformed JSON lines without crashing', async () => {
      const stream = sseStream([
        '{bad json',
        JSON.stringify({ type: 'token', content: 'ok' }),
      ])
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(stream))

      useMercuryStore.setState({ inputValue: 'q' })
      await useMercuryStore.getState().sendMessage(false)

      const last = useMercuryStore.getState().messages.at(-1)
      expect(last?.content).toBe('ok')
    })
  })

  describe('sendMessage – JSON fallback', () => {
    test('parses nested data.answer from JSON response', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(
        jsonResponse({ success: true, data: { answer: 'JSON answer', confidence: 0.88 } }),
      )

      useMercuryStore.setState({ inputValue: 'q' })
      await useMercuryStore.getState().sendMessage(false)

      const last = useMercuryStore.getState().messages.at(-1)
      expect(last?.content).toBe('JSON answer')
      expect(last?.confidence).toBe(0.88)
    })

    test('falls back to top-level answer when data wrapper missing', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(
        jsonResponse({ answer: 'flat answer', confidence: 0.75 }),
      )

      useMercuryStore.setState({ inputValue: 'q' })
      await useMercuryStore.getState().sendMessage(false)

      const last = useMercuryStore.getState().messages.at(-1)
      expect(last?.content).toBe('flat answer')
    })
  })

  describe('sendMessage – error handling', () => {
    test('adds error message on non-ok response', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(
        mockResponse(null, { ok: false }),
      )

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
})
