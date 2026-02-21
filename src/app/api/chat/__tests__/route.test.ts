/**
 * Tests for /api/chat route handler
 *
 * Covers: auth, query validation, incognito mode, safety mode (URL fetch),
 * cache read/write, BYOLLM routing (choice / aegis_only / byollm_only / error),
 * backend error handling (tool errors + generic), SSE passthrough, JSON response,
 * and the outer catch block.
 */

// ── Mocks (declared before any imports that reference them) ────────────

const mockGetToken = jest.fn()
jest.mock('next-auth/jwt', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
}))

const mockIsToolError = jest.fn()
const mockCreateErrorResponse = jest.fn()
jest.mock('@/lib/mercury/toolErrors', () => ({
  isToolError: (...args: unknown[]) => mockIsToolError(...args),
  createErrorResponse: (...args: unknown[]) => mockCreateErrorResponse(...args),
}))

const mockGetCachedQuery = jest.fn()
const mockSetCachedQuery = jest.fn()
jest.mock('@/lib/cache/queryCache', () => ({
  getCachedQuery: (...args: unknown[]) => mockGetCachedQuery(...args),
  setCachedQuery: (...args: unknown[]) => mockSetCachedQuery(...args),
}))

const mockFindUnique = jest.fn()
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    lLMConfig: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}))

const mockDecryptKey = jest.fn()
jest.mock('@/lib/utils/kms', () => ({
  decryptKey: (...args: unknown[]) => mockDecryptKey(...args),
}))

const mockValidateExternalUrl = jest.fn()
jest.mock('@/lib/utils/url-validation', () => ({
  validateExternalUrl: (...args: unknown[]) => mockValidateExternalUrl(...args),
}))

// ── Imports (after mocks) ────────────────────────────────────

import { NextRequest } from 'next/server'
import { POST } from '../route'

// ── Helpers ──────────────────────────────────────────────────

function buildRequest(
  body?: Record<string, unknown>,
  headers?: Record<string, string>,
): NextRequest {
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
  }
  if (body) {
    init.body = JSON.stringify(body)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NextRequest(new URL('/api/chat', 'http://localhost:3000'), init as any)
}

async function parseResponse(res: Response): Promise<Record<string, unknown>> {
  return res.json()
}

function authenticateAs(id = 'user-001', email = 'test@ragbox.co') {
  mockGetToken.mockResolvedValue({ id, email })
}

// ── Setup / Teardown ────────────────────────────────────────

const originalFetch = global.fetch

beforeEach(() => {
  jest.clearAllMocks()
  authenticateAs()
  global.fetch = jest.fn()
  mockIsToolError.mockReturnValue(false)
  mockGetCachedQuery.mockResolvedValue(null)
  mockSetCachedQuery.mockResolvedValue(undefined)
  mockDecryptKey.mockResolvedValue('sk-decrypted-key')
  mockFindUnique.mockResolvedValue(null)
})

afterAll(() => {
  global.fetch = originalFetch
})

// ═══════════════════════════════════════════════════════════
// Auth Tests
// ═══════════════════════════════════════════════════════════

describe('POST /api/chat — auth', () => {
  test('returns 401 when no token', async () => {
    mockGetToken.mockResolvedValue(null)
    const req = buildRequest({ query: 'hello' })
    const res = await POST(req)
    const body = await parseResponse(res)
    expect(res.status).toBe(401)
    expect(body.error).toBe('Authentication required')
  })

  test('returns 401 when token has no id and no email', async () => {
    mockGetToken.mockResolvedValue({ id: '', email: '' })
    const req = buildRequest({ query: 'hello' })
    const res = await POST(req)
    const body = await parseResponse(res)
    expect(res.status).toBe(401)
    expect(body.error).toBe('Unable to determine user identity')
  })

  test('uses email as userId when id is empty', async () => {
    mockGetToken.mockResolvedValue({ id: '', email: 'fallback@test.com' })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true, data: { answer: 'ok' } }),
    })
    const req = buildRequest({ query: 'hello' })
    await POST(req)
    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    expect(fetchCall[1].headers['X-User-ID']).toBe('fallback@test.com')
  })
})

