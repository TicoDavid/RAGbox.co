// THEME-EXEMPT: Public pricing page, locked to Obsidian Gold palette
// Pricing canonical source: connexus-ops/docs/POS-BILLING-ARCHITECTURE.md
'use client'

import React from 'react'
import { motion } from 'framer-motion'
import {
  Check,
  Shield,
  Zap,
  Crown,
  ArrowRight,
  Building2,
  Lock,
  FileText,
  Users,
  HardDrive,
  Bot,
  Mic,
  Mail,
  MessageCircle,
  Monitor,
  Plus,
  Calculator,
} from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import Footer from '@/components/Footer'

// ============================================================================
// STRIPE PLACEHOLDERS — wire to real price IDs when Stripe products configured
// ============================================================================

async function handleCheckout(plan: 'sovereign' | 'sovereign_mercury') {
  const res = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  })
  const { url } = await res.json()
  if (url) window.location.href = url
}

function handleEnterprise() {
  // Syndicate is sales-led, not self-serve
  window.location.href = 'mailto:david@theconnexus.ai?subject=RAGb%C3%B6x%20Syndicate%20%E2%80%94%20Enterprise%20Inquiry'
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
// SOVEREIGN CARD — The Anchor
// ============================================================================

const SOVEREIGN_FEATURES = [
  'Unlimited Vault storage',
  'Sovereign RAG pipeline (Aegis AI)',
  'Citation-backed answers with source verification',
  'Silence Protocol (confidence gating)',
  'Sovereign Studio — reports, decks, evidence timelines',
  '10 Expert Personas (CEO to Whistleblower)',
  'Privilege Mode (Attorney-Client segregation)',
  'Veritas immutable audit trail',
  'AES-256-GCM encryption at rest',
]

function SovereignCard() {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-[#0a0e1a]/80 backdrop-blur-sm border border-amber-500/30 shadow-[0_0_60px_-15px_rgba(245,158,11,0.15)]">
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent" />

      <div className="p-8 md:p-10">
        {/* Badge */}
        <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full mb-5">
          The Foundation
        </span>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
          {/* Left: Identity */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-xl bg-amber-500/15 flex items-center justify-center">
                <Shield className="w-5.5 h-5.5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Sovereign</h2>
                <p className="text-sm text-white/30">Digital Insurance for Intellectual Property</p>
              </div>
            </div>

            <p className="text-sm text-white/40 leading-relaxed mb-6 max-w-lg">
              Everything you need to transform unstructured documents into sovereign intelligence.
              One user. Unlimited power.
            </p>

            {/* Features grid */}
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
              {SOVEREIGN_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-white/55">
                  <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Right: Price + CTA */}
          <div className="shrink-0 md:text-right md:min-w-[200px]">
            <div className="flex items-baseline gap-1.5 md:justify-end mb-1">
              <span className="text-5xl font-bold text-white tracking-tight">$99</span>
              <span className="text-sm text-white/30 font-medium">/ mo</span>
            </div>
            <p className="text-xs text-white/25 mb-6">Single user. Cancel anytime.</p>

            <button
              onClick={() => handleCheckout('sovereign')}
              className="w-full md:w-auto px-8 py-3.5 rounded-xl text-sm font-bold transition-all duration-200
                         bg-gradient-to-r from-amber-500 to-amber-600 text-black
                         hover:from-amber-400 hover:to-amber-500
                         shadow-lg shadow-amber-500/20"
            >
              Start Free Trial
              <ArrowRight className="w-4 h-4 inline ml-2" />
            </button>
            <p className="text-[11px] text-white/20 mt-2.5">14 days free. No credit card required.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// PLUS CONNECTOR
// ============================================================================

function PlusConnector() {
  return (
    <div className="flex items-center justify-center py-4">
      <div className="w-px h-8 bg-white/[0.06]" />
      <div className="mx-4 w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
        <Plus className="w-5 h-5 text-amber-400/60" />
      </div>
      <div className="w-px h-8 bg-white/[0.06]" />
    </div>
  )
}

// ============================================================================
// MERCURY CARD — The Digital Hire
// ============================================================================

const MERCURY_CHANNELS = [
  { icon: Mic, label: 'Voice' },
  { icon: Monitor, label: 'Chat' },
  { icon: Mail, label: 'Email' },
  { icon: MessageCircle, label: 'SMS' },
]

const MERCURY_FEATURES = [
  'Mercury AI assistant across every channel',
  'Voice agent — talk to your documents',
  'Email integration (reads and responds)',
  'SMS & WhatsApp support',
  'BYOLLM (bring your own LLM)',
  'Multi-channel conversation history',
]

function MercuryCard() {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-[#0a0e1a]/80 backdrop-blur-sm border border-white/[0.08] hover:border-amber-500/20 transition-colors">
      <div className="p-8 md:p-10">
        {/* Badge */}
        <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-[#D4A853] bg-[#D4A853]/10 border border-[#D4A853]/20 px-2.5 py-1 rounded-full mb-5">
          The Digital Hire
        </span>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
          {/* Left: Identity */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-xl bg-[#D4A853]/15 flex items-center justify-center">
                <Bot className="w-5.5 h-5.5 text-[#D4A853]" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Protocol Mercury</h2>
                <p className="text-sm text-white/30">Add-on to Sovereign</p>
              </div>
            </div>

            <p className="text-sm text-white/40 leading-relaxed mb-5 max-w-lg">
              For $99, you hire an Executive Assistant that listens to every call, reads every email,
              and works 24/7/365. A real EA costs $60,000/year. Mercury costs $1,200.
            </p>

            {/* Channel icons */}
            <div className="flex items-center gap-3 mb-5">
              {MERCURY_CHANNELS.map((ch) => {
                const Icon = ch.icon
                return (
                  <div
                    key={ch.label}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">{ch.label}</span>
                  </div>
                )
              })}
            </div>

            {/* Features */}
            <ul className="space-y-2.5">
              {MERCURY_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-white/55">
                  <Check className="w-4 h-4 text-[#D4A853] shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Right: Price + CTA */}
          <div className="shrink-0 md:text-right md:min-w-[200px]">
            <div className="flex items-baseline gap-1.5 md:justify-end mb-1">
              <span className="text-lg text-white/30 font-medium">+</span>
              <span className="text-5xl font-bold text-white tracking-tight">$99</span>
              <span className="text-sm text-white/30 font-medium">/ mo</span>
            </div>
            <p className="text-xs text-white/25 mb-2">Requires Sovereign plan.</p>

            {/* ROI callout */}
            <div className="inline-block px-3 py-1.5 rounded-lg bg-amber-500/[0.07] border border-amber-500/15 mb-5">
              <p className="text-[11px] text-amber-400/70 font-medium">
                98% cheaper than a human EA
              </p>
            </div>

            <div>
              <button
                onClick={() => handleCheckout('sovereign_mercury')}
                className="w-full md:w-auto px-8 py-3.5 rounded-xl text-sm font-bold transition-all duration-200
                           bg-white/5 text-white border border-white/10
                           hover:bg-white/10 hover:border-white/20"
              >
                Get Sovereign + Mercury
                <ArrowRight className="w-4 h-4 inline ml-2" />
              </button>
              <p className="text-xs text-white/25 mt-2 md:text-right">$198/mo total. 14 days free.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SYNDICATE CARD — The Enterprise
// ============================================================================

const SYNDICATE_FEATURES = [
  'Dedicated Cloud Run instance',
  'CMEK encryption (your keys)',
  'Custom SSO / SAML (Okta)',
  'VPC peering & private endpoints',
  'Data residency (Frankfurt / NY / London)',
  'SLA with 99.9% uptime guarantee',
  'Dedicated success manager',
  'White-glove onboarding',
]

function SyndicateCard() {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-[#0a0e1a]/60 backdrop-blur-sm border border-white/[0.06]">
      <div className="p-8 md:p-10">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
          {/* Left */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center">
                <Crown className="w-5.5 h-5.5 text-white/40" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Syndicate</h2>
                <p className="text-sm text-white/30">Enterprise Governance</p>
              </div>
            </div>

            <p className="text-sm text-white/40 leading-relaxed mb-6 max-w-lg">
              For firms that require full data sovereignty, dedicated infrastructure,
              and compliance-grade SLAs. We do not sell seats — we sell governance.
            </p>

            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
              {SYNDICATE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-white/50">
                  <Check className="w-4 h-4 text-white/25 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Right */}
          <div className="shrink-0 md:text-right md:min-w-[200px]">
            <p className="text-sm text-white/25 uppercase tracking-wider font-semibold mb-1">Starting at</p>
            <div className="flex items-baseline gap-1.5 md:justify-end mb-1">
              <span className="text-4xl font-bold text-white tracking-tight">$25K</span>
              <span className="text-sm text-white/30 font-medium">/ year</span>
            </div>
            <p className="text-xs text-white/25 mb-6">Annual contract. Prepaid.</p>

            <button
              onClick={handleEnterprise}
              className="w-full md:w-auto px-8 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200
                         bg-white/[0.04] text-white/70 border border-white/[0.08]
                         hover:bg-white/[0.08] hover:text-white hover:border-white/15"
            >
              Talk to Sales
              <ArrowRight className="w-4 h-4 inline ml-2" />
            </button>
          </div>
        </div>
      </div>
    </div>
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
          <RoiStat
            label="Senior Partner Rate"
            value="$600 – $1,200"
            sub="per hour"
          />
          <RoiStat
            label="RAGböx Cost"
            value="$198"
            sub="per month (Sovereign + Mercury)"
            highlight
          />
          <RoiStat
            label="Break-Even"
            value="20 minutes"
            sub="of saved work per month"
          />
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
    a: 'RAGböx operates on a zero-retention model. Your documents are encrypted at rest (AES-256) and in transit (TLS 1.3). We never train on your data. Syndicate adds CMEK so only your keys can decrypt.',
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
  return (
    <main className="min-h-screen bg-[#020408]">
      <Navbar />

      {/* Hero */}
      <section className="pt-36 pb-16 px-6">
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

      {/* Sovereign Card */}
      <section className="pb-2 px-6">
        <div className="max-w-4xl mx-auto">
          <FadeUp delay={0.1}>
            <SovereignCard />
          </FadeUp>
        </div>
      </section>

      {/* Plus Connector */}
      <section className="px-6">
        <div className="max-w-4xl mx-auto">
          <PlusConnector />
        </div>
      </section>

      {/* Mercury Card */}
      <section className="pt-2 pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          <FadeUp delay={0.15}>
            <MercuryCard />
          </FadeUp>
        </div>
      </section>

      {/* ROI Section */}
      <section className="pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          <RoiSection />
        </div>
      </section>

      {/* Syndicate */}
      <section className="pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <FadeUp>
            <div className="text-center mb-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/20 mb-2">Enterprise</p>
              <div className="w-12 h-px bg-white/[0.06] mx-auto" />
            </div>
            <SyndicateCard />
          </FadeUp>
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
