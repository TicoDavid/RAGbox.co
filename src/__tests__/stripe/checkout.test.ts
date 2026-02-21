/**
 * Stripe Checkout Route Tests
 *
 * Tests the /api/stripe/checkout endpoint — plan validation, session creation,
 * and price configuration.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
export {}

// ─── Mock Stripe SDK ────────────────────────────────────────────────────────
const mockCreate = jest.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test' })

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: { create: mockCreate },
    },
  }))
})

// ─── Mock NextRequest / NextResponse ────────────────────────────────────────
// We test the route handler function directly

// Set env vars before importing route
const ORIGINAL_ENV = process.env
beforeAll(() => {
  process.env = {
    ...ORIGINAL_ENV,
    STRIPE_SECRET_KEY: 'sk_test_fake',
    STRIPE_PRICE_SOVEREIGN: 'price_sovereign_test',
    STRIPE_PRICE_MERCURY: 'price_mercury_test',
    NEXT_PUBLIC_APP_URL: 'https://app.ragbox.co',
  }
})

afterAll(() => {
  process.env = ORIGINAL_ENV
})

beforeEach(() => {
  mockCreate.mockClear()
})

// ─── Import the PRICES map and POST handler ─────────────────────────────────
// We dynamically require to get the module after env vars are set

function createMockRequest(body: unknown): { json: () => Promise<unknown> } {
  return {
    json: async () => body,
  }
}

describe('Stripe Checkout', () => {
  // ─── 2.1 Checkout Route (5 tests) ──────────────────────────────────────

  describe('2.1 Checkout Route', () => {
    it('POST with plan: "sovereign" → creates session with 1 line item', async () => {
      // Import fresh module
      const { POST } = require('@/app/api/stripe/checkout/route')
      const req = createMockRequest({ plan: 'sovereign' })
      const res = await POST(req as any)
      const data = await res.json()

      expect(data.url).toBe('https://checkout.stripe.com/test')
      expect(mockCreate).toHaveBeenCalledTimes(1)

      const createArgs = mockCreate.mock.calls[0][0]
      expect(createArgs.mode).toBe('subscription')
      expect(createArgs.line_items).toHaveLength(1)
      expect(createArgs.line_items[0].price).toBe('price_sovereign_test')
    })

    it('POST with plan: "sovereign_mercury" → creates session with 2 line items', async () => {
      const { POST } = require('@/app/api/stripe/checkout/route')
      const req = createMockRequest({ plan: 'sovereign_mercury' })
      const res = await POST(req as any)
      const data = await res.json()

      expect(data.url).toBe('https://checkout.stripe.com/test')
      const createArgs = mockCreate.mock.calls[0][0]
      expect(createArgs.line_items).toHaveLength(2)
      expect(createArgs.line_items[0].price).toBe('price_sovereign_test')
      expect(createArgs.line_items[1].price).toBe('price_mercury_test')
    })

    it('POST with plan: "invalid" → 400 {error: "Invalid plan"}', async () => {
      const { POST } = require('@/app/api/stripe/checkout/route')
      const req = createMockRequest({ plan: 'invalid' })
      const res = await POST(req as any)

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('Invalid plan')
    })

    it('POST with no body → error (not crash)', async () => {
      const { POST } = require('@/app/api/stripe/checkout/route')
      const req = { json: async () => ({ }) }

      // Empty object = no plan field → should return 400
      const res = await POST(req as any)
      expect(res.status).toBe(400)
    })

    it('POST with plan: "syndicate" → 400 (Syndicate is sales-led)', async () => {
      const { POST } = require('@/app/api/stripe/checkout/route')
      const req = createMockRequest({ plan: 'syndicate' })
      const res = await POST(req as any)

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('Invalid plan')
    })
  })

  // ─── 2.3 Price Configuration (3 tests) ────────────────────────────────

  describe('2.3 Price Configuration', () => {
    it('sovereign plan maps to exactly 1 price ID', async () => {
      const { POST } = require('@/app/api/stripe/checkout/route')
      const req = createMockRequest({ plan: 'sovereign' })
      await POST(req as any)

      const items = mockCreate.mock.calls[0][0].line_items
      expect(items).toHaveLength(1)
    })

    it('sovereign_mercury plan maps to exactly 2 price IDs', async () => {
      const { POST } = require('@/app/api/stripe/checkout/route')
      const req = createMockRequest({ plan: 'sovereign_mercury' })
      await POST(req as any)

      const items = mockCreate.mock.calls[0][0].line_items
      expect(items).toHaveLength(2)
    })

    it('syndicate key does not exist in PRICES (enterprise is manual)', async () => {
      const { POST } = require('@/app/api/stripe/checkout/route')
      const req = createMockRequest({ plan: 'syndicate' })
      const res = await POST(req as any)

      // If syndicate existed, it would create a session (200). Since it doesn't → 400
      expect(res.status).toBe(400)
    })
  })
})
