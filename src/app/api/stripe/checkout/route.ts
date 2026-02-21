import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

let _stripe: Stripe | null = null

function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  }
  return _stripe
}

function getPrices(): Record<string, string[]> {
  return {
    sovereign: [process.env.STRIPE_PRICE_SOVEREIGN!],
    sovereign_mercury: [
      process.env.STRIPE_PRICE_SOVEREIGN!,
      process.env.STRIPE_PRICE_MERCURY!,
    ],
  }
}

export async function POST(req: NextRequest) {
  const { plan } = (await req.json()) as { plan: string }
  const priceIds = getPrices()[plan]
  if (!priceIds) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    line_items: priceIds.map((price) => ({ price, quantity: 1 })),
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?checkout=cancel`,
  })

  return NextResponse.json({ url: session.url })
}
