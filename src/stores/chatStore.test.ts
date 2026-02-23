/**
 * Store-level tests for chatStore.
 *
 * Verifies clearThread resets all state fields correctly,
 * including documentScope and documentScopeName (GAP-2).
 * Extended with coverage for sendMessage (SSE + JSON fallback),
 * toggleSafetyMode, setModel, toggleIncognito, stopStreaming,
 * fetchThreads, loadThread, startDocumentChat, and error handling.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock apiFetch BEFORE importing the store
jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(),
  apiUrl: jest.fn((p: string) => p),
}))

import { useChatStore } from './chatStore'
import type { ChatMessage } from '@/types/ragbox'
import { apiFetch } from '@/lib/api'

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>

// ── Helpers ──────────────────────────────────────────────────

/** Dirty up the store so clearThread has something to reset. */
function seedStore() {
  const msg: ChatMessage = {
    id: 'test-msg-1',
    role: 'user',
    content: 'What is this document about?',
    timestamp: new Date(),
  }

  useChatStore.setState({
    threadId: 'thread-abc-123',
    threadTitle: 'Contract Analysis',
    messages: [msg],
    inputValue: 'follow-up question',
    isStreaming: true,
    streamingContent: 'partial response...',
    abortController: new AbortController(),
    documentScope: 'doc-xyz-456',
    documentScopeName: 'NDA_Final.pdf',
    safetyMode: false,
    selectedModel: 'gpt-4o',
  })
}

// ── Tests ────────────────────────────────────────────────────

// ── Globals & fetch mock ─────────────────────────────────────

const originalFetch = global.fetch

beforeEach(() => {
  jest.clearAllMocks()
  // Stub global.fetch used by persistence helpers (createDbThread, persistMessage, etc.)
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: { id: 'thread-persisted-1' } }),
  })

  // Reset to initial state before each test
  useChatStore.setState({
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
  })
})

afterAll(() => {
  global.fetch = originalFetch
})

describe('chatStore.clearThread', () => {
  it('resets thread fields to initial state', () => {
    seedStore()

    // Verify dirty state
    expect(useChatStore.getState().threadId).toBe('thread-abc-123')
    expect(useChatStore.getState().messages).toHaveLength(1)
    expect(useChatStore.getState().threadTitle).toBe('Contract Analysis')

    useChatStore.getState().clearThread()

    const s = useChatStore.getState()
    expect(s.threadId).toBeNull()
    expect(s.threadTitle).toBe('New Chat')
    expect(s.messages).toEqual([])
  })

  it('clears documentScope and documentScopeName', () => {
    seedStore()

    expect(useChatStore.getState().documentScope).toBe('doc-xyz-456')
    expect(useChatStore.getState().documentScopeName).toBe('NDA_Final.pdf')

    useChatStore.getState().clearThread()

    const s = useChatStore.getState()
    expect(s.documentScope).toBeNull()
    expect(s.documentScopeName).toBeNull()
  })

  it('resets transient streaming state', () => {
    seedStore()

    expect(useChatStore.getState().isStreaming).toBe(true)
    expect(useChatStore.getState().streamingContent).toBe('partial response...')
    expect(useChatStore.getState().abortController).not.toBeNull()

    useChatStore.getState().clearThread()

    const s = useChatStore.getState()
    expect(s.isStreaming).toBe(false)
    expect(s.streamingContent).toBe('')
    expect(s.abortController).toBeNull()
    expect(s.inputValue).toBe('')
  })

  it('does not reset safetyMode or selectedModel', () => {
    seedStore()

    // safetyMode was set to false, selectedModel to gpt-4o
    expect(useChatStore.getState().safetyMode).toBe(false)
    expect(useChatStore.getState().selectedModel).toBe('gpt-4o')

    useChatStore.getState().clearThread()

    const s = useChatStore.getState()
    // clearThread should NOT touch user preferences
    expect(s.safetyMode).toBe(false)
    expect(s.selectedModel).toBe('gpt-4o')
  })
})

