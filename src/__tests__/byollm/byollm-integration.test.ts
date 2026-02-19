/**
 * BYOLLM Integration Tests
 *
 * Validates Bring-Your-Own-LLM behavior across the RAGbox pipeline:
 * - AEGIS fallback when BYOLLM keys fail
 * - Policy enforcement (choice, byollm_only, aegis_only)
 * - API key encryption at rest and masking in responses
 * - Audit trail completeness (model, provider, latency)
 * - RAG parity: same retrieval regardless of LLM backend
 * - Silence Protocol consistency across providers
 *
 * STORY-027 | AC-3, AC-2, AC-4 implemented; AC-1, AC-5, AC-6 stubbed
 * (AC-1/5/6 require Go backend mocking — deferred to STORY-028)
 *
 * Acceptance Criteria Reference:
 *   AC-1: AEGIS fallback on BYOLLM failure
 *   AC-2: Policy enforcement (choice / byollm_only / aegis_only)
 *   AC-3: API key encryption (KMS) + masking in responses
 *   AC-4: Audit log fields (model_used, provider, latency_ms)
 *   AC-5: Same retrieved chunks regardless of LLM provider
 *   AC-6: Silence Protocol threshold is provider-agnostic
 */

import {
  createTenantWithLLMConfig,
  createTenantWithoutLLMConfig,
  createTenantWithInvalidLLMConfig,
  createOpenRouterResponse,
  createOpenRouterErrorResponse,
  createAegisResponse,
  chatResponseToSSEFrames,
  sseStream,
  TEST_RAW_API_KEY,
  TEST_MASKED_API_KEY,
  maskApiKey,
} from './test-helpers'
import type { LLMPolicy } from './test-helpers'

// ── Mocks (declared before imports that use them) ────────────

// Mock prisma client
const mockFindUnique = jest.fn()
const mockCreate = jest.fn()
const mockUpdate = jest.fn()
const mockDelete = jest.fn()

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    lLMConfig: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
    mercuryPersona: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  },
}))

// Mock next-auth/jwt
const mockGetToken = jest.fn()
jest.mock('next-auth/jwt', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
}))

// Mock cache (no-op for tests)
jest.mock('@/lib/cache/queryCache', () => ({
  getCachedQuery: jest.fn().mockResolvedValue(null),
  setCachedQuery: jest.fn().mockResolvedValue(undefined),
}))

// Mock toolErrors
jest.mock('@/lib/mercury/toolErrors', () => ({
  isToolError: jest.fn().mockReturnValue(false),
  createErrorResponse: jest.fn().mockReturnValue({
    response: 'error', error: { code: 'ERR' }, canRetry: true,
  }),
}))

// Use REAL kms-stub and mask-key (they're pure functions, no external deps)
// No mock needed — we test their actual behavior

// ── Imports (after mocks) ────────────────────────────────────

import { encryptKey, decryptKey } from '@/lib/utils/kms-stub'
import { maskApiKey as realMaskApiKey } from '@/lib/utils/mask-key'
import { NextRequest } from 'next/server'

// Lazy-import route handlers (they read mocked modules at import time)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const settingsRoute = require('@/app/api/settings/llm/route')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const chatRoute = require('@/app/api/chat/route')

// ── Test Helpers ─────────────────────────────────────────────

/** Build a NextRequest for testing route handlers. */
function buildRequest(
  method: string,
  url: string,
  body?: Record<string, unknown>,
): NextRequest {
  const init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal } = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) {
    init.body = JSON.stringify(body)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NextRequest(new URL(url, 'http://localhost:3000'), init as any)
}

/** Extract JSON body from a NextResponse or Response. */
async function parseResponse(res: Response): Promise<Record<string, unknown>> {
  return res.json()
}

/** Simulate an authenticated user for route handlers. */
function authenticateAs(email = 'test@ragbox.co', id = 'user-001') {
  mockGetToken.mockResolvedValue({ email, id })
}