// ═══════════════════════════════════════════════════════════
// Query Validation
// ═══════════════════════════════════════════════════════════

describe('POST /api/chat — query validation', () => {
  test('returns 400 when query is missing', async () => {
    const req = buildRequest({})
    const res = await POST(req)
    const body = await parseResponse(res)
    expect(res.status).toBe(400)
    expect(body.error).toBe('Query is required')
  })

  test('returns 400 when query is not a string', async () => {
    const req = buildRequest({ query: 42 })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  test('returns 400 when query is empty string', async () => {
    const req = buildRequest({ query: '' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

// ═══════════════════════════════════════════════════════════
// Safety Mode — URL fetching
// ═══════════════════════════════════════════════════════════

describe('POST /api/chat — safety mode URL fetching', () => {
  function setupFetchMock(jsonData: Record<string, unknown> = { success: true }) {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => jsonData,
    })
  }

  test('does not fetch URLs when safetyMode is true (default)', async () => {
    setupFetchMock()
    const req = buildRequest({ query: 'check https://example.com', safetyMode: true })
    await POST(req)
    // Only one fetch call (to Go backend), not two
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(mockValidateExternalUrl).not.toHaveBeenCalled()
  })

  test('skips URL fetch when SSRF validation fails', async () => {
    mockValidateExternalUrl.mockReturnValue({ ok: false, reason: 'blocked' })
    setupFetchMock()
    const req = buildRequest({ query: 'check https://10.0.0.1/secret', safetyMode: false })
    await POST(req)
    // Backend fetch only (URL fetch skipped due to SSRF block)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  test('fetches URL and prepends web context on valid HTML', async () => {
    mockValidateExternalUrl.mockReturnValue({
      ok: true,
      url: new URL('https://example.com/page'),
    })

    // First call: external URL fetch; second call: Go backend
    const htmlContent = '<html><body>' + 'A'.repeat(100) + '</body></html>'
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: (h: string) => h === 'content-type' ? 'text/html' : null },
        text: async () => htmlContent,
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true }),
      })

    const req = buildRequest({ query: 'summarize https://example.com/page', safetyMode: false })
    await POST(req)

    // Two fetch calls: URL + backend
    expect(global.fetch).toHaveBeenCalledTimes(2)
    const backendBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body)
    expect(backendBody.query).toContain('[Web content from https://example.com/page]')
  })

  test('skips web context when fetched content is too short', async () => {
    mockValidateExternalUrl.mockReturnValue({
      ok: true,
      url: new URL('https://example.com/short'),
    })

    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: (h: string) => h === 'content-type' ? 'text/plain' : null },
        text: async () => 'hi', // too short (< 50 chars)
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true }),
      })

    const req = buildRequest({ query: 'fetch https://example.com/short', safetyMode: false })
    await POST(req)

    const backendBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body)
    expect(backendBody.query).not.toContain('[Web content')
  })

  test('continues without web context when URL fetch throws', async () => {
    mockValidateExternalUrl.mockReturnValue({
      ok: true,
      url: new URL('https://example.com/fail'),
    })

    ;(global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true }),
      })

    const req = buildRequest({ query: 'fetch https://example.com/fail', safetyMode: false })
    const res = await POST(req)
    const body = await parseResponse(res)
    expect(body.success).toBe(true)
  })

  test('skips web context when URL response is not ok', async () => {
    mockValidateExternalUrl.mockReturnValue({
      ok: true,
      url: new URL('https://example.com/404'),
    })

    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: { get: () => 'text/html' },
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true }),
      })

    const req = buildRequest({ query: 'get https://example.com/404', safetyMode: false })
    await POST(req)

    const backendBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body)
    expect(backendBody.query).not.toContain('[Web content')
  })
})

// ═══════════════════════════════════════════════════════════
// Cache behavior
// ═══════════════════════════════════════════════════════════