describe('chatStore.setDocumentScope', () => {
  it('sets documentScope and clears documentScopeName', () => {
    useChatStore.getState().setDocumentScope('doc-new-789')

    const s = useChatStore.getState()
    expect(s.documentScope).toBe('doc-new-789')
    expect(s.documentScopeName).toBeNull()
  })

  it('clears documentScope when passed null', () => {
    seedStore()

    useChatStore.getState().setDocumentScope(null)

    const s = useChatStore.getState()
    expect(s.documentScope).toBeNull()
    expect(s.documentScopeName).toBeNull()
  })
})

// ── SSE helpers ──────────────────────────────────────────────

/** Encode SSE events into a ReadableStream suitable for res.body. */
function sseStream(events: Array<{ event?: string; data: unknown }>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const lines = events.map((e) => {
    const parts: string[] = []
    if (e.event) parts.push(`event: ${e.event}`)
    parts.push(`data: ${JSON.stringify(e.data)}`)
    return parts.join('\n') + '\n\n'
  })
  const payload = encoder.encode(lines.join(''))
  return new ReadableStream({
    start(controller) {
      controller.enqueue(payload)
      controller.close()
    },
  })
}

/** Build a mock Response with SSE content-type and a readable body. */
function mockSSEResponse(events: Array<{ event?: string; data: unknown }>): Response {
  const body = sseStream(events)
  return {
    ok: true,
    headers: new Headers({ 'content-type': 'text/event-stream' }),
    body,
  } as unknown as Response
}

/** Build a mock Response with JSON content-type. */
function mockJSONResponse(payload: unknown): Response {
  return {
    ok: true,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => payload,
    body: null,
  } as unknown as Response
}

// ── toggleSafetyMode ────────────────────────────────────────

describe('chatStore.toggleSafetyMode', () => {
  it('flips safetyMode from true to false', () => {
    expect(useChatStore.getState().safetyMode).toBe(true)
    useChatStore.getState().toggleSafetyMode()
    expect(useChatStore.getState().safetyMode).toBe(false)
  })

  it('flips safetyMode from false to true', () => {
    useChatStore.setState({ safetyMode: false })
    useChatStore.getState().toggleSafetyMode()
    expect(useChatStore.getState().safetyMode).toBe(true)
  })
})

// ── setModel ─────────────────────────────────────────────────

describe('chatStore.setModel', () => {
  it('sets selectedModel to a BYOLLM model string', () => {
    useChatStore.getState().setModel('claude-3-opus')
    expect(useChatStore.getState().selectedModel).toBe('claude-3-opus')
  })

  it('can reset back to aegis', () => {
    useChatStore.getState().setModel('gpt-4o')
    useChatStore.getState().setModel('aegis')
    expect(useChatStore.getState().selectedModel).toBe('aegis')
  })
})

// ── toggleIncognito ──────────────────────────────────────────

describe('chatStore.toggleIncognito', () => {
  it('flips incognitoMode from false to true', () => {
    expect(useChatStore.getState().incognitoMode).toBe(false)
    useChatStore.getState().toggleIncognito()
    expect(useChatStore.getState().incognitoMode).toBe(true)
  })

  it('flips incognitoMode from true to false', () => {
    useChatStore.setState({ incognitoMode: true })
    useChatStore.getState().toggleIncognito()
    expect(useChatStore.getState().incognitoMode).toBe(false)
  })
})

// ── stopStreaming ────────────────────────────────────────────

describe('chatStore.stopStreaming', () => {
  it('aborts the controller and resets streaming state', () => {
    const ac = new AbortController()
    const abortSpy = jest.spyOn(ac, 'abort')
    useChatStore.setState({
      isStreaming: true,
      streamingContent: 'partial...',
      abortController: ac,
    })

    useChatStore.getState().stopStreaming()

    expect(abortSpy).toHaveBeenCalled()
    const s = useChatStore.getState()
    expect(s.isStreaming).toBe(false)
    expect(s.streamingContent).toBe('')
    expect(s.abortController).toBeNull()
  })

  it('is safe to call when no abortController exists', () => {
    useChatStore.setState({ isStreaming: true, abortController: null })
    useChatStore.getState().stopStreaming()
    expect(useChatStore.getState().isStreaming).toBe(false)
  })
})

// ── fetchThreads ─────────────────────────────────────────────

