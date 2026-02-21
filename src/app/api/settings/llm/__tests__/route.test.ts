/**
 * Tests for /api/settings/llm route handlers (GET, PUT, DELETE)
 *
 * Covers: auth checks, GET with/without config, serializeConfig decryptKey
 * failure, PUT validation, PUT upsert (create vs update), PUT apiKey
 * encryption, DELETE existing/missing, and 500 error paths.
 */

// ── Mocks (declared before any imports that reference them) ────────────

const mockGetToken = jest.fn()
jest.mock('next-auth/jwt', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
}))

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
  },
}))

const mockEncryptKey = jest.fn()
const mockDecryptKey = jest.fn()
jest.mock('@/lib/utils/kms', () => ({
  encryptKey: (...args: unknown[]) => mockEncryptKey(...args),
  decryptKey: (...args: unknown[]) => mockDecryptKey(...args),
}))

jest.mock('@/lib/utils/mask-key', () => ({
  maskApiKey: (key: string) => key.length < 10 ? '***' : `${key.slice(0, 5)}***${key.slice(-3)}`,
}))

// ── Imports (after mocks) ────────────────────────────────────

import { NextRequest } from 'next/server'
import { GET, PUT, DELETE } from '../route'

// ── Helpers ──────────────────────────────────────────────────

function buildRequest(
  method: string,
  body?: Record<string, unknown>,
): NextRequest {
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) {
    init.body = JSON.stringify(body)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NextRequest(new URL('/api/settings/llm', 'http://localhost:3000'), init as any)
}

async function parseResponse(res: Response): Promise<Record<string, unknown>> {
  return res.json()
}

function authenticateAs(id = 'user-001', email = 'test@ragbox.co') {
  mockGetToken.mockResolvedValue({ id, email })
}

function buildLLMConfig(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: 'default',
    provider: 'openrouter',
    apiKeyEncrypted: 'kms-stub:abc',
    baseUrl: null,
    defaultModel: 'claude-3.5-sonnet',
    policy: 'choice',
    lastTestedAt: null,
    lastTestResult: null,
    lastTestLatency: null,
    ...overrides,
  }
}

// ── Setup ─────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  authenticateAs()
  mockDecryptKey.mockResolvedValue('sk-raw-api-key-1234567890')
  mockEncryptKey.mockResolvedValue('kms-stub:encrypted')
})

// ═══════════════════════════════════════════════════════════
// GET /api/settings/llm
// ═══════════════════════════════════════════════════════════

describe('GET /api/settings/llm', () => {
  test('returns 401 when not authenticated', async () => {
    mockGetToken.mockResolvedValue(null)
    const req = buildRequest('GET')
    const res = await GET(req)
    const body = await parseResponse(res)
    expect(res.status).toBe(401)
    expect(body.error).toBe('Authentication required')
  })

  test('returns configured:false when no LLMConfig exists', async () => {
    mockFindUnique.mockResolvedValue(null)
    const req = buildRequest('GET')
    const res = await GET(req)
    const body = await parseResponse(res)
    expect(body.success).toBe(true)
    expect((body.data as Record<string, unknown>).configured).toBe(false)
    expect((body.data as Record<string, unknown>).policy).toBe('choice')
  })

  test('returns serialized config with masked key when config exists', async () => {
    mockFindUnique.mockResolvedValue(buildLLMConfig({
      lastTestedAt: new Date('2025-06-01T00:00:00Z'),
      lastTestResult: 'ok',
      lastTestLatency: 200,
    }))
    const req = buildRequest('GET')
    const res = await GET(req)
    const body = await parseResponse(res)
    const data = body.data as Record<string, unknown>
    expect(body.success).toBe(true)
    expect(data.configured).toBe(true)
    expect(data.provider).toBe('openrouter')
    expect(data.maskedKey).toBe('sk-ra***890')
    expect(data.lastTestedAt).toBe('2025-06-01T00:00:00.000Z')
    expect(data.lastTestResult).toBe('ok')
    expect(data.lastTestLatency).toBe(200)
  })

  test('returns maskedKey as *** when decryption fails', async () => {
    mockDecryptKey.mockRejectedValue(new Error('KMS unavailable'))
    mockFindUnique.mockResolvedValue(buildLLMConfig())
    const req = buildRequest('GET')
    const res = await GET(req)
    const body = await parseResponse(res)
    const data = body.data as Record<string, unknown>
    expect(data.maskedKey).toBe('***')
  })

  test('returns 500 on unexpected error', async () => {
    mockFindUnique.mockRejectedValue(new Error('DB failure'))
    const req = buildRequest('GET')
    const res = await GET(req)
    const body = await parseResponse(res)
    expect(res.status).toBe(500)
    expect(body.error).toBe('Failed to load LLM settings')
  })
})

// ═══════════════════════════════════════════════════════════
// PUT /api/settings/llm
// ═══════════════════════════════════════════════════════════

