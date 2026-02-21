// THEME-EXEMPT: Public pricing page, locked to Obsidian Gold palette
'use client'

import React, { useState } from 'react'
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
  Globe,
} from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import Footer from '@/components/Footer'

// ============================================================================
// TIER DATA
// ============================================================================

type BillingCycle = 'monthly' | 'annual'

interface PriceTier {
  id: string
  name: string
  tagline: string
  icon: React.ElementType
  monthlyPrice: number | null // null = "Contact us"
  annualPrice: number | null
  highlight: boolean // gold border treatment
  cta: string
  features: string[]
  limits: { storage: string; documents: string; users: string; queries: string }
}

const TIERS: PriceTier[] = [
  {
    id: 'analyst',
    name: 'Analyst',
    tagline: 'For solo practitioners and small teams getting started.',
    icon: Zap,
    monthlyPrice: 49,
    annualPrice: 39,
    highlight: false,
    cta: 'Start Free Trial',
    limits: {
      storage: '5 GB',
      documents: '500 docs',
      users: '3 seats',
      queries: '1,000 / mo',
    },
    features: [
      'Sovereign RAG pipeline',
      'Document ingestion (PDF, DOCX, TXT)',
      'Citation-backed answers',
      'Mercury AI assistant',
      'Silence Protocol (confidence gating)',
      'Basic audit log',
      'Cobalt theme',
    ],
  },
  {
    id: 'counsel',
    name: 'Counsel',
    tagline: 'For growing firms with compliance and privilege needs.',
    icon: Shield,
    monthlyPrice: 149,
    annualPrice: 119,
    highlight: true,
    cta: 'Start Free Trial',
    limits: {
      storage: '50 GB',
      documents: '5,000 docs',
      users: '15 seats',
      queries: '10,000 / mo',
    },
    features: [
      'Everything in Analyst',
      'Attorney-Client Privilege Mode',
      'Veritas immutable audit trail',
      'BYOLLM (bring your own LLM)',
      'Mercury Voice agent',
      'Multi-channel (Email, WhatsApp, SMS)',
      'Vault access control & clearance levels',
      'All 4 themes',
      'Priority support',
    ],
  },
  {
    id: 'sovereign',
    name: 'Sovereign',
    tagline: 'For enterprises requiring full data sovereignty.',
    icon: Crown,
    monthlyPrice: null,
    annualPrice: null,
    highlight: false,
    cta: 'Contact Sales',
    limits: {
      storage: 'Unlimited',
      documents: 'Unlimited',
      users: 'Unlimited',
      queries: 'Unlimited',
    },
    features: [
      'Everything in Counsel',
      'Dedicated Cloud Run instance',
      'CMEK encryption (your keys)',
      'VPC peering & private endpoints',
      'SOC 2 Type II attestation',
      'Custom SSO / SAML',
      'SLA with 99.9% uptime',
      'White-glove onboarding',
      'Dedicated success manager',
    ],
  },
]

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function BillingToggle({ cycle, onChange }: { cycle: BillingCycle; onChange: (c: BillingCycle) => void }) {
  return (
    <div className="flex items-center justify-center gap-3">
      <span className={`text-sm font-medium transition-colors ${cycle === 'monthly' ? 'text-white' : 'text-white/40'}`}>
        Monthly
      </span>
      <button
        onClick={() => onChange(cycle === 'monthly' ? 'annual' : 'monthly')}
        className="relative w-14 h-7 rounded-full bg-white/10 border border-amber-500/20 transition-colors"
        aria-label="Toggle billing cycle"
      >
        <motion.div
          className="absolute top-[3px] w-5 h-5 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]"
          animate={{ left: cycle === 'monthly' ? '3px' : '33px' }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      </button>
      <span className={`text-sm font-medium transition-colors ${cycle === 'annual' ? 'text-white' : 'text-white/40'}`}>
        Annual
      </span>
      {cycle === 'annual' && (
        <motion.span
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full"
        >
          Save 20%
        </motion.span>
      )}
    </div>
  )
}

function LimitRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 text-white/50 text-sm">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <span className="text-sm font-semibold text-white/80">{value}</span>
    </div>
  )
}

