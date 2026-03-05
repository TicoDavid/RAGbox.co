/**
 * Sarah — E26-008: Billing Tests
 *
 * Tests tier enforcement, provisioning pipeline, entitlement shapes,
 * and Stripe integration patterns.
 */

// ── Mocks ────────────────────────────────────────────────────────

const mockGetToken = jest.fn()
jest.mock('next-auth/jwt', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
}))

const mockPrismaUserFindUnique = jest.fn()
const mockPrismaUserFindFirst = jest.fn()
const mockPrismaUserUpsert = jest.fn()
const mockPrismaUserUpdate = jest.fn()
const mockPrismaVaultAggregate = jest.fn()
const mockPrismaVaultCount = jest.fn()
const mockPrismaVaultCreate = jest.fn()
const mockPrismaTenantUpsert = jest.fn()
const mockPrismaApiKeyCount = jest.fn()

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: (...args: unknown[]) => mockPrismaUserFindUnique(...args),
      findFirst: (...args: unknown[]) => mockPrismaUserFindFirst(...args),
      upsert: (...args: unknown[]) => mockPrismaUserUpsert(...args),
      update: (...args: unknown[]) => mockPrismaUserUpdate(...args),
    },
    vault: {
      aggregate: (...args: unknown[]) => mockPrismaVaultAggregate(...args),
      count: (...args: unknown[]) => mockPrismaVaultCount(...args),
      create: (...args: unknown[]) => mockPrismaVaultCreate(...args),
    },
    tenant: {
      upsert: (...args: unknown[]) => mockPrismaTenantUpsert(...args),
    },
    apiKey: {
      count: (...args: unknown[]) => mockPrismaApiKeyCount(...args),
    },
  },
}))

jest.mock('@/lib/audit/auditWriter', () => ({
  writeAuditEntry: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/email/gmail', () => ({
  isGmailConfigured: jest.fn(() => false),
  sendViaGmail: jest.fn(),
}))

jest.mock('@/lib/email/templates/welcome-sovereign', () => ({
  welcomeSovereignEmail: jest.fn(() => ({ subject: 'Welcome', html: '<p>Welcome</p>' })),
}))

jest.mock('@/lib/email/templates/welcome-mercury-addon', () => ({
  welcomeMercuryEmail: jest.fn(() => ({ subject: 'Welcome', html: '<p>Welcome</p>' })),
}))

// ── Imports ──────────────────────────────────────────────────────

import { NextRequest } from 'next/server'
import {
  TIER_ENTITLEMENTS,
  getEntitlements,
  normalizeTier,
  resolveTierFromPriceIds,
  type BillingTier,
  type Entitlements,
} from '@/lib/billing/entitlements'
import { checkVaultUpload, checkByollm, checkApiKeyCreation, checkEntitlement } from '@/lib/auth/tierCheck'
import { provisionFromCheckout, updateSubscription, handlePaymentFailed } from '@/lib/billing/provision'

// ── Setup ────────────────────────────────────────────────────────

const ORIGINAL_ENV = process.env

function buildRequest(path = 'http://localhost/api/test'): NextRequest {
  return new NextRequest(path)
}