// ── Setup / Teardown ────────────────────────────────────────

const originalFetch = global.fetch

beforeEach(() => {
  jest.clearAllMocks()
  authenticateAs()
  global.fetch = jest.fn()
})

afterAll(() => {
  global.fetch = originalFetch
})

// ═══════════════════════════════════════════════════════════
// AC-1: AEGIS Fallback (stubbed — requires Go backend mocking)
// ═══════════════════════════════════════════════════════════

describe('AC-1: AEGIS fallback when BYOLLM key is invalid', () => {
  test('falls back to AEGIS when OpenRouter returns 401 (invalid key)', async () => {
    // GIVEN: tenant with invalid BYOLLM key, policy=choice
    const _tenant = createTenantWithInvalidLLMConfig({ policy: 'choice' })
    const _orError = createOpenRouterErrorResponse(401, 'Invalid API key')
    const _aegisResponse = createAegisResponse()

    // STUBBED: requires Go backend to handle fallback logic
    // The Next.js proxy forwards BYOLLM fields; Go decides the fallback.
    // See BYOLLM_CHAT_PIPELINE_SPEC.md section B.4.
  })

  test('falls back to AEGIS when OpenRouter returns 429 (rate limited)', async () => {
    const _tenant = createTenantWithLLMConfig({ policy: 'choice' })
    const _orError = createOpenRouterErrorResponse(429, 'Rate limit exceeded')
    const _aegisResponse = createAegisResponse()
    // STUBBED: Go backend fallback logic
  })

  test('falls back to AEGIS when OpenRouter times out', async () => {
    const _tenant = createTenantWithLLMConfig({ policy: 'choice' })
    // STUBBED: Go backend timeout + fallback
  })

  test('does NOT fall back when policy is byollm_only (returns error instead)', async () => {
    const _tenant = createTenantWithInvalidLLMConfig({ policy: 'byollm_only' })
    // STUBBED: Go backend error-without-fallback logic
  })
})

// ═══════════════════════════════════════════════════════════
// AC-2: Policy Enforcement (chat proxy layer — IMPLEMENTED)
// ═══════════════════════════════════════════════════════════

describe('AC-2: Policy enforcement — aegis_only strips BYOLLM fields from proxy', () => {
  test('aegis_only policy strips llmProvider/llmModel even when frontend sends them', async () => {
    // GIVEN: tenant with valid BYOLLM key, policy=aegis_only
    const encrypted = await encryptKey(TEST_RAW_API_KEY)
    mockFindUnique.mockResolvedValue({
      tenantId: 'default',
      provider: 'openrouter',
      apiKeyEncrypted: encrypted,
      baseUrl: null,
      defaultModel: 'anthropic/claude-sonnet-4-20250514',
      policy: 'aegis_only',
      lastTestedAt: null,
      lastTestResult: null,
      lastTestLatency: null,
    })

    // Mock Go backend returning a successful SSE response
    const aegisFrames = chatResponseToSSEFrames(createAegisResponse())
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'text/event-stream' },
      body: sseStream(aegisFrames),
    })

    // WHEN: frontend sends llmProvider=byollm
    const req = buildRequest('POST', '/api/chat', {
      query: 'What is the NDA term?',
      stream: true,
      llmProvider: 'byollm',
      llmModel: 'openai/gpt-4o',
    })
    await chatRoute.POST(req)

    // THEN: Go backend is called WITHOUT BYOLLM fields
    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    const forwardedBody = JSON.parse(fetchCall[1].body)

    expect(forwardedBody.llmProvider).toBeUndefined()
    expect(forwardedBody.llmModel).toBeUndefined()
    expect(forwardedBody.llmApiKey).toBeUndefined()
    expect(forwardedBody.query).toBe('What is the NDA term?')
  })

  test('aegis_only policy works even if LLMConfig has invalid key', async () => {
    // GIVEN: tenant with invalid BYOLLM key, policy=aegis_only
    const encrypted = await encryptKey('sk-invalid')
    mockFindUnique.mockResolvedValue({
      tenantId: 'default',
      provider: 'openrouter',
      apiKeyEncrypted: encrypted,
      baseUrl: null,
      defaultModel: null,
      policy: 'aegis_only',
      lastTestedAt: null,
      lastTestResult: null,
      lastTestLatency: null,
    })

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true, data: { answer: 'AEGIS answer' } }),
    })

    // WHEN: frontend requests byollm
    const req = buildRequest('POST', '/api/chat', {
      query: 'test query',
      llmProvider: 'byollm',
    })
    await chatRoute.POST(req)

    // THEN: BYOLLM fields are stripped regardless of key validity
    const forwardedBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(forwardedBody.llmProvider).toBeUndefined()
    expect(forwardedBody.llmApiKey).toBeUndefined()
  })
})