describe('POST /api/chat — caching', () => {
  test('returns cached response for simple query', async () => {
    mockGetCachedQuery.mockResolvedValue({
      text: 'cached answer',
      confidence: 0.95,
      citations: [{ id: 'c1' }],
    })

    const req = buildRequest({ query: 'hello' })
    const res = await POST(req)
    const body = await parseResponse(res)

    expect(body.success).toBe(true)
    expect((body.data as Record<string, unknown>).fromCache).toBe(true)
    expect((body.data as Record<string, unknown>).answer).toBe('cached answer')
    // Should NOT call fetch (Go backend)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('skips cache when incognito header is set', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true, data: { answer: 'fresh' } }),
    })

    const req = buildRequest({ query: 'hello' }, { 'x-incognito': 'true' })
    await POST(req)

    expect(mockGetCachedQuery).not.toHaveBeenCalled()
    expect(mockSetCachedQuery).not.toHaveBeenCalled()
  })

  test('skips cache read when history is provided', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true, data: { answer: 'contextual' } }),
    })

    const req = buildRequest({ query: 'hello', history: [{ role: 'user', content: 'prev' }] })
    await POST(req)

    expect(mockGetCachedQuery).not.toHaveBeenCalled()
  })

  test('writes to cache on successful simple query JSON response', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        success: true,
        data: { answer: 'new answer', confidence: 0.9, citations: [] },
      }),
    })

    const req = buildRequest({ query: 'hello' })
    await POST(req)

    expect(mockSetCachedQuery).toHaveBeenCalledTimes(1)
    expect(mockSetCachedQuery.mock.calls[0][0]).toBe('hello')
  })
})

// ═══════════════════════════════════════════════════════════
// BYOLLM routing
// ═══════════════════════════════════════════════════════════

describe('POST /api/chat — BYOLLM routing', () => {
  test('BYOLLM config lookup error falls back gracefully', async () => {
    mockFindUnique.mockRejectedValue(new Error('DB error'))
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true }),
    })

    const req = buildRequest({ query: 'test', llmProvider: 'byollm' })
    const res = await POST(req)
    const body = await parseResponse(res)

    expect(body.success).toBe(true)
    // BYOLLM fields should NOT be forwarded (graceful fallback to AEGIS)
    const forwardedBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(forwardedBody.llmApiKey).toBeUndefined()
  })

  test('byollm_only policy forces BYOLLM even without frontend request', async () => {
    mockFindUnique.mockResolvedValue({
      tenantId: 'default',
      provider: 'openai',
      apiKeyEncrypted: 'encrypted-key',
      baseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o',
      policy: 'byollm_only',
      lastTestedAt: null,
      lastTestResult: null,
      lastTestLatency: null,
    })

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true }),
    })

    const req = buildRequest({ query: 'test' }) // no llmProvider
    await POST(req)

    const forwardedBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(forwardedBody.llmProvider).toBe('openai')
    expect(forwardedBody.llmApiKey).toBe('sk-decrypted-key')
    expect(forwardedBody.llmBaseUrl).toBe('https://api.openai.com/v1')
  })

  test('byollm_only policy check error falls back gracefully', async () => {
    mockFindUnique.mockRejectedValue(new Error('DB error'))
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true }),
    })

    const req = buildRequest({ query: 'test' }) // no llmProvider
    await POST(req)

    const forwardedBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(forwardedBody.llmProvider).toBeUndefined()
  })

  test('BYOLLM with baseUrl includes llmBaseUrl in forwarded payload', async () => {
    mockFindUnique.mockResolvedValue({
      tenantId: 'default',
      provider: 'openrouter',
      apiKeyEncrypted: 'encrypted-key',
      baseUrl: 'https://openrouter.ai/api/v1',
      defaultModel: 'claude-3.5-sonnet',
      policy: 'choice',
      lastTestedAt: null,
      lastTestResult: null,
      lastTestLatency: null,
    })

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true }),
    })

    const req = buildRequest({ query: 'test', llmProvider: 'byollm' })
    await POST(req)

    const forwardedBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(forwardedBody.llmBaseUrl).toBe('https://openrouter.ai/api/v1')
  })
})

// ═══════════════════════════════════════════════════════════
// Backend error handling
// ═══════════════════════════════════════════════════════════

