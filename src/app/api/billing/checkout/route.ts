/**
 * POST /api/billing/checkout — Create a Stripe Checkout Session.
 * EPIC-031 E31-002
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import Stripe from 'stripe'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Read secrets inside handler (Cloud Run secret gotcha)
  const stripeKey = (process.env.STRIPE_SECRET_KEY || '').trim()
  if (!stripeKey) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''
  const userEmail = (token.email as string) || ''

  // Build valid price ID set inside handler
  const validPriceIds = new Set(
    [
      process.env.STRIPE_PRICE_STARTER_MONTHLY,
      process.env.STRIPE_PRICE_STARTER_ANNUAL,
      process.env.STRIPE_PRICE_PRO_MONTHLY,
      process.env.STRIPE_PRICE_PRO_ANNUAL,
      process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
      process.env.STRIPE_PRICE_BUSINESS_ANNUAL,
      process.env.STRIPE_PRICE_VREP_MONTHLY,
      process.env.STRIPE_PRICE_VREP_ANNUAL,
      process.env.STRIPE_PRICE_AITEAM_MONTHLY,
      process.env.STRIPE_PRICE_AITEAM_ANNUAL,
      // Legacy single-price env vars
      process.env.STRIPE_PRICE_STARTER,
      process.env.STRIPE_PRICE_PROFESSIONAL,
      process.env.STRIPE_PRICE_ENTERPRISE,
      process.env.STRIPE_PRICE_SOVEREIGN,
    ].filter(Boolean) as string[],
  )

  let body: { priceId?: string; successUrl?: string; cancelUrl?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { priceId } = body
  if (!priceId || !validPriceIds.has(priceId)) {
    return NextResponse.json({ error: 'Invalid or missing priceId' }, { status: 400 })
  }

  const stripe = new Stripe(stripeKey)

  try {
    // Get or create Stripe customer
    let stripeCustomerId: string | undefined

    const userSub = await (prisma as any).userSubscription.findUnique({
      where: { userId },
      select: { stripeCustomerId: true },
    })

    if (userSub?.stripeCustomerId) {
      stripeCustomerId = userSub.stripeCustomerId
    } else {
      // Check User model fallback
      const user = await prisma.user.findFirst({
        where: { OR: [{ id: userId }, { email: userEmail }] },
        select: { stripeCustomerId: true },
      })

      if (user?.stripeCustomerId) {
        stripeCustomerId = user.stripeCustomerId
      } else {
        // Create new Stripe customer
        const customer = await stripe.customers.create({
          email: userEmail,
          metadata: { ragboxUserId: userId },
        })
        stripeCustomerId = customer.id

        // Store on User record
        await prisma.user.updateMany({
          where: { OR: [{ id: userId }, { email: userEmail }] },
          data: { stripeCustomerId: customer.id },
        })
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://app.ragbox.co'
    const successUrl = body.successUrl || `${appUrl}/dashboard/settings?billing=success`
    const cancelUrl = body.cancelUrl || `${appUrl}/pricing?canceled=true`

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      subscription_data: {
        metadata: { ragboxUserId: userId },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Checkout session failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