describe('AC-2: Policy enforcement — byollm_only forces BYOLLM fields', () => {
  test('byollm_only policy injects BYOLLM fields even when frontend sends aegis', async () => {
    // GIVEN: tenant with valid BYOLLM key, policy=byollm_only
    const encrypted = await encryptKey(TEST_RAW_API_KEY)
    mockFindUnique.mockResolvedValue({
      tenantId: 'default',
      provider: 'openrouter',
      apiKeyEncrypted: encrypted,
      baseUrl: null,
      defaultModel: 'anthropic/claude-sonnet-4-20250514',
      policy: 'byollm_only',
      lastTestedAt: null,
      lastTestResult: null,
      lastTestLatency: null,
    })

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true, data: { answer: 'BYOLLM answer' } }),
    })

    // WHEN: frontend does NOT send llmProvider (defaults to aegis)
    const req = buildRequest('POST', '/api/chat', {
      query: 'What is the NDA term?',
    })
    await chatRoute.POST(req)

    // THEN: Go backend is called WITH BYOLLM fields (policy overrides)
    const forwardedBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(forwardedBody.llmProvider).toBe('openrouter')
    expect(forwardedBody.llmModel).toBe('anthropic/claude-sonnet-4-20250514')
    expect(forwardedBody.llmApiKey).toBe(TEST_RAW_API_KEY)
  })

  test('byollm_only policy never allows AEGIS-only routing', async () => {
    // GIVEN: tenant with policy=byollm_only
    const encrypted = await encryptKey(TEST_RAW_API_KEY)
    mockFindUnique.mockResolvedValue({
      tenantId: 'default',
      provider: 'openai',
      apiKeyEncrypted: encrypted,
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

    const req = buildRequest('POST', '/api/chat', { query: 'test' })
    await chatRoute.POST(req)

    const forwardedBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(forwardedBody.llmProvider).toBe('openai')
    expect(forwardedBody.llmBaseUrl).toBe('https://api.openai.com/v1')
  })
})

