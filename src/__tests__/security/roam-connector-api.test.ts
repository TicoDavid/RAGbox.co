/**
 * ROAM Connector API Tests — EPIC-018 SA01
 *
 * Tests for Sheldon's S01 connector routes:
 *   POST /api/connectors/roam/install
 *   POST /api/connectors/roam/test
 *   GET  /api/connectors/roam/groups
 *   GET  /api/connectors/roam/status
 *   POST /api/connectors/roam/uninstall
 *
 * Mock ROAM API calls — do NOT hit real ROAM in tests.
 *
 * — Sarah, QA
 */
export {}

// ── Mock next-auth/jwt ───────────────────────────────────────────
const mockGetToken = jest.fn()
jest.mock('next-auth/jwt', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
}))

// ── Mock Prisma ──────────────────────────────────────────────────
const mockRoamIntegrationUpsert = jest.fn()
const mockRoamIntegrationFindUnique = jest.fn()
const mockRoamIntegrationUpdate = jest.fn()
const mockMercuryThreadMessageCount = jest.fn()

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    roamIntegration: {
      upsert: (...args: unknown[]) => mockRoamIntegrationUpsert(...args),
      findUnique: (...args: unknown[]) => mockRoamIntegrationFindUnique(...args),
      update: (...args: unknown[]) => mockRoamIntegrationUpdate(...args),
    },
    mercuryThreadMessage: {
      count: (...args: unknown[]) => mockMercuryThreadMessageCount(...args),
    },
  },
}))

// ── Mock KMS ─────────────────────────────────────────────────────
const mockEncryptKey = jest.fn()
const mockDecryptKey = jest.fn()
jest.mock('@/lib/utils/kms', () => ({
  encryptKey: (...args: unknown[]) => mockEncryptKey(...args),
  decryptKey: (...args: unknown[]) => mockDecryptKey(...args),
}))

// ── Mock ROAM client ─────────────────────────────────────────────
const mockListGroupsWithKey = jest.fn()
jest.mock('@/lib/roam/roamClient', () => ({
  listGroupsWithKey: (...args: unknown[]) => mockListGroupsWithKey(...args),
}))

// ── Mock ROAM Webhook V0 ─────────────────────────────────────────
const mockAutoSubscribeWebhooks = jest.fn()
const mockUnsubscribeAllWebhooks = jest.fn()
const mockParseSubscriptionIds = jest.fn()
jest.mock('@/lib/roam/roamWebhookV0', () => ({
  autoSubscribeWebhooks: (...args: unknown[]) => mockAutoSubscribeWebhooks(...args),
  unsubscribeAllWebhooks: (...args: unknown[]) => mockUnsubscribeAllWebhooks(...args),
  parseSubscriptionIds: (...args: unknown[]) => mockParseSubscriptionIds(...args),
}))

// ── Mock logger ──────────────────────────────────────────────────
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}))

// ── Import routes ────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const installRoute = require('@/app/api/connectors/roam/install/route')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const testRoute = require('@/app/api/connectors/roam/test/route')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const groupsRoute = require('@/app/api/connectors/roam/groups/route')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const statusRoute = require('@/app/api/connectors/roam/status/route')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const uninstallRoute = require('@/app/api/connectors/roam/uninstall/route')

const installPOST = installRoute.POST as (req: Request) => Promise<Response>
const testPOST = testRoute.POST as (req: Request) => Promise<Response>
const groupsGET = groupsRoute.GET as (req: Request) => Promise<Response>
const statusGET = statusRoute.GET as (req: Request) => Promise<Response>
const uninstallPOST = uninstallRoute.POST as (req: Request) => Promise<Response>

// ── Helpers ──────────────────────────────────────────────────────

function makeRequest(
  method: string,
  body?: Record<string, unknown>
): Request {
  const init: RequestInit = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) init.body = JSON.stringify(body)
  return new Request('http://localhost:3000/api/connectors/roam/install', init)
}

