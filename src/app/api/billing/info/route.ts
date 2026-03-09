/**
 * GET /api/billing/info — Returns billing info, usage, and invoices.
 * EPIC-031 E31-005
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import Stripe from 'stripe'
import prisma from '@/lib/prisma'
import { normalizeTier } from '@/lib/billing/entitlements'
import { TIER_LIMITS } from '@/lib/billing/tierEnforcement'

interface SubRecord {
  tier: string
  status: string
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  stripeCustomerId: string
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''

  const user = await prisma.user.findFirst({
    where: { OR: [{ id: userId }, { email: token.email as string }] },
    select: {
      id: true,
      subscriptionTier: true,
      stripeCustomerId: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Query UserSubscription separately (model may not be in generated client yet)
  let userSub: SubRecord | null = null
  try {
    userSub = await (prisma as any).userSubscription.findUnique({
      where: { userId: user.id },
      select: {
        tier: true,
        status: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        stripeCustomerId: true,
      },
    })
  } catch {
    // Table may not exist yet — fall back to User fields
  }

  const tier = normalizeTier(userSub?.tier || user.subscriptionTier || 'free')
  const status = userSub?.status || 'active'
  const currentPeriodEnd = userSub?.currentPeriodEnd || null
  const cancelAtPeriodEnd = userSub?.cancelAtPeriodEnd || false
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free
  const actualUserId = user.id

  // Compute usage in parallel
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [docCount, vaultAgg, queryCount] = await Promise.all([
    prisma.document.count({
      where: { userId: actualUserId, deletionStatus: 'Active' },
    }),
    prisma.document.aggregate({
      where: { userId: actualUserId, deletionStatus: 'Active' },
      _sum: { sizeBytes: true },
    }),
    prisma.query.count({
      where: { userId: actualUserId, createdAt: { gte: monthStart } },
    }),
  ])

  const vaultSizeMB = Math.round(Number(vaultAgg._sum.sizeBytes ?? 0) / (1024 * 1024))

  // Fetch invoices from Stripe if customer exists
  const invoices: Array<{
    id: string
    date: string
    amount: number
    status: string | null
    pdfUrl: string | null
  }> = []

  const stripeCustomerId = userSub?.stripeCustomerId || user.stripeCustomerId
  if (stripeCustomerId) {
    const stripeKey = (process.env.STRIPE_SECRET_KEY || '').trim()
    if (stripeKey) {
      try {
        const stripe = new Stripe(stripeKey)
        const invoiceList = await stripe.invoices.list({
          customer: stripeCustomerId,
          limit: 12,
        })
        for (const inv of invoiceList.data) {
          invoices.push({
            id: inv.id,
            date: new Date((inv.created || 0) * 1000).toISOString(),
            amount: (inv.amount_paid || 0) / 100,
            status: inv.status ?? null,
            pdfUrl: inv.invoice_pdf ?? null,
          })
        }
      } catch {
        // Non-fatal — return empty invoices
      }
    }
  }

  return NextResponse.json({
    tier,
    status,
    currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd).toISOString() : null,
    cancelAtPeriodEnd,
    usage: {
      documents: {
        current: docCount,
        limit: limits.documentsMax,
      },
      vaultSizeMB: {
        current: vaultSizeMB,
        limit: limits.vaultSizeMB,
      },
      queriesThisMonth: {
        current: queryCount,
        limit: limits.queriesPerMonth === -1 ? null : limits.queriesPerMonth,
      },
    },
    invoices,
  })
}
