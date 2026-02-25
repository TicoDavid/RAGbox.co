/**
 * Tier enforcement middleware for API routes.
 *
 * Reads the user's subscription tier from their JWT/session and checks
 * entitlements before allowing the operation to proceed.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { type BillingTier, type Entitlements, getEntitlements, normalizeTier } from '@/lib/billing/entitlements'

export interface TierCheckResult {
  allowed: boolean
  userId: string
  tier: BillingTier
  entitlements: Entitlements
}

interface TierDenied {
  allowed: false
  response: NextResponse
}

interface TierAllowed {
  allowed: true
  userId: string
  tier: BillingTier
  entitlements: Entitlements
}

type TierGateResult = TierDenied | TierAllowed

/**
 * Authenticate and load user tier info from JWT.
 * Returns 401 if not authenticated.
 */
async function loadUserTier(req: NextRequest): Promise<TierGateResult> {
  const token = await getToken({ req })
  if (!token) {
    return {
      allowed: false,
      response: NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      ),
    }
  }

  const userId = (token.id as string) || token.email || ''
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true, subscriptionStatus: true },
  })

  const tier = normalizeTier(user?.subscriptionTier || 'free')
  const entitlements = getEntitlements(tier)

  return { allowed: true, userId, tier, entitlements }
}

function denyResponse(currentTier: BillingTier, requiredTier: string, feature: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: 'Upgrade required',
      currentTier,
      requiredTier,
      feature,
      upgradeUrl: '/pricing',
    },
    { status: 403 },
  )
}

/**
 * Check if user can upload to vault (storage limit).
 */
export async function checkVaultUpload(req: NextRequest): Promise<TierGateResult> {
  const gate = await loadUserTier(req)
  if (!gate.allowed) return gate

  const { userId, tier, entitlements } = gate
  const storageLimit = entitlements.vault_storage_bytes

  // Unlimited
  if (storageLimit === -1) return gate

  // Sum current vault storage
  const result = await prisma.vault.aggregate({
    where: { userId },
    _sum: { storageUsedBytes: true },
  })

  const currentBytes = Number(result._sum.storageUsedBytes ?? 0)
  if (currentBytes >= storageLimit) {
    return { allowed: false, response: denyResponse(tier, 'sovereign', 'vault_storage') }
  }

  return gate
}

/**
 * Check if user can configure BYOLLM.
 */
export async function checkByollm(req: NextRequest): Promise<TierGateResult> {
  const gate = await loadUserTier(req)
  if (!gate.allowed) return gate

  if (!gate.entitlements.byollm_enabled) {
    return { allowed: false, response: denyResponse(gate.tier, 'sovereign', 'byollm') }
  }

  return gate
}

/**
 * Check if user can create an API key (count limit).
 */
export async function checkApiKeyCreation(req: NextRequest): Promise<TierGateResult> {
  const gate = await loadUserTier(req)
  if (!gate.allowed) return gate

  const { userId, tier, entitlements } = gate
  const limit = entitlements.api_keys_limit

  // Unlimited
  if (limit === -1) return gate

  const currentCount = await prisma.apiKey.count({
    where: { userId, isRevoked: false },
  })

  if (currentCount >= limit) {
    return { allowed: false, response: denyResponse(tier, 'sovereign', 'api_keys') }
  }

  return gate
}

/**
 * Check if user can create a V-Rep (persona limit).
 */
export async function checkVRepCreation(req: NextRequest): Promise<TierGateResult> {
  const gate = await loadUserTier(req)
  if (!gate.allowed) return gate

  const { tier, entitlements } = gate
  const limit = entitlements.vreps_limit

  // Unlimited
  if (limit === -1) return gate

  if (limit === 0) {
    return { allowed: false, response: denyResponse(tier, 'sovereign', 'vreps') }
  }

  return gate
}

/**
 * Generic entitlement check — pass a predicate against the user's entitlements.
 */
export async function checkEntitlement(
  req: NextRequest,
  check: (e: Entitlements) => boolean,
  requiredTier: string,
  feature: string,
): Promise<TierGateResult> {
  const gate = await loadUserTier(req)
  if (!gate.allowed) return gate

  if (!check(gate.entitlements)) {
    return { allowed: false, response: denyResponse(gate.tier, requiredTier, feature) }
  }

  return gate
}
