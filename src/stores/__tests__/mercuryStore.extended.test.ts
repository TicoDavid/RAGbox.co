/**
 * Extended store-level tests for mercuryStore.
 *
 * Covers silence protocol handling, abort/stop streaming,
 * attachment management, persona switching, and additional edge cases
 * not covered by the base mercuryStore.test.ts.
 */
import { useMercuryStore } from '../mercuryStore'

// ── Helpers ──────────────────────────────────────────────────

/** Encode SSE messages with proper event: + data: format. */
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
      const reader = body?.getReader()
      if (!reader) return {}
      const { value } = await reader.read()
      reader.releaseLock()
      return JSON.parse(new TextDecoder().decode(value))
    },
  }
}

// ── Setup / Teardown ─────────────────────────────────────────

const originalFetch = global.fetch

beforeEach(() => {
  useMercuryStore.setState({
    messages: [],
    inputValue: '',
    isStreaming: false,
    streamingContent: '',
    abortController: null,
    temperaturePreset: 'executive-cpo',
    attachments: [],
    activePersona: 'cpo',
    isRefocusing: false,
  })
  global.fetch = jest.fn()
})

afterAll(() => {
  global.fetch = originalFetch
})

// ── Tests ────────────────────────────────────────────────────

describe('mercuryStore – silence protocol', () => {
  test('silence event stores message and confidence on the message', async () => {
    const stream = sseStream([
      { event: 'status', data: JSON.stringify({ stage: 'retrieving' }) },
      { event: 'silence', data: JSON.stringify({
        message: 'Insufficient evidence to provide a reliable answer.',
        confidence: 0.45,
        suggestions: ['Upload more docs'],
        protocol: 'SILENCE_PROTOCOL',
      }) },
      { event: 'done', data: '{}' },
    ])
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(stream))

    useMercuryStore.setState({ inputValue: 'q' })
    await useMercuryStore.getState().sendMessage(false)

    const last = useMercuryStore.getState().messages.at(-1)
    expect(last?.confidence).toBe(0.45)
    expect(last?.content).toBe('Insufficient evidence to provide a reliable answer.')
  })

  test('silence event with zero confidence is preserved', async () => {
    const stream = sseStream([
      { event: 'silence', data: JSON.stringify({
        message: 'No relevant documents found.',
        confidence: 0,
        suggestions: [],
        protocol: 'SILENCE_PROTOCOL',
      }) },
      { event: 'done', data: '{}' },
    ])
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(stream))

    useMercuryStore.setState({ inputValue: 'q' })
    await useMercuryStore.getState().sendMessage(false)

    const last = useMercuryStore.getState().messages.at(-1)
    expect(last?.confidence).toBe(0)
  })
})

describe('mercuryStore – stopStreaming', () => {
  test('appends partial content with "[Query stopped by user]" suffix', () => {
    const mockAbort = jest.fn()
    useMercuryStore.setState({
      isStreaming: true,
      streamingContent: 'Partial answer so far',
      abortController: { abort: mockAbort } as unknown as AbortController,
      messages: [],
    })

    useMercuryStore.getState().stopStreaming()

    expect(mockAbort).toHaveBeenCalled()

    const state = useMercuryStore.getState()
    expect(state.isStreaming).toBe(false)
    expect(state.streamingContent).toBe('')

    const last = state.messages.at(-1)
    expect(last?.content).toContain('Partial answer so far')
    expect(last?.content).toContain('[Query stopped by user]')
    expect(last?.role).toBe('assistant')
  })

  test('does not add message when no streaming content exists', () => {
    const mockAbort = jest.fn()
    useMercuryStore.setState({
      isStreaming: true,
      streamingContent: '',
      abortController: { abort: mockAbort } as unknown as AbortController,
      messages: [],
    })

    useMercuryStore.getState().stopStreaming()

    expect(mockAbort).toHaveBeenCalled()
    expect(useMercuryStore.getState().messages).toHaveLength(0)
    expect(useMercuryStore.getState().isStreaming).toBe(false)
  })
})

describe('mercuryStore – clearConversation', () => {
  test('clears messages, streaming content, and attachments', () => {
    useMercuryStore.setState({
      messages: [
        { id: '1', role: 'user', content: 'hi', timestamp: new Date() },
      ],
      streamingContent: 'partial',
      attachments: [
        { id: 'a1', name: 'file.pdf', type: 'file', status: 'ready' },
      ],
    })

    useMercuryStore.getState().clearConversation()

    const state = useMercuryStore.getState()
    expect(state.messages).toEqual([])
    expect(state.streamingContent).toBe('')
    expect(state.attachments).toEqual([])
  })
})

