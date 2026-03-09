/**
 * Sarah — EPIC-031 T2: Stripe Webhook Route Tests
 *
 * POST /api/webhooks/stripe — Stripe event handling.
 * Verifies signature verification, event dispatch, and DB updates.
 */

// ── Mocks ────────────────────────────────────────────────────────

const mockConstructEvent = jest.fn()
const mockSubscriptionsRetrieve = jest.fn()

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: { constructEvent: mockConstructEvent },
    subscriptions: { retrieve: mockSubscriptionsRetrieve },
  }))
})

const mockUserSubFindUnique = jest.fn()
const mockUserSubUpsert = jest.fn()
const mockUserSubUpdate = jest.fn()
const mockUserUpdateMany = jest.fn()
const mockUserUpdate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    userSubscription: {
      findUnique: (...args: unknown[]) => mockUserSubFindUnique(...args),
      upsert: (...args: unknown[]) => mockUserSubUpsert(...args),
      update: (...args: unknown[]) => mockUserSubUpdate(...args),
    },
    user: {
      updateMany: (...args: unknown[]) => mockUserUpdateMany(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
  },
}))

jest.mock('@/lib/billing/entitlements', () => ({
  normalizeTier: (t: string) => t,
}))

// ── Imports ──────────────────────────────────────────────────────

import { NextRequest } from 'next/server'
import { POST } from '../route'

// ── Setup ────────────────────────────────────────────────────────

const ORIGINAL_ENV = process.env

function buildWebhookRequest(body: string, signature = 'sig_test'): NextRequest {
  return new NextRequest('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': signature,
    },
    body,
  })
}

function makeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_123',
    customer: 'cus_123',
    status: 'active',
    items: { data: [{ price: { id: 'price_pro_m' } }] },
    metadata: { ragboxUserId: 'user-1' },
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
    cancel_at_period_end: false,
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env = {
    ...ORIGINAL_ENV,
    STRIPE_SECRET_KEY: 'sk_test_fake',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_fake',
    STRIPE_PRICE_PRO_MONTHLY: 'price_pro_m',
    STRIPE_PRICE_STARTER_MONTHLY: 'price_starter_m',
  }
  mockUserSubUpsert.mockResolvedValue({})
  mockUserSubUpdate.mockResolvedValue({})
  mockUserUpdateMany.mockResolvedValue({ count: 1 })
  mockUserUpdate.mockResolvedValue({})
})

afterAll(() => {
  process.env = ORIGINAL_ENV
})

// ── Tests ────────────────────────────────────────────────────────