const MOCK_GROUPS = [
  { id: 'grp-1', name: 'General', description: 'Main group', memberCount: 12 },
  { id: 'grp-2', name: 'Engineering', description: 'Dev team', memberCount: 5 },
]

// ── Setup ────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()

  // Default: authenticated user
  mockGetToken.mockResolvedValue({ id: 'user-123', email: 'sarah@ragbox.co' })

  // Default: ROAM credential validation succeeds
  mockListGroupsWithKey.mockResolvedValue(MOCK_GROUPS)

  // Default: KMS succeeds
  mockEncryptKey.mockResolvedValue('encrypted-key-xyz')
  mockDecryptKey.mockResolvedValue('decrypted-roam-api-key')

  // Default: webhook auto-subscribe succeeds
  mockAutoSubscribeWebhooks.mockResolvedValue({
    subscriptionIds: ['sub-1', 'sub-2', 'sub-3', 'sub-4', 'sub-5', 'sub-6', 'sub-7'],
    errors: [],
  })
  mockUnsubscribeAllWebhooks.mockResolvedValue(undefined)

  // Default: subscription ID parser
  mockParseSubscriptionIds.mockReturnValue(['sub-1', 'sub-2', 'sub-3'])

  // Default: integration record
  mockRoamIntegrationUpsert.mockResolvedValue({ id: 'integration-1' })
  mockRoamIntegrationFindUnique.mockResolvedValue({
    id: 'integration-1',
    status: 'connected',
    apiKeyEncrypted: 'encrypted-key-xyz',
    webhookSubscriptionId: '["sub-1","sub-2","sub-3"]',
    targetGroupId: 'grp-1',
    targetGroupName: 'General',
    connectedAt: new Date('2026-02-25T10:00:00Z'),
    lastHealthCheckAt: new Date('2026-02-25T12:00:00Z'),
    updatedAt: new Date('2026-02-25T12:00:00Z'),
    errorReason: null,
  })
  mockRoamIntegrationUpdate.mockResolvedValue({})

  // Default: message count
  mockMercuryThreadMessageCount.mockResolvedValue(42)
})

// ── Tests ────────────────────────────────────────────────────────

