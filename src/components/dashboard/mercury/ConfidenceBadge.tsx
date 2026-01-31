'use client'

import React from 'react'
import { CONFIDENCE_THRESHOLD } from '@/types/ragbox'

interface ConfidenceBadgeProps {
  confidence: number
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const isHigh = confidence >= CONFIDENCE_THRESHOLD
  const pct = Math.round(confidence * 100)

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        isHigh
          ? 'bg-[var(--success)]/10 text-[var(--success)]'
          : 'bg-[var(--warning)]/10 text-[var(--warning)]'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isHigh ? 'bg-[var(--success)]' : 'bg-[var(--warning)]'}`} />
      {pct}%
    </span>
  )
}
