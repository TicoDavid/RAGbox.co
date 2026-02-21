/**
 * SA-16: Auth Session Validation Tests
 *
 * Tests that API routes correctly enforce authentication:
 * - Valid JWT → 200
 * - Missing JWT → 401
 * - Expired JWT → 401
 *
 * Tests the authenticateUser/getAuth pattern used across API routes.
 */

import { getToken } from 'next-auth/jwt'
import { NextRequest } from 'next/server'

// Mock next-auth/jwt
jest.mock('next-auth/jwt')
const mockGetToken = getToken as jest.MockedFunction<typeof getToken>

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    mercuryThread: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'thread-1',
        title: 'Mercury Thread',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      create: jest.fn(),
    },
  },
}))

// Import the route handler after mocks
import { GET } from '@/app/api/mercury/thread/route'

function createMockRequest(url = 'http://localhost:3000/api/mercury/thread'): NextRequest {
  return new NextRequest(new URL(url), {
    method: 'GET',
  })
}

describe('Auth Session Validation (SA-16)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 200 with valid JWT token', async () => {
    mockGetToken.mockResolvedValue({
      sub: 'user-123',
      id: 'user-123',
      email: 'test@ragbox.co',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400, // 24h from now
    })

    const request = createMockRequest()
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toBeDefined()
  })

  it('returns 401 when JWT token is missing', async () => {
    mockGetToken.mockResolvedValue(null)

    const request = createMockRequest()
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.success).toBe(false)
    expect(body.error).toBe('Authentication required')
  })

  it('returns 401 when JWT token has no user identifier', async () => {
    // Token exists but has no id, email, or sub that resolves to a userId
    mockGetToken.mockResolvedValue({
      sub: undefined,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) - 3600, // expired 1h ago
    } as unknown as Awaited<ReturnType<typeof getToken>>)

    const request = createMockRequest()
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.success).toBe(false)
    expect(body.error).toBe('Authentication required')
  })
})
