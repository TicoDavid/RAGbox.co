// THEME-EXEMPT: Public pricing page, locked to Obsidian Gold palette
// Pricing canonical source: connexus-ops/docs/POS-BILLING-ARCHITECTURE.md
// E26-006: Interactive tier comparison with checkout buttons
'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check,
  X,
  Shield,
  Crown,
  ArrowRight,
  Bot,
  Mic,
  Mail,
  MessageCircle,
  Monitor,
  Calculator,
} from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import Footer from '@/components/Footer'

// ============================================================================
// STRIPE CHECKOUT — wired to POST /api/billing/checkout (Sheldon backend)
// ============================================================================

type PlanKey = 'sovereign' | 'sovereign_mercury'

async function handleCheckout(plan: PlanKey, annual: boolean) {
  const res = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, interval: annual ? 'year' : 'month' }),
  })
  const { url } = await res.json()
  if (url) window.location.href = url
}

function handleEnterprise() {
  window.location.href = 'mailto:david@theconnexus.ai?subject=RAGb%C3%B6x%20Syndicate%20%E2%80%94%20Inquiry'
}

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
// BILLING TOGGLE
// ============================================================================

function BillingToggle({ annual, onToggle }: { annual: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-center gap-4 mb-12">
      <span className={`text-sm font-medium transition-colors ${!annual ? 'text-white' : 'text-white/30'}`}>
        Monthly
      </span>
      <button
        onClick={onToggle}
        className="relative w-14 h-7 rounded-full bg-white/10 border border-white/10 transition-colors hover:border-white/20"
        aria-label={annual ? 'Switch to monthly billing' : 'Switch to annual billing'}
      >
        <motion.div
          className="absolute top-0.5 w-6 h-6 rounded-full bg-amber-400"
          animate={{ left: annual ? '30px' : '2px' }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
      <span className={`text-sm font-medium transition-colors ${annual ? 'text-white' : 'text-white/30'}`}>
        Annual
      </span>
      <AnimatePresence>
        {annual && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full"
          >
            Save 20%
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================================================
// PRICE DISPLAY
// ============================================================================

function PriceDisplay({ monthly, annual, isAnnual }: { monthly: number; annual: number; isAnnual: boolean }) {
  const price = isAnnual ? annual : monthly
  return (
    <div className="mb-1">
      <AnimatePresence mode="wait">
        <motion.div
          key={isAnnual ? 'annual' : 'monthly'}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
          className="flex items-baseline gap-1"
        >
          <span className="text-4xl font-bold text-white tracking-tight">${price}</span>
          <span className="text-sm text-white/30 font-medium">/ mo</span>
        </motion.div>
      </AnimatePresence>
      {isAnnual && (
        <p className="text-[11px] text-amber-400/70 mt-1">
          ${annual * 12}/yr (save ${(monthly - annual) * 12}/yr)
        </p>
      )}
    </div>
  )
}

// ============================================================================
// TIER CARDS
// ============================================================================

const SOVEREIGN_FEATURES = [
  'Unlimited Vault storage',
  'Sovereign RAG pipeline (Aegis AI)',
  'Citation-backed answers',
  'Silence Protocol (confidence gating)',
  'Sovereign Studio',
  '10 Expert Personas',
  'Privilege Mode',
  'Veritas audit trail',
  'AES-256-GCM encryption',
]

const MERCURY_CHANNELS = [
  { icon: Mic, label: 'Voice' },
  { icon: Monitor, label: 'Chat' },
  { icon: Mail, label: 'Email' },
  { icon: MessageCircle, label: 'SMS' },
]

function SovereignCard({ isAnnual }: { isAnnual: boolean }) {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-[var(--bg-secondary)]/80 backdrop-blur-sm border border-amber-500/30 shadow-[0_0_60px_-15px_rgba(245,158,11,0.15)] flex flex-col h-full">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent" />

      <div className="p-8 flex flex-col flex-1">
        <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full mb-4 self-start">
          Most Popular
        </span>

        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <Shield className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Sovereign</h2>
            <p className="text-xs text-white/30">Digital Insurance for IP</p>
          </div>
        </div>

        <PriceDisplay monthly={99} annual={79} isAnnual={isAnnual} />
        <p className="text-xs text-white/25 mb-5">Single user. Cancel anytime.</p>

        <ul className="space-y-2 flex-1">
          {SOVEREIGN_FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-white/55">
              <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              {f}
            </li>
          ))}
        </ul>

        <button
          onClick={() => handleCheckout('sovereign', isAnnual)}
          className="w-full mt-6 px-6 py-3.5 rounded-xl text-sm font-bold transition-all duration-200
                     bg-gradient-to-r from-amber-500 to-amber-600 text-black
                     hover:from-amber-400 hover:to-amber-500
                     shadow-lg shadow-amber-500/20"
        >
          Start Free Trial
          <ArrowRight className="w-4 h-4 inline ml-2" />
        </button>
        <p className="text-[11px] text-white/20 mt-2 text-center">14 days free. No credit card required.</p>
      </div>
    </div>
  )
}

function MercuryCard({ isAnnual }: { isAnnual: boolean }) {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-[var(--bg-secondary)]/80 backdrop-blur-sm border border-white/[0.08] hover:border-amber-500/20 transition-colors flex flex-col h-full">
      <div className="p-8 flex flex-col flex-1">
        <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent-gold)] bg-[var(--accent-gold)]/10 border border-[var(--accent-gold)]/20 px-2.5 py-1 rounded-full mb-4 self-start">
          The Digital Hire
        </span>

        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-gold)]/15 flex items-center justify-center">
            <Bot className="w-5 h-5 text-[var(--accent-gold)]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Sovereign + Mercury</h2>
            <p className="text-xs text-white/30">Everything + AI Assistant</p>
          </div>
        </div>

        <PriceDisplay monthly={198} annual={158} isAnnual={isAnnual} />
        <p className="text-xs text-white/25 mb-2">Sovereign + Mercury bundle.</p>

        <div className="inline-block px-3 py-1.5 rounded-lg bg-amber-500/[0.07] border border-amber-500/15 mb-4 self-start">
          <p className="text-[11px] text-amber-400/70 font-medium">
            98% cheaper than a human EA
          </p>
        </div>

        {/* Channel icons */}
        <div className="flex items-center gap-2 mb-4">
          {MERCURY_CHANNELS.map((ch) => {
            const Icon = ch.icon
            return (
              <div
                key={ch.label}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40"
              >
                <Icon className="w-3 h-3" />
                <span className="text-[10px] font-medium">{ch.label}</span>
              </div>
            )
          })}
        </div>

        <ul className="space-y-2 flex-1">
          <li className="flex items-start gap-2 text-sm text-white/55">
            <Check className="w-4 h-4 text-[var(--accent-gold)] shrink-0 mt-0.5" />
            Everything in Sovereign
          </li>
          <li className="flex items-start gap-2 text-sm text-white/55">
            <Check className="w-4 h-4 text-[var(--accent-gold)] shrink-0 mt-0.5" />
            Mercury AI across every channel
          </li>
          <li className="flex items-start gap-2 text-sm text-white/55">
            <Check className="w-4 h-4 text-[var(--accent-gold)] shrink-0 mt-0.5" />
            Voice agent — talk to your docs
          </li>
          <li className="flex items-start gap-2 text-sm text-white/55">
            <Check className="w-4 h-4 text-[var(--accent-gold)] shrink-0 mt-0.5" />
            Email & SMS integration
          </li>
          <li className="flex items-start gap-2 text-sm text-white/55">
            <Check className="w-4 h-4 text-[var(--accent-gold)] shrink-0 mt-0.5" />
            BYOLLM (bring your own LLM)
          </li>
          <li className="flex items-start gap-2 text-sm text-white/55">
            <Check className="w-4 h-4 text-[var(--accent-gold)] shrink-0 mt-0.5" />
            Multi-channel conversation history
          </li>
        </ul>

        <button
          onClick={() => handleCheckout('sovereign_mercury', isAnnual)}
          className="w-full mt-6 px-6 py-3.5 rounded-xl text-sm font-bold transition-all duration-200
                     bg-white/5 text-white border border-white/10
                     hover:bg-white/10 hover:border-white/20"
        >
          Get Sovereign + Mercury
          <ArrowRight className="w-4 h-4 inline ml-2" />
        </button>
        <p className="text-[11px] text-white/20 mt-2 text-center">14 days free. Proration on upgrade.</p>
      </div>
    </div>
  )
}

