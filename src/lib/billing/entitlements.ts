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

// Canonical tier names (CPO pricing model — EPIC-031)
export type BillingTier = 'free' | 'starter' | 'professional' | 'enterprise' | 'sovereign' | 'business' | 'vrep' | 'aiteam'

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
    case 'business':
    case 'vrep':
    case 'aiteam':
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
  // ── EPIC-031 tiers (CPO pricing: $249/$499/$2,499) ───────────────────
  business: {
    documents_limit: 2000,
    queries_per_month: 10000,
    vault_storage_bytes: 10 * GB,
    api_keys_limit: -1,
    vreps_limit: 10,
    byollm_enabled: true,
    api_keys_enabled: true,
    mercury_voice: true,
    mercury_channels: ['voice', 'chat', 'whatsapp', 'email', 'sms'],
  },
  vrep: {
    documents_limit: 5000,
    queries_per_month: 50000,
    vault_storage_bytes: 25 * GB,
    api_keys_limit: -1,
    vreps_limit: -1,
    byollm_enabled: true,
    api_keys_enabled: true,
    mercury_voice: true,
    mercury_channels: ['voice', 'chat', 'whatsapp', 'email', 'sms'],
  },
  aiteam: {
    documents_limit: 20000,
    queries_per_month: -1,
    vault_storage_bytes: 100 * GB,
    api_keys_limit: -1,
    vreps_limit: -1,
    byollm_enabled: true,
    api_keys_enabled: true,
    mercury_voice: true,
    mercury_channels: ['voice', 'chat', 'whatsapp', 'email', 'sms'],
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
 * EPIC-031: Extended with business/vrep/aiteam + monthly/annual variants.
 */
export function resolveTierFromPriceIds(priceIds: string[]): BillingTier {
  // Build mapping from env vars (read inside function — Cloud Run secret gotcha)
  const envPairs: [string, BillingTier][] = [
    ['STRIPE_PRICE_AITEAM_MONTHLY', 'aiteam'],
    ['STRIPE_PRICE_AITEAM_ANNUAL', 'aiteam'],
    ['STRIPE_PRICE_VREP_MONTHLY', 'vrep'],
    ['STRIPE_PRICE_VREP_ANNUAL', 'vrep'],
    ['STRIPE_PRICE_BUSINESS_MONTHLY', 'business'],
    ['STRIPE_PRICE_BUSINESS_ANNUAL', 'business'],
    ['STRIPE_PRICE_PRO_MONTHLY', 'professional'],
    ['STRIPE_PRICE_PRO_ANNUAL', 'professional'],
    ['STRIPE_PRICE_STARTER_MONTHLY', 'starter'],
    ['STRIPE_PRICE_STARTER_ANNUAL', 'starter'],
    // Legacy single-price env vars
    ['STRIPE_PRICE_SOVEREIGN', 'sovereign'],
    ['STRIPE_PRICE_ENTERPRISE', 'enterprise'],
    ['STRIPE_PRICE_PROFESSIONAL', 'professional'],
    ['STRIPE_PRICE_MERCURY', 'starter'],
    ['STRIPE_PRICE_STARTER', 'starter'],
  ]

  for (const [envKey, tier] of envPairs) {
    const val = (process.env[envKey] || '').trim()
    if (val && priceIds.includes(val)) return tier
  }

  // Fallback
  return 'starter'
}

export function getEntitlements(tier: BillingTier | string): Entitlements {
  const canonical = normalizeTier(tier)
  return { ...TIER_ENTITLEMENTS[canonical] }
}
