/**
 * EPIC-011 STORY-120 Block 2: Stripe Provisioning Tests
 *
 * Test webhook event handling: checkout, subscription lifecycle,
 * signature validation, and idempotency.
 *
 * — Sarah, Engineering
 */
export {} // Module isolation — avoid TS2393 with other test files

// ── Mocks ────────────────────────────────────────────────────────

const mockProvisionFromCheckout = jest.fn()
const mockUpdateSubscription = jest.fn()
const mockHandlePaymentFailed = jest.fn()
const mockSendInvoiceEmail = jest.fn()

jest.mock('@/lib/billing/provision', () => ({
  provisionFromCheckout: (...args: unknown[]) => mockProvisionFromCheckout(...args),
  updateSubscription: (...args: unknown[]) => mockUpdateSubscription(...args),
  handlePaymentFailed: (...args: unknown[]) => mockHandlePaymentFailed(...args),
  sendInvoiceEmail: (...args: unknown[]) => mockSendInvoiceEmail(...args),
}))

const mockConstructEvent = jest.fn()
const mockRetrieveSubscription = jest.fn()

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
    },
    subscriptions: {
      retrieve: (...args: unknown[]) => mockRetrieveSubscription(...args),
    },
  }))
})

// Set env before importing route
process.env.STRIPE_SECRET_KEY = 'sk_test_123'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_456'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('@/app/api/stripe/webhook/route')

function makeRequest(body: string, sig = 'valid-sig'): Request {
  return new Request('http://localhost:3000/api/stripe/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': sig,
    },
    body,
  })
}

describe('Stripe Webhook Provisioning', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockProvisionFromCheckout.mockResolvedValue({
      userId: 'user-1', email: 'user@test.com', tier: 'sovereign', action: 'created',
    })
    mockUpdateSubscription.mockResolvedValue({
      userId: 'user-1', tier: 'sovereign', status: 'active',
    })
    mockHandlePaymentFailed.mockResolvedValue(undefined)
    mockSendInvoiceEmail.mockResolvedValue(undefined)
  })

  it('checkout.session.completed → provisions tenant with correct tier', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          customer_details: { email: 'user@test.com' },
          customer: 'cus_test_123',
          subscription: 'sub_test_456',
          line_items: {
            data: [{ price: { id: 'price_sovereign_monthly' } }],
          },
        },
      },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)

    expect(mockProvisionFromCheckout).toHaveBeenCalledWith({
      email: 'user@test.com',
      stripeCustomerId: 'cus_test_123',
      stripeSubscriptionId: 'sub_test_456',
      priceIds: ['price_sovereign_monthly'],
    })
  })

  it('customer.subscription.updated → tier changes applied', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_test_456',
          status: 'active',
          items: {
            data: [{ price: { id: 'price_mercury_monthly' } }],
          },
        },
      },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)

    expect(mockUpdateSubscription).toHaveBeenCalledWith({
      stripeSubscriptionId: 'sub_test_456',
      status: 'active',
      priceIds: ['price_mercury_monthly'],
    })
  })

  it('customer.subscription.deleted → tenant downgraded/cancelled', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_test_456',
          status: 'canceled',
          items: { data: [] },
        },
      },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)

    expect(mockUpdateSubscription).toHaveBeenCalledWith({
      stripeSubscriptionId: 'sub_test_456',
      status: 'cancelled',
    })
  })

  it('rejects invalid webhook signature with 400', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Signature verification failed')
    })

    const res = await POST(makeRequest('{}', 'bad-sig'))
    expect(res.status).toBe(400)

    const json = await res.json()
    expect(json.error).toBe('Invalid signature')

    // No provisioning should happen
    expect(mockProvisionFromCheckout).not.toHaveBeenCalled()
  })

  it('duplicate checkout is idempotent — provisionFromCheckout handles upsert', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          customer_details: { email: 'user@test.com' },
          customer: 'cus_test_123',
          subscription: 'sub_test_456',
          line_items: { data: [{ price: { id: 'price_sovereign_monthly' } }] },
        },
      },
    })

    // First call
    const res1 = await POST(makeRequest('{}'))
    expect(res1.status).toBe(200)

    // Second call (duplicate) — should succeed without error
    mockProvisionFromCheckout.mockResolvedValue({
      userId: 'user-1', email: 'user@test.com', tier: 'sovereign', action: 'updated',
    })
    const res2 = await POST(makeRequest('{}'))
    expect(res2.status).toBe(200)

    // Both calls trigger provisionFromCheckout (idempotent upsert)
    expect(mockProvisionFromCheckout).toHaveBeenCalledTimes(2)
  })

  it('returns 503 when Stripe is not configured', async () => {
    const originalKey = process.env.STRIPE_SECRET_KEY
    delete process.env.STRIPE_SECRET_KEY

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(503)

    const json = await res.json()
    expect(json.error).toBe('Billing not configured')

    process.env.STRIPE_SECRET_KEY = originalKey
  })
})
