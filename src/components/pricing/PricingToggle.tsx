'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface PricingToggleProps {
  isAnnual: boolean
  onToggle: (annual: boolean) => void
}

export function PricingToggle({ isAnnual, onToggle }: PricingToggleProps) {
  return (
    <div className="flex items-center justify-center gap-3">
      <button
        onClick={() => onToggle(false)}
        className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          !isAnnual
            ? 'text-[var(--text-primary)]'
            : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
        }`}
      >
        {!isAnnual && (
          <motion.div
            layoutId="pricing-toggle"
            className="absolute inset-0 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-default)]"
            transition={{ duration: 0.2 }}
          />
        )}
        <span className="relative z-10">Monthly</span>
      </button>
      <button
        onClick={() => onToggle(true)}
        className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          isAnnual
            ? 'text-[var(--text-primary)]'
            : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
        }`}
      >
        {isAnnual && (
          <motion.div
            layoutId="pricing-toggle"
            className="absolute inset-0 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-default)]"
            transition={{ duration: 0.2 }}
          />
        )}
        <span className="relative z-10">Annual</span>
        <span className="relative z-10 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--success)]/15 text-[var(--success)] border border-[var(--success)]/20">
          Save 20%
        </span>
      </button>
    </div>
  )
}