function authenticateAs(id: string, email: string, tier = 'free', status = 'active') {
  mockGetToken.mockResolvedValue({ id, email })
  mockPrismaUserFindUnique.mockResolvedValue({
    subscriptionTier: tier,
    subscriptionStatus: status,
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env = {
    ...ORIGINAL_ENV,
    STRIPE_PRICE_STARTER: 'price_starter_test',
    STRIPE_PRICE_PROFESSIONAL: 'price_pro_test',
    STRIPE_PRICE_ENTERPRISE: 'price_ent_test',
    STRIPE_PRICE_SOVEREIGN: 'price_sov_test',
  }
})

afterAll(() => {
  process.env = ORIGINAL_ENV
})

// ── Tests ────────────────────────────────────────────────────────

describe('E26-008: Billing — Tier Enforcement', () => {
  describe('checkVaultUpload', () => {
    test('allows upload when under storage limit', async () => {
      authenticateAs('user-1', 'test@test.com', 'starter')
      mockPrismaVaultAggregate.mockResolvedValue({
        _sum: { storageUsedBytes: 500 * 1024 * 1024 }, // 500MB
      })

      const result = await checkVaultUpload(buildRequest())
      expect(result.allowed).toBe(true)
    })

    test('denies upload when at storage limit', async () => {
      authenticateAs('user-1', 'test@test.com', 'free')
      mockPrismaVaultAggregate.mockResolvedValue({
        _sum: { storageUsedBytes: 100 * 1024 * 1024 }, // 100MB = free tier limit
      })

      const result = await checkVaultUpload(buildRequest())
      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        const body = await result.response.json()
        expect(body.error).toBe('Upgrade required')
        expect(body.feature).toBe('vault_storage')
        expect(body.upgradeUrl).toBe('/pricing')
        expect(result.response.status).toBe(403)
      }
    })

    test('allows unlimited storage for enterprise tier', async () => {
      authenticateAs('user-1', 'test@test.com', 'enterprise')

      const result = await checkVaultUpload(buildRequest())
      // Enterprise has vault_storage_bytes = -1 (unlimited), skips aggregate check
      expect(result.allowed).toBe(true)
      expect(mockPrismaVaultAggregate).not.toHaveBeenCalled()
    })

    test('returns 401 when not authenticated', async () => {
      mockGetToken.mockResolvedValue(null)

      const result = await checkVaultUpload(buildRequest())
      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.response.status).toBe(401)
      }
    })
  })

  describe('checkByollm', () => {
    test('allows BYOLLM for professional tier', async () => {
      authenticateAs('user-1', 'test@test.com', 'professional')

      const result = await checkByollm(buildRequest())
      expect(result.allowed).toBe(true)
    })

    test('denies BYOLLM for free tier', async () => {
      authenticateAs('user-1', 'test@test.com', 'free')

      const result = await checkByollm(buildRequest())
      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        const body = await result.response.json()
        expect(body.feature).toBe('byollm')
        expect(result.response.status).toBe(403)
      }
    })

    test('denies BYOLLM for starter tier', async () => {
      authenticateAs('user-1', 'test@test.com', 'starter')

      const result = await checkByollm(buildRequest())
      expect(result.allowed).toBe(false)
    })

    test('allows BYOLLM for sovereign tier', async () => {
      authenticateAs('user-1', 'test@test.com', 'sovereign')

      const result = await checkByollm(buildRequest())
      expect(result.allowed).toBe(true)
    })
  })

  describe('checkApiKeyCreation', () => {
    test('allows API key creation under limit', async () => {
      authenticateAs('user-1', 'test@test.com', 'starter')
      mockPrismaApiKeyCount.mockResolvedValue(1)

      const result = await checkApiKeyCreation(buildRequest())
      expect(result.allowed).toBe(true)
    })

    test('denies API key creation at limit', async () => {
      authenticateAs('user-1', 'test@test.com', 'starter')
      mockPrismaApiKeyCount.mockResolvedValue(3) // starter limit = 3

      const result = await checkApiKeyCreation(buildRequest())
      expect(result.allowed).toBe(false)
    })

    test('allows unlimited API keys for enterprise tier', async () => {
      authenticateAs('user-1', 'test@test.com', 'enterprise')

      const result = await checkApiKeyCreation(buildRequest())
      expect(result.allowed).toBe(true)
      expect(mockPrismaApiKeyCount).not.toHaveBeenCalled()
    })
  })

  describe('checkEntitlement (generic)', () => {
    test('allows when predicate returns true', async () => {
      authenticateAs('user-1', 'test@test.com', 'enterprise')

      const result = await checkEntitlement(
        buildRequest(),
        (e) => e.mercury_voice,
        'starter',
        'voice',
      )
      expect(result.allowed).toBe(true)
    })

    test('denies when predicate returns false', async () => {
      authenticateAs('user-1', 'test@test.com', 'free')

      const result = await checkEntitlement(
        buildRequest(),
        (e) => e.mercury_voice,
        'starter',
        'voice',
      )
      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        const body = await result.response.json()
        expect(body.feature).toBe('voice')
        expect(body.requiredTier).toBe('starter')
      }
    })
  })
})