describe('Sarah — EPIC-031 T2: POST /api/webhooks/stripe', () => {
  describe('configuration guard', () => {
    test('returns 500 if STRIPE_SECRET_KEY not set', async () => {
      process.env.STRIPE_SECRET_KEY = ''
      const res = await POST(buildWebhookRequest('{}'))
      expect(res.status).toBe(500)
    })

    test('returns 500 if STRIPE_WEBHOOK_SECRET not set', async () => {
      process.env.STRIPE_WEBHOOK_SECRET = ''
      const res = await POST(buildWebhookRequest('{}'))
      expect(res.status).toBe(500)
    })
  })

  describe('signature verification', () => {
    test('returns 400 if stripe-signature header missing', async () => {
      const req = new NextRequest('http://localhost/api/webhooks/stripe', {
        method: 'POST',
        body: '{}',
      })
      const res = await POST(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Missing stripe-signature header')
    })

    test('returns 400 on invalid signature', async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error('Signature mismatch')
      })
      const res = await POST(buildWebhookRequest('{}'))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('Webhook signature verification failed')
    })
  })

  describe('checkout.session.completed', () => {
    const session = {
      subscription: 'sub_123',
      metadata: { ragboxUserId: 'user-1' },
    }

    beforeEach(() => {
      const sub = makeSubscription()
      mockConstructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: session },
      })
      mockSubscriptionsRetrieve.mockResolvedValue(sub)
    })

    test('upserts UserSubscription record', async () => {
      const res = await POST(buildWebhookRequest(JSON.stringify(session)))
      expect(res.status).toBe(200)
      expect(mockUserSubUpsert).toHaveBeenCalledTimes(1)

      const args = mockUserSubUpsert.mock.calls[0][0]
      expect(args.where.userId).toBe('user-1')
      expect(args.create.stripeSubscriptionId).toBe('sub_123')
    })

    test('syncs User.subscriptionTier', async () => {
      await POST(buildWebhookRequest(JSON.stringify(session)))
      expect(mockUserUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            subscriptionStatus: 'active',
            stripeCustomerId: 'cus_123',
            stripeSubscriptionId: 'sub_123',
          }),
        }),
      )
    })

    test('skips if missing ragboxUserId in metadata', async () => {
      const subNoMeta = makeSubscription({ metadata: {} })
      mockSubscriptionsRetrieve.mockResolvedValue(subNoMeta)
      mockConstructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: { subscription: 'sub_123', metadata: {} } },
      })

      const res = await POST(buildWebhookRequest('{}'))
      expect(res.status).toBe(200)
      expect(mockUserSubUpsert).not.toHaveBeenCalled()
    })
  })

  describe('customer.subscription.updated', () => {
    test('updates UserSubscription tier and status', async () => {
      mockUserSubFindUnique.mockResolvedValue({ userId: 'user-1' })
      const sub = makeSubscription()
      mockConstructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        data: { object: sub },
      })

      const res = await POST(buildWebhookRequest('{}'))
      expect(res.status).toBe(200)
      expect(mockUserSubUpdate).toHaveBeenCalledTimes(1)
    })

    test('syncs User model on update', async () => {
      mockUserSubFindUnique.mockResolvedValue({ userId: 'user-1' })
      mockConstructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        data: { object: makeSubscription() },
      })

      await POST(buildWebhookRequest('{}'))
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
        }),
      )
    })

    test('skips if no existing subscription found', async () => {
      mockUserSubFindUnique.mockResolvedValue(null)
      mockConstructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        data: { object: makeSubscription() },
      })

      const res = await POST(buildWebhookRequest('{}'))
      expect(res.status).toBe(200)
      expect(mockUserSubUpdate).not.toHaveBeenCalled()
    })
  })

  describe('customer.subscription.deleted', () => {
    test('sets tier to free and status to cancelled', async () => {
      mockUserSubFindUnique.mockResolvedValue({ userId: 'user-1' })
      mockConstructEvent.mockReturnValue({
        type: 'customer.subscription.deleted',
        data: { object: makeSubscription() },
      })

      const res = await POST(buildWebhookRequest('{}'))
      expect(res.status).toBe(200)

      expect(mockUserSubUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tier: 'free',
            status: 'cancelled',
          }),
        }),
      )

      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subscriptionTier: 'free',
            subscriptionStatus: 'cancelled',
          }),
        }),
      )
    })
  })

  describe('invoice.payment_failed', () => {
    test('sets status to past_due', async () => {
      mockUserSubFindUnique.mockResolvedValue({ userId: 'user-1' })
      mockConstructEvent.mockReturnValue({
        type: 'invoice.payment_failed',
        data: { object: { id: 'inv_123', customer: 'cus_123' } },
      })

      const res = await POST(buildWebhookRequest('{}'))
      expect(res.status).toBe(200)

      expect(mockUserSubUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'past_due' },
        }),
      )
    })

    test('skips if no customer found', async () => {
      mockUserSubFindUnique.mockResolvedValue(null)
      mockConstructEvent.mockReturnValue({
        type: 'invoice.payment_failed',
        data: { object: { id: 'inv_123', customer: 'cus_123' } },
      })

      const res = await POST(buildWebhookRequest('{}'))
      expect(res.status).toBe(200)
      expect(mockUserSubUpdate).not.toHaveBeenCalled()
    })
  })

  describe('unhandled events', () => {
    test('returns 200 for unhandled event types', async () => {
      mockConstructEvent.mockReturnValue({
        type: 'payment_method.attached',
        data: { object: {} },
      })

      const res = await POST(buildWebhookRequest('{}'))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.received).toBe(true)
    })

    test('returns 200 even when handler throws (prevents Stripe retries)', async () => {
      mockUserSubFindUnique.mockRejectedValue(new Error('DB connection lost'))
      mockConstructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        data: { object: makeSubscription() },
      })

      const res = await POST(buildWebhookRequest('{}'))
      // Handler errors are caught — still returns 200
      expect(res.status).toBe(200)
    })
  })
})