function EnterpriseCard() {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-[var(--bg-secondary)]/60 backdrop-blur-sm border border-white/[0.06] flex flex-col h-full">
      <div className="p-8 flex flex-col flex-1">
        <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full mb-4 self-start">
          Syndicate
        </span>

        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
            <Crown className="w-5 h-5 text-white/40" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Enterprise</h2>
            <p className="text-xs text-white/30">Full Data Sovereignty</p>
          </div>
        </div>

        <div className="mb-1">
          <p className="text-[10px] text-white/25 uppercase tracking-wider font-semibold mb-1">Starting at</p>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-white tracking-tight">$25K</span>
            <span className="text-sm text-white/30 font-medium">/ year</span>
          </div>
        </div>
        <p className="text-xs text-white/25 mb-5">Annual contract. Prepaid.</p>

        <ul className="space-y-2 flex-1">
          <li className="flex items-start gap-2 text-sm text-white/50">
            <Check className="w-4 h-4 text-white/25 shrink-0 mt-0.5" />
            Everything in Sovereign + Mercury
          </li>
          <li className="flex items-start gap-2 text-sm text-white/50">
            <Check className="w-4 h-4 text-white/25 shrink-0 mt-0.5" />
            Dedicated Cloud Run instance
          </li>
          <li className="flex items-start gap-2 text-sm text-white/50">
            <Check className="w-4 h-4 text-white/25 shrink-0 mt-0.5" />
            CMEK encryption (your keys)
          </li>
          <li className="flex items-start gap-2 text-sm text-white/50">
            <Check className="w-4 h-4 text-white/25 shrink-0 mt-0.5" />
            Custom SSO / SAML (Okta)
          </li>
          <li className="flex items-start gap-2 text-sm text-white/50">
            <Check className="w-4 h-4 text-white/25 shrink-0 mt-0.5" />
            VPC peering & private endpoints
          </li>
          <li className="flex items-start gap-2 text-sm text-white/50">
            <Check className="w-4 h-4 text-white/25 shrink-0 mt-0.5" />
            99.9% SLA + dedicated success manager
          </li>
        </ul>

        <button
          onClick={handleEnterprise}
          className="w-full mt-6 px-6 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200
                     bg-white/[0.04] text-white/70 border border-white/[0.08]
                     hover:bg-white/[0.08] hover:text-white hover:border-white/15"
        >
          Talk to Sales
          <ArrowRight className="w-4 h-4 inline ml-2" />
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// FEATURE COMPARISON TABLE
// ============================================================================

type FeatureValue = boolean | string

interface ComparisonRow {
  feature: string
  sovereign: FeatureValue
  mercury: FeatureValue
  enterprise: FeatureValue
}

const COMPARISON_SECTIONS: { title: string; rows: ComparisonRow[] }[] = [
  {
    title: 'Core Platform',
    rows: [
      { feature: 'Vault document storage', sovereign: 'Unlimited', mercury: 'Unlimited', enterprise: 'Unlimited' },
      { feature: 'Aegis RAG pipeline', sovereign: true, mercury: true, enterprise: true },
      { feature: 'Citation-backed answers', sovereign: true, mercury: true, enterprise: true },
      { feature: 'Silence Protocol', sovereign: true, mercury: true, enterprise: true },
      { feature: 'Sovereign Studio', sovereign: true, mercury: true, enterprise: true },
      { feature: 'Expert Personas', sovereign: '10', mercury: '10', enterprise: 'Custom' },
      { feature: 'Privilege Mode', sovereign: true, mercury: true, enterprise: true },
      { feature: 'Veritas audit trail', sovereign: true, mercury: true, enterprise: true },
    ],
  },
  {
    title: 'Mercury AI',
    rows: [
      { feature: 'Dashboard chat', sovereign: true, mercury: true, enterprise: true },
      { feature: 'Voice agent', sovereign: false, mercury: true, enterprise: true },
      { feature: 'Email integration', sovereign: false, mercury: true, enterprise: true },
      { feature: 'SMS & WhatsApp', sovereign: false, mercury: true, enterprise: true },
      { feature: 'BYOLLM', sovereign: false, mercury: true, enterprise: true },
      { feature: 'Multi-channel history', sovereign: false, mercury: true, enterprise: true },
    ],
  },
  {
    title: 'Security & Compliance',
    rows: [
      { feature: 'AES-256-GCM encryption', sovereign: true, mercury: true, enterprise: true },
      { feature: 'TLS 1.3 in transit', sovereign: true, mercury: true, enterprise: true },
      { feature: 'CMEK (your keys)', sovereign: false, mercury: false, enterprise: true },
      { feature: 'SSO / SAML', sovereign: false, mercury: false, enterprise: true },
      { feature: 'VPC peering', sovereign: false, mercury: false, enterprise: true },
      { feature: 'Data residency', sovereign: false, mercury: false, enterprise: true },
    ],
  },
  {
    title: 'Support',
    rows: [
      { feature: 'Community support', sovereign: true, mercury: true, enterprise: true },
      { feature: 'Priority support', sovereign: false, mercury: true, enterprise: true },
      { feature: 'Dedicated success manager', sovereign: false, mercury: false, enterprise: true },
      { feature: 'SLA guarantee', sovereign: false, mercury: false, enterprise: '99.9%' },
      { feature: 'White-glove onboarding', sovereign: false, mercury: false, enterprise: true },
    ],
  },
]

function CellValue({ value }: { value: FeatureValue }) {
  if (typeof value === 'string') {
    return <span className="text-sm text-white/70 font-medium">{value}</span>
  }
  if (value) {
    return <Check className="w-4 h-4 text-amber-400 mx-auto" />
  }
  return <X className="w-4 h-4 text-white/15 mx-auto" />
}

function ComparisonTable() {
  return (
    <FadeUp>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[640px]">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left py-4 pr-4 text-sm font-semibold text-white/40 w-[40%]">Features</th>
              <th className="text-center py-4 px-3 text-sm font-semibold text-amber-400 w-[20%]">Sovereign</th>
              <th className="text-center py-4 px-3 text-sm font-semibold text-[var(--accent-gold)] w-[20%]">+ Mercury</th>
              <th className="text-center py-4 px-3 text-sm font-semibold text-white/40 w-[20%]">Enterprise</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON_SECTIONS.map((section) => (
              <React.Fragment key={section.title}>
                <tr>
                  <td
                    colSpan={4}
                    className="pt-6 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/20"
                  >
                    {section.title}
                  </td>
                </tr>
                {section.rows.map((row) => (
                  <tr
                    key={row.feature}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3 pr-4 text-sm text-white/50">{row.feature}</td>
                    <td className="py-3 px-3 text-center"><CellValue value={row.sovereign} /></td>
                    <td className="py-3 px-3 text-center"><CellValue value={row.mercury} /></td>
                    <td className="py-3 px-3 text-center"><CellValue value={row.enterprise} /></td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </FadeUp>
  )
}

// ============================================================================
// ROI SECTION — The Billable Hour Test
// ============================================================================

function RoiSection() {
  return (
    <FadeUp>
      <div className="rounded-2xl overflow-hidden bg-gradient-to-b from-amber-500/[0.04] to-transparent border border-amber-500/10 p-8 md:p-10">
        <div className="flex items-center gap-3 mb-6">
          <Calculator className="w-5 h-5 text-amber-400/60" />
          <h2 className="text-lg font-bold text-white tracking-tight">The Billable Hour Test</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <RoiStat label="Senior Partner Rate" value="$600 - $1,200" sub="per hour" />
          <RoiStat label="RAGbox Cost" value="$198" sub="per month (Sovereign + Mercury)" highlight />
          <RoiStat label="Break-Even" value="20 minutes" sub="of saved work per month" />
        </div>

        <p className="text-sm text-white/30 leading-relaxed max-w-2xl">
          If Mercury catches one liability in a contract that a human missed, it pays for itself for 10 years.
          This is not software cost. This is insurance premium.
        </p>
      </div>
    </FadeUp>
  )
}

function RoiStat({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className={`p-5 rounded-xl border ${highlight ? 'bg-amber-500/[0.05] border-amber-500/15' : 'bg-white/[0.02] border-white/[0.06]'}`}>
      <p className="text-xs text-white/30 uppercase tracking-wider font-medium mb-2">{label}</p>
      <p className={`text-2xl font-bold tracking-tight mb-0.5 ${highlight ? 'text-amber-400' : 'text-white'}`}>{value}</p>
      <p className="text-xs text-white/25">{sub}</p>
    </div>
  )
}

// ============================================================================
// FAQ
// ============================================================================

const FAQS = [
  {
    q: 'What happens to my data?',
    a: 'RAGbox operates on a zero-retention model. Your documents are encrypted at rest (AES-256) and in transit (TLS 1.3). We never train on your data. Enterprise adds CMEK so only your keys can decrypt.',
  },
  {
    q: 'Can I add Mercury later?',
    a: 'Yes. Start with Sovereign, then upgrade anytime from your dashboard. Mercury is added to your existing subscription with automatic proration.',
  },
  {
    q: 'What is Privilege Mode?',
    a: 'Attorney-Client Privilege Mode is a binary toggle that segregates privileged documents from normal queries. When active, privileged docs are invisible to standard users. Full audit trail included.',
  },
  {
    q: 'What does "Bring Your Own LLM" mean?',
    a: 'Mercury supports BYOLLM via OpenAI, Anthropic, Google AI, or OpenRouter. Your API key, your model, your data stays in your pipeline. Available with Mercury add-on.',
  },
]

function FaqSection() {
  return (
    <FadeUp>
      <h2 className="text-2xl font-bold text-white text-center mb-10 tracking-tight">
        Frequently Asked Questions
      </h2>
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {FAQS.map((faq) => (
          <div
            key={faq.q}
            className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/10 transition-colors"
          >
            <h3 className="text-sm font-semibold text-white mb-2">{faq.q}</h3>
            <p className="text-sm text-white/40 leading-relaxed">{faq.a}</p>
          </div>
        ))}
      </div>
    </FadeUp>
  )
}

// ============================================================================
// PAGE
// ============================================================================

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false)

  return (
    <main className="min-h-screen bg-[var(--bg-primary)]">
      <Navbar />

      {/* Hero */}
      <section className="pt-36 pb-10 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <FadeUp>
            <span className="inline-block text-[10px] font-bold uppercase tracking-[0.25em] text-amber-400/60 mb-4">
              Pricing
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4 leading-[1.15]">
              Digital Insurance<br />
              <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
                for Intellectual Property.
              </span>
            </h1>
            <p className="text-base text-white/40 max-w-xl mx-auto leading-relaxed">
              Not a chatbot. Not a search tool. Sovereign intelligence that
              pays for itself in 20 minutes of saved work.
            </p>
          </FadeUp>
        </div>
      </section>

      {/* Billing toggle */}
      <section className="px-6">
        <BillingToggle annual={isAnnual} onToggle={() => setIsAnnual((v) => !v)} />
      </section>

      {/* 3-Column Tier Cards */}
      <section className="pb-20 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          <FadeUp delay={0.05}>
            <SovereignCard isAnnual={isAnnual} />
          </FadeUp>
          <FadeUp delay={0.1}>
            <MercuryCard isAnnual={isAnnual} />
          </FadeUp>
          <FadeUp delay={0.15}>
            <EnterpriseCard />
          </FadeUp>
        </div>
      </section>

      {/* ROI Section */}
      <section className="pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          <RoiSection />
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <FadeUp>
            <h2 className="text-2xl font-bold text-white text-center mb-2 tracking-tight">
              Compare Plans
            </h2>
            <p className="text-sm text-white/30 text-center mb-10">
              Every plan includes the core Sovereign platform. Mercury adds multi-channel AI.
            </p>
          </FadeUp>
          <ComparisonTable />
        </div>
      </section>

      {/* FAQ */}
      <section className="pb-24 px-6">
        <div className="max-w-5xl mx-auto">
          <FaqSection />
        </div>
      </section>

      {/* Trust bar */}
      <section className="pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs tracking-[0.3em] font-mono text-white/15 uppercase">
            SOC2 Ready &middot; Zero Retention &middot; AES-256 Encrypted &middot; HIPAA Compliant &middot; SEC 17a-4 Audit
          </p>
        </div>
      </section>

      <Footer />
    </main>
  )
}