describe('ROAM Connector API (EPIC-018 S01)', () => {
  // ── POST /api/connectors/roam/install ────────────────────────

  describe('POST /install', () => {
    it('valid credentials → 200 + { status: "connected" }', async () => {
      const req = makeRequest('POST', { apiKey: 'valid-roam-key', defaultGroupId: 'grp-1' })
      const res = await installPOST(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.status).toBe('connected')
      expect(data.workspace).toBe('ConnexUS Ai Inc')
      expect(data.groups).toHaveLength(2)
      expect(data.groups[0].id).toBe('grp-1')
      expect(data.groups[0].name).toBe('General')
      expect(data.subscriptions).toBe(7)
      expect(data.integrationId).toBe('integration-1')
    })

    it('invalid API key → 401 + { status: "error" }', async () => {
      const roamError = new Error('Unauthorized') as Error & { status: number }
      roamError.status = 401
      mockListGroupsWithKey.mockRejectedValue(roamError)

      const req = makeRequest('POST', { apiKey: 'bad-key' })
      const res = await installPOST(req)
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data.status).toBe('error')
      expect(data.message).toBe('Invalid API key')
    })

    it('missing required fields → 400', async () => {
      const req = makeRequest('POST', {})
      const res = await installPOST(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.status).toBe('error')
      expect(data.message).toBe('apiKey is required')
    })

    it('empty apiKey string → 400', async () => {
      const req = makeRequest('POST', { apiKey: '   ' })
      const res = await installPOST(req)

      expect(res.status).toBe(400)
    })

    it('stores credentials in tenant config', async () => {
      const req = makeRequest('POST', { apiKey: 'valid-key', defaultGroupId: 'grp-1' })
      await installPOST(req)

      // KMS encryption was called with the API key
      expect(mockEncryptKey).toHaveBeenCalledWith('valid-key')

      // Prisma upsert was called with encrypted key
      expect(mockRoamIntegrationUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'default' },
          update: expect.objectContaining({
            apiKeyEncrypted: 'encrypted-key-xyz',
            status: 'connected',
          }),
          create: expect.objectContaining({
            apiKeyEncrypted: 'encrypted-key-xyz',
            status: 'connected',
          }),
        })
      )
    })

    it('triggers webhook subscription (S03)', async () => {
      const req = makeRequest('POST', { apiKey: 'valid-key' })
      await installPOST(req)

      // Auto-subscribe was called with the API key
      expect(mockAutoSubscribeWebhooks).toHaveBeenCalledWith('valid-key')

      // Subscription IDs stored as JSON array
      expect(mockRoamIntegrationUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            webhookSubscriptionId: JSON.stringify(['sub-1', 'sub-2', 'sub-3', 'sub-4', 'sub-5', 'sub-6', 'sub-7']),
          }),
        })
      )
    })

    it('rejects unauthenticated requests with 401', async () => {
      mockGetToken.mockResolvedValue(null)

      const req = makeRequest('POST', { apiKey: 'valid-key' })
      const res = await installPOST(req)

      expect(res.status).toBe(401)
    })

    it('handles KMS encryption failure → 500', async () => {
      mockEncryptKey.mockRejectedValue(new Error('KMS unavailable'))

      const req = makeRequest('POST', { apiKey: 'valid-key' })
      const res = await installPOST(req)

      expect(res.status).toBe(500)
    })

    it('handles ROAM API unreachable → 502', async () => {
      mockListGroupsWithKey.mockRejectedValue(new Error('ECONNREFUSED'))

      const req = makeRequest('POST', { apiKey: 'valid-key' })
      const res = await installPOST(req)

      expect(res.status).toBe(502)
    })
  })

  // ── POST /api/connectors/roam/test ───────────────────────────

  describe('POST /test', () => {
    it('valid API key → { valid: true, workspace, groupCount }', async () => {
      const req = makeRequest('POST', { apiKey: 'valid-key' })
      const res = await testPOST(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.valid).toBe(true)
      expect(data.workspace).toBe('ConnexUS Ai Inc')
      expect(data.groupCount).toBe(2)
    })

    it('invalid API key → { valid: false, error }', async () => {
      const roamError = new Error('Unauthorized') as Error & { status: number }
      roamError.status = 401
      mockListGroupsWithKey.mockRejectedValue(roamError)

      const req = makeRequest('POST', { apiKey: 'bad-key' })
      const res = await testPOST(req)
      const data = await res.json()

      expect(res.status).toBe(200) // 200 with valid: false
      expect(data.valid).toBe(false)
      expect(data.error).toBe('Invalid API key')
    })

    it('missing apiKey → 400', async () => {
      const req = makeRequest('POST', {})
      const res = await testPOST(req)

      expect(res.status).toBe(400)
    })

    it('rejects unauthenticated → 401', async () => {
      mockGetToken.mockResolvedValue(null)

      const req = makeRequest('POST', { apiKey: 'key' })
      const res = await testPOST(req)

      expect(res.status).toBe(401)
    })
  })

  // ── GET /api/connectors/roam/groups ──────────────────────────

  describe('GET /groups', () => {
    it('returns group list when connected', async () => {
      const req = new Request('http://localhost:3000/api/connectors/roam/groups')
      const res = await groupsGET(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data).toHaveLength(2)
      expect(data[0].id).toBe('grp-1')
      expect(data[0].name).toBe('General')
      expect(data[0].type).toBe('group')
    })

    it('returns 401 when not authenticated', async () => {
      mockGetToken.mockResolvedValue(null)

      const req = new Request('http://localhost:3000/api/connectors/roam/groups')
      const res = await groupsGET(req)

      expect(res.status).toBe(401)
    })

    it('returns 400 when not connected', async () => {
      mockRoamIntegrationFindUnique.mockResolvedValue({
        apiKeyEncrypted: null,
        status: 'disconnected',
      })

      const req = new Request('http://localhost:3000/api/connectors/roam/groups')
      const res = await groupsGET(req)

      expect(res.status).toBe(400)
    })

    it('decrypts stored API key for ROAM call', async () => {
      const req = new Request('http://localhost:3000/api/connectors/roam/groups')
      await groupsGET(req)

      expect(mockDecryptKey).toHaveBeenCalledWith('encrypted-key-xyz')
      expect(mockListGroupsWithKey).toHaveBeenCalledWith('decrypted-roam-api-key')
    })
  })

  // ── GET /api/connectors/roam/status ──────────────────────────

  describe('GET /status', () => {
    it('returns connected state with timestamps', async () => {
      const req = new Request('http://localhost:3000/api/connectors/roam/status')
      const res = await statusGET(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.connected).toBe(true)
      expect(data.workspace).toBe('ConnexUS Ai Inc')
      expect(data.messageCount).toBe(42)
      expect(data.subscriptionIds).toEqual(['sub-1', 'sub-2', 'sub-3'])
    })

    it('returns disconnected state when no integration', async () => {
      mockRoamIntegrationFindUnique.mockResolvedValue(null)

      const req = new Request('http://localhost:3000/api/connectors/roam/status')
      const res = await statusGET(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.connected).toBe(false)
      expect(data.workspace).toBeNull()
      expect(data.messageCount).toBe(0)
      expect(data.subscriptionIds).toEqual([])
    })

    it('rejects unauthenticated → 401', async () => {
      mockGetToken.mockResolvedValue(null)

      const req = new Request('http://localhost:3000/api/connectors/roam/status')
      const res = await statusGET(req)

      expect(res.status).toBe(401)
    })

    it('never exposes encrypted API key', async () => {
      const req = new Request('http://localhost:3000/api/connectors/roam/status')
      const res = await statusGET(req)
      const data = await res.json()
      const body = JSON.stringify(data)

      expect(body).not.toContain('encrypted-key-xyz')
      expect(body).not.toContain('apiKeyEncrypted')
    })
  })

  // ── POST /api/connectors/roam/uninstall ──────────────────────

  describe('POST /uninstall', () => {
    it('clears credentials and returns { status: "disconnected" }', async () => {
      const req = makeRequest('POST')
      const res = await uninstallPOST(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.status).toBe('disconnected')

      // Credentials cleared in DB
      expect(mockRoamIntegrationUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            apiKeyEncrypted: null,
            webhookSubscriptionId: null,
            status: 'disconnected',
          }),
        })
      )
    })

    it('unsubscribes webhooks before clearing creds', async () => {
      const req = makeRequest('POST')
      await uninstallPOST(req)

      // Decrypted key to unsubscribe
      expect(mockDecryptKey).toHaveBeenCalledWith('encrypted-key-xyz')
      // Unsubscribe called with parsed subscription IDs
      expect(mockUnsubscribeAllWebhooks).toHaveBeenCalledWith(
        'decrypted-roam-api-key',
        ['sub-1', 'sub-2', 'sub-3']
      )
    })

    it('returns 404 when no integration exists', async () => {
      mockRoamIntegrationFindUnique.mockResolvedValue(null)

      const req = makeRequest('POST')
      const res = await uninstallPOST(req)

      expect(res.status).toBe(404)
    })

    it('still clears creds even if webhook cleanup fails', async () => {
      mockDecryptKey.mockRejectedValue(new Error('Decrypt failed'))

      const req = makeRequest('POST')
      const res = await uninstallPOST(req)
      const data = await res.json()

      // Should still succeed and clear creds
      expect(res.status).toBe(200)
      expect(data.status).toBe('disconnected')
      expect(mockRoamIntegrationUpdate).toHaveBeenCalled()
    })

    it('rejects unauthenticated → 401', async () => {
      mockGetToken.mockResolvedValue(null)

      const req = makeRequest('POST')
      const res = await uninstallPOST(req)

      expect(res.status).toBe(401)
    })
  })
})
