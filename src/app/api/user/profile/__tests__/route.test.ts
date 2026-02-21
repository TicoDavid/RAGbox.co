/**
 * Tests for /api/user/profile route handlers (GET, PUT)
 *
 * Covers: auth checks, profile retrieval, name update validation,
 * name length limits, and user-not-found edge case.
 */

// ── Mocks ────────────────────────────────────────────────

const mockGetToken = jest.fn()
jest.mock('next-auth/jwt', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
}))

const mockFindUnique = jest.fn()
const mockUpdate = jest.fn()
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NextRequest(new URL('/api/user/profile', 'http://localhost:3000'), init as any)
}

async function parseResponse(res: Response): Promise<Record<string, unknown>> {
  return res.json()
}

function authenticateAs(id = 'user-001', email = 'test@ragbox.co') {
  mockGetToken.mockResolvedValue({ id, email })
}

const mockUser = {
  id: 'user-001',
  name: 'David Tico',
  email: 'test@ragbox.co',
  image: null,
  role: 'Associate',
}

// ── Setup ────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  authenticateAs()
  mockFindUnique.mockResolvedValue(mockUser)
})

// ═══════════════════════════════════════════════════════════
// GET /api/user/profile
// ═══════════════════════════════════════════════════════════

describe('GET /api/user/profile', () => {
  test('returns 401 when not authenticated', async () => {
    mockGetToken.mockResolvedValue(null)
    const res = await GET(buildRequest('GET'))
    expect(res.status).toBe(401)
  })

  test('returns profile for authenticated user', async () => {
    const res = await GET(buildRequest('GET'))
    const body = await parseResponse(res)

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    const data = body.data as Record<string, unknown>
    expect(data.displayName).toBe('David Tico')
    expect(data.email).toBe('test@ragbox.co')
    expect(data.role).toBe('Associate')
  })

  test('returns 404 when user not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    const res = await GET(buildRequest('GET'))
    expect(res.status).toBe(404)
  })
})

// ═══════════════════════════════════════════════════════════
// PUT /api/user/profile
// ═══════════════════════════════════════════════════════════

describe('PUT /api/user/profile', () => {
  test('returns 401 when not authenticated', async () => {
    mockGetToken.mockResolvedValue(null)
    const res = await PUT(buildRequest('PUT', { displayName: 'New Name' }))
    expect(res.status).toBe(401)
  })

  test('updates displayName successfully', async () => {
    mockUpdate.mockResolvedValue({ ...mockUser, name: 'New Name' })
    const res = await PUT(buildRequest('PUT', { displayName: 'New Name' }))
    const body = await parseResponse(res)

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect((body.data as Record<string, unknown>).displayName).toBe('New Name')
  })

  test('rejects empty displayName with 400', async () => {
    const res = await PUT(buildRequest('PUT', { displayName: '' }))
    expect(res.status).toBe(400)
  })

  test('rejects whitespace-only displayName with 400', async () => {
    const res = await PUT(buildRequest('PUT', { displayName: '   ' }))
    expect(res.status).toBe(400)
  })

  test('rejects displayName over 100 chars with 400', async () => {
    const res = await PUT(buildRequest('PUT', { displayName: 'A'.repeat(101) }))
    const body = await parseResponse(res)
    expect(res.status).toBe(400)
    expect(body.error).toContain('100')
  })

  test('rejects missing displayName with 400', async () => {
    const res = await PUT(buildRequest('PUT', {}))
    expect(res.status).toBe(400)
  })

  test('trims whitespace from displayName', async () => {
    mockUpdate.mockResolvedValue({ ...mockUser, name: 'Trimmed Name' })
    await PUT(buildRequest('PUT', { displayName: '  Trimmed Name  ' }))
    const updateArgs = mockUpdate.mock.calls[0][0]
    expect(updateArgs.data.name).toBe('Trimmed Name')
  })
})
