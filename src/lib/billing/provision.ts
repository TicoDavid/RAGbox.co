/**
 * Stripe webhook provisioning pipeline.
 *
 * Handles the full lifecycle: checkout → user creation → entitlements → email.
 * Designed to be idempotent — safe to call multiple times for the same event.
 */

import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { type BillingTier, getEntitlements, resolveTierFromPriceIds } from './entitlements'
import { welcomeSovereignEmail } from '@/lib/email/templates/welcome-sovereign'
import { welcomeMercuryEmail } from '@/lib/email/templates/welcome-mercury-addon'

export interface ProvisionResult {
  userId: string
  email: string
  tier: BillingTier
  action: 'created' | 'updated'
}

/**
 * Provision a user after successful Stripe checkout.
 * Creates or updates the user record with subscription details and entitlements.
 */
export async function provisionFromCheckout(params: {
  email: string
  stripeCustomerId: string
  stripeSubscriptionId: string
  priceIds: string[]
}): Promise<ProvisionResult> {
  const { email, stripeCustomerId, stripeSubscriptionId, priceIds } = params
  const tier = resolveTierFromPriceIds(priceIds)
  const entitlements = getEntitlements(tier)
  const now = new Date()

  // Upsert: create user if new, update if returning
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: email.split('@')[0],
      subscriptionTier: tier,
      subscriptionStatus: 'active',
      stripeCustomerId,
      stripeSubscriptionId,
      entitlements: entitlements as unknown as Prisma.InputJsonValue,
      subscriptionStartedAt: now,
    },
    update: {
      subscriptionTier: tier,
      subscriptionStatus: 'active',
      stripeCustomerId,
      stripeSubscriptionId,
      entitlements: entitlements as unknown as Prisma.InputJsonValue,
      subscriptionStartedAt: now,
      subscriptionEndsAt: null,
    },
  })

  const action = user.createdAt.getTime() >= now.getTime() - 1000 ? 'created' : 'updated'

  // Send welcome email (log-only until email transport is wired)
  const emailTemplate = tier === 'mercury'
    ? welcomeMercuryEmail({ userName: user.name || email, mercuryName: 'Mercury' })
    : welcomeSovereignEmail({ userName: user.name || email, mercuryName: 'Mercury' })

  console.info('[Billing] Welcome email prepared (send pending transport config):', {
    to: email,
    subject: emailTemplate.subject,
    tier,
  })

  console.info('[Billing] User provisioned:', {
    userId: user.id,
    email,
    tier,
    action,
    entitlements,
  })

  return { userId: user.id, email, tier, action }
}

/**
 * Update entitlements when a subscription changes (upgrade/downgrade).
 */
export async function updateSubscription(params: {
  stripeSubscriptionId: string
  status: 'active' | 'past_due' | 'cancelled'
  priceIds?: string[]
}): Promise<{ userId: string; tier: BillingTier; status: string } | null> {
  const { stripeSubscriptionId, status, priceIds } = params

  const user = await prisma.user.findFirst({
    where: { stripeSubscriptionId },
  })

  if (!user) {
    console.warn('[Billing] No user found for subscription:', stripeSubscriptionId)
    return null
  }

  const tier = priceIds ? resolveTierFromPriceIds(priceIds) : user.subscriptionTier as BillingTier
  const entitlements = getEntitlements(tier)

  const subscriptionStatusMap: Record<string, 'active' | 'past_due' | 'cancelled' | 'inactive'> = {
    active: 'active',
    past_due: 'past_due',
    cancelled: 'cancelled',
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionTier: tier,
      subscriptionStatus: subscriptionStatusMap[status] || 'active',
      entitlements: entitlements as unknown as Prisma.InputJsonValue,
      ...(status === 'cancelled' ? { subscriptionEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } : {}),
    },
  })

  console.info('[Billing] Subscription updated:', {
    userId: user.id,
    tier,
    status,
  })

  return { userId: user.id, tier, status }
}

/**
 * Handle failed payment — set status to past_due.
 */
export async function handlePaymentFailed(params: {
  stripeCustomerId: string
}): Promise<void> {
  const { stripeCustomerId } = params

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId },
  })

  if (!user) {
    console.warn('[Billing] No user found for customer:', stripeCustomerId)
    return
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { subscriptionStatus: 'past_due' },
  })

  console.info('[Billing] Payment failed, status set to past_due:', {
    userId: user.id,
    email: user.email,
  })
}
