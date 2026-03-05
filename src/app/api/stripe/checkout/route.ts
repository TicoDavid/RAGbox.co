import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

let _stripe: Stripe | null = null

function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  }
  return _stripe
}

function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://app.ragbox.co'
}

function getPrices(): Record<string, string[]> {
  const prices: Record<string, string[]> = {
    starter: [process.env.STRIPE_PRICE_STARTER!],
    professional: [process.env.STRIPE_PRICE_PROFESSIONAL || process.env.STRIPE_PRICE_MERCURY!],
    enterprise: [process.env.STRIPE_PRICE_ENTERPRISE!],
  }
  if (process.env.STRIPE_PRICE_SOVEREIGN) {
    prices.sovereign = [process.env.STRIPE_PRICE_SOVEREIGN]
  }
  return prices
}

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 })
  }

  const { plan } = (await req.json()) as { plan: string }
  const priceIds = getPrices()[plan]
  if (!priceIds) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const validPrices = priceIds.filter(Boolean)
  if (validPrices.length === 0) {
    return NextResponse.json({ error: 'Price not configured for this plan' }, { status: 503 })
  }

  try {
    const appUrl = getAppUrl()
    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: validPrices.map((price) => ({ price, quantity: 1 })),
      success_url: `${appUrl}/dashboard?checkout=success`,
      cancel_url: `${appUrl}/onboarding/plan?checkout=cancel`,
      metadata: { plan },
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Checkout session creation failed'
    console.error('[stripe/checkout] Error creating session:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