function TierCard({ tier, cycle }: { tier: PriceTier; cycle: BillingCycle }) {
  const price = cycle === 'monthly' ? tier.monthlyPrice : tier.annualPrice
  const Icon = tier.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
      className={`
        relative flex flex-col rounded-2xl overflow-hidden
        bg-[#0a0e1a]/80 backdrop-blur-sm
        border transition-all duration-300
        ${tier.highlight
          ? 'border-amber-500/40 shadow-[0_0_40px_-10px_rgba(245,158,11,0.2)]'
          : 'border-white/[0.06] hover:border-white/10'
        }
      `}
    >
      {/* Popular badge */}
      {tier.highlight && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
      )}

      {/* Header */}
      <div className={`px-7 pt-7 pb-5 ${tier.highlight ? 'bg-amber-500/[0.03]' : ''}`}>
        {tier.highlight && (
          <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full mb-4">
            Most Popular
          </span>
        )}

        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            tier.highlight
              ? 'bg-amber-500/15 text-amber-400'
              : 'bg-white/5 text-white/50'
          }`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">{tier.name}</h3>
          </div>
        </div>

        <p className="text-sm text-white/40 leading-relaxed mb-6">{tier.tagline}</p>

        {/* Price */}
        <div className="flex items-baseline gap-1.5 mb-1">
          {price !== null ? (
            <>
              <span className="text-4xl font-bold text-white tracking-tight">${price}</span>
              <span className="text-sm text-white/30 font-medium">/ seat / mo</span>
            </>
          ) : (
            <span className="text-2xl font-bold text-white tracking-tight">Custom</span>
          )}
        </div>
        {price !== null && cycle === 'annual' && (
          <p className="text-xs text-amber-400/60">billed annually</p>
        )}
      </div>

      {/* Divider */}
      <div className="mx-7 h-px bg-white/[0.06]" />

      {/* Limits */}
      <div className="px-7 py-4">
        <LimitRow icon={HardDrive} label="Storage" value={tier.limits.storage} />
        <LimitRow icon={FileText} label="Documents" value={tier.limits.documents} />
        <LimitRow icon={Users} label="Team" value={tier.limits.users} />
        <LimitRow icon={Bot} label="Queries" value={tier.limits.queries} />
      </div>

      {/* Divider */}
      <div className="mx-7 h-px bg-white/[0.06]" />

      {/* Features */}
      <div className="px-7 py-5 flex-1">
        <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">
          {tier.id === 'analyst' ? 'Includes' : tier.id === 'counsel' ? 'Everything in Analyst, plus' : 'Everything in Counsel, plus'}
        </p>
        <ul className="space-y-2.5">
          {tier.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm text-white/60">
              <Check className={`w-4 h-4 shrink-0 mt-0.5 ${tier.highlight ? 'text-amber-400' : 'text-blue-400/60'}`} />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="px-7 pb-7 mt-auto">
        <button
          className={`
            w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200
            flex items-center justify-center gap-2
            ${tier.highlight
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/20'
              : tier.monthlyPrice === null
                ? 'bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:border-white/20'
                : 'bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:border-white/20'
            }
          `}
        >
          {tier.cta}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  )
}

// ============================================================================
// COMPARISON TABLE
// ============================================================================

interface CompareRow {
  label: string
  icon: React.ElementType
  analyst: string | boolean
  counsel: string | boolean
  sovereign: string | boolean
}

const COMPARE_ROWS: CompareRow[] = [
  { label: 'Storage', icon: HardDrive, analyst: '5 GB', counsel: '50 GB', sovereign: 'Unlimited' },
  { label: 'Documents', icon: FileText, analyst: '500', counsel: '5,000', sovereign: 'Unlimited' },
  { label: 'Team seats', icon: Users, analyst: '3', counsel: '15', sovereign: 'Unlimited' },
  { label: 'Mercury AI', icon: Bot, analyst: true, counsel: true, sovereign: true },
  { label: 'Voice Agent', icon: Mic, analyst: false, counsel: true, sovereign: true },
  { label: 'Multi-channel', icon: Globe, analyst: false, counsel: true, sovereign: true },
  { label: 'Privilege Mode', icon: Lock, analyst: false, counsel: true, sovereign: true },
  { label: 'BYOLLM', icon: Zap, analyst: false, counsel: true, sovereign: true },
  { label: 'Immutable Audit', icon: Shield, analyst: false, counsel: true, sovereign: true },
  { label: 'Dedicated Instance', icon: Building2, analyst: false, counsel: false, sovereign: true },
  { label: 'CMEK Encryption', icon: Lock, analyst: false, counsel: false, sovereign: true },
  { label: 'Custom SSO', icon: Users, analyst: false, counsel: false, sovereign: true },
]

function CompareCell({ value }: { value: string | boolean }) {
  if (typeof value === 'boolean') {
    return value ? (
      <Check className="w-4 h-4 text-amber-400 mx-auto" />
    ) : (
      <span className="block w-4 h-px bg-white/10 mx-auto" />
    )
  }
  return <span className="text-sm text-white/60 font-medium">{value}</span>
}

function ComparisonTable() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5 }}
      className="mt-28"
    >
      <h2 className="text-2xl font-bold text-white text-center mb-2 tracking-tight">
        Compare Plans
      </h2>
      <p className="text-sm text-white/30 text-center mb-10">
        Every plan includes end-to-end encryption and zero data retention.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="py-4 pr-6 text-xs font-semibold text-white/30 uppercase tracking-wider w-1/4">Feature</th>
              <th className="py-4 px-4 text-center text-xs font-semibold text-white/30 uppercase tracking-wider w-1/4">Analyst</th>
              <th className="py-4 px-4 text-center text-xs font-semibold text-amber-400/60 uppercase tracking-wider w-1/4">Counsel</th>
              <th className="py-4 pl-4 text-center text-xs font-semibold text-white/30 uppercase tracking-wider w-1/4">Sovereign</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map((row) => {
              const Icon = row.icon
              return (
                <tr key={row.label} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 pr-6">
                    <div className="flex items-center gap-2.5 text-sm text-white/50">
                      <Icon className="w-4 h-4 shrink-0" />
                      {row.label}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center"><CompareCell value={row.analyst} /></td>
                  <td className="py-3.5 px-4 text-center bg-amber-500/[0.02]"><CompareCell value={row.counsel} /></td>
                  <td className="py-3.5 pl-4 text-center"><CompareCell value={row.sovereign} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  )
}

// ============================================================================
// FAQ
// ============================================================================

const FAQS = [
  {
    q: 'What happens to my data?',
    a: 'RAGbox operates on a zero-retention model. Your documents are encrypted at rest (AES-256) and in transit (TLS 1.3). We never train on your data. Sovereign tier adds CMEK so only your keys can decrypt.',
  },
  {
    q: 'Can I bring my own LLM?',
    a: 'Yes. Counsel and Sovereign plans support BYOLLM via OpenAI, Anthropic, Google AI, or OpenRouter. Your API key, your model, your data stays in your pipeline.',
  },
  {
    q: 'What is Privilege Mode?',
    a: 'Attorney-Client Privilege Mode is a binary toggle that segregates privileged documents from normal queries. When active, privileged docs are invisible to standard users. Full audit trail included.',
  },
  {
    q: 'Do you offer a free trial?',
    a: 'Yes. Analyst and Counsel plans include a 14-day free trial with full feature access. No credit card required to start.',
  },
]

function FaqSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5 }}
      className="mt-28"
    >
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
    </motion.div>
  )
}

// ============================================================================
// PAGE
// ============================================================================

export default function PricingPage() {
  const [cycle, setCycle] = useState<BillingCycle>('annual')

  return (
    <main className="min-h-screen bg-[#020408]">
      <Navbar />

      {/* Hero */}
      <section className="pt-36 pb-16 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block text-[10px] font-bold uppercase tracking-[0.25em] text-amber-400/60 mb-4">
              Pricing
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4 leading-[1.15]">
              Sovereign intelligence,<br />
              <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
                priced for reality.
              </span>
            </h1>
            <p className="text-base text-white/40 max-w-xl mx-auto mb-10 leading-relaxed">
              Every plan includes end-to-end encryption, zero data retention,
              and the RAG pipeline your compliance team will love.
            </p>
          </motion.div>

          <BillingToggle cycle={cycle} onChange={setCycle} />
        </div>
      </section>

      {/* Tier Cards */}
      <section className="pb-20 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          {TIERS.map((tier) => (
            <TierCard key={tier.id} tier={tier} cycle={cycle} />
          ))}
        </div>
      </section>

      {/* Comparison Table */}
      <section className="pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <ComparisonTable />
        </div>
      </section>

      {/* FAQ */}
      <section className="pb-24 px-6">
        <div className="max-w-5xl mx-auto">
          <FaqSection />
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="pb-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="p-10 rounded-2xl bg-gradient-to-b from-amber-500/[0.04] to-transparent border border-amber-500/10">
            <Crown className="w-8 h-8 text-amber-400/60 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Need something custom?</h2>
            <p className="text-sm text-white/40 mb-6 leading-relaxed">
              On-prem deployment, custom integrations, dedicated infrastructure.<br />
              Our team will architect the perfect sovereign stack.
            </p>
            <a
              href="https://theconnexus.ai/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-semibold hover:bg-white/10 hover:border-white/20 transition-all"
            >
              Talk to Sales
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
