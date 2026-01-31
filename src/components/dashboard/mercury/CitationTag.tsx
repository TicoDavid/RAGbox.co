'use client'

import React from 'react'
import type { Citation } from '@/types/ragbox'

interface CitationTagProps {
  citation: Citation
  onClick?: (citation: Citation) => void
}

export function CitationTag({ citation, onClick }: CitationTagProps) {
  return (
    <button
      onClick={() => onClick?.(citation)}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--brand-blue)]/10 text-[var(--brand-blue)] text-xs font-medium hover:bg-[var(--brand-blue)]/20 transition-colors"
      title={citation.excerpt}
    >
      <span>[{citation.citationIndex}]</span>
      <span className="max-w-[120px] truncate">{citation.documentName}</span>
    </button>
  )
}
