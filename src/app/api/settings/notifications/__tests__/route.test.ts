/**
 * Tests for /api/settings/notifications route handlers (GET, PUT)
 *
 * Covers: auth checks, defaults when no record exists, upsert behavior,
 * boolean field validation, and empty payload rejection.
 */

// ── Mocks ────────────────────────────────────────────────

const mockGetToken = jest.fn()
jest.mock('next-auth/jwt', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
}))

const mockFindUnique = jest.fn()
const mockUpsert = jest.fn()
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    notificationSettings: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
  },
}))

// ── Imports ──────────────────────────────────────────────

import { NextRequest } from 'next/server'
import { GET, PUT } from '../route'

// ── Helpers ──────────────────────────────────────────────

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
  return new NextRequest(new URL('/api/settings/notifications', 'http://localhost:3000'), init as ConstructorParameters<typeof NextRequest>[1])
}

async function parseResponse(res: Response): Promise<Record<string, unknown>> {
  return res.json()
}

function authenticateAs(id = 'user-001', email = 'test@ragbox.co') {
  mockGetToken.mockResolvedValue({ id, email })
}

// ── Setup ────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  authenticateAs()
})

// ═══════════════════════════════════════════════════════════
// GET /api/settings/notifications
// ═══════════════════════════════════════════════════════════

describe('GET /api/settings/notifications', () => {
  test('returns 401 when not authenticated', async () => {
    mockGetToken.mockResolvedValue(null)
    const res = await GET(buildRequest('GET'))
    expect(res.status).toBe(401)
  })

  test('returns defaults when no record exists', async () => {
    mockFindUnique.mockResolvedValue(null)
    const res = await GET(buildRequest('GET'))
    const body = await parseResponse(res)

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    const data = body.data as Record<string, boolean>
    expect(data.email).toBe(true)
    expect(data.push).toBe(false)
    expect(data.audit).toBe(true)
  })

  test('returns saved preferences when record exists', async () => {
    mockFindUnique.mockResolvedValue({ email: false, push: true, audit: false })
    const res = await GET(buildRequest('GET'))
    const body = await parseResponse(res)

    const data = body.data as Record<string, boolean>
    expect(data.email).toBe(false)
    expect(data.push).toBe(true)
    expect(data.audit).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════
// PUT /api/settings/notifications
// ═══════════════════════════════════════════════════════════

describe('PUT /api/settings/notifications', () => {
  test('returns 401 when not authenticated', async () => {
    mockGetToken.mockResolvedValue(null)
    const res = await PUT(buildRequest('PUT', { email: false }))
    expect(res.status).toBe(401)
  })

  test('updates single preference', async () => {
    mockUpsert.mockResolvedValue({ email: false, push: false, audit: true })
    const res = await PUT(buildRequest('PUT', { email: false }))
    const body = await parseResponse(res)

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect((body.data as Record<string, boolean>).email).toBe(false)
  })

  test('updates multiple preferences', async () => {
    mockUpsert.mockResolvedValue({ email: false, push: true, audit: false })
    const res = await PUT(buildRequest('PUT', { email: false, push: true, audit: false }))
    const body = await parseResponse(res)

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })

  test('rejects non-boolean field with 400', async () => {
    const res = await PUT(buildRequest('PUT', { email: 'yes' }))
    const body = await parseResponse(res)
    expect(res.status).toBe(400)
    expect(body.error).toContain('boolean')
  })

  test('rejects empty payload with 400', async () => {
    const res = await PUT(buildRequest('PUT', {}))
    const body = await parseResponse(res)
    expect(res.status).toBe(400)
    expect(body.error).toContain('No valid fields')
  })

  test('ignores unknown fields', async () => {
    mockUpsert.mockResolvedValue({ email: true, push: false, audit: true })
    const res = await PUT(buildRequest('PUT', { email: true, unknownField: true }))
    const body = await parseResponse(res)
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })
})
