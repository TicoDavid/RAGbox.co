/**
 * Simulate Checkout — Dev/Test Only
 *
 * Runs the full provisioning pipeline with fake Stripe data.
 * Blocked in production unless explicitly enabled via env var.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { provisionFromCheckout } from '@/lib/billing/provision'
import { type BillingTier, TIER_ENTITLEMENTS, getEntitlements } from '@/lib/billing/entitlements'

export async function POST(req: NextRequest) {
  // STORY-S03: Gate 1 — require env var (return 404 to hide endpoint in production)
  if (process.env.ENABLE_BILLING_SIMULATION !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // STORY-S03: Gate 2 — require authenticated session
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as { tier?: string; email?: string }
  const { tier, email } = body

  if (!tier || !email) {
    return NextResponse.json(
      { error: 'Missing required fields: tier, email' },
      { status: 400 },
    )
  }

  const validTiers: BillingTier[] = ['sovereign', 'mercury', 'syndicate']
  if (!validTiers.includes(tier as BillingTier)) {
    return NextResponse.json(
      { error: `Invalid tier. Must be one of: ${validTiers.join(', ')}` },
      { status: 400 },
    )
  }

  // Build fake price IDs that will resolve to the correct tier
  const fakePriceIds: string[] = []
  const sovereignPrice = process.env.STRIPE_PRICE_SOVEREIGN || 'price_simulated_sovereign'
  const mercuryPrice = process.env.STRIPE_PRICE_MERCURY || 'price_simulated_mercury'

  if (tier === 'sovereign' || tier === 'mercury' || tier === 'syndicate') {
    fakePriceIds.push(sovereignPrice)
  }
  if (tier === 'mercury') {
    fakePriceIds.push(mercuryPrice)
  }

  const result = await provisionFromCheckout({
    email,
    stripeCustomerId: `cus_simulated_${Date.now()}`,
    stripeSubscriptionId: `sub_simulated_${Date.now()}`,
    priceIds: fakePriceIds,
  })

  // For syndicate, override the tier since it's sales-led and not price-mapped
  if (tier === 'syndicate') {
    const { default: prisma } = await import('@/lib/prisma')
    const entitlements = getEntitlements('syndicate')
    await prisma.user.update({
      where: { id: result.userId },
      data: {
        subscriptionTier: 'syndicate',
        entitlements: entitlements as unknown as Prisma.InputJsonValue,
      },
    })
    result.tier = 'syndicate'
  }

  return NextResponse.json({
    user: {
      id: result.userId,
      email: result.email,
      tier: result.tier,
      action: result.action,
    },
    entitlements: TIER_ENTITLEMENTS[result.tier],
    status: 'provisioned',
  })
}
