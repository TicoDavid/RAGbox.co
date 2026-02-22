/**
 * Tier entitlement definitions for RAGbox billing.
 *
 * Each subscription tier maps to a fixed set of entitlements.
 * These are stored as JSONB on the User record and enforced at runtime.
 */

export interface Entitlements {
  documents_limit: number      // -1 = unlimited
  queries_per_month: number
  vault_storage_bytes: number  // -1 = unlimited
  api_keys_limit: number       // -1 = unlimited
  vreps_limit: number          // -1 = unlimited
  byollm_enabled: boolean
  api_keys_enabled: boolean
  mercury_voice: boolean
  mercury_channels: string[]
}

export type BillingTier = 'free' | 'sovereign' | 'mercury' | 'syndicate'

const MB = 1024 * 1024
const GB = 1024 * MB

export const TIER_ENTITLEMENTS: Record<BillingTier, Entitlements> = {
  free: {
    documents_limit: 5,
    queries_per_month: 25,
    vault_storage_bytes: 100 * MB,
    api_keys_limit: 1,
    vreps_limit: 0,
    byollm_enabled: false,
    api_keys_enabled: false,
    mercury_voice: false,
    mercury_channels: [],
  },
  sovereign: {
    documents_limit: 50,
    queries_per_month: 500,
    vault_storage_bytes: 5 * GB,
    api_keys_limit: 5,
    vreps_limit: 1,
    byollm_enabled: true,
    api_keys_enabled: true,
    mercury_voice: false,
    mercury_channels: [],
  },
  mercury: {
    documents_limit: 50,
    queries_per_month: 500,
    vault_storage_bytes: 50 * GB,
    api_keys_limit: 25,
    vreps_limit: 5,
    byollm_enabled: true,
    api_keys_enabled: true,
    mercury_voice: true,
    mercury_channels: ['voice', 'chat'],
  },
  syndicate: {
    documents_limit: -1,
    queries_per_month: 10000,
    vault_storage_bytes: -1,
    api_keys_limit: -1,
    vreps_limit: 15,
    byollm_enabled: true,
    api_keys_enabled: true,
    mercury_voice: true,
    mercury_channels: ['voice', 'chat', 'whatsapp', 'email', 'sms'],
  },
}

/**
 * Map a Stripe price ID to the corresponding billing tier.
 * Returns the highest tier when multiple prices are present (e.g., sovereign + mercury addon).
 */
export function resolveTierFromPriceIds(priceIds: string[]): BillingTier {
  const sovereignPrice = process.env.STRIPE_PRICE_SOVEREIGN || ''
  const mercuryPrice = process.env.STRIPE_PRICE_MERCURY || ''

  const hasSovereign = priceIds.includes(sovereignPrice)
  const hasMercury = priceIds.includes(mercuryPrice)

  if (hasSovereign && hasMercury) return 'mercury'
  if (hasSovereign) return 'sovereign'

  // Fallback: if we can't identify the prices, default to sovereign
  return 'sovereign'
}

export function getEntitlements(tier: BillingTier): Entitlements {
  return { ...TIER_ENTITLEMENTS[tier] }
}