describe('POST /api/chat — backend errors', () => {
  test('returns tool error response when backend returns a ToolError', async () => {
    mockIsToolError.mockReturnValue(true)
    mockCreateErrorResponse.mockReturnValue({
      response: 'Permission denied message',
      error: { code: 'PERMISSION_DENIED', recoverable: false },
      canRetry: false,
    })

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: { get: () => 'application/json' },
      json: async () => ({
        error: {
          code: 'PERMISSION_DENIED',
          message: 'not allowed',
          recoverable: false,
          suggestion: 'check perms',
        },
      }),
    })

    const req = buildRequest({ query: 'test' })
    const res = await POST(req)
    const body = await parseResponse(res)

    expect(body.success).toBe(false)
    expect(body.response).toBe('Permission denied message')
    expect(body.canRetry).toBe(false)
  })

  test('returns UPSTREAM_FAILURE when backend error is not a ToolError', async () => {
    mockIsToolError.mockReturnValue(false)

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 502,
      headers: { get: () => 'application/json' },
      json: async () => ({ message: 'gateway error' }),
    })

    const req = buildRequest({ query: 'test' })
    const res = await POST(req)
    const body = await parseResponse(res)

    expect(res.status).toBe(502)
    expect(body.success).toBe(false)
    expect((body.error as Record<string, unknown>).code).toBe('UPSTREAM_FAILURE')
    expect(body.canRetry).toBe(true)
  })

  test('handles backend error when json() parse fails', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: { get: () => 'text/plain' },
      json: async () => { throw new Error('not json') },
    })

    const req = buildRequest({ query: 'test' })
    const res = await POST(req)
    const body = await parseResponse(res)

    expect(res.status).toBe(500)
    expect(body.success).toBe(false)
    expect(body.canRetry).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════
// Streaming (SSE) passthrough
// ═══════════════════════════════════════════════════════════

describe('POST /api/chat — SSE streaming', () => {
  test('passes through SSE stream when content-type is text/event-stream', async () => {
    const mockBody = new ReadableStream()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'text/event-stream' },
      body: mockBody,
    })

    const req = buildRequest({ query: 'test', stream: true })
    const res = await POST(req)

    expect(res.headers.get('Content-Type')).toBe('text/event-stream')
    expect(res.headers.get('Cache-Control')).toBe('no-cache')
  })
})

// ═══════════════════════════════════════════════════════════
// Outer catch block (500)
// ═══════════════════════════════════════════════════════════

describe('POST /api/chat — unhandled errors', () => {
  test('returns 500 when request.json() throws', async () => {
    const req = new NextRequest(new URL('/api/chat', 'http://localhost:3000'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid json {{{',
    })
    const res = await POST(req)
    const body = await parseResponse(res)

    expect(res.status).toBe(500)
    expect(body.success).toBe(false)
    expect((body.error as Record<string, unknown>).code).toBe('INTERNAL_ERROR')
  })
})

// ═══════════════════════════════════════════════════════════
// Forwarded payload structure
// ═══════════════════════════════════════════════════════════

describe('POST /api/chat — forwarded payload', () => {
  test('forwards all optional fields to Go backend', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true }),
    })

    const req = buildRequest({
      query: 'test',
      stream: false,
      privilegeMode: true,
      history: [{ role: 'user', content: 'prev' }],
      maxTier: 2,
      personaId: 'persona-1',
      documentScope: ['doc-1', 'doc-2'],
    })
    await POST(req)

    const forwardedBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(forwardedBody.stream).toBe(false)
    expect(forwardedBody.privilegeMode).toBe(true)
    expect(forwardedBody.history).toHaveLength(1)
    expect(forwardedBody.maxTier).toBe(2)
    expect(forwardedBody.persona).toBe('persona-1')
    expect(forwardedBody.documentScope).toEqual(['doc-1', 'doc-2'])
  })

  test('uses default values when optional fields are omitted', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true }),
    })

    const req = buildRequest({ query: 'test' })
    await POST(req)

    const forwardedBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(forwardedBody.stream).toBe(true)
    expect(forwardedBody.privilegeMode).toBe(false)
    expect(forwardedBody.history).toEqual([])
    expect(forwardedBody.maxTier).toBe(3)
    expect(forwardedBody.persona).toBeUndefined()
  })
})
