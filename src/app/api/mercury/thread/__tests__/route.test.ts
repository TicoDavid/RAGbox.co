/**
 * Tests for /api/mercury/thread route handlers (GET, POST, PATCH)
 *
 * Covers: auth checks, GET (find existing / create new / error fallback),
 * POST (create success / error), PATCH (validation, ownership check,
 * not found, success, title truncation, error).
 */

// ── Mocks (declared before any imports that reference them) ────────────

const mockGetToken = jest.fn()
jest.mock('next-auth/jwt', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
}))

const mockFindFirst = jest.fn()
const mockCreate = jest.fn()
const mockUpdate = jest.fn()
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    mercuryThread: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}))

// ── Imports (after mocks) ────────────────────────────────────

import { NextRequest } from 'next/server'
import { GET, POST, PATCH } from '../route'

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
  return new NextRequest(new URL('/api/mercury/thread', 'http://localhost:3000'), init as any)
}

async function parseResponse(res: Response): Promise<Record<string, unknown>> {
  return res.json()
}

function authenticateAs(id = 'user-001', email = 'test@ragbox.co') {
  mockGetToken.mockResolvedValue({ id, email })
}

const MOCK_THREAD = {
  id: 'thread-001',
  title: 'Mercury Thread',
  createdAt: new Date('2025-06-01T00:00:00Z'),
  updatedAt: new Date('2025-06-01T00:00:00Z'),
}

// ── Setup ─────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  authenticateAs()
})

// ═══════════════════════════════════════════════════════════
// GET /api/mercury/thread
// ═══════════════════════════════════════════════════════════

