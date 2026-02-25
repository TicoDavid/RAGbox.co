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

  const validTiers: BillingTier[] = ['starter', 'professional', 'enterprise', 'sovereign']
  if (!validTiers.includes(tier as BillingTier)) {
    return NextResponse.json(
      { error: `Invalid tier. Must be one of: ${validTiers.join(', ')}` },
      { status: 400 },
    )
  }

  // Build fake price IDs that will resolve to the correct tier
  const fakePriceIds: string[] = []
  const starterPrice = process.env.STRIPE_PRICE_STARTER || 'price_simulated_starter'
  const professionalPrice = process.env.STRIPE_PRICE_PROFESSIONAL || 'price_simulated_professional'
  const enterprisePrice = process.env.STRIPE_PRICE_ENTERPRISE || 'price_simulated_enterprise'
  const sovereignPrice = process.env.STRIPE_PRICE_SOVEREIGN || 'price_simulated_sovereign'

  if (tier === 'starter') fakePriceIds.push(starterPrice)
  else if (tier === 'professional') fakePriceIds.push(professionalPrice)
  else if (tier === 'enterprise') fakePriceIds.push(enterprisePrice)
  else if (tier === 'sovereign') fakePriceIds.push(sovereignPrice)

  const result = await provisionFromCheckout({
    email,
    stripeCustomerId: `cus_simulated_${Date.now()}`,
    stripeSubscriptionId: `sub_simulated_${Date.now()}`,
    priceIds: fakePriceIds,
  })

  // For enterprise/sovereign, override the tier since they're sales-led and not price-mapped
  if (tier === 'enterprise' || tier === 'sovereign') {
    const { default: prisma } = await import('@/lib/prisma')
    const entitlements = getEntitlements(tier)
    await prisma.user.update({
      where: { id: result.userId },
      data: {
        subscriptionTier: tier,
        entitlements: entitlements as unknown as Prisma.InputJsonValue,
      },
    })
    result.tier = tier
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
