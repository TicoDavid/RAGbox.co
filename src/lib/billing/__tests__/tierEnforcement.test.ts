/**
 * Sarah — EPIC-031 T4: Tier Enforcement Middleware Tests
 *
 * Tests checkTierAccess(), checkUsageLimit(), TIER_LIMITS,
 * FEATURE_REQUIREMENTS, and the tier hierarchy.
 */

// ── Mocks ────────────────────────────────────────────────────────

const mockGetToken = jest.fn()
jest.mock('next-auth/jwt', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
}))

const mockUserFindFirst = jest.fn()
const mockDocAggregate = jest.fn()
const mockDocCount = jest.fn()
const mockQueryCount = jest.fn()

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findFirst: (...args: unknown[]) => mockUserFindFirst(...args),
    },
    document: {
      aggregate: (...args: unknown[]) => mockDocAggregate(...args),
      count: (...args: unknown[]) => mockDocCount(...args),
    },
    query: {
      count: (...args: unknown[]) => mockQueryCount(...args),
    },
  },
}))

// ── Imports ──────────────────────────────────────────────────────

import { NextRequest } from 'next/server'
import {
  checkTierAccess,
  checkUsageLimit,
  TIER_LIMITS,
  FEATURE_REQUIREMENTS,
  type EnforcementTier,
} from '@/lib/billing/tierEnforcement'

// ── Setup ────────────────────────────────────────────────────────

function buildRequest(): NextRequest {
  return new NextRequest('http://localhost/api/test')
}