describe('PUT /api/settings/llm', () => {
  test('returns 401 when not authenticated', async () => {
    mockGetToken.mockResolvedValue(null)
    const req = buildRequest('PUT', { provider: 'openai', apiKey: 'sk-test' })
    const res = await PUT(req)
    expect(res.status).toBe(401)
  })

  test('returns 400 when body fails Zod validation', async () => {
    const req = buildRequest('PUT', { provider: 'invalid_provider' })
    const res = await PUT(req)
    const body = await parseResponse(res)
    expect(res.status).toBe(400)
    expect(body.error).toBe('Invalid request')
    expect(body.details).toBeDefined()
  })

  test('updates existing config when record exists', async () => {
    mockFindUnique.mockResolvedValue(buildLLMConfig())
    mockUpdate.mockResolvedValue(buildLLMConfig({ policy: 'aegis_only' }))
    const req = buildRequest('PUT', { policy: 'aegis_only' })
    const res = await PUT(req)
    const body = await parseResponse(res)
    expect(body.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  test('encrypts apiKey before storing', async () => {
    mockFindUnique.mockResolvedValue(buildLLMConfig())
    mockUpdate.mockResolvedValue(buildLLMConfig())
    const req = buildRequest('PUT', { apiKey: 'sk-new-key-value' })
    await PUT(req)
    expect(mockEncryptKey).toHaveBeenCalledWith('sk-new-key-value')
    const updateArgs = mockUpdate.mock.calls[0][0]
    expect(updateArgs.data.apiKeyEncrypted).toBe('kms-stub:encrypted')
  })

  test('creates new config when no existing record', async () => {
    mockFindUnique.mockResolvedValue(null)
    mockCreate.mockResolvedValue(buildLLMConfig())
    const req = buildRequest('PUT', {
      provider: 'openai',
      apiKey: 'sk-new-key-value-1234567890',
    })
    const res = await PUT(req)
    const body = await parseResponse(res)
    expect(body.success).toBe(true)
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  test('returns 400 when creating new config without apiKey', async () => {
    mockFindUnique.mockResolvedValue(null)
    const req = buildRequest('PUT', { provider: 'openai' })
    const res = await PUT(req)
    const body = await parseResponse(res)
    expect(res.status).toBe(400)
    expect(body.error).toBe('API key is required for initial configuration')
  })

  test('creates config with all optional fields', async () => {
    mockFindUnique.mockResolvedValue(null)
    mockCreate.mockResolvedValue(buildLLMConfig({
      provider: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      defaultModel: 'claude-3.5-sonnet',
      policy: 'byollm_only',
    }))
    const req = buildRequest('PUT', {
      provider: 'anthropic',
      apiKey: 'sk-ant-key-1234567890',
      baseUrl: 'https://api.anthropic.com',
      defaultModel: 'claude-3.5-sonnet',
      policy: 'byollm_only',
    })
    const res = await PUT(req)
    const body = await parseResponse(res)
    expect(body.success).toBe(true)
    const createData = mockCreate.mock.calls[0][0].data
    expect(createData.provider).toBe('anthropic')
    expect(createData.baseUrl).toBe('https://api.anthropic.com')
    expect(createData.defaultModel).toBe('claude-3.5-sonnet')
    expect(createData.policy).toBe('byollm_only')
  })

  test('returns 500 on unexpected error', async () => {
    mockFindUnique.mockRejectedValue(new Error('DB failure'))
    const req = buildRequest('PUT', { apiKey: 'sk-key' })
    const res = await PUT(req)
    const body = await parseResponse(res)
    expect(res.status).toBe(500)
    expect(body.error).toBe('Failed to save LLM settings')
  })

  test('accepts nullable baseUrl and defaultModel', async () => {
    mockFindUnique.mockResolvedValue(buildLLMConfig())
    mockUpdate.mockResolvedValue(buildLLMConfig({ baseUrl: null, defaultModel: null }))
    const req = buildRequest('PUT', { baseUrl: null, defaultModel: null })
    const res = await PUT(req)
    const body = await parseResponse(res)
    expect(body.success).toBe(true)
    const updateArgs = mockUpdate.mock.calls[0][0]
    expect(updateArgs.data.baseUrl).toBeNull()
    expect(updateArgs.data.defaultModel).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════
// DELETE /api/settings/llm
// ═══════════════════════════════════════════════════════════

describe('DELETE /api/settings/llm', () => {
  test('returns 401 when not authenticated', async () => {
    mockGetToken.mockResolvedValue(null)
    const req = buildRequest('DELETE')
    const res = await DELETE(req)
    expect(res.status).toBe(401)
  })

  test('returns deleted:false when no config exists', async () => {
    mockFindUnique.mockResolvedValue(null)
    const req = buildRequest('DELETE')
    const res = await DELETE(req)
    const body = await parseResponse(res)
    expect(body.success).toBe(true)
    expect(body.deleted).toBe(false)
    expect(body.message).toBe('No configuration to delete')
  })

  test('deletes existing config and returns deleted:true', async () => {
    mockFindUnique.mockResolvedValue(buildLLMConfig())
    mockDelete.mockResolvedValue(buildLLMConfig())
    const req = buildRequest('DELETE')
    const res = await DELETE(req)
    const body = await parseResponse(res)
    expect(body.success).toBe(true)
    expect(body.deleted).toBe(true)
    expect(mockDelete).toHaveBeenCalledTimes(1)
  })

  test('returns 500 on unexpected error', async () => {
    mockFindUnique.mockRejectedValue(new Error('DB failure'))
    const req = buildRequest('DELETE')
    const res = await DELETE(req)
    const body = await parseResponse(res)
    expect(res.status).toBe(500)
    expect(body.error).toBe('Failed to delete LLM settings')
  })
})
