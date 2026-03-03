/**
 * BUG-050: Voice-to-RAG Request Tests
 *
 * Validates that the voice pipeline sends the correct fields to the Go
 * backend /api/chat endpoint. Sheldon identified 4 differences between
 * text chat and voice that caused broken RAG responses:
 *   1. stream: true (was false)
 *   2. personaId: 'mercury' (was persona: 'mercury')
 *   3. useVectorPipeline: true (was missing)
 *   4. history: user/assistant only (was including system messages)
 *
 * Source: voice-pipeline-v3.ts processWithLLM (lines 495-543)
 *
 * — Sarah, QA
 */

// ─── Mock global fetch ──────────────────────────────────────────────────────
const mockFetch = jest.fn()
;(global as any).fetch = mockFetch

const GO_BACKEND_URL = 'http://localhost:8080'
const INTERNAL_AUTH = 'test-secret'

beforeEach(() => {
  mockFetch.mockReset()
})

// ─── Types ──────────────────────────────────────────────────────────────────

interface HistoryEntry {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// ─── Replicated request construction (voice-pipeline-v3.ts:495-543) ────────
// processWithLLM is not exported, so we replicate the exact request body
// construction logic for isolated testing.

function buildVoiceBackendRequest(
  userText: string,
  conversationHistory: HistoryEntry[],
  userId = 'anonymous',
  privilegeMode = false,
) {
  const backendUrl = `${GO_BACKEND_URL}/api/chat`
  const backendHeaders = {
    'Content-Type': 'application/json',
    'X-Internal-Auth': INTERNAL_AUTH,
    'X-User-ID': userId,
  }
  // BUG-050 FIX #4: Strip system messages from history
  const chatHistory = conversationHistory
    .filter(h => h.role === 'user' || h.role === 'assistant')
    .slice(-10)
  const backendBody = {
    query: userText,
    stream: true,                     // FIX #1
    useVectorPipeline: true,          // FIX #3
    privilegeMode,
    maxTier: 3,
    personaId: 'mercury',             // FIX #2
    history: chatHistory,             // FIX #4
  }

  return { backendUrl, backendHeaders, backendBody }
}

// ─── Response helpers ───────────────────────────────────────────────────────

function okResponse(body: string) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'text/plain' },
    text: async () => body,
    json: async () => JSON.parse(body),
  }
}

// ============================================================================
// FIX #1: stream: true
// ============================================================================

describe('Voice-to-RAG — stream field (BUG-050 Fix #1)', () => {

  it('voice request sets stream: true', () => {
    const { backendBody } = buildVoiceBackendRequest('What files do I have?', [])
    expect(backendBody.stream).toBe(true)
  })

  it('stream is always true regardless of query type', () => {
    const queries = [
      'What files can you see?',
      'Summarize the NDA.',
      'Compare document A with B.',
    ]
    for (const q of queries) {
      const { backendBody } = buildVoiceBackendRequest(q, [])
      expect(backendBody.stream).toBe(true)
    }
  })
})

// ============================================================================
// FIX #2: personaId (not persona)
// ============================================================================

describe('Voice-to-RAG — personaId field (BUG-050 Fix #2)', () => {

  it('request uses personaId field, not persona', () => {
    const { backendBody } = buildVoiceBackendRequest('Search my documents', [])
    expect(backendBody.personaId).toBe('mercury')
    expect((backendBody as Record<string, unknown>).persona).toBeUndefined()
  })

  it('personaId is always mercury for voice pipeline', () => {
    const { backendBody } = buildVoiceBackendRequest('Anything', [])
    expect(backendBody.personaId).toBe('mercury')
  })
})

// ============================================================================
// FIX #3: useVectorPipeline: true
// ============================================================================

describe('Voice-to-RAG — useVectorPipeline field (BUG-050 Fix #3)', () => {

  it('request includes useVectorPipeline: true', () => {
    const { backendBody } = buildVoiceBackendRequest('Find my NDA', [])
    expect(backendBody.useVectorPipeline).toBe(true)
  })

  it('useVectorPipeline is present in the request body (not omitted)', () => {
    const { backendBody } = buildVoiceBackendRequest('Query', [])
    expect('useVectorPipeline' in backendBody).toBe(true)
  })
})

