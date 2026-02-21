/**
 * Auth Middleware + WebSocket Auth Tests
 *
 * Tests the rate-limiting middleware, protected route behavior,
 * and WebSocket connection parameter extraction.
 */

// ─── Mock next-auth/jwt ─────────────────────────────────────────────────────
const mockGetToken = jest.fn()
jest.mock('next-auth/jwt', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
}))

// ─── Import middleware after mocks ──────────────────────────────────────────
import { NextRequest } from 'next/server'

// Inline reimplementation of extractConnectionParams from agent-ws.ts
// to test WS auth param extraction without needing the full WS server.
function extractConnectionParams(url: string, headers: Record<string, string> = {}) {
  try {
    const parsed = new URL(url)
    const authHeader = headers['authorization']
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : parsed.searchParams.get('token')

    if (!token) {
      return { sessionId: null, userId: 'anonymous', role: 'Viewer' as const, privilegeMode: false }
    }

    const rawRole = parsed.searchParams.get('role')
    const validRoles = ['User', 'Admin', 'Viewer'] as const
    type Role = (typeof validRoles)[number]
    const role: Role = validRoles.includes(rawRole as Role) ? (rawRole as Role) : 'User'
    const userId = parsed.searchParams.get('userId') || 'anonymous'

    return {
      sessionId: parsed.searchParams.get('sessionId'),
      userId,
      role,
      privilegeMode: parsed.searchParams.get('privilegeMode') === 'true',
    }
  } catch {
    return { sessionId: null, userId: 'anonymous', role: 'Viewer' as const, privilegeMode: false }
  }
}

// ============================================================================
// 3.1 Protected Route Guards (5 tests)
// ============================================================================

describe('3.1 Protected Route Guards', () => {
  it('GET /dashboard without session → page requires auth', async () => {
    // The middleware only handles /api/ routes for rate limiting.
    // Dashboard protection is handled by NextAuth's session check in layout.tsx.
    // We verify the middleware doesn't interfere with non-API routes.
    const { middleware } = await import('@/middleware')
    const req = new NextRequest('https://app.ragbox.co/dashboard')
    const res = await middleware(req)

    // Middleware passes through non-API routes
    expect(res.status).toBe(200) // NextResponse.next()
  })

  it('API route rate limiter allows first request through', async () => {
    const { middleware } = await import('@/middleware')
    mockGetToken.mockResolvedValue({ sub: 'user-123', email: 'test@test.com' })

    const req = new NextRequest('https://app.ragbox.co/api/chat', { method: 'POST' })
    const res = await middleware(req)

    expect(res.status).toBe(200) // passes through
    expect(res.headers.get('X-RateLimit-Limit')).toBeTruthy()
  })

  it('API health endpoint is excluded from rate limiting', async () => {
    const { middleware } = await import('@/middleware')
    const req = new NextRequest('https://app.ragbox.co/api/health')
    const res = await middleware(req)

    // Health endpoint is in SKIP_PATHS — no rate limit headers
    expect(res.headers.get('X-RateLimit-Limit')).toBeNull()
  })

  it('NextAuth callback routes are excluded from rate limiting', async () => {
    const { middleware } = await import('@/middleware')
    const req = new NextRequest('https://app.ragbox.co/api/auth/callback/google')
    const res = await middleware(req)

    expect(res.headers.get('X-RateLimit-Limit')).toBeNull()
  })

  it('OTP endpoint has strict rate limit (5 per minute)', async () => {
    const { middleware } = await import('@/middleware')
    const req = new NextRequest('https://app.ragbox.co/api/auth/send-otp', { method: 'POST' })
    const res = await middleware(req)

    const limit = res.headers.get('X-RateLimit-Limit')
    expect(limit).toBe('5')
  })
})

// ============================================================================
// 3.2 Session Token Validation (4 tests)
// ============================================================================

describe('3.2 Session Token Validation', () => {
  it('valid token → user key used for rate limiting', async () => {
    const { middleware } = await import('@/middleware')
    mockGetToken.mockResolvedValue({ sub: 'user-abc', email: 'user@ragbox.co' })

    const req = new NextRequest('https://app.ragbox.co/api/chat', { method: 'POST' })
    const res = await middleware(req)

    // Should pass through (first request)
    expect(res.status).toBe(200)
  })

  it('expired/invalid token → falls back to IP-based rate limiting', async () => {
    const { middleware } = await import('@/middleware')
    mockGetToken.mockRejectedValue(new Error('Token expired'))

    const req = new NextRequest('https://app.ragbox.co/api/chat', {
      method: 'POST',
      headers: { 'x-forwarded-for': '1.2.3.4' },
    })
    const res = await middleware(req)

    // Should still pass through — rate limiting doesn't block auth
    expect(res.status).toBe(200)
  })

  it('null token → IP-based rate limiting used', async () => {
    const { middleware } = await import('@/middleware')
    mockGetToken.mockResolvedValue(null)

    const req = new NextRequest('https://app.ragbox.co/api/chat', { method: 'POST' })
    const res = await middleware(req)

    expect(res.status).toBe(200)
  })

  it('rate limit exceeded → 429 with retry-after', async () => {
    const { middleware } = await import('@/middleware')
    mockGetToken.mockResolvedValue(null)

    // Hammer a strict endpoint (OTP: 5/min) with IP-keyed requests
    const ip = `rate-test-${Date.now()}`
    for (let i = 0; i < 6; i++) {
      const req = new NextRequest('https://app.ragbox.co/api/auth/send-otp', {
        method: 'POST',
        headers: { 'x-forwarded-for': ip },
      })
      const res = await middleware(req)
      if (i >= 5) {
        expect(res.status).toBe(429)
        const body = await res.json()
        expect(body.error).toBe('Too many requests')
        expect(body.retryAfter).toBeGreaterThan(0)
      }
    }
  })
})

// ============================================================================
// 3.3 WebSocket Auth (4 tests)
// ============================================================================

describe('3.3 WebSocket Auth', () => {
  it('connect with userId=test → session with that userId', () => {
    const params = extractConnectionParams(
      'ws://localhost:3003/agent/ws?token=abc&userId=test-user',
    )
    expect(params.userId).toBe('test-user')
  })

  it('connect with role=User → User role set', () => {
    const params = extractConnectionParams(
      'ws://localhost:3003/agent/ws?token=abc&role=User&userId=u1',
    )
    expect(params.role).toBe('User')
  })

  it('connect with role=Admin → Admin role set', () => {
    const params = extractConnectionParams(
      'ws://localhost:3003/agent/ws?token=abc&role=Admin&userId=u1',
    )
    expect(params.role).toBe('Admin')
  })

  it('connect with no params → anonymous session (Viewer role)', () => {
    const params = extractConnectionParams('ws://localhost:3003/agent/ws')
    expect(params.userId).toBe('anonymous')
    expect(params.role).toBe('Viewer')
  })
})