describe('chatStore.fetchThreads', () => {
  it('populates threads from API response', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          threads: [
            { id: 't1', title: 'Thread One', createdAt: '2026-01-01', updatedAt: '2026-01-02', _count: { messages: 5 } },
            { id: 't2', title: null, createdAt: '2026-01-03', updatedAt: '2026-01-04', _count: { messages: 0 } },
          ],
        },
      }),
    })

    await useChatStore.getState().fetchThreads()

    const s = useChatStore.getState()
    expect(s.threadsLoading).toBe(false)
    expect(s.threads).toHaveLength(2)
    expect(s.threads[0]).toEqual({
      id: 't1',
      title: 'Thread One',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-02',
      messageCount: 5,
    })
    // null title falls back to 'Untitled'
    expect(s.threads[1].title).toBe('Untitled')
  })

  it('sets threadsLoading true during fetch and false after', async () => {
    let resolveFetch!: (v: unknown) => void
    ;(global.fetch as jest.Mock).mockReturnValueOnce(
      new Promise((r) => { resolveFetch = r })
    )

    const p = useChatStore.getState().fetchThreads()
    expect(useChatStore.getState().threadsLoading).toBe(true)

    resolveFetch({
      ok: true,
      json: async () => ({ data: { threads: [] } }),
    })
    await p
    expect(useChatStore.getState().threadsLoading).toBe(false)
  })

  it('handles network error gracefully', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network failure'))

    await useChatStore.getState().fetchThreads()

    expect(useChatStore.getState().threadsLoading).toBe(false)
    expect(useChatStore.getState().threads).toEqual([])
  })

  it('handles non-ok response gracefully', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false })

    await useChatStore.getState().fetchThreads()

    expect(useChatStore.getState().threadsLoading).toBe(false)
  })
})

// ── loadThread ───────────────────────────────────────────────

describe('chatStore.loadThread', () => {
  it('populates messages from API and sets threadId', async () => {
    // Pre-populate threads list so loadThread can find the title
    useChatStore.setState({
      threads: [{ id: 'lt-1', title: 'Loaded Thread', createdAt: '', updatedAt: '', messageCount: 2 }],
    })

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          messages: [
            { id: 'm1', role: 'user', content: 'Hello', createdAt: '2026-01-01T00:00:00Z', channel: 'dashboard' },
            { id: 'm2', role: 'assistant', content: 'Hi there', createdAt: '2026-01-01T00:00:01Z', confidence: 0.92 },
          ],
        },
      }),
    })

    await useChatStore.getState().loadThread('lt-1')

    const s = useChatStore.getState()
    expect(s.threadId).toBe('lt-1')
    expect(s.threadTitle).toBe('Loaded Thread')
    expect(s.messages).toHaveLength(2)
    expect(s.messages[0].role).toBe('user')
    expect(s.messages[0].content).toBe('Hello')
    expect(s.messages[1].confidence).toBe(0.92)
    expect(s.isThreadLoading).toBe(false)
  })

  it('sets isThreadLoading true during fetch', async () => {
    let resolveFetch!: (v: unknown) => void
    ;(global.fetch as jest.Mock).mockReturnValueOnce(
      new Promise((r) => { resolveFetch = r })
    )

    const p = useChatStore.getState().loadThread('lt-1')
    expect(useChatStore.getState().isThreadLoading).toBe(true)

    resolveFetch({
      ok: true,
      json: async () => ({ data: { messages: [] } }),
    })
    await p
    expect(useChatStore.getState().isThreadLoading).toBe(false)
  })

  it('falls back to "Chat" when thread not found in threads list', async () => {
    useChatStore.setState({ threads: [] })

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { messages: [] } }),
    })

    await useChatStore.getState().loadThread('unknown-id')

    expect(useChatStore.getState().threadTitle).toBe('Chat')
  })

  it('handles error without crashing', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Fail'))

    await useChatStore.getState().loadThread('fail-id')

    expect(useChatStore.getState().isThreadLoading).toBe(false)
  })

  it('resets documentScope and streaming state on load', async () => {
    useChatStore.setState({
      documentScope: 'doc-old',
      documentScopeName: 'Old.pdf',
      isStreaming: true,
      streamingContent: 'leftover',
    })

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { messages: [] } }),
    })

    await useChatStore.getState().loadThread('lt-clean')

    const s = useChatStore.getState()
    expect(s.documentScope).toBeNull()
    expect(s.documentScopeName).toBeNull()
    expect(s.isStreaming).toBe(false)
    expect(s.streamingContent).toBe('')
  })
})