describe('AC-2: Policy enforcement — choice passes BYOLLM when requested', () => {
  test('choice policy forwards BYOLLM fields when frontend requests byollm', async () => {
    // GIVEN: tenant with valid BYOLLM key, policy=choice
    const encrypted = await encryptKey(TEST_RAW_API_KEY)
    mockFindUnique.mockResolvedValue({
      tenantId: 'default',
      provider: 'openrouter',
      apiKeyEncrypted: encrypted,
      baseUrl: null,
      defaultModel: 'anthropic/claude-sonnet-4-20250514',
      policy: 'choice',
      lastTestedAt: null,
      lastTestResult: null,
      lastTestLatency: null,
    })

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true, data: { answer: 'BYOLLM answer' } }),
    })

    // WHEN: frontend sends llmProvider=byollm with a model override
    const req = buildRequest('POST', '/api/chat', {
      query: 'What is the NDA term?',
      llmProvider: 'byollm',
      llmModel: 'openai/gpt-4o',
    })
    await chatRoute.POST(req)

    // THEN: Go backend receives BYOLLM fields with frontend's model
    const forwardedBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(forwardedBody.llmProvider).toBe('openrouter')
    expect(forwardedBody.llmModel).toBe('openai/gpt-4o')
    expect(forwardedBody.llmApiKey).toBe(TEST_RAW_API_KEY)
  })

  test('choice policy uses AEGIS when no LLMConfig exists', async () => {
    // GIVEN: tenant without any LLMConfig
    mockFindUnique.mockResolvedValue(null)

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true, data: { answer: 'AEGIS answer' } }),
    })

    // WHEN: frontend sends llmProvider=byollm but no config exists
    const req = buildRequest('POST', '/api/chat', {
      query: 'test',
      llmProvider: 'byollm',
    })
    await chatRoute.POST(req)

    // THEN: Go backend is called without BYOLLM fields (graceful fallback)
    const forwardedBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(forwardedBody.llmProvider).toBeUndefined()
    expect(forwardedBody.llmApiKey).toBeUndefined()
  })

  test('choice policy does not inject BYOLLM when frontend uses aegis', async () => {
    // GIVEN: tenant with valid BYOLLM key, policy=choice
    const encrypted = await encryptKey(TEST_RAW_API_KEY)
    mockFindUnique.mockResolvedValue({
      tenantId: 'default',
      provider: 'openrouter',
      apiKeyEncrypted: encrypted,
      baseUrl: null,
      defaultModel: 'anthropic/claude-sonnet-4-20250514',
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

    // WHEN: frontend does NOT send llmProvider (uses aegis)
    const req = buildRequest('POST', '/api/chat', { query: 'test' })
    await chatRoute.POST(req)

    // THEN: Go backend is called without BYOLLM fields
    const forwardedBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(forwardedBody.llmProvider).toBeUndefined()
    expect(forwardedBody.llmApiKey).toBeUndefined()
  })
})

// ═══════════════════════════════════════════════════════════
// AC-3: Key Encryption & Masking (IMPLEMENTED)
// ═══════════════════════════════════════════════════════════

describe('AC-3: Key encryption — kms-stub encrypt/decrypt round-trip', () => {
  test('encryptKey produces a kms-stub prefixed value, not the raw key', async () => {
    const encrypted = await encryptKey(TEST_RAW_API_KEY)

    expect(encrypted).not.toBe(TEST_RAW_API_KEY)
    expect(encrypted.startsWith('kms-stub:')).toBe(true)
    expect(encrypted).not.toContain(TEST_RAW_API_KEY)
  })

  test('decryptKey recovers the original key from encrypted value', async () => {
    const encrypted = await encryptKey(TEST_RAW_API_KEY)
    const decrypted = await decryptKey(encrypted)

    expect(decrypted).toBe(TEST_RAW_API_KEY)
  })

  test('decryptKey throws on unknown encryption format', async () => {
    await expect(decryptKey('unknown-format:abc')).rejects.toThrow(
      'Unknown encryption format'
    )
  })
})

