/**
 * EPIC-031 Tier Enforcement — Feature gating + resource limits.
 *
 * Tier hierarchy: Free(0) < Starter(1) < Pro(2) < Business(3) < VRep(4) < AITeam(5)
 * Pro maps to 'professional' in DB enum, VRep to 'vrep', AITeam to 'aiteam'.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { normalizeTier } from '@/lib/billing/entitlements'

// ── Tier hierarchy ────────────────────────────────────────────────────

export type EnforcementTier = 'Free' | 'Starter' | 'Pro' | 'Business' | 'VRep' | 'AITeam'

const TIER_LEVEL: Record<string, number> = {
  free: 0,
  starter: 1,
  professional: 2, // "Pro" in CPO pricing
  business: 3,
  vrep: 4,
  aiteam: 5,
}

function tierLevel(dbTier: string): number {
  const canonical = normalizeTier(dbTier)
  return TIER_LEVEL[canonical] ?? 0
}

// Map display names to DB enum values
const DISPLAY_TO_DB: Record<EnforcementTier, string> = {
  Free: 'free',
  Starter: 'starter',
  Pro: 'professional',
  Business: 'business',
  VRep: 'vrep',
  AITeam: 'aiteam',
}

// ── Feature requirements ──────────────────────────────────────────────

export const FEATURE_REQUIREMENTS: Record<string, EnforcementTier> = {
  voice: 'Pro',
  whatsapp: 'Pro',
  forge_templates: 'Pro',
  email_actions: 'Business',
  sms_actions: 'Business',
  custom_personas: 'Business',
  api_access: 'Business',
  team_management: 'VRep',
  multi_agent: 'AITeam',
}

// ── Per-tier resource limits ──────────────────────────────────────────

const MB = 1024 * 1024
const GB = 1024 * MB

export interface TierLimits {
  vaultSizeMB: number     // MB
  documentsMax: number
  queriesPerMonth: number // -1 = unlimited
}

export const TIER_LIMITS: Record<string, TierLimits> = {
  free:         { vaultSizeMB: 50,     documentsMax: 10,    queriesPerMonth: 50 },
  starter:      { vaultSizeMB: 500,    documentsMax: 100,   queriesPerMonth: 500 },
  professional: { vaultSizeMB: 2048,   documentsMax: 500,   queriesPerMonth: 2000 },
  business:     { vaultSizeMB: 10240,  documentsMax: 2000,  queriesPerMonth: 10000 },
  vrep:         { vaultSizeMB: 25600,  documentsMax: 5000,  queriesPerMonth: 50000 },
  aiteam:       { vaultSizeMB: 102400, documentsMax: 20000, queriesPerMonth: -1 },
}

function getLimits(dbTier: string): TierLimits {
  const canonical = normalizeTier(dbTier)
  return TIER_LIMITS[canonical] ?? TIER_LIMITS.free
}

// ── checkTierAccess ───────────────────────────────────────────────────

/**
 * Returns null if access granted, or a 403 Response if blocked.
 */
export async function checkTierAccess(
  req: NextRequest,
  requiredTier: EnforcementTier,
): Promise<NextResponse | null> {
  const token = await getToken({ req })
  if (!token) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 },
    )
  }

  const userId = (token.id as string) || token.email || ''
  const user = await prisma.user.findFirst({
    where: { OR: [{ id: userId }, { email: token.email as string }] },
    select: { subscriptionTier: true },
  })

  const currentTier = user?.subscriptionTier || 'free'
  const requiredDbTier = DISPLAY_TO_DB[requiredTier]
  const currentLevel = tierLevel(currentTier)
  const requiredLevel = TIER_LEVEL[requiredDbTier] ?? 0

  if (currentLevel >= requiredLevel) {
    return null // access granted
  }

  return NextResponse.json(
    {
      error: 'Upgrade required',
      requiredTier,
      currentTier: normalizeTier(currentTier),
      upgradeUrl: '/pricing',
    },
    { status: 403 },
  )
}

// ── checkUsageLimit ───────────────────────────────────────────────────

export type LimitType = 'vault_size' | 'document_count' | 'query_count'

export interface UsageLimitResult {
  allowed: boolean
  current: number
  limit: number | null // null = unlimited
  tier: string
}

export async function checkUsageLimit(
  userId: string,
  limitType: LimitType,
): Promise<UsageLimitResult> {
  const user = await prisma.user.findFirst({
    where: { OR: [{ id: userId }, { email: userId }] },
    select: { id: true, subscriptionTier: true },
  })

  const dbTier = user?.subscriptionTier || 'free'
  const canonical = normalizeTier(dbTier)
  const limits = getLimits(dbTier)
  const actualUserId = user?.id || userId

  if (limitType === 'vault_size') {
    const result = await prisma.document.aggregate({
      where: { userId: actualUserId, deletionStatus: 'Active' },
      _sum: { sizeBytes: true },
    })
    const currentMB = Math.round(Number(result._sum.sizeBytes ?? 0) / MB)
    return {
      allowed: currentMB < limits.vaultSizeMB,
      current: currentMB,
      limit: limits.vaultSizeMB,
      tier: canonical,
    }
  }

  if (limitType === 'document_count') {
    const count = await prisma.document.count({
      where: { userId: actualUserId, deletionStatus: 'Active' },
    })
    return {
      allowed: count < limits.documentsMax,
      current: count,
      limit: limits.documentsMax,
      tier: canonical,
    }
  }

  if (limitType === 'query_count') {
    if (limits.queriesPerMonth === -1) {
      return { allowed: true, current: 0, limit: null, tier: canonical }
    }
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const count = await prisma.query.count({
      where: { userId: actualUserId, createdAt: { gte: monthStart } },
    })
    return {
      allowed: count < limits.queriesPerMonth,
      current: count,
      limit: limits.queriesPerMonth,
      tier: canonical,
    }
  }

  return { allowed: true, current: 0, limit: null, tier: canonical }
}