// ── sendMessage — SSE streaming path ─────────────────────────

describe('chatStore.sendMessage (SSE streaming)', () => {
  it('processes token events and builds assistant message', async () => {
    useChatStore.setState({ inputValue: 'What is contract law?' })

    mockApiFetch.mockResolvedValueOnce(
      mockSSEResponse([
        { event: 'token', data: { text: 'Contract ' } },
        { event: 'token', data: { text: 'law is...' } },
        { event: 'done', data: { answer: 'Contract law is the body of law.', confidence: 0.91 } },
      ]),
    )

    await useChatStore.getState().sendMessage(false)

    const s = useChatStore.getState()
    expect(s.messages).toHaveLength(2)
    expect(s.messages[0].role).toBe('user')
    expect(s.messages[0].content).toBe('What is contract law?')
    expect(s.messages[1].role).toBe('assistant')
    // STORY-173: tokens streamed incrementally are preserved (done.answer is fallback only)
    expect(s.messages[1].content).toBe('Contract law is...')
    expect(s.messages[1].confidence).toBe(0.91)
    expect(s.isStreaming).toBe(false)
    expect(s.inputValue).toBe('')
  })

  it('extracts citations from done event', async () => {
    useChatStore.setState({ inputValue: 'Find references' })

    const testCitations = [
      { citationIndex: 0, documentId: 'doc-1', documentName: 'NDA.pdf', excerpt: 'excerpt text', relevanceScore: 0.88 },
    ]

    mockApiFetch.mockResolvedValueOnce(
      mockSSEResponse([
        { event: 'token', data: { text: 'Answer with citations' } },
        { event: 'done', data: { answer: 'Found reference.', citations: testCitations, confidence: 0.88 } },
      ]),
    )

    await useChatStore.getState().sendMessage(false)

    const assistant = useChatStore.getState().messages[1]
    expect(assistant.citations).toEqual(testCitations)
    expect(assistant.citationBlocks).toBeDefined()
  })

  it('extracts metadata (sources, evidence, model_used) from done event', async () => {
    useChatStore.setState({ inputValue: 'Analyze compliance' })

    mockApiFetch.mockResolvedValueOnce(
      mockSSEResponse([
        {
          event: 'done',
          data: {
            answer: 'Compliance analysis complete.',
            confidence: 0.85,
            sources: [{ id: 's1', name: 'Source 1' }],
            evidence: [{ chunk: 'evidence text' }],
            documents_searched: 5,
            chunks_evaluated: 42,
            model_used: 'gemini-1.5-pro',
            provider: 'vertex',
            latency_ms: 1200,
          },
        },
      ]),
    )

    await useChatStore.getState().sendMessage(false)

    const assistant = useChatStore.getState().messages[1]
    expect(assistant.modelUsed).toBe('gemini-1.5-pro')
    expect(assistant.provider).toBe('vertex')
    expect(assistant.latencyMs).toBe(1200)
    expect(assistant.metadata).toEqual({
      sources: [{ id: 's1', name: 'Source 1' }],
      evidence: [{ chunk: 'evidence text' }],
      modelUsed: 'gemini-1.5-pro',
      provider: 'vertex',
      latencyMs: 1200,
    })
  })

  it('handles done event wrapped in data envelope', async () => {
    useChatStore.setState({ inputValue: 'Wrapped response' })

    mockApiFetch.mockResolvedValueOnce(
      mockSSEResponse([
        {
          event: 'done',
          data: {
            data: {
              answer: 'Unwrapped answer.',
              confidence: 0.77,
            },
          },
        },
      ]),
    )

    await useChatStore.getState().sendMessage(false)

    const assistant = useChatStore.getState().messages[1]
    expect(assistant.content).toBe('Unwrapped answer.')
    expect(assistant.confidence).toBe(0.77)
  })

  it('handles silence event with fallback message', async () => {
    useChatStore.setState({ inputValue: 'Ask about missing topic' })

    mockApiFetch.mockResolvedValueOnce(
      mockSSEResponse([
        { event: 'silence', data: { message: 'Cannot provide grounded answer.', confidence: 0.3 } },
        { event: 'done', data: {} },
      ]),
    )

    await useChatStore.getState().sendMessage(false)

    const assistant = useChatStore.getState().messages[1]
    expect(assistant.content).toBe('Cannot provide grounded answer.')
    expect(assistant.confidence).toBe(0.3)
  })

  it('handles separate citations event before done', async () => {
    useChatStore.setState({ inputValue: 'Citations test' })

    const citArray = [
      { citationIndex: 0, documentId: 'd1', documentName: 'Doc.pdf', excerpt: 'ex', relevanceScore: 0.9 },
    ]

    mockApiFetch.mockResolvedValueOnce(
      mockSSEResponse([
        { event: 'token', data: { text: 'Response text' } },
        { event: 'citations', data: citArray },
        { event: 'confidence', data: { score: 0.92, modelUsed: 'aegis-v2', provider: 'gcp', latencyMs: 800 } },
        { event: 'done', data: {} },
      ]),
    )

    await useChatStore.getState().sendMessage(false)

    const assistant = useChatStore.getState().messages[1]
    expect(assistant.content).toBe('Response text')
    expect(assistant.citations).toEqual(citArray)
    expect(assistant.confidence).toBe(0.92)
    expect(assistant.modelUsed).toBe('aegis-v2')
    expect(assistant.provider).toBe('gcp')
    expect(assistant.latencyMs).toBe(800)
  })

  it('skips malformed JSON in SSE data gracefully', async () => {
    useChatStore.setState({ inputValue: 'Bad JSON test' })

    // Build a custom stream with a malformed SSE event
    const encoder = new TextEncoder()
    const payload = encoder.encode(
      'event: token\ndata: {bad json}\n\n' +
      'event: token\ndata: {"text":"recovered"}\n\n' +
      'event: done\ndata: {"answer":"Final answer."}\n\n'
    )
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(payload); controller.close() },
    })

    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body,
    } as unknown as Response)

    await useChatStore.getState().sendMessage(false)

    const assistant = useChatStore.getState().messages[1]
    // STORY-173: streamed tokens are preserved; done.answer only used as fallback
    expect(assistant.content).toBe('recovered')
  })

  it('falls back to accumulated tokens when done event has no answer', async () => {
    useChatStore.setState({ inputValue: 'No answer field' })

    mockApiFetch.mockResolvedValueOnce(
      mockSSEResponse([
        { event: 'token', data: { text: 'Accumulated ' } },
        { event: 'token', data: { text: 'content.' } },
        { event: 'done', data: { confidence: 0.7 } },
      ]),
    )

    await useChatStore.getState().sendMessage(false)

    const assistant = useChatStore.getState().messages[1]
    expect(assistant.content).toBe('Accumulated content.')
    expect(assistant.confidence).toBe(0.7)
  })
})

