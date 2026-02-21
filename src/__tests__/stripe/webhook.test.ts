/**
 * Stripe Webhook Route Tests
 *
 * Tests the /api/stripe/webhook endpoint — event handling, signature
 * verification, provisioning calls, and graceful degradation.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
export {}

// ─── Mock Stripe SDK ────────────────────────────────────────────────────────
const mockConstructEvent = jest.fn()
const mockSubscriptionsRetrieve = jest.fn()

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: mockConstructEvent,
    },
    subscriptions: {
      retrieve: mockSubscriptionsRetrieve,
    },
  }))
})

// ─── Mock Billing Provision ─────────────────────────────────────────────────
const mockProvisionFromCheckout = jest.fn().mockResolvedValue({
  userId: 'user_123',
  email: 'test@ragbox.co',
  tier: 'sovereign',
  action: 'created',
})
const mockUpdateSubscription = jest.fn().mockResolvedValue({
  userId: 'user_123',
  tier: 'sovereign',
  status: 'active',
})
const mockHandlePaymentFailed = jest.fn().mockResolvedValue(undefined)

jest.mock('@/lib/billing/provision', () => ({
  provisionFromCheckout: (...args: unknown[]) => mockProvisionFromCheckout(...args),
  updateSubscription: (...args: unknown[]) => mockUpdateSubscription(...args),
  handlePaymentFailed: (...args: unknown[]) => mockHandlePaymentFailed(...args),
}))

const ORIGINAL_ENV = process.env
beforeAll(() => {
  process.env = {
    ...ORIGINAL_ENV,
    STRIPE_SECRET_KEY: 'sk_test_fake',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_fake',
    STRIPE_PRICE_SOVEREIGN: 'price_sovereign_test',
    STRIPE_PRICE_MERCURY: 'price_mercury_test',
  }
})

afterAll(() => {
  process.env = ORIGINAL_ENV
})

beforeEach(() => {
  mockConstructEvent.mockReset()
  mockSubscriptionsRetrieve.mockReset()
  mockProvisionFromCheckout.mockClear()
  mockUpdateSubscription.mockClear()
  mockHandlePaymentFailed.mockClear()
  jest.spyOn(console, 'info').mockImplementation()
  jest.spyOn(console, 'error').mockImplementation()
  jest.spyOn(console, 'warn').mockImplementation()
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
  describe('Event Handling', () => {
    it('checkout.session.completed → 200, calls provisionFromCheckout', async () => {
      const event = makeStripeEvent('checkout.session.completed', {
        customer: 'cus_123',
        subscription: 'sub_456',
        customer_details: { email: 'test@ragbox.co' },
        line_items: { data: [{ price: { id: 'price_sovereign_test' } }] },
      })
      mockConstructEvent.mockReturnValue(event)

      const { POST } = require('@/app/api/stripe/webhook/route')
      const req = createWebhookRequest('{}')
      const res = await POST(req as any)

      expect(res.status).toBe(200)
      expect(mockProvisionFromCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@ragbox.co',
          stripeCustomerId: 'cus_123',
          stripeSubscriptionId: 'sub_456',
        })
      )
    })

    it('customer.subscription.updated → 200, calls updateSubscription', async () => {
      const event = makeStripeEvent('customer.subscription.updated', {
        id: 'sub_456',
        status: 'active',
        items: { data: [{ price: { id: 'price_sovereign_test' } }] },
      })
      mockConstructEvent.mockReturnValue(event)

      const { POST } = require('@/app/api/stripe/webhook/route')
      const req = createWebhookRequest('{}')
      const res = await POST(req as any)

      expect(res.status).toBe(200)
      expect(mockUpdateSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeSubscriptionId: 'sub_456',
          status: 'active',
        })
      )
    })

    it('customer.subscription.deleted → 200, calls updateSubscription with cancelled', async () => {
      const event = makeStripeEvent('customer.subscription.deleted', {
        id: 'sub_456',
        items: { data: [] },
      })
      mockConstructEvent.mockReturnValue(event)

      const { POST } = require('@/app/api/stripe/webhook/route')
      const req = createWebhookRequest('{}')
      const res = await POST(req as any)

      expect(res.status).toBe(200)
      expect(mockUpdateSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeSubscriptionId: 'sub_456',
          status: 'cancelled',
        })
      )
    })

    it('invoice.payment_failed → 200, calls handlePaymentFailed', async () => {
      const event = makeStripeEvent('invoice.payment_failed', {
        customer: 'cus_123',
        amount_due: 4900,
      })
      mockConstructEvent.mockReturnValue(event)

      const { POST } = require('@/app/api/stripe/webhook/route')
      const req = createWebhookRequest('{}')
      const res = await POST(req as any)

      expect(res.status).toBe(200)
      expect(mockHandlePaymentFailed).toHaveBeenCalledWith({ stripeCustomerId: 'cus_123' })
    })

    it('unknown event type → 200 (graceful pass-through)', async () => {
      const event = makeStripeEvent('payment_method.attached', { id: 'pm_123' })
      mockConstructEvent.mockReturnValue(event)

      const { POST } = require('@/app/api/stripe/webhook/route')
      const req = createWebhookRequest('{}')
      const res = await POST(req as any)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.received).toBe(true)
    })
  })

  describe('Signature Verification', () => {
    it('invalid signature → 400', async () => {
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

    it('empty body → 400', async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error('No webhook payload was provided')
      })

      const { POST } = require('@/app/api/stripe/webhook/route')
      const req = createWebhookRequest('')
      const res = await POST(req as any)

      expect(res.status).toBe(400)
    })
  })

  describe('Graceful Degradation', () => {
    it('no Stripe config → 503', async () => {
      const savedKey = process.env.STRIPE_SECRET_KEY
      const savedSecret = process.env.STRIPE_WEBHOOK_SECRET
      delete process.env.STRIPE_SECRET_KEY
      delete process.env.STRIPE_WEBHOOK_SECRET

      // Need fresh import to pick up missing env
      jest.resetModules()
      const { POST } = require('@/app/api/stripe/webhook/route')
      const req = createWebhookRequest('{}')
      const res = await POST(req as any)

      expect(res.status).toBe(503)
      const data = await res.json()
      expect(data.error).toBe('Billing not configured')

      process.env.STRIPE_SECRET_KEY = savedKey
      process.env.STRIPE_WEBHOOK_SECRET = savedSecret
    })
  })

  describe('Idempotency', () => {
    it('same event twice → no crash, both 200', async () => {
      const event = makeStripeEvent('checkout.session.completed', {
        customer: 'cus_123',
        subscription: 'sub_456',
        customer_details: { email: 'test@ragbox.co' },
        line_items: { data: [{ price: { id: 'price_sovereign_test' } }] },
      })
      mockConstructEvent.mockReturnValue(event)

      const { POST } = require('@/app/api/stripe/webhook/route')

      const res1 = await POST(createWebhookRequest('{}') as any)
      const res2 = await POST(createWebhookRequest('{}') as any)

      expect(res1.status).toBe(200)
      expect(res2.status).toBe(200)
      expect(mockProvisionFromCheckout).toHaveBeenCalledTimes(2)
    })
  })
})
