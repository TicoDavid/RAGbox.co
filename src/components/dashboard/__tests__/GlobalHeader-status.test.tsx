/**
 * @jest-environment node
 */

/**
 * EPIC-012 STORY-137: Integration Status API Tests
 *
 * Test GET /api/integrations/roam/status returns correct shape
 * and health status computation.
 *
 * — Sarah, Engineering
 */

// ── Mocks ────────────────────────────────────────────────────────

const mockGetToken = jest.fn()
const mockRoamIntegrationFindUnique = jest.fn()

jest.mock('next-auth/jwt', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    roamIntegration: {
      findUnique: (...args: unknown[]) => mockRoamIntegrationFindUnique(...args),
    },
  },
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GET } = require('@/app/api/integrations/roam/status/route')

function makeRequest(): Request {
  return new Request('http://localhost:3000/api/integrations/roam/status', {
    method: 'GET',
  })
}

describe('Integration Status API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetToken.mockResolvedValue({ id: 'user-1', email: 'user@test.com' })
  })

  it('returns not_configured when no integration exists', async () => {
    mockRoamIntegrationFindUnique.mockResolvedValue(null)

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.status).toBe('not_configured')
    expect(json.data.healthStatus).toBe('unknown')
  })

  it('returns healthy status for connected integration', async () => {
    mockRoamIntegrationFindUnique.mockResolvedValue({
      id: 'int-1',
      status: 'connected',
      targetGroupId: 'group-1',
      targetGroupName: 'Team Chat',
      mentionOnly: false,
      meetingSummaries: true,
      connectedAt: new Date(),
      lastHealthCheckAt: new Date(), // recent — not stale
      errorReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const res = await GET(makeRequest())
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.data.healthStatus).toBe('healthy')
    expect(json.data.status).toBe('connected')
    expect(json.data.targetGroupName).toBe('Team Chat')
  })

  it('returns error status when integration has errorReason', async () => {
    mockRoamIntegrationFindUnique.mockResolvedValue({
      id: 'int-1',
      status: 'connected',
      targetGroupId: 'group-1',
      targetGroupName: 'Team Chat',
      mentionOnly: false,
      meetingSummaries: false,
      connectedAt: new Date(),
      lastHealthCheckAt: new Date(),
      errorReason: '401 Unauthorized — API key revoked',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const res = await GET(makeRequest())
    const json = await res.json()

    expect(json.data.healthStatus).toBe('error')
    expect(json.data.errorReason).toContain('401')
  })

  it('returns 401 when not authenticated', async () => {
    mockGetToken.mockResolvedValue(null)

    const res = await GET(makeRequest())
    expect(res.status).toBe(401)

    const json = await res.json()
    expect(json.error).toBe('Authentication required')
  })
})