// ── sendMessage — JSON fallback path ─────────────────────────

describe('chatStore.sendMessage (JSON fallback)', () => {
  it('parses JSON response with data envelope', async () => {
    useChatStore.setState({ inputValue: 'JSON query' })

    mockApiFetch.mockResolvedValueOnce(
      mockJSONResponse({
        data: {
          answer: 'The JSON answer.',
          confidence: 0.88,
          citations: [{ citationIndex: 0, documentId: 'd1', documentName: 'X.pdf', excerpt: 'text', relevanceScore: 0.9 }],
        },
      }),
    )

    await useChatStore.getState().sendMessage(false)

    const s = useChatStore.getState()
    expect(s.messages).toHaveLength(2)
    expect(s.messages[1].content).toBe('The JSON answer.')
    expect(s.messages[1].confidence).toBe(0.88)
    expect(s.messages[1].citations).toHaveLength(1)
  })

  it('parses JSON response without data envelope', async () => {
    useChatStore.setState({ inputValue: 'Flat JSON query' })

    mockApiFetch.mockResolvedValueOnce(
      mockJSONResponse({
        answer: 'Flat answer.',
        confidence: 0.75,
      }),
    )

    await useChatStore.getState().sendMessage(false)

    expect(useChatStore.getState().messages[1].content).toBe('Flat answer.')
    expect(useChatStore.getState().messages[1].confidence).toBe(0.75)
  })

  it('shows fallback content when JSON has no answer', async () => {
    useChatStore.setState({ inputValue: 'Empty JSON' })

    mockApiFetch.mockResolvedValueOnce(
      mockJSONResponse({}),
    )

    await useChatStore.getState().sendMessage(false)

    expect(useChatStore.getState().messages[1].content).toBe('No response generated.')
  })
})

