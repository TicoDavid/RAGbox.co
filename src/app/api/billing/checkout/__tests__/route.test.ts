/**
 * Sarah — EPIC-031 T1: Checkout Route Tests
 *
 * POST /api/billing/checkout — Stripe Checkout Session creation.
 * Mocks: Stripe SDK, next-auth/jwt, @/lib/prisma
 */

// ── Mocks ────────────────────────────────────────────────────────

const mockGetToken = jest.fn()
jest.mock('next-auth/jwt', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
}))

const mockSessionCreate = jest.fn()
const mockCustomerCreate = jest.fn()
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: { sessions: { create: mockSessionCreate } },
    customers: { create: mockCustomerCreate },
  }))
})

const mockUserSubFindUnique = jest.fn()
const mockUserFindFirst = jest.fn()
const mockUserUpdateMany = jest.fn()

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    userSubscription: {
      findUnique: (...args: unknown[]) => mockUserSubFindUnique(...args),
    },
    user: {
      findFirst: (...args: unknown[]) => mockUserFindFirst(...args),
      updateMany: (...args: unknown[]) => mockUserUpdateMany(...args),
    },
  },
}))

// ── Imports ──────────────────────────────────────────────────────

import { NextRequest } from 'next/server'
import { POST } from '../route'

// ── Setup ────────────────────────────────────────────────────────

const ORIGINAL_ENV = process.env

beforeEach(() => {
  jest.clearAllMocks()
  process.env = {
    ...ORIGINAL_ENV,
    STRIPE_SECRET_KEY: 'sk_test_fake',
    STRIPE_PRICE_STARTER_MONTHLY: 'price_starter_m',
    STRIPE_PRICE_PRO_MONTHLY: 'price_pro_m',
    STRIPE_PRICE_BUSINESS_MONTHLY: 'price_biz_m',
    NEXT_PUBLIC_APP_URL: 'https://app.ragbox.co',
  }
  mockGetToken.mockResolvedValue({ id: 'user-1', email: 'test@test.com' })
  mockSessionCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session123' })
  mockUserSubFindUnique.mockResolvedValue(null)
  mockUserFindFirst.mockResolvedValue(null)
  mockCustomerCreate.mockResolvedValue({ id: 'cus_new123' })
  mockUserUpdateMany.mockResolvedValue({ count: 1 })
})

afterAll(() => {
  process.env = ORIGINAL_ENV
})

function buildRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Tests ────────────────────────────────────────────────────────

describe('Sarah — EPIC-031 T1: POST /api/billing/checkout', () => {
  test('returns 500 when STRIPE_SECRET_KEY is not set', async () => {
    process.env.STRIPE_SECRET_KEY = ''

    const res = await POST(buildRequest({ priceId: 'price_starter_m' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Stripe not configured')
  })

  test('returns 401 when not authenticated', async () => {
    mockGetToken.mockResolvedValue(null)

    const res = await POST(buildRequest({ priceId: 'price_starter_m' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Authentication required')
  })

  test('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json at all{{{',
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid JSON body')
  })

  test('returns 400 when priceId is missing', async () => {
    const res = await POST(buildRequest({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid or missing priceId')
  })

  test('returns 400 when priceId is not in valid set', async () => {
    const res = await POST(buildRequest({ priceId: 'price_unknown_xyz' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid or missing priceId')
  })

  test('creates Stripe checkout session with valid priceId', async () => {
    const res = await POST(buildRequest({ priceId: 'price_starter_m' }))
    expect(res.status).toBe(200)

    expect(mockSessionCreate).toHaveBeenCalledTimes(1)
    const args = mockSessionCreate.mock.calls[0][0]
    expect(args.mode).toBe('subscription')
    expect(args.line_items).toEqual([{ price: 'price_starter_m', quantity: 1 }])
    expect(args.allow_promotion_codes).toBe(true)
  })

  test('returns checkout URL on success', async () => {
    const res = await POST(buildRequest({ priceId: 'price_starter_m' }))
    const body = await res.json()
    expect(body.url).toBe('https://checkout.stripe.com/session123')
  })

  test('reuses existing stripeCustomerId from UserSubscription', async () => {
    mockUserSubFindUnique.mockResolvedValue({ stripeCustomerId: 'cus_existing_sub' })

    await POST(buildRequest({ priceId: 'price_starter_m' }))

    const args = mockSessionCreate.mock.calls[0][0]
    expect(args.customer).toBe('cus_existing_sub')
    expect(mockCustomerCreate).not.toHaveBeenCalled()
  })

  test('reuses existing stripeCustomerId from User model', async () => {
    mockUserSubFindUnique.mockResolvedValue(null)
    mockUserFindFirst.mockResolvedValue({ stripeCustomerId: 'cus_existing_user' })

    await POST(buildRequest({ priceId: 'price_pro_m' }))

    const args = mockSessionCreate.mock.calls[0][0]
    expect(args.customer).toBe('cus_existing_user')
    expect(mockCustomerCreate).not.toHaveBeenCalled()
  })

  test('creates new Stripe customer when none exists', async () => {
    mockUserSubFindUnique.mockResolvedValue(null)
    mockUserFindFirst.mockResolvedValue(null)

    await POST(buildRequest({ priceId: 'price_biz_m' }))

    expect(mockCustomerCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'test@test.com',
        metadata: { ragboxUserId: 'user-1' },
      }),
    )
    expect(mockUserUpdateMany).toHaveBeenCalled()
  })

  test('returns 500 on Stripe API error', async () => {
    mockSessionCreate.mockRejectedValue(new Error('Stripe rate limit exceeded'))

    const res = await POST(buildRequest({ priceId: 'price_starter_m' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Stripe rate limit exceeded')
  })
})