describe('E26-008: Billing — Provisioning Pipeline', () => {
  describe('provisionFromCheckout', () => {
    test('creates new user with correct tier and entitlements', async () => {
      const now = new Date()
      mockPrismaUserUpsert.mockResolvedValue({
        id: 'user-new',
        name: 'testuser',
        email: 'test@ragbox.co',
        createdAt: now,
      })
      mockPrismaTenantUpsert.mockResolvedValue({})
      mockPrismaVaultCount.mockResolvedValue(0)
      mockPrismaVaultCreate.mockResolvedValue({})

      const result = await provisionFromCheckout({
        email: 'test@ragbox.co',
        stripeCustomerId: 'cus_test123',
        stripeSubscriptionId: 'sub_test456',
        priceIds: ['price_pro_test'],
      })

      expect(result.userId).toBe('user-new')
      expect(result.tier).toBe('professional')
      expect(result.email).toBe('test@ragbox.co')
    })

    test('upserts tenant record by slug', async () => {
      mockPrismaUserUpsert.mockResolvedValue({
        id: 'user-1',
        name: 'alice',
        email: 'alice@company.com',
        createdAt: new Date(),
      })
      mockPrismaTenantUpsert.mockResolvedValue({})
      mockPrismaVaultCount.mockResolvedValue(0)
      mockPrismaVaultCreate.mockResolvedValue({})

      await provisionFromCheckout({
        email: 'alice@company.com',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        priceIds: ['price_starter_test'],
      })

      expect(mockPrismaTenantUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: 'alice' },
        })
      )
    })

    test('creates default vault only if none exist', async () => {
      mockPrismaUserUpsert.mockResolvedValue({
        id: 'user-1',
        name: 'bob',
        email: 'bob@co.com',
        createdAt: new Date(),
      })
      mockPrismaTenantUpsert.mockResolvedValue({})
      mockPrismaVaultCount.mockResolvedValue(1) // already has a vault

      await provisionFromCheckout({
        email: 'bob@co.com',
        stripeCustomerId: 'cus_2',
        stripeSubscriptionId: 'sub_2',
        priceIds: ['price_starter_test'],
      })

      expect(mockPrismaVaultCreate).not.toHaveBeenCalled()
    })

    test('sovereign price resolves to sovereign tier', async () => {
      mockPrismaUserUpsert.mockResolvedValue({
        id: 'user-sov',
        name: 'sovereign',
        email: 'sov@ragbox.co',
        createdAt: new Date(),
      })
      mockPrismaTenantUpsert.mockResolvedValue({})
      mockPrismaVaultCount.mockResolvedValue(0)
      mockPrismaVaultCreate.mockResolvedValue({})

      const result = await provisionFromCheckout({
        email: 'sov@ragbox.co',
        stripeCustomerId: 'cus_sov',
        stripeSubscriptionId: 'sub_sov',
        priceIds: ['price_sov_test'],
      })

      expect(result.tier).toBe('sovereign')
    })
  })

  describe('updateSubscription', () => {
    test('updates user tier on upgrade', async () => {
      mockPrismaUserFindFirst.mockResolvedValue({
        id: 'user-1',
        subscriptionTier: 'starter',
      })
      mockPrismaUserUpdate.mockResolvedValue({})

      const result = await updateSubscription({
        stripeSubscriptionId: 'sub_1',
        status: 'active',
        priceIds: ['price_pro_test'],
      })

      expect(result).not.toBeNull()
      expect(result!.tier).toBe('professional')
      expect(result!.status).toBe('active')
    })

    test('returns null when subscription not found', async () => {
      mockPrismaUserFindFirst.mockResolvedValue(null)

      const result = await updateSubscription({
        stripeSubscriptionId: 'sub_unknown',
        status: 'active',
      })

      expect(result).toBeNull()
    })

    test('sets cancellation end date on cancel', async () => {
      mockPrismaUserFindFirst.mockResolvedValue({
        id: 'user-1',
        subscriptionTier: 'professional',
      })
      mockPrismaUserUpdate.mockResolvedValue({})

      await updateSubscription({
        stripeSubscriptionId: 'sub_1',
        status: 'cancelled',
      })

      expect(mockPrismaUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subscriptionStatus: 'cancelled',
            subscriptionEndsAt: expect.any(Date),
          }),
        })
      )
    })
  })

  describe('handlePaymentFailed', () => {
    test('sets status to past_due', async () => {
      mockPrismaUserFindFirst.mockResolvedValue({ id: 'user-1', email: 'test@test.com' })
      mockPrismaUserUpdate.mockResolvedValue({})

      await handlePaymentFailed({ stripeCustomerId: 'cus_1' })

      expect(mockPrismaUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { subscriptionStatus: 'past_due' },
        })
      )
    })

    test('handles unknown customer gracefully', async () => {
      mockPrismaUserFindFirst.mockResolvedValue(null)

      await expect(
        handlePaymentFailed({ stripeCustomerId: 'cus_unknown' })
      ).resolves.not.toThrow()
    })
  })
})