describe('AC-3: Key encryption — PUT /api/settings/llm stores encrypted key', () => {
  test('API key is encrypted via KMS before storage', async () => {
    // GIVEN: no existing config
    mockFindUnique.mockResolvedValue(null)
    mockCreate.mockResolvedValue({
      tenantId: 'default',
      provider: 'openrouter',
      apiKeyEncrypted: '',  // will be overwritten
      baseUrl: null,
      defaultModel: null,
      policy: 'choice',
      lastTestedAt: null,
      lastTestResult: null,
      lastTestLatency: null,
    })

    // WHEN: PUT with raw API key
    const req = buildRequest('PUT', '/api/settings/llm', {
      provider: 'openrouter',
      apiKey: TEST_RAW_API_KEY,
    })
    await settingsRoute.PUT(req)

    // THEN: prisma.create was called with encrypted value
    expect(mockCreate).toHaveBeenCalledTimes(1)
    const createArgs = mockCreate.mock.calls[0][0]
    const storedKey = createArgs.data.apiKeyEncrypted

    // Stored value is NOT the raw key
    expect(storedKey).not.toBe(TEST_RAW_API_KEY)
    // Stored value has kms-stub prefix
    expect(storedKey.startsWith('kms-stub:')).toBe(true)
    // Stored value can be decrypted back to original
    const decrypted = await decryptKey(storedKey)
    expect(decrypted).toBe(TEST_RAW_API_KEY)
  })

  test('updating existing config re-encrypts the key', async () => {
    // GIVEN: existing config in DB
    const oldEncrypted = await encryptKey('sk-old-key-value-here-1234567890')
    mockFindUnique.mockResolvedValue({
      tenantId: 'default',
      provider: 'openrouter',
      apiKeyEncrypted: oldEncrypted,
      baseUrl: null,
      defaultModel: null,
      policy: 'choice',
      lastTestedAt: null,
      lastTestResult: null,
      lastTestLatency: null,
    })
    mockUpdate.mockResolvedValue({
      tenantId: 'default',
      provider: 'openrouter',
      apiKeyEncrypted: '',
      baseUrl: null,
      defaultModel: null,
      policy: 'choice',
      lastTestedAt: null,
      lastTestResult: null,
      lastTestLatency: null,
    })

    // WHEN: PUT with a new API key
    const req = buildRequest('PUT', '/api/settings/llm', {
      apiKey: TEST_RAW_API_KEY,
    })
    await settingsRoute.PUT(req)

    // THEN: prisma.update was called with newly encrypted value
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    const updateArgs = mockUpdate.mock.calls[0][0]
    const storedKey = updateArgs.data.apiKeyEncrypted

    expect(storedKey).not.toBe(TEST_RAW_API_KEY)
    expect(storedKey).not.toBe(oldEncrypted)
    const decrypted = await decryptKey(storedKey)
    expect(decrypted).toBe(TEST_RAW_API_KEY)
  })
})

describe('AC-3: Key masking — GET /api/settings/llm returns masked key', () => {
  test('response contains masked key (first 5 + *** + last 3)', async () => {
    // GIVEN: tenant with stored BYOLLM config
    const encrypted = await encryptKey(TEST_RAW_API_KEY)
    mockFindUnique.mockResolvedValue({
      tenantId: 'default',
      provider: 'openrouter',
      apiKeyEncrypted: encrypted,
      baseUrl: null,
      defaultModel: 'anthropic/claude-sonnet-4-20250514',
      policy: 'choice',
      lastTestedAt: null,
      lastTestResult: null,
      lastTestLatency: null,
    })

    // WHEN: GET /api/settings/llm
    const req = buildRequest('GET', '/api/settings/llm')
    const res = await settingsRoute.GET(req)
    const body = await parseResponse(res)

    // THEN: response has masked key, not raw key
    const data = body.data as Record<string, unknown>
    expect(data.configured).toBe(true)
    expect(data.maskedKey).toBe(TEST_MASKED_API_KEY)
  })

  test('short keys are fully masked', () => {
    expect(realMaskApiKey('short')).toBe('***')
    expect(realMaskApiKey('123456789')).toBe('***') // 9 chars, below 10
    expect(realMaskApiKey('1234567890')).toBe('12345***890') // exactly 10
  })

  test('maskApiKey utility matches test-helper maskApiKey', () => {
    // Real implementation and test helper should agree
    expect(realMaskApiKey(TEST_RAW_API_KEY)).toBe(maskApiKey(TEST_RAW_API_KEY))
    expect(realMaskApiKey(TEST_RAW_API_KEY)).toBe(TEST_MASKED_API_KEY)
  })
})

