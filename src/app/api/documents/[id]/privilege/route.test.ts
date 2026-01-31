/**
 * Backend tests for the document privilege API route.
 *
 * Mocks Prisma (persistence), next/headers (cookies), and @/lib/audit
 * to verify route handler logic in isolation.
 */

import { NextRequest } from 'next/server'

// ── Mocks ──────────────────────────────────────────────────────

const mockFindUnique = jest.fn()
const mockUpdate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    document: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}))

const mockGetCookie = jest.fn()

jest.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => mockGetCookie(name),
  }),
}))

const mockLogPrivilegeChange = jest.fn().mockResolvedValue({})

jest.mock('@/lib/audit', () => ({
  logDocumentPrivilegeChange: (...args: unknown[]) => mockLogPrivilegeChange(...args),
}))

// ── Import handlers after mocks ─────────────────────────────────

import { GET, PATCH } from './route'

// ── Helpers ─────────────────────────────────────────────────────

function makeRequest(method: string, body?: object): NextRequest {
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) init.body = JSON.stringify(body)
  return new NextRequest('http://localhost/api/documents/doc-1/privilege', init)
}

function routeParams(id = 'doc-1') {
  return { params: Promise.resolve({ id }) }
}

// ── Setup ───────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  // Default: session cookie present, not in privilege mode
  mockGetCookie.mockImplementation((name: string) => {
    if (name === 'session') return { value: 'user-123' }
    return undefined
  })
})

// ── Tests ───────────────────────────────────────────────────────

describe('GET /api/documents/[id]/privilege', () => {
  test('returns privilege status from DB', async () => {
    mockFindUnique.mockResolvedValueOnce({
      isPrivileged: true,
      updatedAt: new Date('2025-01-01T00:00:00Z'),
    })

    const res = await GET(makeRequest('GET'), routeParams())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.documentId).toBe('doc-1')
    expect(json.isPrivileged).toBe(true)
    expect(json.lastChanged).toBe('2025-01-01T00:00:00.000Z')
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      select: { isPrivileged: true, updatedAt: true },
    })
  })

  test('returns 404 for missing document', async () => {
    mockFindUnique.mockResolvedValueOnce(null)

    const res = await GET(makeRequest('GET'), routeParams('nonexistent'))
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/documents/[id]/privilege', () => {
  test('marks document privileged and logs audit', async () => {
    mockFindUnique.mockResolvedValueOnce({ isPrivileged: false })
    mockUpdate.mockResolvedValueOnce({
      isPrivileged: true,
      updatedAt: new Date('2025-06-01T00:00:00Z'),
    })

    const res = await PATCH(
      makeRequest('PATCH', { privileged: true, filename: 'brief.pdf' }),
      routeParams(),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.isPrivileged).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { isPrivileged: true },
      select: { isPrivileged: true, updatedAt: true },
    })
    expect(mockLogPrivilegeChange).toHaveBeenCalledWith(
      'user-123', 'doc-1', 'brief.pdf', true, 'unknown',
    )
  })

  test('returns 403 PRIVILEGE_MODE_SAFETY when unmarking in privilege mode', async () => {
    mockFindUnique.mockResolvedValueOnce({ isPrivileged: true })
    // Simulate privilege mode cookie active
    mockGetCookie.mockImplementation((name: string) => {
      if (name === 'session') return { value: 'user-123' }
      if (name === 'ragbox_privilege_mode') return { value: 'true' }
      return undefined
    })

    const res = await PATCH(
      makeRequest('PATCH', { privileged: false }),
      routeParams(),
    )
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.code).toBe('PRIVILEGE_MODE_SAFETY')
  })

  test('returns 400 CONFIRM_UNMARK_REQUIRED when unmarking without confirmation', async () => {
    mockFindUnique.mockResolvedValueOnce({ isPrivileged: true })

    const res = await PATCH(
      makeRequest('PATCH', { privileged: false }),
      routeParams(),
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.code).toBe('CONFIRM_UNMARK_REQUIRED')
    expect(json.requiresConfirmation).toBe(true)
  })

  test('succeeds with confirmUnmark: true', async () => {
    mockFindUnique.mockResolvedValueOnce({ isPrivileged: true })
    mockUpdate.mockResolvedValueOnce({
      isPrivileged: false,
      updatedAt: new Date('2025-06-02T00:00:00Z'),
    })

    const res = await PATCH(
      makeRequest('PATCH', { privileged: false, confirmUnmark: true }),
      routeParams(),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.isPrivileged).toBe(false)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { isPrivileged: false },
      }),
    )
  })

  test('returns 404 for missing document', async () => {
    mockFindUnique.mockResolvedValueOnce(null)

    const res = await PATCH(
      makeRequest('PATCH', { privileged: true }),
      routeParams('ghost'),
    )
    expect(res.status).toBe(404)
  })
})
