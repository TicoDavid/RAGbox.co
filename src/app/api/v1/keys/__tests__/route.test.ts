/**
 * Tests for /api/v1/keys route handlers (GET, POST, DELETE)
 * and validateApiKey from apiKeyManager.
 *
 * Covers: auth checks, key listing, creation, revocation,
 * validation rejecting revoked keys, and error paths.
 */

// ── Mocks (declared before any imports that reference them) ────────────

const mockGetToken = jest.fn()
jest.mock('next-auth/jwt', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
}))

const mockFindMany = jest.fn()
const mockFindUnique = jest.fn()
const mockCreate = jest.fn()
const mockUpdateMany = jest.fn()
const mockUpdate = jest.fn()
const mockCount = jest.fn()
const mockUserFindUnique = jest.fn()
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    apiKey: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}))

const mockWriteAuditEntry = jest.fn()
jest.mock('@/lib/audit/auditWriter', () => ({
  writeAuditEntry: (...args: unknown[]) => mockWriteAuditEntry(...args),
}))

// ── Imports (after mocks) ────────────────────────────────────

import { NextRequest } from 'next/server'
import { GET, POST, DELETE } from '../route'
import { validateApiKey } from '@/lib/api/apiKeyManager'

// ── Helpers ──────────────────────────────────────────────────

function buildRequest(
  method: string,
  body?: Record<string, unknown>,
  queryParams?: Record<string, string>,
): NextRequest {
  const url = new URL('/api/v1/keys', 'http://localhost:3000')
  if (queryParams) {
    for (const [k, v] of Object.entries(queryParams)) {
      url.searchParams.set(k, v)
    }
  }
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) {
    init.body = JSON.stringify(body)
  }
  return new NextRequest(url, init as ConstructorParameters<typeof NextRequest>[1])
}

async function parseResponse(res: Response): Promise<Record<string, unknown>> {
  return res.json()
}

function authenticateAs(id = 'user-001', email = 'test@ragbox.co') {
  mockGetToken.mockResolvedValue({ id, email })
}

// ── Setup ─────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  authenticateAs()
  mockWriteAuditEntry.mockResolvedValue(undefined)
  // Default: sovereign tier (allows API key creation)
  mockUserFindUnique.mockResolvedValue({ subscriptionTier: 'sovereign', subscriptionStatus: 'active' })
  // Default: 0 existing keys (under limit)
  mockCount.mockResolvedValue(0)
})

// ═══════════════════════════════════════════════════════════
// GET /api/v1/keys
// ═══════════════════════════════════════════════════════════

describe('GET /api/v1/keys', () => {
  test('returns 401 when not authenticated', async () => {
    mockGetToken.mockResolvedValue(null)
    const res = await GET(buildRequest('GET'))
    expect(res.status).toBe(401)
    const body = await parseResponse(res)
    expect(body.success).toBe(false)
  })

  test('returns keys list for authenticated user', async () => {
    const mockKeys = [
      {
        id: 'key-1',
        name: 'Production',
        keyPrefix: 'rbx_live_abcd1234...',
        scopes: ['read', 'write'],
        lastUsedAt: null,
        isRevoked: false,
        createdAt: new Date('2025-01-01'),
      },
    ]
    mockFindMany.mockResolvedValue(mockKeys)

    const res = await GET(buildRequest('GET'))
    const body = await parseResponse(res)

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect((body.data as Record<string, unknown>).keys).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'key-1', name: 'Production' })]),
    )
  })
})

// ═══════════════════════════════════════════════════════════
// POST /api/v1/keys
// ═══════════════════════════════════════════════════════════

