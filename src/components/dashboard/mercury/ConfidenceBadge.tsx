'use client'

import React from 'react'

interface ConfidenceBadgeProps {
  confidence: number
}

function getConfidenceColor(confidence: number): { bg: string; text: string; dot: string } {
  if (confidence >= 0.85) {
    return { bg: 'bg-[var(--success)]/10', text: 'text-[var(--success)]', dot: 'bg-[var(--success)]' }
  }
  if (confidence >= 0.70) {
    return { bg: 'bg-[var(--warning)]/10', text: 'text-[var(--warning)]', dot: 'bg-[var(--warning)]' }
  }
  return { bg: 'bg-[var(--danger)]/10', text: 'text-[var(--danger)]', dot: 'bg-[var(--danger)]' }
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const pct = Math.round(confidence * 100)
  const color = getConfidenceColor(confidence)

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color.bg} ${color.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
      {pct}%
    </span>
  )
}