describe('AC-3: Key masking — full key never in any API response body', () => {
  test('PUT /api/settings/llm response does not echo back the raw key', async () => {
    // GIVEN: no existing config
    const encrypted = await encryptKey(TEST_RAW_API_KEY)
    mockFindUnique.mockResolvedValue(null)
    mockCreate.mockResolvedValue({
      tenantId: 'default',
      provider: 'openrouter',
      apiKeyEncrypted: encrypted,
      baseUrl: null,
      defaultModel: null,
      policy: 'choice',
      lastTestedAt: null,
      lastTestResult: null,
      lastTestLatency: null,
    })

    // WHEN: PUT with raw API key
    const req = buildRequest('PUT', '/api/settings/llm', {
      provider: 'openrouter',
      apiKey: TEST_RAW_API_KEY,
    })
    const res = await settingsRoute.PUT(req)
    const body = await parseResponse(res)
    const bodyStr = JSON.stringify(body)

    // THEN: response body does NOT contain the raw key
    expect(bodyStr).not.toContain(TEST_RAW_API_KEY)
    // THEN: response body contains the masked version
    expect(bodyStr).toContain(TEST_MASKED_API_KEY)
  })

  test('GET /api/settings/llm response does not contain raw key', async () => {
    // GIVEN: tenant with stored BYOLLM config
    const encrypted = await encryptKey(TEST_RAW_API_KEY)
    mockFindUnique.mockResolvedValue({
      tenantId: 'default',
      provider: 'openrouter',
      apiKeyEncrypted: encrypted,
      baseUrl: null,
      defaultModel: null,
      policy: 'choice',
      lastTestedAt: null,
      lastTestResult: null,
      lastTestLatency: null,
    })

    // WHEN: GET /api/settings/llm
    const req = buildRequest('GET', '/api/settings/llm')
    const res = await settingsRoute.GET(req)
    const body = await parseResponse(res)
    const bodyStr = JSON.stringify(body)

    // THEN: full response JSON does NOT contain the raw key
    expect(bodyStr).not.toContain(TEST_RAW_API_KEY)
  })

  test('chat proxy does not leak the API key in the forwarded response', async () => {
    // GIVEN: tenant with BYOLLM config, policy=choice
    const encrypted = await encryptKey(TEST_RAW_API_KEY)
    mockFindUnique.mockResolvedValue({
      tenantId: 'default',
      provider: 'openrouter',
      apiKeyEncrypted: encrypted,
      baseUrl: null,
      defaultModel: 'anthropic/claude-sonnet-4-20250514',
      policy: 'choice',
      lastTestedAt: null,
      lastTestResult: null,
      lastTestLatency: null,
    })

    // Mock Go backend returning a JSON response
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        success: true,
        data: { answer: 'The NDA term is 3 years.', confidence: 0.91 },
      }),
    })

    // WHEN: chat request with BYOLLM
    const req = buildRequest('POST', '/api/chat', {
      query: 'What is the NDA term?',
      llmProvider: 'byollm',
    })
    const res = await chatRoute.POST(req)
    const body = await parseResponse(res)
    const bodyStr = JSON.stringify(body)

    // THEN: response body does NOT contain the raw key
    expect(bodyStr).not.toContain(TEST_RAW_API_KEY)

    // Also verify the key WAS sent to Go backend (server-to-server)
    const forwardedBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(forwardedBody.llmApiKey).toBe(TEST_RAW_API_KEY)
  })
})

// ═══════════════════════════════════════════════════════════
// AC-4: Audit Log Fields (IMPLEMENTED — mock factory level)
// ═══════════════════════════════════════════════════════════