describe('POST /api/v1/keys', () => {
  test('returns 401 when not authenticated', async () => {
    mockGetToken.mockResolvedValue(null)
    const res = await POST(buildRequest('POST', { name: 'Test Key' }))
    expect(res.status).toBe(401)
  })

  test('creates key with valid name', async () => {
    mockCreate.mockResolvedValue({
      id: 'key-new',
      name: 'My API Key',
      keyPrefix: 'rbx_live_abcd1234...',
      scopes: ['read'],
      createdAt: new Date(),
    })

    const res = await POST(buildRequest('POST', { name: 'My API Key' }))
    const body = await parseResponse(res)

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    const data = body.data as Record<string, unknown>
    expect(data.key).toBeDefined()
    expect(typeof data.key).toBe('string')
    expect(data.name).toBe('My API Key')
    expect(mockWriteAuditEntry).toHaveBeenCalledWith(
      'user-001',
      'apikey.create',
      'key-new',
      expect.objectContaining({ name: 'My API Key' }),
    )
  })

  test('rejects empty name with 400', async () => {
    const res = await POST(buildRequest('POST', { name: '' }))
    const body = await parseResponse(res)
    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error).toContain('name')
  })

  test('rejects missing name with 400', async () => {
    const res = await POST(buildRequest('POST', {}))
    const body = await parseResponse(res)
    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
  })

  test('rejects invalid JSON with 400', async () => {
    const req = new NextRequest(
      new URL('/api/v1/keys', 'http://localhost:3000'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      },
    )
    const res = await POST(req)
    const body = await parseResponse(res)
    expect(res.status).toBe(400)
    expect(body.error).toBe('Invalid JSON')
  })
})

// ═══════════════════════════════════════════════════════════
// DELETE /api/v1/keys
// ═══════════════════════════════════════════════════════════

describe('DELETE /api/v1/keys', () => {
  test('returns 401 when not authenticated', async () => {
    mockGetToken.mockResolvedValue(null)
    const res = await DELETE(buildRequest('DELETE', undefined, { id: 'key-1' }))
    expect(res.status).toBe(401)
  })

  test('revokes key with valid id', async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 })

    const res = await DELETE(buildRequest('DELETE', undefined, { id: 'key-1' }))
    const body = await parseResponse(res)

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockWriteAuditEntry).toHaveBeenCalledWith('user-001', 'apikey.revoke', 'key-1')
  })

  test('returns 400 without key id', async () => {
    const res = await DELETE(buildRequest('DELETE'))
    const body = await parseResponse(res)
    expect(res.status).toBe(400)
    expect(body.error).toContain('Key ID required')
  })

  test('returns 404 for non-existent key', async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 })

    const res = await DELETE(buildRequest('DELETE', undefined, { id: 'nonexistent' }))
    const body = await parseResponse(res)
    expect(res.status).toBe(404)
    expect(body.error).toBe('Key not found')
  })
})

// ═══════════════════════════════════════════════════════════
// validateApiKey (unit)
// ═══════════════════════════════════════════════════════════

describe('validateApiKey', () => {
  test('rejects key without correct prefix', async () => {
    const result = await validateApiKey('sk_invalid_key')
    expect(result).toBeNull()
  })

  test('rejects key not found in DB', async () => {
    mockFindUnique.mockResolvedValue(null)
    const result = await validateApiKey('rbx_live_' + 'a'.repeat(48))
    expect(result).toBeNull()
  })

  test('rejects revoked key', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'key-1',
      isRevoked: true,
      expiresAt: null,
      user: { id: 'user-001', email: 'test@ragbox.co', name: 'Test' },
    })
    // Fire-and-forget update should not be called for revoked keys
    const result = await validateApiKey('rbx_live_' + 'a'.repeat(48))
    expect(result).toBeNull()
  })

  test('rejects expired key', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'key-1',
      isRevoked: false,
      expiresAt: new Date('2020-01-01'),
      user: { id: 'user-001', email: 'test@ragbox.co', name: 'Test' },
    })
    const result = await validateApiKey('rbx_live_' + 'a'.repeat(48))
    expect(result).toBeNull()
  })

  test('returns key record for valid, active key', async () => {
    const mockApiKey = {
      id: 'key-1',
      isRevoked: false,
      expiresAt: null,
      user: { id: 'user-001', email: 'test@ragbox.co', name: 'Test' },
    }
    mockFindUnique.mockResolvedValue(mockApiKey)
    mockUpdate.mockResolvedValue(mockApiKey)

    const result = await validateApiKey('rbx_live_' + 'a'.repeat(48))
    expect(result).not.toBeNull()
    expect(result?.id).toBe('key-1')
  })
})
