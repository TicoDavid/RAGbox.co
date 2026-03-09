/**
 * POST /api/webhooks/stripe — Stripe webhook handler.
 * EPIC-031 E31-003
 *
 * CRITICAL: Raw body parsing required for signature verification.
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import prisma from '@/lib/prisma'
import { normalizeTier } from '@/lib/billing/entitlements'

export const runtime = 'nodejs'

/**
 * Map Stripe price ID → DB subscription_tier enum value.
 * Reads env vars inside function (Cloud Run secret gotcha).
 */
function priceIdToTier(priceId: string): string {
  const map: Record<string, string> = {}

  // Monthly + Annual variants
  const pairs: [string, string][] = [
    ['STRIPE_PRICE_STARTER_MONTHLY', 'starter'],
    ['STRIPE_PRICE_STARTER_ANNUAL', 'starter'],
    ['STRIPE_PRICE_PRO_MONTHLY', 'professional'],
    ['STRIPE_PRICE_PRO_ANNUAL', 'professional'],
    ['STRIPE_PRICE_BUSINESS_MONTHLY', 'business'],
    ['STRIPE_PRICE_BUSINESS_ANNUAL', 'business'],
    ['STRIPE_PRICE_VREP_MONTHLY', 'vrep'],
    ['STRIPE_PRICE_VREP_ANNUAL', 'vrep'],
    ['STRIPE_PRICE_AITEAM_MONTHLY', 'aiteam'],
    ['STRIPE_PRICE_AITEAM_ANNUAL', 'aiteam'],
    // Legacy single-price env vars
    ['STRIPE_PRICE_STARTER', 'starter'],
    ['STRIPE_PRICE_PROFESSIONAL', 'professional'],
    ['STRIPE_PRICE_ENTERPRISE', 'enterprise'],
    ['STRIPE_PRICE_SOVEREIGN', 'sovereign'],
  ]

  for (const [envKey, tier] of pairs) {
    const val = (process.env[envKey] || '').trim()
    if (val) map[val] = tier
  }

  return map[priceId] || 'free'
}

/**
 * Map Stripe subscription status → DB subscription_status enum value.
 */
function mapStripeStatus(status: string): string {
  switch (status) {
    case 'active': return 'active'
    case 'past_due': return 'past_due'
    case 'canceled':
    case 'unpaid': return 'cancelled'
    case 'trialing': return 'trialing'
    case 'incomplete':
    case 'incomplete_expired': return 'incomplete'
    default: return 'active'
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const stripeKey = (process.env.STRIPE_SECRET_KEY || '').trim()
  const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim()

  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  const stripe = new Stripe(stripeKey)

  // Read raw body — do NOT call req.json()
  const rawBody = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid signature'
    return NextResponse.json({ error: `Webhook signature verification failed: ${msg}` }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(stripe, event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break

      default:
        // Unhandled event type — acknowledge
        break
    }
  } catch (err) {
    console.error(`Webhook handler error for ${event.type}:`, err)
    // Return 200 to prevent Stripe retries for handler errors
  }

  return NextResponse.json({ received: true })
}

async function handleCheckoutCompleted(stripe: Stripe, session: Stripe.Checkout.Session) {
  const subscriptionId = session.subscription as string
  if (!subscriptionId) return

  const subResponse = await stripe.subscriptions.retrieve(subscriptionId)
  const subscription = subResponse as unknown as Stripe.Subscription
  const customerId = subscription.customer as string
  const priceId = subscription.items.data[0]?.price?.id || ''
  const tier = priceIdToTier(priceId)
  const ragboxUserId = subscription.metadata?.ragboxUserId ||
    session.metadata?.ragboxUserId || ''

  if (!ragboxUserId) {
    console.error('checkout.session.completed: missing ragboxUserId in metadata')
    return
  }

  const periodStart = (subscription as any).current_period_start
  const periodEnd = (subscription as any).current_period_end

  // Upsert UserSubscription
  await (prisma as any).userSubscription.upsert({
    where: { userId: ragboxUserId },
    create: {
      userId: ragboxUserId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: priceId,
      tier,
      status: mapStripeStatus(subscription.status),
      currentPeriodStart: periodStart ? new Date(periodStart * 1000) : null,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    update: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: priceId,
      tier,
      status: mapStripeStatus(subscription.status),
      currentPeriodStart: periodStart ? new Date(periodStart * 1000) : null,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  })

  // Sync User.subscriptionTier
  await prisma.user.updateMany({
    where: { id: ragboxUserId },
    data: {
      subscriptionTier: tier as never,
      subscriptionStatus: 'active' as never,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
    },
  })
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string
  const priceId = subscription.items.data[0]?.price?.id || ''
  const tier = priceIdToTier(priceId)
  const status = mapStripeStatus(subscription.status)
  const periodStart = (subscription as any).current_period_start
  const periodEnd = (subscription as any).current_period_end

  const userSub = await (prisma as any).userSubscription.findUnique({
    where: { stripeCustomerId: customerId },
    select: { userId: true },
  })

  if (!userSub) return

  await (prisma as any).userSubscription.update({
    where: { stripeCustomerId: customerId },
    data: {
      stripePriceId: priceId,
      tier,
      status,
      currentPeriodStart: periodStart ? new Date(periodStart * 1000) : null,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  })

  // Sync User.subscriptionTier
  await prisma.user.update({
    where: { id: userSub.userId },
    data: {
      subscriptionTier: tier as never,
      subscriptionStatus: status as never,
    },
  })
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string

  const userSub = await (prisma as any).userSubscription.findUnique({
    where: { stripeCustomerId: customerId },
    select: { userId: true },
  })

  if (!userSub) return

  await (prisma as any).userSubscription.update({
    where: { stripeCustomerId: customerId },
    data: {
      tier: 'free',
      status: 'cancelled',
      stripeSubscriptionId: null,
      stripePriceId: null,
      cancelAtPeriodEnd: false,
    },
  })

  // Downgrade User to Free
  await prisma.user.update({
    where: { id: userSub.userId },
    data: {
      subscriptionTier: 'free' as never,
      subscriptionStatus: 'cancelled' as never,
    },
  })
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string
  if (!customerId) return

  const userSub = await (prisma as any).userSubscription.findUnique({
    where: { stripeCustomerId: customerId as string },
    select: { userId: true },
  })

  if (!userSub) return

  // Set to PastDue — do NOT downgrade yet (Stripe retries automatically)
  await (prisma as any).userSubscription.update({
    where: { stripeCustomerId: customerId as string },
    data: { status: 'past_due' },
  })

  await prisma.user.update({
    where: { id: userSub.userId },
    data: { subscriptionStatus: 'past_due' as never },
  })

  console.error('invoice.payment_failed', {
    customerId,
    userId: userSub.userId,
    invoiceId: invoice.id,
  })
}
