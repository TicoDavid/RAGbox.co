/**
 * Billing Sync API
 *
 * POST /api/billing/sync — Sync subscription from Stripe to DB.
 * Used as a fallback when the webhook hasn't updated the user record yet.
 *
 * Accepts optional { sessionId } to retrieve a specific checkout session,
 * otherwise looks up the Stripe customer by email.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import Stripe from 'stripe'
import prisma from '@/lib/prisma'
import { resolveTierFromPriceIds, getEntitlements, type BillingTier } from '@/lib/billing/entitlements'
import { Prisma } from '@prisma/client'

let _stripe: Stripe | null = null

function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  }
  return _stripe
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 })
  }

  const email = token.email as string
  const userId = (token.id as string) || email

  let body: { sessionId?: string } = {}
  try { body = await req.json() } catch { /* empty body is fine */ }

  let tier: BillingTier = 'free'
  let stripeCustomerId: string | null = null
  let stripeSubscriptionId: string | null = null

  // Method 1: Retrieve a specific checkout session by ID
  if (body.sessionId) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(body.sessionId, {
        expand: ['line_items'],
      })
      stripeCustomerId = typeof session.customer === 'string'
        ? session.customer
        : (session.customer as Stripe.Customer | null)?.id || null
      stripeSubscriptionId = typeof session.subscription === 'string'
        ? session.subscription
        : (session.subscription as Stripe.Subscription | null)?.id || null

      const priceIds = session.line_items?.data
        ?.map(item => item.price?.id)
        .filter((id): id is string => Boolean(id)) || []

      if (priceIds.length > 0) {
        tier = resolveTierFromPriceIds(priceIds)
      }
    } catch (err) {
      console.warn('[billing/sync] Failed to retrieve checkout session:', err)
    }
  }

  // Method 2: Look up Stripe customer by email
  if (tier === 'free') {
    try {
      const customers = await getStripe().customers.list({ email, limit: 1 })
      if (customers.data.length > 0) {
        const customer = customers.data[0]
        stripeCustomerId = customer.id

        const subscriptions = await getStripe().subscriptions.list({
          customer: customer.id,
          status: 'active',
          limit: 1,
        })

        if (subscriptions.data.length > 0) {
          const sub = subscriptions.data[0]
          stripeSubscriptionId = sub.id
          const priceIds = sub.items.data
            .map(item => item.price?.id)
            .filter((id): id is string => Boolean(id))
          tier = resolveTierFromPriceIds(priceIds)
        }
      }
    } catch (err) {
      console.warn('[billing/sync] Stripe customer lookup failed:', err)
    }
  }

  // Update DB if we found a paid subscription
  if (tier !== 'free') {
    const entitlements = getEntitlements(tier)
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionTier: tier as never,
          subscriptionStatus: 'active',
          ...(stripeCustomerId ? { stripeCustomerId } : {}),
          ...(stripeSubscriptionId ? { stripeSubscriptionId } : {}),
          entitlements: entitlements as unknown as Prisma.InputJsonValue,
        },
      })
      console.info('[billing/sync] User subscription synced:', { userId, email, tier })
    } catch (err) {
      console.error('[billing/sync] DB update failed:', err)
    }
  }

  return NextResponse.json({ tier })
}
