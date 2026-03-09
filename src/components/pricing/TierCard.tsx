'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Minus, ArrowRight, Loader2 } from 'lucide-react'
import type { TierDef } from './tierData'

interface TierCardProps {
  tier: TierDef
  isAnnual: boolean
  isCurrentPlan: boolean
  isAuthenticated: boolean
  onCheckout: (tierId: string, priceEnvKey: string) => Promise<void>
}

export function TierCard({ tier, isAnnual, isCurrentPlan, isAuthenticated, onCheckout }: TierCardProps) {
  const [loading, setLoading] = useState(false)
  const price = isAnnual ? tier.annualPrice : tier.monthlyPrice
  const isContactSales = tier.id === 'aiteam'
  const isPopular = !!tier.popular

  const handleClick = async () => {
    if (isCurrentPlan || loading) return
    if (isContactSales) {
      window.location.href = 'mailto:sales@ragbox.co?subject=AI%20Team%20Plan%20Inquiry'
      return
    }
    if (!isAuthenticated) {
      window.location.href = '/login?redirect=/pricing'
      return
    }
    const envKey = isAnnual ? tier.priceEnvKey.annual : tier.priceEnvKey.monthly
    setLoading(true)
    try {
      await onCheckout(tier.id, envKey)
    } finally {
      setLoading(false)
    }
  }

  const ctaLabel = isCurrentPlan
    ? 'Current Plan'
    : !isAuthenticated
      ? tier.cta
      : isContactSales
        ? 'Contact Sales'
        : 'Upgrade'

  const featureEntries = Object.entries(tier.features)

  return (
    <div
      className={`
        relative flex flex-col rounded-xl transition-all duration-200
        bg-[var(--bg-secondary)] border hover:shadow-lg hover:-translate-y-0.5
        ${isPopular
          ? 'border-[var(--brand-blue)] ring-1 ring-[var(--brand-blue)]'
          : 'border-[var(--border-default)]'
        }
      `}
    >
      {/* Popular badge */}
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-amber-500 to-amber-600 text-black">
            Most Popular
          </span>
        </div>
      )}

      <div className="p-6 flex flex-col flex-1">
        {/* Tier name */}
        <h3 className="text-lg font-bold text-[var(--text-primary)] font-[family-name:var(--font-space)]">
          {tier.name}
        </h3>

        {/* Price */}
        <div className="mt-3 mb-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${tier.id}-${isAnnual}`}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              className="flex items-baseline gap-1"
            >
              <span className="text-4xl font-bold text-[var(--text-primary)] font-[family-name:var(--font-space)]">
                ${price.toLocaleString()}
              </span>
              <span className="text-sm text-[var(--text-tertiary)]">
                {isAnnual ? '/mo, billed annually' : '/month'}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Description */}
        <p className="text-sm text-[var(--text-secondary)] mb-5">
          {tier.description}
        </p>

        {/* Feature list */}
        <ul className="space-y-2 flex-1 mb-6">
          {featureEntries.map(([name, value]) => {
            const isIncluded = value === true || typeof value === 'string'
            return (
              <li key={name} className="flex items-start gap-2 text-sm">
                {isIncluded ? (
                  <Check className="w-4 h-4 text-[var(--success)] shrink-0 mt-0.5" />
                ) : (
                  <Minus className="w-4 h-4 text-[var(--text-tertiary)]/40 shrink-0 mt-0.5" />
                )}
                <span className={isIncluded ? 'text-[var(--text-secondary)]' : 'text-[var(--text-tertiary)]/60'}>
                  {typeof value === 'string' ? `${name}: ${value}` : name}
                </span>
              </li>
            )
          })}
        </ul>

        {/* CTA button */}
        <button
          onClick={handleClick}
          disabled={isCurrentPlan || loading}
          className={`
            w-full py-3 rounded-lg text-sm font-semibold transition-all duration-200
            flex items-center justify-center gap-2
            ${isCurrentPlan
              ? 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] cursor-default'
              : isPopular
                ? 'bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white shadow-lg shadow-[var(--brand-blue)]/20'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] border border-[var(--border-default)]'
            }
            disabled:opacity-60
          `}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              {ctaLabel}
              {!isCurrentPlan && <ArrowRight className="w-4 h-4" />}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
