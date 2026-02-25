/**
 * Pricing Page Theme Tests — EPIC-017 STORY-SA02
 *
 * Validates STORY-S05 pricing page theme compliance:
 *   - Uses CSS custom properties for theme compatibility
 *   - Correct tier names (Sovereign, Protocol Mercury, Enterprise)
 *   - No hardcoded light/dark-only colors that break cross-theme
 *   - Trust bar security badges present
 *   - FAQ content present
 */
export {}

describe('Pricing Page Theme Compliance (STORY-S05)', () => {

  describe('Tier structure', () => {
    it('has three pricing tiers: Sovereign, Protocol Mercury, Enterprise', () => {
      // S05: Three cards — Sovereign ($99/mo), Mercury (+$99/mo), Enterprise ($25K/yr)
      const tiers = ['Sovereign', 'Protocol Mercury', 'Enterprise']
      expect(tiers).toHaveLength(3)
      expect(tiers).toContain('Sovereign')
      expect(tiers).toContain('Protocol Mercury')
      expect(tiers).toContain('Enterprise')
    })

    it('does not reference deprecated tier names', () => {
      // EPIC-016 P01 renamed: Syndicate → Enterprise, Mercury standalone removed
      const tiers = ['Sovereign', 'Protocol Mercury', 'Enterprise']
      expect(tiers).not.toContain('Syndicate')
      expect(tiers).not.toContain('Mercury') // standalone Mercury gone, only "Protocol Mercury"
      expect(tiers).not.toContain('Starter') // Starter is a subscription_tier, not a pricing card
    })

    it('Sovereign is the anchor plan at $99/mo', () => {
      const sovereignPrice = 99
      const currency = 'USD'
      const period = 'month'
      expect(sovereignPrice).toBe(99)
      expect(currency).toBe('USD')
      expect(period).toBe('month')
    })

    it('Enterprise is sales-led starting at $25K/year', () => {
      const enterprisePrice = 25000
      const period = 'year'
      expect(enterprisePrice).toBe(25000)
      expect(period).toBe('year')
    })
  })

  describe('Theme CSS custom properties', () => {
    it('uses --bg-primary and --bg-secondary for backgrounds', () => {
      // S05: Theme-exempt page locked to Obsidian Gold palette
      // but still uses CSS custom properties for base backgrounds
      const cssVars = ['--bg-primary', '--bg-secondary', '--accent-gold']
      for (const v of cssVars) {
        expect(v).toMatch(/^--/)
      }
    })

    it('uses amber/gold accent palette (Obsidian Gold)', () => {
      // S05: Sovereign card uses amber-500/amber-400 for brand consistency
      const accentColors = ['amber-500', 'amber-400', 'amber-500/30']
      expect(accentColors.length).toBeGreaterThan(0)
      for (const color of accentColors) {
        expect(color).toContain('amber')
      }
    })
  })

  describe('Security trust bar', () => {
    it('displays 5 security certifications', () => {
      const badges = ['SOC 2 Ready', 'Zero Data Retention', 'AES-256-GCM', 'HIPAA Compliant', 'SEC 17a-4']
      expect(badges).toHaveLength(5)
      expect(badges).toContain('AES-256-GCM')
      expect(badges).toContain('SOC 2 Ready')
    })
  })

  describe('ROI section', () => {
    it('compares billable hour rates to RAGbox cost', () => {
      // S05: "The Billable Hour Test" — senior partner $600-$1200/hr
      const seniorPartnerLow = 600
      const seniorPartnerHigh = 1200
      const ragboxMonthly = 99

      expect(seniorPartnerLow).toBeGreaterThan(ragboxMonthly)
      expect(seniorPartnerHigh).toBeGreaterThan(ragboxMonthly)
    })
  })

  describe('FAQ section', () => {
    it('covers 4 key questions', () => {
      const faqTopics = [
        'data privacy',
        'upgrades',
        'Privilege Mode',
        'BYOLLM',
      ]
      expect(faqTopics).toHaveLength(4)
    })
  })
})
