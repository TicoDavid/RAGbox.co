/**
 * Sarah — EPIC-028 Phase 3, Task 5: Phase 3 integration tests
 *
 * Tests the full intent → handler routing without requiring Inworld Runtime
 * or a live Go backend. Validates that the RAGboxNode correctly routes
 * intents to the right handlers.
 */

import { RAGboxNode, classifyIntent, stripForVoice } from '../ragbox_node'

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

// Mock the Inworld CustomNode/ProcessContext — we only need process()
jest.mock('@inworld/runtime/graph', () => ({
  CustomNode: class {},
  ProcessContext: class {},
}))

describe('Phase 3 integration — intent routing', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('conversational query does NOT trigger RAG pipeline (no fetch)', async () => {
    const node = new RAGboxNode()
    const result = await node.process({} as never, {
      text: 'how are you?',
      userId: 'u1',
    })

    // Conversational intents are handled locally — no fetch call
    expect(mockFetch).not.toHaveBeenCalled()
    expect(result).toContain('Doing well')
  })

  it('greeting query does NOT trigger RAG pipeline', async () => {
    const node = new RAGboxNode()
    const result = await node.process({} as never, {
      text: 'hello',
      userId: 'u1',
    })

    expect(mockFetch).not.toHaveBeenCalled()
    expect(result.toLowerCase()).toMatch(/good|ready|help/)
  })

  it('meta query does NOT trigger RAG pipeline', async () => {
    const node = new RAGboxNode()
    const result = await node.process({} as never, {
      text: 'what can you do?',
      userId: 'u1',
    })

    expect(mockFetch).not.toHaveBeenCalled()
    expect(result).toContain('search your vault')
  })

  it('document query DOES trigger RAG pipeline (calls fetch)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        answer: 'The contract **expires** on [1] March 15.',
        citations: [{ id: 1 }],
        confidence: 0.92,
      }),
    })

    const node = new RAGboxNode()
    const result = await node.process({} as never, {
      text: "what's the deadline in the contract?",
      userId: 'u1',
      personaId: 'persona_cfo',
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    // Verify fetch was called with correct backend URL pattern
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/chat')
    expect(opts.method).toBe('POST')
    // Response should be stripped for voice
    expect(result).not.toMatch(/\*\*/)
    expect(result).not.toMatch(/\[\d+\]/)
  })

  it('document query handles backend error gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    })

    const node = new RAGboxNode()
    const result = await node.process({} as never, {
      text: 'search for deadline info',
      userId: 'u1',
    })

    expect(result).toContain('encountered an issue')
  })

  it('document query handles network error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    const node = new RAGboxNode()
    const result = await node.process({} as never, {
      text: 'find the contract clause',
      userId: 'u1',
    })

    expect(result).toContain('trouble connecting')
  })
})

describe('Phase 3 integration — end-to-end voice pipeline', () => {
  it('classify → handle → format: document intent produces clean voice text', async () => {
    // Step 1: Classify
    const { intent } = classifyIntent("what's the renewal date?")
    expect(intent).toBe('document')

    // Step 2: Simulate RAG response
    const ragResponse = `## Renewal Information

According to **Section 4.1** [1], the contract renewal date is April 15, 2026 [2].

- Failure to renew results in automatic termination
- A 30-day notice period is required [3]

The compliance team recommends initiating the renewal process by March 15. Additional clauses may apply. Review the full document for details. Extra notes follow here.`

    // Step 3: Format for voice
    const voiceText = stripForVoice(ragResponse)

    // Verify clean output
    expect(voiceText).not.toMatch(/\*\*/)
    expect(voiceText).not.toMatch(/\[\d+\]/)
    expect(voiceText).not.toContain('##')
    const sentences = voiceText.match(/[^.!?]*[.!?]+/g) || []
    expect(sentences.length).toBeLessThanOrEqual(3)
    expect(voiceText.length).toBeGreaterThan(20)
  })

  it('classify → handle: conversational intent returns personality response', () => {
    const { intent } = classifyIntent('thank you')
    expect(intent).toBe('conversational')
    // The handler returns a personality-driven response (tested in unit tests)
  })
})
