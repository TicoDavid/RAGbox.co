'use client'

import React from 'react'
import { Sparkles, ArrowRight } from 'lucide-react'

interface FeaturePreviewCardProps {
  feature: string
  description: string
  requiredTier: string
  currentTier: string
  icon?: React.ReactNode
}

/**
 * Upgrade CTA shown as a "feature preview card" during beta.
 * Per David's decision (03-07): no hard blocks during beta, just upgrade nudges.
 */
export function FeaturePreviewCard({
  feature,
  description,
  requiredTier,
  currentTier,
  icon,
}: FeaturePreviewCardProps) {
  const isUpgradeNeeded = currentTier !== requiredTier

  return (
    <div className="rounded-xl border border-[var(--warning)]/20 bg-[var(--warning)]/5 p-5">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-lg bg-[var(--warning)]/10 flex items-center justify-center">
          {icon || <Sparkles className="w-5 h-5 text-[var(--warning)]" />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-0.5">
            {feature}
          </h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">
            {description}
          </p>
          {isUpgradeNeeded && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">
                Available on {requiredTier}
              </span>
              <a
                href="/pricing"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--warning)] hover:text-[var(--warning)] transition-colors"
              >
                View Plans
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
