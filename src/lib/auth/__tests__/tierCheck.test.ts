/**
 * EPIC-011 STORY-120 Block 3: Tier Enforcement Tests
 *
 * Test BYOLLM gating, vault upload limits, API key limits by tier.
 *
 * — Sarah, Engineering
 */

// ── Mocks ────────────────────────────────────────────────────────

const mockGetToken = jest.fn()
const mockUserFindUnique = jest.fn()
const mockVaultAggregate = jest.fn()
const mockApiKeyCount = jest.fn()

jest.mock('next-auth/jwt', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    vault: {
      aggregate: (...args: unknown[]) => mockVaultAggregate(...args),
    },
    apiKey: {
      count: (...args: unknown[]) => mockApiKeyCount(...args),
    },
  },
}))

import { checkByollm, checkVaultUpload, checkApiKeyCreation } from '../tierCheck'

const MB = 1024 * 1024
const GB = 1024 * MB

function makeReq(): unknown {
  return new Request('http://localhost:3000/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('Tier Enforcement', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetToken.mockResolvedValue({ id: 'user-1', email: 'user@test.com' })
  })

  // ── BYOLLM Gating ──────────────────────────────────────────────

  describe('BYOLLM', () => {
    it('free tier + BYOLLM attempt → 403', async () => {
      mockUserFindUnique.mockResolvedValue({
        subscriptionTier: 'free',
        subscriptionStatus: 'active',
      })

      const result = await checkByollm(makeReq() as never)
      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        const json = await result.response.json()
        expect(result.response.status).toBe(403)
        expect(json.error).toBe('Upgrade required')
        expect(json.feature).toBe('byollm')
      }
    })

    it('sovereign tier + BYOLLM attempt → allowed', async () => {
      mockUserFindUnique.mockResolvedValue({
        subscriptionTier: 'sovereign',
        subscriptionStatus: 'active',
      })

      const result = await checkByollm(makeReq() as never)
      expect(result.allowed).toBe(true)
      if (result.allowed) {
        expect(result.tier).toBe('sovereign')
        expect(result.entitlements.byollm_enabled).toBe(true)
      }
    })
  })

  // ── Vault Upload Limits ─────────────────────────────────────────

  describe('Vault Upload', () => {
    it('free tier + storage at 100MB limit → 403', async () => {
      mockUserFindUnique.mockResolvedValue({
        subscriptionTier: 'free',
        subscriptionStatus: 'active',
      })
      mockVaultAggregate.mockResolvedValue({
        _sum: { storageUsedBytes: 100 * MB },
      })

      const result = await checkVaultUpload(makeReq() as never)
      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.response.status).toBe(403)
        const json = await result.response.json()
        expect(json.feature).toBe('vault_storage')
      }
    })

    it('sovereign tier + storage under 5GB → allowed', async () => {
      mockUserFindUnique.mockResolvedValue({
        subscriptionTier: 'sovereign',
        subscriptionStatus: 'active',
      })
      mockVaultAggregate.mockResolvedValue({
        _sum: { storageUsedBytes: 1 * GB },
      })

      const result = await checkVaultUpload(makeReq() as never)
      expect(result.allowed).toBe(true)
      if (result.allowed) {
        expect(result.tier).toBe('sovereign')
      }
    })
  })

  // ── API Key Limits ──────────────────────────────────────────────

  describe('API Key Creation', () => {
    it('free tier at limit (1 key) → 403', async () => {
      mockUserFindUnique.mockResolvedValue({
        subscriptionTier: 'free',
        subscriptionStatus: 'active',
      })
      mockApiKeyCount.mockResolvedValue(1) // free limit is 1

      const result = await checkApiKeyCreation(makeReq() as never)
      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.response.status).toBe(403)
        const json = await result.response.json()
        expect(json.feature).toBe('api_keys')
      }
    })

    it('sovereign tier under limit (2 of 5 keys) → allowed', async () => {
      mockUserFindUnique.mockResolvedValue({
        subscriptionTier: 'sovereign',
        subscriptionStatus: 'active',
      })
      mockApiKeyCount.mockResolvedValue(2) // sovereign limit is 5

      const result = await checkApiKeyCreation(makeReq() as never)
      expect(result.allowed).toBe(true)
      if (result.allowed) {
        expect(result.tier).toBe('sovereign')
        expect(result.entitlements.api_keys_limit).toBe(5)
      }
    })
  })

  // ── Auth Required ───────────────────────────────────────────────

  describe('Authentication', () => {
    it('no auth token → 401', async () => {
      mockGetToken.mockResolvedValue(null)

      const result = await checkByollm(makeReq() as never)
      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.response.status).toBe(401)
        const json = await result.response.json()
        expect(json.error).toBe('Authentication required')
      }
    })

    it('syndicate tier has unlimited API keys (-1)', async () => {
      mockUserFindUnique.mockResolvedValue({
        subscriptionTier: 'syndicate',
        subscriptionStatus: 'active',
      })
      // apiKey.count should NOT be called for unlimited
      const result = await checkApiKeyCreation(makeReq() as never)
      expect(result.allowed).toBe(true)
      if (result.allowed) {
        expect(result.entitlements.api_keys_limit).toBe(-1)
      }
      expect(mockApiKeyCount).not.toHaveBeenCalled()
    })
  })
})
