// E31-006: Public pricing page — 5 tiers with annual/monthly toggle
// Jordan — EPIC-031
'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useSession } from 'next-auth/react'
import { Navbar } from '@/components/Navbar'
import Footer from '@/components/Footer'
import { TierCard } from '@/components/pricing/TierCard'
import { PricingToggle } from '@/components/pricing/PricingToggle'
import { FeatureComparisonTable } from '@/components/pricing/FeatureComparisonTable'
import { PricingFAQ } from '@/components/pricing/PricingFAQ'
import { TIERS } from '@/components/pricing/tierData'
import { useSubscriptionTier } from '@/hooks/useSubscriptionTier'

// ============================================================================
// FADE IN
// ============================================================================

function FadeUp({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.55, delay, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  )
}

// ============================================================================
// CHECKOUT HANDLER
// ============================================================================

async function initiateCheckout(tierId: string, priceEnvKey: string): Promise<void> {
  const res = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan: tierId, priceEnvKey }),
  })
  const { url } = await res.json()
  if (url) window.location.href = url
}

// ============================================================================
// PAGE
// ============================================================================

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false)
  const { data: session } = useSession()
  const { tier } = useSubscriptionTier()
  const isAuthenticated = !!session?.user

  return (
    <main className="min-h-screen bg-[var(--bg-primary)]">
      <Navbar />

      {/* Hero */}
      <section className="pt-36 pb-12 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <FadeUp>
            <h1 className="text-4xl md:text-5xl font-bold text-[var(--text-primary)] tracking-tight mb-4 leading-[1.15] font-[family-name:var(--font-space)]">
              Simple, Transparent Pricing
            </h1>
            <p className="text-base text-[var(--text-secondary)] max-w-xl mx-auto leading-relaxed mb-8">
              Choose the plan that fits your firm. Upgrade or downgrade anytime.
            </p>
            <PricingToggle isAnnual={isAnnual} onToggle={setIsAnnual} />
          </FadeUp>
        </div>
      </section>

      {/* Tier Cards */}
      <section className="pb-20 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-5 items-stretch">
          {TIERS.map((t, i) => (
            <FadeUp key={t.id} delay={i * 0.05}>
              <TierCard
                tier={t}
                isAnnual={isAnnual}
                isCurrentPlan={tier === t.id}
                isAuthenticated={isAuthenticated}
                onCheckout={initiateCheckout}
              />
            </FadeUp>
          ))}
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <FadeUp>
            <h2 className="text-2xl font-bold text-[var(--text-primary)] text-center mb-2 tracking-tight font-[family-name:var(--font-space)]">
              Compare Plans
            </h2>
            <p className="text-sm text-[var(--text-secondary)] text-center mb-10">
              Every plan includes the core platform. Higher tiers unlock more channels and capacity.
            </p>
          </FadeUp>
          <FadeUp>
            <FeatureComparisonTable />
          </FadeUp>
        </div>
      </section>

      {/* FAQ */}
      <section className="pb-20 px-6">
        <FadeUp>
          <PricingFAQ />
        </FadeUp>
      </section>

      {/* Footer CTA */}
      <section className="pb-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <FadeUp>
            <div className="p-8 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)]">
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2 font-[family-name:var(--font-space)]">
                Start your free trial today
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mb-5">
                14 days free on any plan. No credit card required.
              </p>
              <a
                href={isAuthenticated ? '/dashboard' : '/login'}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white transition-colors"
              >
                Get Started
              </a>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* Trust bar */}
      <section className="pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[10px] tracking-[0.3em] font-mono text-[var(--text-tertiary)]/40 uppercase">
            SOC2 Ready &middot; Zero Retention &middot; AES-256 Encrypted &middot; HIPAA Compliant &middot; SEC 17a-4 Audit
          </p>
        </div>
      </section>

      <Footer />
    </main>
  )
}
