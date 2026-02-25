/**
 * Entitlements module tests — tier mapping, price resolution, entitlement shapes.
 * EPIC-016: Updated to canonical tier names (starter/professional/enterprise/sovereign).
 */

import {
  TIER_ENTITLEMENTS,
  getEntitlements,
  normalizeTier,
  resolveTierFromPriceIds,
  type BillingTier,
  type Entitlements,
} from '@/lib/billing/entitlements'

const ORIGINAL_ENV = process.env
beforeAll(() => {
  process.env = {
    ...ORIGINAL_ENV,
    STRIPE_PRICE_STARTER: 'price_starter_test',
    STRIPE_PRICE_PROFESSIONAL: 'price_professional_test',
    STRIPE_PRICE_ENTERPRISE: 'price_enterprise_test',
    STRIPE_PRICE_SOVEREIGN: 'price_sovereign_test',
  }
})

afterAll(() => {
  process.env = ORIGINAL_ENV
})

describe('Entitlements', () => {
  describe('TIER_ENTITLEMENTS', () => {
    it('defines all 5 canonical tiers', () => {
      const tiers: BillingTier[] = ['free', 'starter', 'professional', 'enterprise', 'sovereign']
      for (const tier of tiers) {
        expect(TIER_ENTITLEMENTS[tier]).toBeDefined()
      }
    })

    it('defines legacy tier aliases', () => {
      expect(TIER_ENTITLEMENTS['mercury']).toBeDefined()
      expect(TIER_ENTITLEMENTS['syndicate']).toBeDefined()
    })

    it('free tier has lowest limits', () => {
      const free = TIER_ENTITLEMENTS.free
      expect(free.documents_limit).toBe(5)
      expect(free.queries_per_month).toBe(25)
      expect(free.mercury_voice).toBe(false)
      expect(free.byollm_enabled).toBe(false)
    })

    it('starter tier has 10 docs and voice', () => {
      const starter = TIER_ENTITLEMENTS.starter
      expect(starter.documents_limit).toBe(10)
      expect(starter.queries_per_month).toBe(100)
      expect(starter.mercury_voice).toBe(true)
    })

    it('professional tier has 50 docs and BYOLLM', () => {
      const pro = TIER_ENTITLEMENTS.professional
      expect(pro.documents_limit).toBe(50)
      expect(pro.queries_per_month).toBe(500)
      expect(pro.byollm_enabled).toBe(true)
      expect(pro.mercury_voice).toBe(true)
    })

    it('enterprise tier has unlimited docs and all channels', () => {
      const ent = TIER_ENTITLEMENTS.enterprise
      expect(ent.documents_limit).toBe(-1)
      expect(ent.queries_per_month).toBe(10000)
      expect(ent.byollm_enabled).toBe(true)
      expect(ent.api_keys_enabled).toBe(true)
      expect(ent.mercury_channels).toEqual(
        expect.arrayContaining(['voice', 'chat', 'whatsapp', 'email', 'sms'])
      )
    })

    it('sovereign tier has 50 docs but no voice', () => {
      const sov = TIER_ENTITLEMENTS.sovereign
      expect(sov.documents_limit).toBe(50)
      expect(sov.queries_per_month).toBe(500)
      expect(sov.mercury_voice).toBe(false)
    })
  })

  describe('normalizeTier', () => {
    it('maps mercury → starter', () => {
      expect(normalizeTier('mercury')).toBe('starter')
    })

    it('maps syndicate → enterprise', () => {
      expect(normalizeTier('syndicate')).toBe('enterprise')
    })

    it('passes through canonical names', () => {
      expect(normalizeTier('free')).toBe('free')
      expect(normalizeTier('starter')).toBe('starter')
      expect(normalizeTier('professional')).toBe('professional')
      expect(normalizeTier('enterprise')).toBe('enterprise')
      expect(normalizeTier('sovereign')).toBe('sovereign')
    })

    it('unknown → free', () => {
      expect(normalizeTier('unknown')).toBe('free')
    })
  })

  describe('getEntitlements', () => {
    it('returns a copy (not reference)', () => {
      const a = getEntitlements('sovereign')
      const b = getEntitlements('sovereign')
      expect(a).toEqual(b)
      expect(a).not.toBe(b) // different object
    })

    it('normalizes legacy tier names', () => {
      const mercury = getEntitlements('mercury')
      const starter = getEntitlements('starter')
      expect(mercury).toEqual(starter)
    })
  })

  describe('resolveTierFromPriceIds', () => {
    it('starter price → starter', () => {
      expect(resolveTierFromPriceIds(['price_starter_test'])).toBe('starter')
    })

    it('professional price → professional', () => {
      expect(resolveTierFromPriceIds(['price_professional_test'])).toBe('professional')
    })

    it('sovereign price → sovereign', () => {
      expect(resolveTierFromPriceIds(['price_sovereign_test'])).toBe('sovereign')
    })

    it('unknown price IDs → starter fallback', () => {
      expect(resolveTierFromPriceIds(['price_unknown'])).toBe('starter')
    })

    it('empty array → starter fallback', () => {
      expect(resolveTierFromPriceIds([])).toBe('starter')
    })
  })
})
