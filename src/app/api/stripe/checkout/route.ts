import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const PRICES: Record<string, string[]> = {
  sovereign: [process.env.STRIPE_PRICE_SOVEREIGN!],
  sovereign_mercury: [
    process.env.STRIPE_PRICE_SOVEREIGN!,
    process.env.STRIPE_PRICE_MERCURY!,
  ],
}

export async function POST(req: NextRequest) {
  const { plan } = (await req.json()) as { plan: string }
  const priceIds = PRICES[plan]
  if (!priceIds) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: priceIds.map((price) => ({ price, quantity: 1 })),
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?checkout=cancel`,
  })

  return NextResponse.json({ url: session.url })
}
