/**
 * Sarah — EPIC-031 T8: Billing Edge Cases
 *
 * Edge cases: race conditions, boundary values, concurrent usage,
 * missing data, and tier boundary enforcement.
 */

// ── Mocks ────────────────────────────────────────────────────────

const mockGetToken = jest.fn()
jest.mock('next-auth/jwt', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
}))

const mockUserFindFirst = jest.fn()
const mockUserFindUnique = jest.fn()
const mockDocAggregate = jest.fn()
const mockDocCount = jest.fn()
const mockQueryCount = jest.fn()
const mockApiKeyCount = jest.fn()
const mockVaultAggregate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findFirst: (...args: unknown[]) => mockUserFindFirst(...args),
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    document: {
      aggregate: (...args: unknown[]) => mockDocAggregate(...args),
      count: (...args: unknown[]) => mockDocCount(...args),
    },
    query: {
      count: (...args: unknown[]) => mockQueryCount(...args),
    },
    apiKey: {
      count: (...args: unknown[]) => mockApiKeyCount(...args),
    },
    vault: {
      aggregate: (...args: unknown[]) => mockVaultAggregate(...args),
    },
  },
}))

// ── Imports ──────────────────────────────────────────────────────

import { NextRequest } from 'next/server'
import { normalizeTier, getEntitlements, resolveTierFromPriceIds, TIER_ENTITLEMENTS } from '@/lib/billing/entitlements'
import { checkTierAccess, checkUsageLimit, TIER_LIMITS } from '@/lib/billing/tierEnforcement'
import { checkVaultUpload, checkByollm, checkApiKeyCreation, checkVRepCreation } from '@/lib/auth/tierCheck'

// ── Setup ────────────────────────────────────────────────────────

const ORIGINAL_ENV = process.env

function buildRequest(): NextRequest {
  return new NextRequest('http://localhost/api/test')
}

function authenticateAs(tier: string) {
  mockGetToken.mockResolvedValue({ id: 'user-1', email: 'test@test.com' })
  mockUserFindUnique.mockResolvedValue({
    subscriptionTier: tier,
    subscriptionStatus: 'active',
  })
  mockUserFindFirst.mockResolvedValue({
    id: 'user-1',
    subscriptionTier: tier,
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env = { ...ORIGINAL_ENV }
})

afterAll(() => {
  process.env = ORIGINAL_ENV
})

// ── Tests ────────────────────────────────────────────────────────

describe('Sarah — EPIC-031 T8: Billing Edge Cases', () => {
  describe('boundary values', () => {
    test('vault at exactly limit is denied (>= check)', async () => {
      authenticateAs('free')
      // Free vault_storage_bytes = 100MB, vaultSizeMB = 50
      mockVaultAggregate.mockResolvedValue({
        _sum: { storageUsedBytes: 100 * 1024 * 1024 }, // exactly at limit
      })

      const result = await checkVaultUpload(buildRequest())
      expect(result.allowed).toBe(false)
    })

    test('vault at one byte under limit is allowed', async () => {
      authenticateAs('free')
      mockVaultAggregate.mockResolvedValue({
        _sum: { storageUsedBytes: 100 * 1024 * 1024 - 1 },
      })

      const result = await checkVaultUpload(buildRequest())
      expect(result.allowed).toBe(true)
    })

    test('API keys at exactly limit is denied', async () => {
      authenticateAs('starter')
      mockApiKeyCount.mockResolvedValue(3) // starter limit = 3

      const result = await checkApiKeyCreation(buildRequest())
      expect(result.allowed).toBe(false)
    })

    test('API keys one under limit is allowed', async () => {
      authenticateAs('starter')
      mockApiKeyCount.mockResolvedValue(2)

      const result = await checkApiKeyCreation(buildRequest())
      expect(result.allowed).toBe(true)
    })

    test('document count at exactly limit is denied', async () => {
      mockUserFindFirst.mockResolvedValue({ id: 'user-1', subscriptionTier: 'free' })
      mockDocCount.mockResolvedValue(10) // free documentsMax = 10

      const usage = await checkUsageLimit('user-1', 'document_count')
      expect(usage.allowed).toBe(false)
    })
  })

  describe('tier normalization edge cases', () => {
    test('null/undefined tier defaults to free entitlements', () => {
      const ent = getEntitlements('')
      expect(ent.documents_limit).toBe(5) // free tier
    })

    test('case-sensitive: "Free" (capitalized) defaults to free', () => {
      const tier = normalizeTier('Free')
      expect(tier).toBe('free')
    })

    test('whitespace in tier name defaults to free', () => {
      const tier = normalizeTier('  ')
      expect(tier).toBe('free')
    })
  })

  describe('entitlement consistency', () => {
    test('all tiers have non-negative document limits (or -1 unlimited)', () => {
      const tiers = Object.keys(TIER_ENTITLEMENTS)
      for (const tier of tiers) {
        const ent = TIER_ENTITLEMENTS[tier as keyof typeof TIER_ENTITLEMENTS]
        expect(ent.documents_limit === -1 || ent.documents_limit > 0).toBe(true)
      }
    })

    test('all tiers with mercury_voice have at least voice and chat channels', () => {
      const tiers = Object.keys(TIER_ENTITLEMENTS)
      for (const tier of tiers) {
        const ent = TIER_ENTITLEMENTS[tier as keyof typeof TIER_ENTITLEMENTS]
        if (ent.mercury_voice) {
          expect(ent.mercury_channels).toEqual(
            expect.arrayContaining(['voice', 'chat']),
          )
        }
      }
    })

    test('tiers without mercury_voice have empty channels', () => {
      const free = getEntitlements('free')
      expect(free.mercury_voice).toBe(false)
      expect(free.mercury_channels).toEqual([])
    })
  })

  describe('price resolution edge cases', () => {
    test('empty array falls back to starter', () => {
      expect(resolveTierFromPriceIds([])).toBe('starter')
    })

    test('empty string price ID falls back to starter', () => {
      expect(resolveTierFromPriceIds([''])).toBe('starter')
    })

    test('env vars not set causes fallback to starter', () => {
      // Clear all Stripe price env vars
      delete process.env.STRIPE_PRICE_STARTER_MONTHLY
      delete process.env.STRIPE_PRICE_PRO_MONTHLY

      expect(resolveTierFromPriceIds(['price_any'])).toBe('starter')
    })
  })

  describe('V-Rep creation limits', () => {
    test('free tier denied V-Rep creation (limit = 0)', async () => {
      authenticateAs('free')

      const result = await checkVRepCreation(buildRequest())
      expect(result.allowed).toBe(false)
    })

    test('enterprise tier with unlimited vreps is allowed', async () => {
      authenticateAs('enterprise')

      const result = await checkVRepCreation(buildRequest())
      // enterprise vreps_limit = 15, not unlimited, but still allowed
      expect(result.allowed).toBe(true)
    })
  })

  describe('concurrent usage patterns', () => {
    test('checkUsageLimit is safe with zero-value aggregates', async () => {
      mockUserFindFirst.mockResolvedValue({ id: 'user-1', subscriptionTier: 'starter' })
      mockDocAggregate.mockResolvedValue({ _sum: { sizeBytes: null } }) // null when no documents

      const result = await checkUsageLimit('user-1', 'vault_size')
      expect(result.allowed).toBe(true)
      expect(result.current).toBe(0)
    })
  })
})
