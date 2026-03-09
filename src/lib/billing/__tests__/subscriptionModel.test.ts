/**
 * Sarah — EPIC-031 T3: Subscription Model Tests
 *
 * Tests entitlement shapes, normalization, price resolution,
 * and EPIC-031 tier additions (business, vrep, aiteam).
 */

import {
  normalizeTier,
  getEntitlements,
  resolveTierFromPriceIds,
  TIER_ENTITLEMENTS,
  type BillingTier,
  type Entitlements,
} from '../entitlements'

// ── Setup ────────────────────────────────────────────────────────

const ORIGINAL_ENV = process.env

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    STRIPE_PRICE_STARTER_MONTHLY: 'price_start_m',
    STRIPE_PRICE_STARTER_ANNUAL: 'price_start_a',
    STRIPE_PRICE_PRO_MONTHLY: 'price_pro_m',
    STRIPE_PRICE_PRO_ANNUAL: 'price_pro_a',
    STRIPE_PRICE_BUSINESS_MONTHLY: 'price_biz_m',
    STRIPE_PRICE_BUSINESS_ANNUAL: 'price_biz_a',
    STRIPE_PRICE_VREP_MONTHLY: 'price_vrep_m',
    STRIPE_PRICE_VREP_ANNUAL: 'price_vrep_a',
    STRIPE_PRICE_AITEAM_MONTHLY: 'price_ai_m',
    STRIPE_PRICE_AITEAM_ANNUAL: 'price_ai_a',
  }
})

afterAll(() => {
  process.env = ORIGINAL_ENV
})

// ── Tests ────────────────────────────────────────────────────────

describe('Sarah — EPIC-031 T3: Subscription Model', () => {
  describe('normalizeTier', () => {
    test('maps legacy "mercury" to "starter"', () => {
      expect(normalizeTier('mercury')).toBe('starter')
    })

    test('maps legacy "syndicate" to "enterprise"', () => {
      expect(normalizeTier('syndicate')).toBe('enterprise')
    })

    test('returns canonical tiers unchanged', () => {
      const canonical: BillingTier[] = ['free', 'starter', 'professional', 'enterprise', 'sovereign', 'business', 'vrep', 'aiteam']
      for (const tier of canonical) {
        expect(normalizeTier(tier)).toBe(tier)
      }
    })

    test('defaults unknown tiers to "free"', () => {
      expect(normalizeTier('platinum')).toBe('free')
      expect(normalizeTier('')).toBe('free')
      expect(normalizeTier('gold')).toBe('free')
    })
  })

  describe('getEntitlements', () => {
    test('returns a copy, not the original reference', () => {
      const a = getEntitlements('starter')
      const b = getEntitlements('starter')
      expect(a).toEqual(b)
      expect(a).not.toBe(b)
    })

    test('all tiers have all required Entitlements fields', () => {
      const requiredFields: (keyof Entitlements)[] = [
        'documents_limit', 'queries_per_month', 'vault_storage_bytes',
        'api_keys_limit', 'vreps_limit', 'byollm_enabled',
        'api_keys_enabled', 'mercury_voice', 'mercury_channels',
      ]
      const allTiers: string[] = ['free', 'starter', 'professional', 'enterprise', 'sovereign', 'business', 'vrep', 'aiteam', 'mercury', 'syndicate']
      for (const tier of allTiers) {
        const ent = getEntitlements(tier)
        for (const field of requiredFields) {
          expect(ent[field]).toBeDefined()
        }
      }
    })
  })

  describe('EPIC-031 tiers: business, vrep, aiteam', () => {
    test('business tier has correct limits', () => {
      const biz = getEntitlements('business')
      expect(biz.documents_limit).toBe(2000)
      expect(biz.queries_per_month).toBe(10000)
      expect(biz.vreps_limit).toBe(10)
      expect(biz.byollm_enabled).toBe(true)
      expect(biz.mercury_channels).toEqual(
        expect.arrayContaining(['voice', 'chat', 'whatsapp', 'email', 'sms']),
      )
    })

    test('vrep tier has higher limits than business', () => {
      const biz = getEntitlements('business')
      const vrep = getEntitlements('vrep')
      expect(vrep.documents_limit).toBeGreaterThan(biz.documents_limit)
      expect(vrep.queries_per_month).toBeGreaterThan(biz.queries_per_month)
      expect(vrep.vreps_limit).toBe(-1) // unlimited
    })

    test('aiteam tier has unlimited queries', () => {
      const ai = getEntitlements('aiteam')
      expect(ai.queries_per_month).toBe(-1)
      expect(ai.documents_limit).toBe(20000)
      expect(ai.vreps_limit).toBe(-1)
    })

    test('tier hierarchy: limits increase from free to aiteam', () => {
      const free = getEntitlements('free')
      const starter = getEntitlements('starter')
      const pro = getEntitlements('professional')
      const biz = getEntitlements('business')

      expect(starter.documents_limit).toBeGreaterThan(free.documents_limit)
      expect(pro.documents_limit).toBeGreaterThan(starter.documents_limit)
      expect(biz.documents_limit).toBeGreaterThan(pro.documents_limit)
    })
  })

  describe('resolveTierFromPriceIds', () => {
    test('resolves monthly price IDs', () => {
      expect(resolveTierFromPriceIds(['price_start_m'])).toBe('starter')
      expect(resolveTierFromPriceIds(['price_pro_m'])).toBe('professional')
      expect(resolveTierFromPriceIds(['price_biz_m'])).toBe('business')
      expect(resolveTierFromPriceIds(['price_vrep_m'])).toBe('vrep')
      expect(resolveTierFromPriceIds(['price_ai_m'])).toBe('aiteam')
    })

    test('resolves annual price IDs', () => {
      expect(resolveTierFromPriceIds(['price_start_a'])).toBe('starter')
      expect(resolveTierFromPriceIds(['price_pro_a'])).toBe('professional')
      expect(resolveTierFromPriceIds(['price_biz_a'])).toBe('business')
      expect(resolveTierFromPriceIds(['price_vrep_a'])).toBe('vrep')
      expect(resolveTierFromPriceIds(['price_ai_a'])).toBe('aiteam')
    })

    test('falls back to "starter" for unknown price IDs', () => {
      expect(resolveTierFromPriceIds(['price_does_not_exist'])).toBe('starter')
    })
  })
})