// ============================================================================
// FIX #4: History — user/assistant only (no system messages)
// ============================================================================

describe('Voice-to-RAG — history filtering (BUG-050 Fix #4)', () => {

  it('system messages are stripped from history', () => {
    const history: HistoryEntry[] = [
      { role: 'system', content: 'You are Mercury, a professional AI assistant.' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ]

    const { backendBody } = buildVoiceBackendRequest('What files?', history)

    expect(backendBody.history).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ])
    expect(backendBody.history.every(
      (h: HistoryEntry) => h.role === 'user' || h.role === 'assistant'
    )).toBe(true)
  })

  it('multiple system messages are all removed', () => {
    const history: HistoryEntry[] = [
      { role: 'system', content: 'System prompt 1' },
      { role: 'user', content: 'Q1' },
      { role: 'system', content: 'System prompt 2' },
      { role: 'assistant', content: 'A1' },
      { role: 'system', content: 'System prompt 3' },
    ]

    const { backendBody } = buildVoiceBackendRequest('Q2', history)

    expect(backendBody.history).toEqual([
      { role: 'user', content: 'Q1' },
      { role: 'assistant', content: 'A1' },
    ])
  })

  it('history is limited to last 10 turns', () => {
    const history: HistoryEntry[] = []
    for (let i = 0; i < 15; i++) {
      history.push({ role: 'user', content: `Q${i}` })
      history.push({ role: 'assistant', content: `A${i}` })
    }

    const { backendBody } = buildVoiceBackendRequest('Latest', history)

    expect(backendBody.history.length).toBe(10)
    // Should be the LAST 10 entries (Q10-Q14, A10-A14)
    expect(backendBody.history[0]).toEqual({ role: 'user', content: 'Q10' })
    expect(backendBody.history[9]).toEqual({ role: 'assistant', content: 'A14' })
  })

  it('empty history produces empty array', () => {
    const { backendBody } = buildVoiceBackendRequest('First message', [])
    expect(backendBody.history).toEqual([])
  })

  it('history with only system messages produces empty array', () => {
    const history: HistoryEntry[] = [
      { role: 'system', content: 'Prompt 1' },
      { role: 'system', content: 'Prompt 2' },
    ]

    const { backendBody } = buildVoiceBackendRequest('Hello', history)
    expect(backendBody.history).toEqual([])
  })
})

// ============================================================================
// FULL REQUEST SHAPE — all fields together
// ============================================================================

describe('Voice-to-RAG — full request shape (BUG-050)', () => {

  it('request body has all required fields with correct values', () => {
    const history: HistoryEntry[] = [
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: 'Previous question' },
      { role: 'assistant', content: 'Previous answer' },
    ]

    const { backendBody, backendHeaders, backendUrl } = buildVoiceBackendRequest(
      'What is in my contract?',
      history,
      'user-42',
      true,
    )

    // URL
    expect(backendUrl).toBe(`${GO_BACKEND_URL}/api/chat`)

    // Headers
    expect(backendHeaders['Content-Type']).toBe('application/json')
    expect(backendHeaders['X-Internal-Auth']).toBe(INTERNAL_AUTH)
    expect(backendHeaders['X-User-ID']).toBe('user-42')

    // Body — all 4 BUG-050 fixes
    expect(backendBody.stream).toBe(true)
    expect(backendBody.personaId).toBe('mercury')
    expect(backendBody.useVectorPipeline).toBe(true)
    expect(backendBody.history).toEqual([
      { role: 'user', content: 'Previous question' },
      { role: 'assistant', content: 'Previous answer' },
    ])

    // Other fields
    expect(backendBody.query).toBe('What is in my contract?')
    expect(backendBody.privilegeMode).toBe(true)
    expect(backendBody.maxTier).toBe(3)
  })

  it('default userId is anonymous when not provided', () => {
    const { backendHeaders } = buildVoiceBackendRequest('Test', [])
    expect(backendHeaders['X-User-ID']).toBe('anonymous')
  })

  it('default privilegeMode is false when not provided', () => {
    const { backendBody } = buildVoiceBackendRequest('Test', [])
    expect(backendBody.privilegeMode).toBe(false)
  })
})
