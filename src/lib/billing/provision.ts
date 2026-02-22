/**
 * Stripe webhook provisioning pipeline.
 *
 * Handles the full lifecycle: checkout → user creation → tenant → vault → email.
 * Designed to be idempotent — safe to call multiple times for the same event.
 */

import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { type BillingTier, getEntitlements, resolveTierFromPriceIds } from './entitlements'
import { welcomeSovereignEmail } from '@/lib/email/templates/welcome-sovereign'
import { welcomeMercuryEmail } from '@/lib/email/templates/welcome-mercury-addon'
import { isGmailConfigured, sendViaGmail } from '@/lib/email/gmail'
import { writeAuditEntry } from '@/lib/audit/auditWriter'

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

  // Create tenant record (idempotent — upsert by slug)
  const slug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9-]/g, '-')
  await prisma.tenant.upsert({
    where: { slug },
    create: {
      name: user.name || slug,
      slug,
    },
    update: {},
  })

  // Create default vault for user (only if none exist)
  const existingVaults = await prisma.vault.count({ where: { userId: user.id } })
  if (existingVaults === 0) {
    await prisma.vault.create({
      data: {
        name: 'My Vault',
        userId: user.id,
        status: 'open',
      },
    })
  }

  // Audit trail
  writeAuditEntry(user.id, 'billing.provision', user.id, {
    tier,
    action,
    stripeCustomerId,
  }).catch(() => {}) // fire-and-forget

  // Send welcome email
  const emailTemplate = tier === 'mercury'
    ? welcomeMercuryEmail({ userName: user.name || email, mercuryName: 'Mercury' })
    : welcomeSovereignEmail({ userName: user.name || email, mercuryName: 'Mercury' })

  if (isGmailConfigured()) {
    sendViaGmail(email, emailTemplate.subject, emailTemplate.html)
      .then((res) => console.info('[Billing] Welcome email sent:', { to: email, messageId: res.id }))
      .catch((err) => console.error('[Billing] Welcome email failed:', err))
  } else {
    console.info('[Billing] Welcome email skipped (Gmail not configured):', {
      to: email,
      subject: emailTemplate.subject,
    })
  }

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

/**
 * Send invoice receipt email after Stripe invoice.paid event.
 */
export async function sendInvoiceEmail(params: {
  email: string
  amountCents: number
  invoiceUrl?: string
}): Promise<void> {
  const { email, amountCents, invoiceUrl } = params
  const { invoicePaidEmail } = await import('@/lib/email/templates/invoice-paid')

  const amountFormatted = `$${(amountCents / 100).toFixed(2)}`
  const template = invoicePaidEmail({ amountFormatted, invoiceUrl })

  if (isGmailConfigured()) {
    const res = await sendViaGmail(email, template.subject, template.html)
    console.info('[Billing] Invoice email sent:', { to: email, messageId: res.id })
  } else {
    console.info('[Billing] Invoice email skipped (Gmail not configured):', { to: email })
  }
}