function authenticateAs(tier: string) {
  mockGetToken.mockResolvedValue({ id: 'user-1', email: 'test@test.com' })
  mockUserFindFirst.mockResolvedValue({ id: 'user-1', subscriptionTier: tier })
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ── Tests ────────────────────────────────────────────────────────

describe('Sarah — EPIC-031 T4: Tier Enforcement', () => {
  describe('checkTierAccess', () => {
    test('returns 401 when not authenticated', async () => {
      mockGetToken.mockResolvedValue(null)

      const result = await checkTierAccess(buildRequest(), 'Starter')
      expect(result).not.toBeNull()
      expect(result!.status).toBe(401)
    })

    test('returns null (access granted) when tier meets requirement', async () => {
      authenticateAs('professional')

      const result = await checkTierAccess(buildRequest(), 'Pro')
      expect(result).toBeNull()
    })

    test('returns null when tier exceeds requirement', async () => {
      authenticateAs('business')

      const result = await checkTierAccess(buildRequest(), 'Pro')
      expect(result).toBeNull()
    })

    test('returns 403 when tier is below requirement', async () => {
      authenticateAs('free')

      const result = await checkTierAccess(buildRequest(), 'Pro')
      expect(result).not.toBeNull()
      expect(result!.status).toBe(403)

      const body = await result!.json()
      expect(body.error).toBe('Upgrade required')
      expect(body.requiredTier).toBe('Pro')
      expect(body.currentTier).toBe('free')
      expect(body.upgradeUrl).toBe('/pricing')
    })

    test('Free tier is denied access to Starter-level features', async () => {
      authenticateAs('free')

      const result = await checkTierAccess(buildRequest(), 'Starter')
      expect(result).not.toBeNull()
      expect(result!.status).toBe(403)
    })

    test('Starter tier can access Starter-level features', async () => {
      authenticateAs('starter')

      const result = await checkTierAccess(buildRequest(), 'Starter')
      expect(result).toBeNull()
    })

    test('AITeam tier can access all feature levels', async () => {
      authenticateAs('aiteam')

      const levels: EnforcementTier[] = ['Free', 'Starter', 'Pro', 'Business', 'VRep', 'AITeam']
      for (const level of levels) {
        const result = await checkTierAccess(buildRequest(), level)
        expect(result).toBeNull()
      }
    })

    test('legacy mercury tier maps to starter level', async () => {
      authenticateAs('mercury')

      const result = await checkTierAccess(buildRequest(), 'Starter')
      expect(result).toBeNull()
    })

    test('unknown tier defaults to free (denied for Starter)', async () => {
      authenticateAs('platinum')

      const result = await checkTierAccess(buildRequest(), 'Starter')
      expect(result).not.toBeNull()
      expect(result!.status).toBe(403)
    })
  })

  describe('checkUsageLimit', () => {
    describe('vault_size', () => {
      test('allows when under vault size limit', async () => {
        mockUserFindFirst.mockResolvedValue({ id: 'user-1', subscriptionTier: 'starter' })
        mockDocAggregate.mockResolvedValue({ _sum: { sizeBytes: 100 * 1024 * 1024 } }) // 100MB < 500MB

        const result = await checkUsageLimit('user-1', 'vault_size')
        expect(result.allowed).toBe(true)
        expect(result.tier).toBe('starter')
        expect(result.limit).toBe(500) // vaultSizeMB for starter
      })

      test('denies when at vault size limit', async () => {
        mockUserFindFirst.mockResolvedValue({ id: 'user-1', subscriptionTier: 'free' })
        mockDocAggregate.mockResolvedValue({ _sum: { sizeBytes: 52 * 1024 * 1024 } }) // 52MB >= 50MB limit

        const result = await checkUsageLimit('user-1', 'vault_size')
        expect(result.allowed).toBe(false)
        expect(result.current).toBe(52)
      })
    })

    describe('document_count', () => {
      test('allows when under document limit', async () => {
        mockUserFindFirst.mockResolvedValue({ id: 'user-1', subscriptionTier: 'professional' })
        mockDocCount.mockResolvedValue(100) // < 500

        const result = await checkUsageLimit('user-1', 'document_count')
        expect(result.allowed).toBe(true)
        expect(result.limit).toBe(500) // documentsMax for professional
      })

      test('denies when at document limit', async () => {
        mockUserFindFirst.mockResolvedValue({ id: 'user-1', subscriptionTier: 'starter' })
        mockDocCount.mockResolvedValue(100) // >= 100

        const result = await checkUsageLimit('user-1', 'document_count')
        expect(result.allowed).toBe(false)
        expect(result.current).toBe(100)
      })
    })

    describe('query_count', () => {
      test('allows when under query limit', async () => {
        mockUserFindFirst.mockResolvedValue({ id: 'user-1', subscriptionTier: 'starter' })
        mockQueryCount.mockResolvedValue(100) // < 500

        const result = await checkUsageLimit('user-1', 'query_count')
        expect(result.allowed).toBe(true)
        expect(result.limit).toBe(500)
      })

      test('denies when at query limit', async () => {
        mockUserFindFirst.mockResolvedValue({ id: 'user-1', subscriptionTier: 'free' })
        mockQueryCount.mockResolvedValue(50) // >= 50

        const result = await checkUsageLimit('user-1', 'query_count')
        expect(result.allowed).toBe(false)
      })

      test('returns unlimited (null limit) for aiteam tier', async () => {
        mockUserFindFirst.mockResolvedValue({ id: 'user-1', subscriptionTier: 'aiteam' })

        const result = await checkUsageLimit('user-1', 'query_count')
        expect(result.allowed).toBe(true)
        expect(result.limit).toBeNull()
      })
    })

    test('defaults to free tier when user not found', async () => {
      mockUserFindFirst.mockResolvedValue(null)
      mockDocAggregate.mockResolvedValue({ _sum: { sizeBytes: 0 } })

      const result = await checkUsageLimit('unknown-user', 'vault_size')
      expect(result.tier).toBe('free')
      expect(result.limit).toBe(50) // free vaultSizeMB
    })
  })

  describe('TIER_LIMITS', () => {
    test('free tier has lowest limits', () => {
      const free = TIER_LIMITS.free
      expect(free.vaultSizeMB).toBe(50)
      expect(free.documentsMax).toBe(10)
      expect(free.queriesPerMonth).toBe(50)
    })

    test('aiteam tier has unlimited queries', () => {
      const ai = TIER_LIMITS.aiteam
      expect(ai.queriesPerMonth).toBe(-1)
      expect(ai.documentsMax).toBe(20000)
    })

    test('limits increase across tier hierarchy', () => {
      const order = ['free', 'starter', 'professional', 'business', 'vrep', 'aiteam']
      for (let i = 1; i < order.length; i++) {
        const prev = TIER_LIMITS[order[i - 1]]
        const curr = TIER_LIMITS[order[i]]
        expect(curr.documentsMax).toBeGreaterThan(prev.documentsMax)
        expect(curr.vaultSizeMB).toBeGreaterThan(prev.vaultSizeMB)
      }
    })
  })

  describe('FEATURE_REQUIREMENTS', () => {
    test('voice requires Pro', () => {
      expect(FEATURE_REQUIREMENTS.voice).toBe('Pro')
    })

    test('api_access requires Business', () => {
      expect(FEATURE_REQUIREMENTS.api_access).toBe('Business')
    })

    test('team_management requires VRep', () => {
      expect(FEATURE_REQUIREMENTS.team_management).toBe('VRep')
    })

    test('multi_agent requires AITeam', () => {
      expect(FEATURE_REQUIREMENTS.multi_agent).toBe('AITeam')
    })
  })
})