describe('GET /api/mercury/thread', () => {
  test('returns 401 when not authenticated', async () => {
    mockGetToken.mockResolvedValue(null)
    const req = buildRequest('GET')
    const res = await GET(req)
    const body = await parseResponse(res)
    expect(res.status).toBe(401)
    expect(body.error).toBe('Authentication required')
  })

  test('returns 401 when token has empty id and email', async () => {
    mockGetToken.mockResolvedValue({ id: '', email: '' })
    const req = buildRequest('GET')
    const res = await GET(req)
    const body = await parseResponse(res)
    expect(res.status).toBe(401)
    expect(body.error).toBe('Authentication required')
  })

  test('returns existing thread when one exists', async () => {
    mockFindFirst.mockResolvedValue(MOCK_THREAD)
    const req = buildRequest('GET')
    const res = await GET(req)
    const body = await parseResponse(res)
    expect(body.success).toBe(true)
    expect((body.data as Record<string, unknown>).id).toBe('thread-001')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  test('creates a new thread when none exists', async () => {
    mockFindFirst.mockResolvedValue(null)
    mockCreate.mockResolvedValue({
      ...MOCK_THREAD,
      id: 'thread-new',
      title: 'Mercury Thread',
    })
    const req = buildRequest('GET')
    const res = await GET(req)
    const body = await parseResponse(res)
    expect(body.success).toBe(true)
    expect((body.data as Record<string, unknown>).id).toBe('thread-new')
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockCreate.mock.calls[0][0].data.title).toBe('Mercury Thread')
  })

  test('returns success:false with data:null on error (graceful fallback)', async () => {
    mockFindFirst.mockRejectedValue(new Error('DB failure'))
    const req = buildRequest('GET')
    const res = await GET(req)
    const body = await parseResponse(res)
    // Returns 200 (not 500) to prevent retry storms
    expect(res.status).toBe(200)
    expect(body.success).toBe(false)
    expect(body.data).toBeNull()
  })

  test('uses email as userId when token.id is empty', async () => {
    mockGetToken.mockResolvedValue({ id: '', email: 'fallback@test.com' })
    mockFindFirst.mockResolvedValue(MOCK_THREAD)
    const req = buildRequest('GET')
    await GET(req)
    expect(mockFindFirst.mock.calls[0][0].where.userId).toBe('fallback@test.com')
  })
})

// ═══════════════════════════════════════════════════════════
// POST /api/mercury/thread
// ═══════════════════════════════════════════════════════════

describe('POST /api/mercury/thread', () => {
  test('returns 401 when not authenticated', async () => {
    mockGetToken.mockResolvedValue(null)
    const req = buildRequest('POST')
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  test('creates a new thread with title "New Chat"', async () => {
    mockCreate.mockResolvedValue({
      ...MOCK_THREAD,
      id: 'thread-new-post',
      title: 'New Chat',
    })
    const req = buildRequest('POST')
    const res = await POST(req)
    const body = await parseResponse(res)
    expect(body.success).toBe(true)
    expect((body.data as Record<string, unknown>).title).toBe('New Chat')
    expect(mockCreate.mock.calls[0][0].data.title).toBe('New Chat')
    expect(mockCreate.mock.calls[0][0].data.userId).toBe('user-001')
  })

  test('returns 500 on error', async () => {
    mockCreate.mockRejectedValue(new Error('DB failure'))
    const req = buildRequest('POST')
    const res = await POST(req)
    const body = await parseResponse(res)
    expect(res.status).toBe(500)
    expect(body.error).toBe('Failed to create thread')
  })
})

// ═══════════════════════════════════════════════════════════
// PATCH /api/mercury/thread
// ═══════════════════════════════════════════════════════════

describe('PATCH /api/mercury/thread', () => {
  test('returns 401 when not authenticated', async () => {
    mockGetToken.mockResolvedValue(null)
    const req = buildRequest('PATCH', { threadId: 'thread-001', title: 'New Title' })
    const res = await PATCH(req)
    expect(res.status).toBe(401)
  })

  test('returns 400 when threadId is missing', async () => {
    const req = buildRequest('PATCH', { title: 'New Title' })
    const res = await PATCH(req)
    const body = await parseResponse(res)
    expect(res.status).toBe(400)
    expect(body.error).toBe('threadId and title are required')
  })

  test('returns 400 when title is missing', async () => {
    const req = buildRequest('PATCH', { threadId: 'thread-001' })
    const res = await PATCH(req)
    const body = await parseResponse(res)
    expect(res.status).toBe(400)
    expect(body.error).toBe('threadId and title are required')
  })

  test('returns 400 when both threadId and title are missing', async () => {
    const req = buildRequest('PATCH', {})
    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })

  test('returns 404 when thread does not exist or user does not own it', async () => {
    mockFindFirst.mockResolvedValue(null)
    const req = buildRequest('PATCH', { threadId: 'thread-unknown', title: 'New Title' })
    const res = await PATCH(req)
    const body = await parseResponse(res)
    expect(res.status).toBe(404)
    expect(body.error).toBe('Thread not found')
  })

  test('updates thread title successfully', async () => {
    mockFindFirst.mockResolvedValue({ id: 'thread-001' })
    mockUpdate.mockResolvedValue({
      ...MOCK_THREAD,
      title: 'Updated Title',
    })
    const req = buildRequest('PATCH', { threadId: 'thread-001', title: 'Updated Title' })
    const res = await PATCH(req)
    const body = await parseResponse(res)
    expect(body.success).toBe(true)
    expect((body.data as Record<string, unknown>).title).toBe('Updated Title')
  })

  test('truncates title to 80 characters', async () => {
    mockFindFirst.mockResolvedValue({ id: 'thread-001' })
    mockUpdate.mockResolvedValue({
      ...MOCK_THREAD,
      title: 'A'.repeat(80),
    })
    const longTitle = 'A'.repeat(120)
    const req = buildRequest('PATCH', { threadId: 'thread-001', title: longTitle })
    await PATCH(req)
    const updateData = mockUpdate.mock.calls[0][0].data
    expect(updateData.title).toBe('A'.repeat(80))
    expect(updateData.title.length).toBe(80)
  })

  test('verifies thread ownership before update', async () => {
    mockFindFirst.mockResolvedValue({ id: 'thread-001' })
    mockUpdate.mockResolvedValue(MOCK_THREAD)
    const req = buildRequest('PATCH', { threadId: 'thread-001', title: 'X' })
    await PATCH(req)
    // findFirst called with both threadId and userId
    const findArgs = mockFindFirst.mock.calls[0][0]
    expect(findArgs.where.id).toBe('thread-001')
    expect(findArgs.where.userId).toBe('user-001')
  })

  test('returns 500 on unexpected error', async () => {
    mockFindFirst.mockRejectedValue(new Error('DB failure'))
    const req = buildRequest('PATCH', { threadId: 'thread-001', title: 'Test' })
    const res = await PATCH(req)
    const body = await parseResponse(res)
    expect(res.status).toBe(500)
    expect(body.error).toBe('Failed to update thread')
  })
})
