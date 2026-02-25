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

// Canonical tier names (CPO pricing model — EPIC-016 P01)
export type BillingTier = 'free' | 'starter' | 'professional' | 'enterprise' | 'sovereign'

// Legacy tier names still in PostgreSQL enum (can't remove from PG enums)
type LegacyTier = 'mercury' | 'syndicate'

/**
 * Normalize legacy tier names from DB to canonical names.
 * mercury → starter, syndicate → enterprise.
 */
export function normalizeTier(tier: string): BillingTier {
  switch (tier) {
    case 'mercury': return 'starter'
    case 'syndicate': return 'enterprise'
    case 'free':
    case 'starter':
    case 'professional':
    case 'enterprise':
    case 'sovereign':
      return tier
    default:
      return 'free'
  }
}

const MB = 1024 * 1024
const GB = 1024 * MB

export const TIER_ENTITLEMENTS: Record<BillingTier | LegacyTier, Entitlements> = {
  // ── Canonical tiers (CPO pricing model) ─────────────────────────────
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
  starter: {
    documents_limit: 10,
    queries_per_month: 100,
    vault_storage_bytes: 1 * GB,
    api_keys_limit: 3,
    vreps_limit: 1,
    byollm_enabled: false,
    api_keys_enabled: true,
    mercury_voice: true,
    mercury_channels: ['voice', 'chat'],
  },
  professional: {
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
  enterprise: {
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
  // ── Legacy aliases (backward compat for unmigreted DB rows) ─────────
  mercury: {
    documents_limit: 10,
    queries_per_month: 100,
    vault_storage_bytes: 1 * GB,
    api_keys_limit: 3,
    vreps_limit: 1,
    byollm_enabled: false,
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
 * EPIC-016: Updated to use canonical tier names (starter/professional/enterprise/sovereign).
 */
export function resolveTierFromPriceIds(priceIds: string[]): BillingTier {
  const starterPrice = process.env.STRIPE_PRICE_STARTER || ''
  const professionalPrice = process.env.STRIPE_PRICE_PROFESSIONAL || process.env.STRIPE_PRICE_MERCURY || ''
  const enterprisePrice = process.env.STRIPE_PRICE_ENTERPRISE || ''
  const sovereignPrice = process.env.STRIPE_PRICE_SOVEREIGN || ''

  if (priceIds.includes(sovereignPrice)) return 'sovereign'
  if (priceIds.includes(enterprisePrice)) return 'enterprise'
  if (priceIds.includes(professionalPrice)) return 'professional'
  if (priceIds.includes(starterPrice)) return 'starter'

  // Fallback: if we can't identify the prices, default to starter
  return 'starter'
}

export function getEntitlements(tier: BillingTier | string): Entitlements {
  const canonical = normalizeTier(tier)
  return { ...TIER_ENTITLEMENTS[canonical] }
}
