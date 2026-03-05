'use client'

import React, { useState } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Check,
  Crown,
  Shield,
  Zap,
  ArrowRight,
  Loader2,
  Mic,
  Monitor,
  Mail,
  MessageCircle,
} from 'lucide-react'

// ============================================================================
// PLAN DATA
// ============================================================================

interface PlanDef {
  key: 'starter' | 'professional' | 'enterprise'
  name: string
  price: number
  badge?: string
  tagline: string
  icon: React.ElementType
  features: string[]
  mercuryNote: string
  channels: Array<{ icon: React.ElementType; label: string }>
  cta: string
}

const PLANS: PlanDef[] = [
  {
    key: 'starter',
    name: 'Starter',
    price: 149,
    tagline: 'For individuals',
    icon: Shield,
    features: [
      'Vault document storage (5 GB)',
      'Aegis RAG pipeline',
      'Citation-backed answers',
      'Silence Protocol',
      '5 Expert Personas',
      'Veritas audit trail',
      'AES-256-GCM encryption',
    ],
    mercuryNote: 'Mercury text chat only',
    channels: [{ icon: Monitor, label: 'Chat' }],
    cta: 'Get Started',
  },
  {
    key: 'professional',
    name: 'Professional',
    price: 399,
    badge: 'Most Popular',
    tagline: 'Full Mercury AI',
    icon: Crown,
    features: [
      'Everything in Starter',
      'Unlimited Vault storage',
      'Mercury AI across every channel',
      'Voice agent — talk to your docs',
      'Email & SMS integration',
      'BYOLLM (bring your own LLM)',
      'Sovereign Studio',
      'Unlimited Expert Personas',
      'Privilege Mode',
      'Priority support',
    ],
    mercuryNote: 'All Mercury channels unlocked',
    channels: [
      { icon: Monitor, label: 'Chat' },
      { icon: Mic, label: 'Voice' },
      { icon: Mail, label: 'Email' },
      { icon: MessageCircle, label: 'SMS' },
    ],
    cta: 'Choose Professional',
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: 999,
    tagline: 'Dedicated infrastructure',
    icon: Zap,
    features: [
      'Everything in Professional',
      'Dedicated infrastructure',
      'CMEK encryption (your keys)',
      'SSO / SAML authentication',
      'VPC Peering',
      '99.9% SLA guarantee',
      'WhatsApp channel',
      'Custom integrations',
      'Dedicated support engineer',
    ],
    mercuryNote: 'All channels + WhatsApp + priority',
    channels: [
      { icon: Monitor, label: 'Chat' },
      { icon: Mic, label: 'Voice' },
      { icon: Mail, label: 'Email' },
      { icon: MessageCircle, label: 'SMS' },
    ],
    cta: 'Choose Enterprise',
  },
]

// ============================================================================
// PLAN PAGE
// ============================================================================

export default function PlanGatePage() {
  const { status } = useSession()
  const [loading, setLoading] = useState<string | null>(null)
  const [promoCode, setPromoCode] = useState('')

  const handleCheckout = async (plan: string) => {
    // If not authenticated, trigger Google sign-in first
    if (status !== 'authenticated') {
      // Store selected plan so we can resume after auth
      try { sessionStorage.setItem('ragbox_pending_plan', plan) } catch { /* SSR */ }
      signIn('google', { callbackUrl: '/onboarding/plan' })
      return
    }

    setLoading(plan)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Checkout failed (${res.status})`)
      }
      const { url } = await res.json()
      if (url) {
        window.location.href = url
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (err) {
      setLoading(null)
      toast.error(err instanceof Error ? err.message : 'Checkout failed. Please try again.')
    }
  }

  // Resume checkout if user just authenticated after selecting a plan
  React.useEffect(() => {
    if (status !== 'authenticated') return
    try {
      const pending = sessionStorage.getItem('ragbox_pending_plan')
      if (pending) {
        sessionStorage.removeItem('ragbox_pending_plan')
        handleCheckout(pending)
      }
    } catch { /* SSR */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  return (
    <div className="min-h-screen bg-[#020408] flex flex-col items-center px-4 py-12">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10"
      >
        <span className="text-2xl font-bold tracking-tight text-white">
          RAG<span className="text-amber-400">box</span>
        </span>
      </motion.div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-center mb-10"
      >
        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-3">
          Choose Your Plan
        </h1>
        <p className="text-sm text-white/40 max-w-md mx-auto">
          Start with text chat on Starter, or unlock the full Mercury AI experience on Professional.
        </p>
      </motion.div>

      {/* Promo code */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-8 w-full max-w-xs"
      >
        <label className="block text-[10px] text-white/30 uppercase tracking-wider mb-1.5 font-medium">
          Promo / Beta Code
        </label>
        <input
          type="text"
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value)}
          placeholder="Enter code (applied at checkout)"
          className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 transition-all"
        />
        <p className="text-[10px] text-white/20 mt-1">Stripe validates codes at checkout. 100% discount codes create a $0 subscription.</p>
      </motion.div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
        {PLANS.map((plan, i) => {
          const isPro = plan.key === 'professional'
          const Icon = plan.icon
          return (
            <motion.div
              key={plan.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.1 }}
              className={`relative rounded-2xl overflow-hidden flex flex-col ${
                isPro
                  ? 'bg-[#0a0e1a] border-2 border-amber-500/40 shadow-xl shadow-amber-500/10'
                  : 'bg-[#0a0e1a]/80 border border-white/[0.08] hover:border-white/15'
              } transition-colors`}
            >
              {/* Most Popular badge */}
              {plan.badge && (
                <div className="absolute top-0 right-0 px-3 py-1 bg-amber-500 text-black text-[10px] font-bold uppercase tracking-wider rounded-bl-lg">
                  {plan.badge}
                </div>
              )}

              <div className="p-6 flex flex-col flex-1">
                {/* Icon + Name */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isPro ? 'bg-amber-500/15' : 'bg-white/5'
                  }`}>
                    <Icon className={`w-5 h-5 ${isPro ? 'text-amber-400' : 'text-white/50'}`} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">{plan.name}</h2>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">{plan.tagline}</p>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-white">${plan.price}</span>
                    <span className="text-sm text-white/30">/ mo</span>
                  </div>
                </div>

                {/* Mercury channels */}
                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-white/[0.06]">
                  <span className="text-[10px] text-white/30 uppercase tracking-wider shrink-0">Mercury:</span>
                  {plan.channels.map((ch) => (
                    <div key={ch.label} className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">
                      <ch.icon className="w-3 h-3 text-white/40" />
                      <span className="text-[10px] text-white/40">{ch.label}</span>
                    </div>
                  ))}
                </div>

                {/* Features */}
                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-white/50">
                      <Check className={`w-4 h-4 shrink-0 mt-0.5 ${isPro ? 'text-amber-400' : 'text-white/30'}`} />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  onClick={() => handleCheckout(plan.key)}
                  disabled={loading !== null}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
                    isPro
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/20'
                      : 'bg-white/[0.06] text-white/70 hover:bg-white/[0.1] hover:text-white border border-white/[0.08]'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {loading === plan.key ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {plan.cta}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-xs text-white/20 mt-10 text-center"
      >
        All plans include end-to-end encryption and SOC 2 compliance. Cancel anytime.
      </motion.p>
    </div>
  )
}
