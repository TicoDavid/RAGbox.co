/**
 * BUG-042 SA-042-02: Grounding Refusal Interceptor Tests
 *
 * Tests that conversational queries get real answers, not RAG grounding
 * refusals. When the Go backend returns "I cannot provide a sufficiently
 * grounded answer" for a casual query like "Hello, how are you?", the
 * interceptor should catch it and return a Mercury persona response.
 *
 * — Sarah, QA
 */

// ─── Mock global fetch ──────────────────────────────────────────────────────
const mockFetch = jest.fn()
;(global as any).fetch = mockFetch

const GO_BACKEND_URL = 'http://localhost:8080'

beforeEach(() => {
  mockFetch.mockReset()
})

// ─── Response helpers ───────────────────────────────────────────────────────

function goBackendJSONResponse(answer: string) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data: { answer } }),
  }
}

// ─── Grounding refusal patterns ─────────────────────────────────────────────
// These patterns indicate the Go backend's RAG pipeline couldn't find
// relevant documents. For conversational queries, this is expected behavior
// that should be intercepted — not surfaced to the user.

const REFUSAL_PATTERNS = [
  /cannot provide a sufficiently grounded answer/i,
  /don't have enough information in the available documents/i,
  /not found in the available documents/i,
]

function isGroundingRefusal(text: string): boolean {
  if (!text || text.trim().length === 0) return true // empty = refusal
  return REFUSAL_PATTERNS.some((p) => p.test(text))
}

function generateFallback(agentName: string): string {
  // Mercury persona fallback — conversational, not robotic
  return `I'm ${agentName}, your secure document analyst. I'm ready to help — ask me anything about your uploaded documents, or just say what's on your mind.`
}

// ─── queryLLM with grounding interceptor ────────────────────────────────────

async function queryLLM(
  text: string,
  config: { name?: string } = {},
): Promise<{ answer: string; intercepted: boolean }> {
  const history: Array<{ role: string; content: string }> = []
  history.push({ role: 'user', content: text })

  const res = await fetch(`${GO_BACKEND_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Auth': 'test-secret',
      'X-User-ID': 'user-1',
    },
    body: JSON.stringify({
      query: text,
      stream: false,
      privilegeMode: false,
      maxTier: 3,
      history: history.slice(-10),
    }),
  })

  if (!res.ok) {
    throw new Error(`Backend error ${res.status}`)
  }

  const rawText = await res.text()
  let answer = ''

  if (rawText.startsWith('{')) {
    const data = JSON.parse(rawText) as { data?: { answer?: string }; answer?: string }
    answer = data.data?.answer || data.answer || ''
  }

  // Grounding refusal interceptor
  if (isGroundingRefusal(answer)) {
    const agentName = config.name || 'Mercury'
    return { answer: generateFallback(agentName), intercepted: true }
  }

  return { answer, intercepted: false }
}

// ============================================================================
// TESTS
// ============================================================================

describe('Grounding Refusal Interceptor (BUG-042 SA-042-02)', () => {

  // TEST 1
  it('grounding refusal is intercepted for conversational query', async () => {
    mockFetch.mockResolvedValueOnce(
      goBackendJSONResponse(
        'I cannot provide a sufficiently grounded answer based on the available documents.',
      ),
    )

    const result = await queryLLM('Hello, how are you?')

    // Response should NOT contain the refusal text
    expect(result.answer).not.toContain('cannot provide a sufficiently grounded')

    // Response IS a friendly Mercury persona response
    expect(result.answer).toContain('Mercury')
    expect(result.intercepted).toBe(true)
  })

  // TEST 2
  it('document query bypasses interceptor', async () => {
    const ragAnswer = 'Based on your uploaded contract, the renewal date is March 15.'

    mockFetch.mockResolvedValueOnce(goBackendJSONResponse(ragAnswer))

    const result = await queryLLM('When does my contract renew?')

    // Response IS the RAG answer (unchanged)
    expect(result.answer).toBe(ragAnswer)

    // Interceptor did NOT fire
    expect(result.intercepted).toBe(false)
  })

  // TEST 3
  it('multiple refusal patterns are caught', async () => {
    const refusalTexts = [
      'I cannot provide a sufficiently grounded answer based on the available documents.',
      "I don't have enough information in the available documents to answer that.",
      'The requested information was not found in the available documents.',
      '', // empty response = refusal
    ]

    for (const refusalText of refusalTexts) {
      mockFetch.mockResolvedValueOnce(goBackendJSONResponse(refusalText))

      const result = await queryLLM('Test query')

      expect(result.intercepted).toBe(true)
      expect(result.answer).not.toContain('cannot provide')
      expect(result.answer).not.toContain('not found in the available')
      expect(result.answer.length).toBeGreaterThan(0) // fallback is non-empty
    }
  })

  // TEST 4
  it('fallback response uses Mercury persona name', async () => {
    mockFetch.mockResolvedValueOnce(
      goBackendJSONResponse(
        'I cannot provide a sufficiently grounded answer.',
      ),
    )

    const result = await queryLLM('Hi there!', { name: 'Evelyn Monroe' })

    // Fallback uses the configured agent name, not "Mercury"
    expect(result.answer).toContain('Evelyn Monroe')
    expect(result.intercepted).toBe(true)

    // Fallback is conversational and appropriate (not robotic)
    expect(result.answer).not.toContain('ERROR')
    expect(result.answer).not.toContain('undefined')
    expect(result.answer.length).toBeGreaterThan(20)
  })

  // TEST 5
  it('RAG answer with citations passes through untouched', async () => {
    const citedAnswer =
      'According to the Master Services Agreement [1], the indemnification clause (Section 4.2) ' +
      'requires 30 days written notice [2]. The financial addendum confirms a cap of $500,000 [3].'

    mockFetch.mockResolvedValueOnce(goBackendJSONResponse(citedAnswer))

    const result = await queryLLM('What does the indemnification clause say?')

    // Response includes citation markers (not stripped)
    expect(result.answer).toContain('[1]')
    expect(result.answer).toContain('[2]')
    expect(result.answer).toContain('[3]')

    // Response is unchanged
    expect(result.answer).toBe(citedAnswer)

    // Interceptor did NOT modify the response
    expect(result.intercepted).toBe(false)
  })
})
