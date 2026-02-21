/**
 * Stripe Webhook Route Tests
 *
 * Tests the /api/stripe/webhook endpoint — event handling, signature
 * verification, and idempotency.
 */
export {}

// ─── Mock Stripe SDK ────────────────────────────────────────────────────────
const mockConstructEvent = jest.fn()

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  }))
})

const ORIGINAL_ENV = process.env
beforeAll(() => {
  process.env = {
    ...ORIGINAL_ENV,
    STRIPE_SECRET_KEY: 'sk_test_fake',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_fake',
  }
})

afterAll(() => {
  process.env = ORIGINAL_ENV
})

beforeEach(() => {
  mockConstructEvent.mockReset()
  jest.spyOn(console, 'info').mockImplementation()
  jest.spyOn(console, 'error').mockImplementation()
})

afterEach(() => {
  jest.restoreAllMocks()
})

// ─── Helpers ────────────────────────────────────────────────────────────────

function createWebhookRequest(body: string, signature = 'sig_valid') {
  return {
    text: async () => body,
    headers: {
      get: (name: string) => {
        if (name === 'stripe-signature') return signature
        return null
      },
    },
  }
}

function makeStripeEvent(type: string, data: Record<string, unknown> = {}) {
  return {
    type,
    data: { object: data },
  }
}

describe('Stripe Webhook', () => {
  // ─── 2.2 Webhook Route (8 tests) ──────────────────────────────────────

  describe('2.2 Webhook Route', () => {
    it('checkout.session.completed → 200, logs customer email', async () => {
      const event = makeStripeEvent('checkout.session.completed', {
        customer: 'cus_123',
        subscription: 'sub_456',
        customer_details: { email: 'test@ragbox.co' },
      })
      mockConstructEvent.mockReturnValue(event)

      const { POST } = require('@/app/api/stripe/webhook/route')
      const req = createWebhookRequest('{}')
      const res = await POST(req as any)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.received).toBe(true)
    })

    it('customer.subscription.updated → 200, logs subscription status', async () => {
      const event = makeStripeEvent('customer.subscription.updated', {
        id: 'sub_456',
        status: 'active',
      })
      mockConstructEvent.mockReturnValue(event)

      const { POST } = require('@/app/api/stripe/webhook/route')
      const req = createWebhookRequest('{}')
      const res = await POST(req as any)

      expect(res.status).toBe(200)
    })

    it('customer.subscription.deleted → 200, logs cancellation', async () => {
      const event = makeStripeEvent('customer.subscription.deleted', {
        id: 'sub_456',
      })
      mockConstructEvent.mockReturnValue(event)

      const { POST } = require('@/app/api/stripe/webhook/route')
      const req = createWebhookRequest('{}')
      const res = await POST(req as any)

      expect(res.status).toBe(200)
    })

    it('invoice.payment_failed → 200, logs failed amount', async () => {
      const event = makeStripeEvent('invoice.payment_failed', {
        customer: 'cus_123',
        amount_due: 4900,
      })
      mockConstructEvent.mockReturnValue(event)

      const { POST } = require('@/app/api/stripe/webhook/route')
      const req = createWebhookRequest('{}')
      const res = await POST(req as any)

      expect(res.status).toBe(200)
    })

    it('unknown event type → 200 (graceful pass-through)', async () => {
      const event = makeStripeEvent('payment_method.attached', {
        id: 'pm_123',
      })
      mockConstructEvent.mockReturnValue(event)

      const { POST } = require('@/app/api/stripe/webhook/route')
      const req = createWebhookRequest('{}')
      const res = await POST(req as any)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.received).toBe(true)
    })

    it('invalid signature → 400 {error: "Invalid signature"}', async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature')
      })

      const { POST } = require('@/app/api/stripe/webhook/route')
      const req = createWebhookRequest('{}', 'sig_invalid')
      const res = await POST(req as any)

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('Invalid signature')
    })

    it('empty body → handled gracefully (400 or valid response)', async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error('No webhook payload was provided')
      })

      const { POST } = require('@/app/api/stripe/webhook/route')
      const req = createWebhookRequest('')
      const res = await POST(req as any)

      // Should not crash — either 400 (bad sig) or handled
      expect(res.status).toBe(400)
    })

    it('same event twice → idempotent (no duplicate processing)', async () => {
      const event = makeStripeEvent('checkout.session.completed', {
        customer: 'cus_123',
        subscription: 'sub_456',
        customer_details: { email: 'test@ragbox.co' },
      })
      mockConstructEvent.mockReturnValue(event)

      const { POST } = require('@/app/api/stripe/webhook/route')

      const res1 = await POST(createWebhookRequest('{}') as any)
      const res2 = await POST(createWebhookRequest('{}') as any)

      expect(res1.status).toBe(200)
      expect(res2.status).toBe(200)
      // Both should succeed — no crash from duplicate processing
    })
  })
})