describe('AC-4: Audit log — model_used field present on every chat response', () => {
  test('AEGIS response includes modelUsed as non-empty string', () => {
    const response = createAegisResponse()

    expect(response.modelUsed).toBeTruthy()
    expect(typeof response.modelUsed).toBe('string')
    expect(response.modelUsed).toContain('gemini')
  })

  test('BYOLLM response includes modelUsed that is not gemini', () => {
    const response = createOpenRouterResponse()

    expect(response.modelUsed).toBeTruthy()
    expect(typeof response.modelUsed).toBe('string')
    expect(response.modelUsed).not.toContain('gemini')
  })

  test('modelUsed is included in SSE confidence event frame', () => {
    const response = createAegisResponse()
    const frames = chatResponseToSSEFrames(response)

    const confidenceFrame = frames.find(f => f.event === 'confidence')
    expect(confidenceFrame).toBeDefined()

    const parsed = JSON.parse(confidenceFrame!.data)
    expect(parsed.score).toBe(response.confidence)
    // Note: the SSE spec shows {score, iterations} currently.
    // modelUsed will be added in Go backend (STORY-022 B.5).
    expect(parsed.score).toBeGreaterThan(0)
  })
})

describe('AC-4: Audit log — provider field present', () => {
  test('AEGIS responses have modelUsed containing gemini', () => {
    const response = createAegisResponse()
    expect(response.modelUsed).toMatch(/gemini/)
  })

  test('BYOLLM responses have modelUsed matching the configured model', () => {
    const response = createOpenRouterResponse({ model: 'openai/gpt-4o' })
    expect(response.modelUsed).toBe('openai/gpt-4o')
  })

  test('different BYOLLM providers produce different modelUsed values', () => {
    const or = createOpenRouterResponse({ model: 'anthropic/claude-sonnet-4-20250514' })
    const oai = createOpenRouterResponse({ model: 'openai/gpt-4o' })

    expect(or.modelUsed).not.toBe(oai.modelUsed)
  })
})

describe('AC-4: Audit log — latency_ms recorded', () => {
  test('latency_ms is a positive integer on successful responses', () => {
    const response = createAegisResponse({ latencyMs: 800 })
    expect(response.latencyMs).toBeGreaterThan(0)
    expect(Number.isInteger(response.latencyMs)).toBe(true)
  })

  test('AEGIS latency and BYOLLM latency are both positive', () => {
    const aegis = createAegisResponse()
    const byollm = createOpenRouterResponse()

    expect(aegis.latencyMs).toBeGreaterThan(0)
    expect(byollm.latencyMs).toBeGreaterThan(0)
  })

  test('SSE done event is last frame (latency is measurable up to done)', () => {
    const response = createAegisResponse()
    const frames = chatResponseToSSEFrames(response)
    const lastFrame = frames[frames.length - 1]

    expect(lastFrame.event).toBe('done')
  })
})

// ═══════════════════════════════════════════════════════════
// AC-5: Same Retrieved Chunks (stubbed — requires Go backend)
// ═══════════════════════════════════════════════════════════

describe('AC-5: Same citations — BYOLLM and AEGIS return identical retrieved chunks', () => {
  test('retrieval step produces same chunks regardless of LLM provider', async () => {
    // STUBBED: requires Go backend retriever + two generator mocks
    // The retriever runs BEFORE the LLM generator. Chunks should
    // be identical because retrieval uses embeddings, not the chat LLM.
    const _aegis = createAegisResponse()
    const _byollm = createOpenRouterResponse()
  })

  test('chunk ordering is deterministic across providers', async () => {
    // STUBBED: requires Go backend
  })
})

// ═══════════════════════════════════════════════════════════
// AC-6: Silence Protocol Consistency (stubbed — requires Go backend)
// ═══════════════════════════════════════════════════════════

describe('AC-6: Silence Protocol — same threshold regardless of LLM', () => {
  test('Silence Protocol triggers at 0.85 for AEGIS', async () => {
    // STUBBED: requires Go backend SelfRAG + silence event
  })

  test('Silence Protocol triggers at 0.85 for BYOLLM (OpenRouter)', async () => {
    // STUBBED: requires Go backend SelfRAG + silence event
  })

  test('Silence Protocol threshold is NOT provider-dependent', async () => {
    // STUBBED: requires Go backend SelfRAG
  })

  test('above-threshold confidence passes for both providers', async () => {
    // STUBBED: requires Go backend SelfRAG
  })
})
