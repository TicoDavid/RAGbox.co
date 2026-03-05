/**
 * Billing Usage Metrics API (C4)
 *
 * GET /api/billing/usage — Returns current usage for the billing settings page.
 * Queries real data from Prisma where available, returns tier limits.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

// Tier limits: documents, storage (bytes), queries per month
const TIER_LIMITS: Record<string, { documents: number; storage: number; queriesPerMonth: number | null }> = {
  free:         { documents: 10,    storage: 1 * 1024 * 1024 * 1024,   queriesPerMonth: 50 },
  starter:      { documents: 100,   storage: 10 * 1024 * 1024 * 1024,  queriesPerMonth: 500 },
  professional: { documents: 1000,  storage: 100 * 1024 * 1024 * 1024, queriesPerMonth: null },
  enterprise:   { documents: 10000, storage: 1024 * 1024 * 1024 * 1024, queriesPerMonth: null },
  sovereign:    { documents: 10000, storage: 1024 * 1024 * 1024 * 1024, queriesPerMonth: null },
}

function startOfMonth(): string {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function endOfMonth(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 1, 0)
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unable to determine user identity' }, { status: 401 })
  }

  try {
    // Get user tier
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true },
    })
    const tier = user?.subscriptionTier ?? 'free'
    const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.free

    // Document count
    const documentCount = await prisma.document.count({
      where: { userId },
    })

    // Vault storage (sum of sizeBytes)
    const storage = await prisma.document.aggregate({
      where: { userId },
      _sum: { sizeBytes: true },
    })
    const storageUsed = storage._sum.sizeBytes ?? 0

    // Query count this month (thread messages from user role)
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const queryCount = await prisma.mercuryThreadMessage.count({
      where: {
        thread: { userId },
        role: 'user',
        createdAt: { gte: monthStart },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        tier,
        documents: { used: documentCount, limit: limits.documents },
        storage: { used: storageUsed, limit: limits.storage },
        queries: { used: queryCount, limit: limits.queriesPerMonth },
        period: { start: startOfMonth(), end: endOfMonth() },
      },
    })
  } catch (err) {
    logger.error('[Billing Usage] Error:', err)
    return NextResponse.json({ success: false, error: 'Failed to load usage data' }, { status: 500 })
  }
}