describe('E26-008: Billing — Entitlement Shapes', () => {
  test('every tier has all required entitlement fields', () => {
    const requiredFields: (keyof Entitlements)[] = [
      'documents_limit',
      'queries_per_month',
      'vault_storage_bytes',
      'api_keys_limit',
      'vreps_limit',
      'byollm_enabled',
      'api_keys_enabled',
      'mercury_voice',
      'mercury_channels',
    ]

    const tiers: BillingTier[] = ['free', 'starter', 'professional', 'enterprise', 'sovereign']
    for (const tier of tiers) {
      const ent = getEntitlements(tier)
      for (const field of requiredFields) {
        expect(ent[field]).toBeDefined()
      }
    }
  })

  test('tier hierarchy: higher tiers have >= limits', () => {
    const free = getEntitlements('free')
    const starter = getEntitlements('starter')
    const professional = getEntitlements('professional')

    expect(starter.documents_limit).toBeGreaterThan(free.documents_limit)
    expect(starter.queries_per_month).toBeGreaterThan(free.queries_per_month)
    expect(professional.documents_limit).toBeGreaterThan(starter.documents_limit)
    expect(professional.queries_per_month).toBeGreaterThan(starter.queries_per_month)
  })

  test('enterprise has unlimited documents (value = -1)', () => {
    const ent = getEntitlements('enterprise')
    expect(ent.documents_limit).toBe(-1)
    expect(ent.vault_storage_bytes).toBe(-1)
  })

  test('free tier has no voice, no BYOLLM, no API keys', () => {
    const ent = getEntitlements('free')
    expect(ent.mercury_voice).toBe(false)
    expect(ent.byollm_enabled).toBe(false)
    expect(ent.api_keys_enabled).toBe(false)
  })

  test('enterprise has all mercury channels', () => {
    const ent = getEntitlements('enterprise')
    expect(ent.mercury_channels).toEqual(
      expect.arrayContaining(['voice', 'chat', 'whatsapp', 'email', 'sms'])
    )
  })

  test('legacy mercury tier maps to starter entitlements', () => {
    const mercury = getEntitlements('mercury')
    const starter = getEntitlements('starter')
    expect(mercury).toEqual(starter)
  })

  test('legacy syndicate tier maps to enterprise entitlements', () => {
    const syndicate = getEntitlements('syndicate')
    const enterprise = getEntitlements('enterprise')
    expect(syndicate).toEqual(enterprise)
  })
})

describe('E26-008: Billing — Price Resolution', () => {
  test('resolves each tier from its Stripe price ID', () => {
    expect(resolveTierFromPriceIds(['price_starter_test'])).toBe('starter')
    expect(resolveTierFromPriceIds(['price_pro_test'])).toBe('professional')
    expect(resolveTierFromPriceIds(['price_ent_test'])).toBe('enterprise')
    expect(resolveTierFromPriceIds(['price_sov_test'])).toBe('sovereign')
  })

  test('sovereign takes priority when multiple prices present', () => {
    expect(resolveTierFromPriceIds(['price_starter_test', 'price_sov_test'])).toBe('sovereign')
  })

  test('enterprise takes priority over professional', () => {
    expect(resolveTierFromPriceIds(['price_pro_test', 'price_ent_test'])).toBe('enterprise')
  })

  test('unknown price falls back to starter', () => {
    expect(resolveTierFromPriceIds(['price_unknown'])).toBe('starter')
  })
})

describe('E26-008: Billing — Deny Response Shape', () => {
  test('403 response includes upgrade metadata', async () => {
    authenticateAs('user-1', 'test@test.com', 'free')

    const result = await checkByollm(buildRequest())
    expect(result.allowed).toBe(false)

    if (!result.allowed) {
      const body = await result.response.json()
      expect(body).toEqual({
        success: false,
        error: 'Upgrade required',
        currentTier: 'free',
        requiredTier: 'sovereign',
        feature: 'byollm',
        upgradeUrl: '/pricing',
      })
    }
  })
})
