'use client'

/**
 * InsightCard — Proactive pattern detection display
 *
 * Amber-bordered card that appears inline in the Mercury thread
 * when Evelyn's pattern detection generates insights.
 */

import React from 'react'
import { Lightbulb, X } from 'lucide-react'
import { useMercuryStore } from '@/stores/mercuryStore'

interface InsightCardProps {
  id: string
  content: string
}

export function InsightCard({ id, content }: InsightCardProps) {
  const dismissInsight = useMercuryStore((s) => s.dismissInsight)

  return (
    <div className="mb-4 rounded-xl border-l-[3px] border-l-[var(--warning)] border border-[var(--warning)]/20 bg-[var(--warning)]/5 p-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0 p-1.5 rounded-lg bg-[var(--warning)]/15">
          <Lightbulb className="w-4 h-4 text-[var(--warning)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--warning)] mb-1">
            Evelyn noticed:
          </p>
          <p className="text-sm text-[var(--text-primary)] leading-relaxed">
            {content}
          </p>
        </div>
        <button
          onClick={() => dismissInsight(id)}
          className="shrink-0 p-1 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50 transition-colors"
          aria-label="Dismiss insight"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
