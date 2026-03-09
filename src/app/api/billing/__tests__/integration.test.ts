/**
 * Sarah — EPIC-031 T7: Billing Integration Tests
 *
 * End-to-end flow tests: checkout → webhook → provision → enforcement.
 * Tests the contract between billing components.
 */

// ── Mocks ────────────────────────────────────────────────────────

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    userSubscription: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    vault: {
      aggregate: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
    },
    tenant: { upsert: jest.fn() },
    document: {
      aggregate: jest.fn(),
      count: jest.fn(),
    },
    query: { count: jest.fn() },
    apiKey: { count: jest.fn() },
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

const mockGetToken = jest.fn()
jest.mock('next-auth/jwt', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
}))

// ── Imports ──────────────────────────────────────────────────────

import prisma from '@/lib/prisma'
import { normalizeTier, getEntitlements, resolveTierFromPriceIds } from '@/lib/billing/entitlements'
import { provisionFromCheckout, updateSubscription, handlePaymentFailed } from '@/lib/billing/provision'
import { checkUsageLimit } from '@/lib/billing/tierEnforcement'

// ── Setup ────────────────────────────────────────────────────────

const ORIGINAL_ENV = process.env

beforeEach(() => {
  jest.clearAllMocks()
  process.env = {
    ...ORIGINAL_ENV,
    STRIPE_PRICE_STARTER_MONTHLY: 'price_starter_m',
    STRIPE_PRICE_PRO_MONTHLY: 'price_pro_m',
    STRIPE_PRICE_BUSINESS_MONTHLY: 'price_biz_m',
  }
})

afterAll(() => {
  process.env = ORIGINAL_ENV
})

// ── Tests ────────────────────────────────────────────────────────

describe('Sarah — EPIC-031 T7: Billing Integration', () => {
  test('provision flow: checkout → user created → tier assigned → entitlements stored', async () => {
    const now = new Date()
    ;(prisma.user.upsert as jest.Mock).mockResolvedValue({
      id: 'user-flow-1',
      name: 'flowuser',
      email: 'flow@ragbox.co',
      createdAt: now,
    })

    const result = await provisionFromCheckout({
      email: 'flow@ragbox.co',
      stripeCustomerId: 'cus_flow',
      stripeSubscriptionId: 'sub_flow',
      priceIds: ['price_pro_m'],
    })

    // Verify tier resolution pipeline
    expect(result.tier).toBe('professional')
    const entitlements = getEntitlements(result.tier)
    expect(entitlements.byollm_enabled).toBe(true)
    expect(entitlements.documents_limit).toBe(50)
  })

  test('upgrade flow: starter → business → entitlements scale up', async () => {
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue({
      id: 'user-up-1',
      subscriptionTier: 'starter',
    })
    ;(prisma.user.update as jest.Mock).mockResolvedValue({})

    const result = await updateSubscription({
      stripeSubscriptionId: 'sub_up_1',
      status: 'active',
      priceIds: ['price_biz_m'],
    })

    expect(result).not.toBeNull()
    expect(result!.tier).toBe('business')

    // Business entitlements are higher than starter
    const bizEnt = getEntitlements('business')
    const startEnt = getEntitlements('starter')
    expect(bizEnt.documents_limit).toBeGreaterThan(startEnt.documents_limit)
    expect(bizEnt.queries_per_month).toBeGreaterThan(startEnt.queries_per_month)
  })

  test('cancellation flow: active → cancelled → usage limits enforce free tier', async () => {
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue({
      id: 'user-cancel-1',
      subscriptionTier: 'professional',
    })
    ;(prisma.user.update as jest.Mock).mockResolvedValue({})

    const result = await updateSubscription({
      stripeSubscriptionId: 'sub_cancel_1',
      status: 'cancelled',
    })

    expect(result).not.toBeNull()
    expect(result!.status).toBe('cancelled')

    // After cancellation, if tier becomes free, usage limits should be enforced
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue({
      id: 'user-cancel-1',
      subscriptionTier: 'free',
    })
    ;(prisma.document as unknown as { count: jest.Mock }).count.mockResolvedValue(15)

    const usage = await checkUsageLimit('user-cancel-1', 'document_count')
    expect(usage.allowed).toBe(false) // 15 >= 10 (free limit)
    expect(usage.tier).toBe('free')
  })

  test('payment failure flow: sets past_due without downgrading tier', async () => {
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue({
      id: 'user-fail-1',
      email: 'fail@test.com',
    })
    ;(prisma.user.update as jest.Mock).mockResolvedValue({})

    await handlePaymentFailed({ stripeCustomerId: 'cus_fail_1' })

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { subscriptionStatus: 'past_due' },
      }),
    )
    // Tier should NOT change — only status
    const updateCall = (prisma.user.update as jest.Mock).mock.calls[0][0]
    expect(updateCall.data.subscriptionTier).toBeUndefined()
  })

  test('tier normalization pipeline: legacy names resolve correctly through entitlements', () => {
    // Legacy mercury → starter → correct entitlements
    const tier = normalizeTier('mercury')
    expect(tier).toBe('starter')
    const ent = getEntitlements(tier)
    expect(ent.documents_limit).toBe(10)

    // Legacy syndicate → enterprise → correct entitlements
    const tier2 = normalizeTier('syndicate')
    expect(tier2).toBe('enterprise')
    const ent2 = getEntitlements(tier2)
    expect(ent2.documents_limit).toBe(-1) // unlimited
  })
})
