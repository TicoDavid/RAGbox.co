/**
 * Entitlements module tests — tier mapping, price resolution, entitlement shapes.
 */

import {
  TIER_ENTITLEMENTS,
  getEntitlements,
  resolveTierFromPriceIds,
  type BillingTier,
  type Entitlements,
} from '@/lib/billing/entitlements'

const ORIGINAL_ENV = process.env
beforeAll(() => {
  process.env = {
    ...ORIGINAL_ENV,
    STRIPE_PRICE_SOVEREIGN: 'price_sovereign_test',
    STRIPE_PRICE_MERCURY: 'price_mercury_test',
  }
})

afterAll(() => {
  process.env = ORIGINAL_ENV
})

describe('Entitlements', () => {
  describe('TIER_ENTITLEMENTS', () => {
    it('defines all 4 tiers', () => {
      const tiers: BillingTier[] = ['free', 'sovereign', 'mercury', 'syndicate']
      for (const tier of tiers) {
        expect(TIER_ENTITLEMENTS[tier]).toBeDefined()
      }
    })

    it('free tier has lowest limits', () => {
      const free = TIER_ENTITLEMENTS.free
      expect(free.documents_limit).toBe(5)
      expect(free.queries_per_month).toBe(25)
      expect(free.mercury_voice).toBe(false)
      expect(free.byollm_enabled).toBe(false)
    })

    it('sovereign tier has 50 docs and 500 queries', () => {
      const sov = TIER_ENTITLEMENTS.sovereign
      expect(sov.documents_limit).toBe(50)
      expect(sov.queries_per_month).toBe(500)
      expect(sov.mercury_voice).toBe(false)
    })

    it('mercury tier includes voice and chat channels', () => {
      const merc = TIER_ENTITLEMENTS.mercury
      expect(merc.mercury_voice).toBe(true)
      expect(merc.mercury_channels).toContain('voice')
      expect(merc.mercury_channels).toContain('chat')
    })

    it('syndicate tier has unlimited docs and all channels', () => {
      const syn = TIER_ENTITLEMENTS.syndicate
      expect(syn.documents_limit).toBe(-1)
      expect(syn.queries_per_month).toBe(10000)
      expect(syn.byollm_enabled).toBe(true)
      expect(syn.api_keys_enabled).toBe(true)
      expect(syn.mercury_channels).toEqual(
        expect.arrayContaining(['voice', 'chat', 'whatsapp', 'email', 'sms'])
      )
    })
  })

  describe('getEntitlements', () => {
    it('returns a copy (not reference)', () => {
      const a = getEntitlements('sovereign')
      const b = getEntitlements('sovereign')
      expect(a).toEqual(b)
      expect(a).not.toBe(b) // different object
    })
  })

  describe('resolveTierFromPriceIds', () => {
    it('sovereign price only → sovereign', () => {
      expect(resolveTierFromPriceIds(['price_sovereign_test'])).toBe('sovereign')
    })

    it('sovereign + mercury prices → mercury', () => {
      expect(
        resolveTierFromPriceIds(['price_sovereign_test', 'price_mercury_test'])
      ).toBe('mercury')
    })

    it('unknown price IDs → sovereign fallback', () => {
      expect(resolveTierFromPriceIds(['price_unknown'])).toBe('sovereign')
    })

    it('empty array → sovereign fallback', () => {
      expect(resolveTierFromPriceIds([])).toBe('sovereign')
    })
  })
})