describe('mercuryStore – attachments', () => {
  test('addAttachment creates an attachment with generated id and pending status', () => {
    const id = useMercuryStore.getState().addAttachment({
      name: 'report.pdf',
      type: 'file',
      mimeType: 'application/pdf',
      size: 1024,
    })

    expect(id).toMatch(/^attach-/)
    const attachments = useMercuryStore.getState().attachments
    expect(attachments).toHaveLength(1)
    expect(attachments[0].name).toBe('report.pdf')
    expect(attachments[0].status).toBe('pending')
  })

  test('removeAttachment removes by id', () => {
    const id = useMercuryStore.getState().addAttachment({
      name: 'file.pdf',
      type: 'file',
    })
    useMercuryStore.getState().addAttachment({
      name: 'other.pdf',
      type: 'file',
    })

    expect(useMercuryStore.getState().attachments).toHaveLength(2)

    useMercuryStore.getState().removeAttachment(id)

    const remaining = useMercuryStore.getState().attachments
    expect(remaining).toHaveLength(1)
    expect(remaining[0].name).toBe('other.pdf')
  })

  test('updateAttachment merges partial updates', () => {
    const id = useMercuryStore.getState().addAttachment({
      name: 'file.pdf',
      type: 'file',
    })

    useMercuryStore.getState().updateAttachment(id, {
      status: 'ready',
      extractedText: 'Some extracted content',
    })

    const attachment = useMercuryStore.getState().attachments[0]
    expect(attachment.status).toBe('ready')
    expect(attachment.extractedText).toBe('Some extracted content')
    expect(attachment.name).toBe('file.pdf') // unchanged
  })

  test('clearAttachments removes all attachments', () => {
    useMercuryStore.getState().addAttachment({ name: 'a.pdf', type: 'file' })
    useMercuryStore.getState().addAttachment({ name: 'b.pdf', type: 'file' })

    useMercuryStore.getState().clearAttachments()

    expect(useMercuryStore.getState().attachments).toEqual([])
  })
})

describe('mercuryStore – persona / neural shift', () => {
  test('setPersona changes activePersona', () => {
    useMercuryStore.getState().setPersona('legal')

    expect(useMercuryStore.getState().activePersona).toBe('legal')
  })

  test('setPersona triggers refocus animation', () => {
    useMercuryStore.getState().setPersona('cfo')

    // isRefocusing should be true immediately after
    expect(useMercuryStore.getState().isRefocusing).toBe(true)
  })

  test('setTemperaturePreset updates the preset', () => {
    useMercuryStore.getState().setTemperaturePreset('legal')

    expect(useMercuryStore.getState().temperaturePreset).toBe('legal')
  })
})

describe('mercuryStore – sendMessage with apiFetch', () => {
  test('calls /api/chat endpoint via apiFetch (routed through fetch)', async () => {
    const stream = sseStream([
      { event: 'token', data: JSON.stringify({ text: 'response' }) },
      { event: 'done', data: '{}' },
    ])
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(stream))

    useMercuryStore.setState({ inputValue: 'test query' })
    await useMercuryStore.getState().sendMessage(false)

    // The call goes through apiFetch -> fetch
    expect(global.fetch).toHaveBeenCalled()
    const [url] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toContain('/api/chat')
  })

  test('adds user message to state before API call', async () => {
    let capturedMessages: unknown[] = []

    ;(global.fetch as jest.Mock).mockImplementationOnce(async () => {
      capturedMessages = [...useMercuryStore.getState().messages]
      return mockResponse(sseStream([
        { event: 'token', data: JSON.stringify({ text: 'done' }) },
        { event: 'done', data: '{}' },
      ]))
    })

    useMercuryStore.setState({ inputValue: 'my question' })
    await useMercuryStore.getState().sendMessage(false)

    // User message should have been added before fetch was called
    expect(capturedMessages).toHaveLength(1)
    expect((capturedMessages[0] as { role: string }).role).toBe('user')
  })

  test('clears input value after sending', async () => {
    const stream = sseStream([
      { event: 'token', data: JSON.stringify({ text: 'done' }) },
      { event: 'done', data: '{}' },
    ])
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(stream))

    useMercuryStore.setState({ inputValue: 'my query' })
    await useMercuryStore.getState().sendMessage(false)

    expect(useMercuryStore.getState().inputValue).toBe('')
  })
})