// ── sendMessage — BYOLLM routing ────────────────────────────

describe('chatStore.sendMessage (BYOLLM routing)', () => {
  it('includes llmProvider and llmModel when selectedModel is not aegis', async () => {
    useChatStore.setState({
      inputValue: 'BYOLLM query',
      selectedModel: 'claude-3-opus',
    })

    mockApiFetch.mockResolvedValueOnce(
      mockJSONResponse({ answer: 'BYOLLM response' }),
    )

    await useChatStore.getState().sendMessage(false)

    expect(mockApiFetch).toHaveBeenCalledTimes(1)
    const callBody = JSON.parse(
      (mockApiFetch.mock.calls[0][1] as RequestInit).body as string,
    )
    expect(callBody.llmProvider).toBe('byollm')
    expect(callBody.llmModel).toBe('claude-3-opus')
  })

  it('does NOT include llmProvider when using aegis', async () => {
    useChatStore.setState({
      inputValue: 'Aegis query',
      selectedModel: 'aegis',
    })

    mockApiFetch.mockResolvedValueOnce(
      mockJSONResponse({ answer: 'Aegis response' }),
    )

    await useChatStore.getState().sendMessage(false)

    const callBody = JSON.parse(
      (mockApiFetch.mock.calls[0][1] as RequestInit).body as string,
    )
    expect(callBody.llmProvider).toBeUndefined()
    expect(callBody.llmModel).toBeUndefined()
  })
})

// ── sendMessage — safetyMode in request body ─────────────────

describe('chatStore.sendMessage (safetyMode)', () => {
  it('sends safetyMode:true in request body by default', async () => {
    useChatStore.setState({ inputValue: 'Safe query' })

    mockApiFetch.mockResolvedValueOnce(
      mockJSONResponse({ answer: 'Safe answer' }),
    )

    await useChatStore.getState().sendMessage(false)

    const callBody = JSON.parse(
      (mockApiFetch.mock.calls[0][1] as RequestInit).body as string,
    )
    expect(callBody.safetyMode).toBe(true)
  })

  it('sends safetyMode:false after toggle', async () => {
    useChatStore.setState({ inputValue: 'Unsafe query', safetyMode: false })

    mockApiFetch.mockResolvedValueOnce(
      mockJSONResponse({ answer: 'Response' }),
    )

    await useChatStore.getState().sendMessage(false)

    const callBody = JSON.parse(
      (mockApiFetch.mock.calls[0][1] as RequestInit).body as string,
    )
    expect(callBody.safetyMode).toBe(false)
  })
})

// ── sendMessage — documentScope in request body ──────────────

describe('chatStore.sendMessage (documentScope)', () => {
  it('includes documentScope when set', async () => {
    useChatStore.setState({
      inputValue: 'Scoped query',
      documentScope: 'doc-scoped-123',
    })

    mockApiFetch.mockResolvedValueOnce(
      mockJSONResponse({ answer: 'Scoped response' }),
    )

    await useChatStore.getState().sendMessage(false)

    const callBody = JSON.parse(
      (mockApiFetch.mock.calls[0][1] as RequestInit).body as string,
    )
    expect(callBody.documentScope).toBe('doc-scoped-123')
  })

  it('omits documentScope when null', async () => {
    useChatStore.setState({
      inputValue: 'Unscoped query',
      documentScope: null,
    })

    mockApiFetch.mockResolvedValueOnce(
      mockJSONResponse({ answer: 'General response' }),
    )

    await useChatStore.getState().sendMessage(false)

    const callBody = JSON.parse(
      (mockApiFetch.mock.calls[0][1] as RequestInit).body as string,
    )
    expect(callBody.documentScope).toBeUndefined()
  })
})

// ── sendMessage — incognitoMode ──────────────────────────────

describe('chatStore.sendMessage (incognitoMode)', () => {
  it('sends X-Incognito header when incognitoMode is true', async () => {
    useChatStore.setState({ inputValue: 'Secret query', incognitoMode: true })

    mockApiFetch.mockResolvedValueOnce(
      mockJSONResponse({ answer: 'Incognito response' }),
    )

    await useChatStore.getState().sendMessage(false)

    const callHeaders = (mockApiFetch.mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(callHeaders['X-Incognito']).toBe('true')
  })

  it('does NOT send X-Incognito header in normal mode', async () => {
    useChatStore.setState({ inputValue: 'Normal query', incognitoMode: false })

    mockApiFetch.mockResolvedValueOnce(
      mockJSONResponse({ answer: 'Normal response' }),
    )

    await useChatStore.getState().sendMessage(false)

    const callHeaders = (mockApiFetch.mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(callHeaders['X-Incognito']).toBeUndefined()
  })

  it('skips DB persistence in incognito mode', async () => {
    useChatStore.setState({ inputValue: 'No persist', incognitoMode: true })

    mockApiFetch.mockResolvedValueOnce(
      mockJSONResponse({ answer: 'Stealth' }),
    )

    await useChatStore.getState().sendMessage(false)

    // Wait for any fire-and-forget async to settle
    await new Promise((r) => setTimeout(r, 50))

    // global.fetch should NOT be called for createDbThread or persistMessage
    // (global.fetch mock calls would be from persistence helpers only,
    //  since apiFetch is separately mocked)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('calls persistence helpers in normal mode', async () => {
    useChatStore.setState({ inputValue: 'Persist me', incognitoMode: false })

    mockApiFetch.mockResolvedValueOnce(
      mockJSONResponse({ answer: 'Persisted' }),
    )

    await useChatStore.getState().sendMessage(false)

    // Wait for fire-and-forget async
    await new Promise((r) => setTimeout(r, 50))

    // Should call createDbThread at minimum (since threadId is null)
    expect(global.fetch).toHaveBeenCalled()
  })
})

// ── sendMessage — error handling ─────────────────────────────

describe('chatStore.sendMessage (error handling)', () => {
  it('adds error message when API returns non-ok', async () => {
    useChatStore.setState({ inputValue: 'Bad request' })

    mockApiFetch.mockResolvedValueOnce({
      ok: false,
      headers: new Headers(),
    } as unknown as Response)

    await useChatStore.getState().sendMessage(false)

    const s = useChatStore.getState()
    // user message + error message
    expect(s.messages).toHaveLength(2)
    expect(s.messages[1].role).toBe('assistant')
    expect(s.messages[1].isError).toBe(true)
    expect(s.messages[1].content).toContain('error occurred')
    expect(s.isStreaming).toBe(false)
  })

  it('adds error message on network failure', async () => {
    useChatStore.setState({ inputValue: 'Network fail' })

    mockApiFetch.mockRejectedValueOnce(new Error('Network error'))

    await useChatStore.getState().sendMessage(false)

    const s = useChatStore.getState()
    expect(s.messages).toHaveLength(2)
    expect(s.messages[1].isError).toBe(true)
    expect(s.isStreaming).toBe(false)
  })

  it('handles AbortError silently without error message', async () => {
    useChatStore.setState({ inputValue: 'Aborted query' })

    const abortError = new DOMException('The operation was aborted', 'AbortError')
    mockApiFetch.mockRejectedValueOnce(abortError)

    await useChatStore.getState().sendMessage(false)

    const s = useChatStore.getState()
    // Only user message, no error message for abort
    expect(s.messages).toHaveLength(1)
    expect(s.isStreaming).toBe(false)
  })

  it('does not send when inputValue is empty', async () => {
    useChatStore.setState({ inputValue: '' })

    await useChatStore.getState().sendMessage(false)

    expect(mockApiFetch).not.toHaveBeenCalled()
    expect(useChatStore.getState().messages).toHaveLength(0)
  })

  it('does not send when inputValue is whitespace only', async () => {
    useChatStore.setState({ inputValue: '   ' })

    await useChatStore.getState().sendMessage(false)

    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('does not send when already streaming', async () => {
    useChatStore.setState({ inputValue: 'Duplicate', isStreaming: true })

    await useChatStore.getState().sendMessage(false)

    expect(mockApiFetch).not.toHaveBeenCalled()
  })
})

// ── sendMessage — privilegeMode & history ────────────────────

describe('chatStore.sendMessage (privilegeMode & history)', () => {
  it('sends privilegeMode:true when passed', async () => {
    useChatStore.setState({ inputValue: 'Privileged query' })

    mockApiFetch.mockResolvedValueOnce(
      mockJSONResponse({ answer: 'Privileged answer' }),
    )

    await useChatStore.getState().sendMessage(true)

    const callBody = JSON.parse(
      (mockApiFetch.mock.calls[0][1] as RequestInit).body as string,
    )
    expect(callBody.privilegeMode).toBe(true)
  })

  it('includes existing messages as history', async () => {
    const priorMsg: ChatMessage = {
      id: 'prior-1',
      role: 'user',
      content: 'Previous question',
      timestamp: new Date(),
    }
    useChatStore.setState({ inputValue: 'Follow up', messages: [priorMsg] })

    mockApiFetch.mockResolvedValueOnce(
      mockJSONResponse({ answer: 'Follow up answer' }),
    )

    await useChatStore.getState().sendMessage(false)

    const callBody = JSON.parse(
      (mockApiFetch.mock.calls[0][1] as RequestInit).body as string,
    )
    expect(callBody.history).toEqual([
      { role: 'user', content: 'Previous question' },
    ])
  })
})

// ── startDocumentChat ────────────────────────────────────────

describe('chatStore.startDocumentChat', () => {
  it('sets document scope and fires sendMessage', async () => {
    mockApiFetch.mockResolvedValueOnce(
      mockJSONResponse({ answer: 'Summary of NDA_Final.pdf' }),
    )

    await useChatStore.getState().startDocumentChat('doc-xyz', 'NDA_Final.pdf')

    const s = useChatStore.getState()
    expect(s.documentScope).toBe('doc-xyz')
    expect(s.documentScopeName).toBe('NDA_Final.pdf')
    // Should have user + assistant message
    expect(s.messages).toHaveLength(2)
    expect(s.messages[0].role).toBe('user')
    expect(s.messages[0].content).toContain('NDA_Final.pdf')
    expect(s.messages[1].role).toBe('assistant')
  })

  it('clears previous thread state before starting', async () => {
    seedStore()
    mockApiFetch.mockResolvedValueOnce(
      mockJSONResponse({ answer: 'Fresh summary' }),
    )

    await useChatStore.getState().startDocumentChat('doc-new', 'New.pdf')

    const s = useChatStore.getState()
    expect(s.threadId).toBeNull()
    expect(s.documentScope).toBe('doc-new')
    expect(s.documentScopeName).toBe('New.pdf')
    // Old messages should be replaced
    expect(s.messages[0].content).toContain('New.pdf')
  })
})

// ── setSidebarOpen ───────────────────────────────────────────

describe('chatStore.setSidebarOpen', () => {
  it('sets sidebarOpen to true', () => {
    useChatStore.getState().setSidebarOpen(true)
    expect(useChatStore.getState().sidebarOpen).toBe(true)
  })

  it('sets sidebarOpen to false', () => {
    useChatStore.setState({ sidebarOpen: true })
    useChatStore.getState().setSidebarOpen(false)
    expect(useChatStore.getState().sidebarOpen).toBe(false)
  })
})

// ── setInputValue ────────────────────────────────────────────

describe('chatStore.setInputValue', () => {
  it('updates inputValue in state', () => {
    useChatStore.getState().setInputValue('hello world')
    expect(useChatStore.getState().inputValue).toBe('hello world')
  })

  it('can set to empty string', () => {
    useChatStore.setState({ inputValue: 'something' })
    useChatStore.getState().setInputValue('')
    expect(useChatStore.getState().inputValue).toBe('')
  })
})
