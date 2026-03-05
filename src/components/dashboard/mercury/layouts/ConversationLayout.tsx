'use client'

/**
 * ConversationLayout — Natural flowing dialogue
 *
 * No cards, no borders — clean flowing text with Mercury avatar inline.
 * Inline citation chips that glow on hover, sources as compact chip row.
 */

import React from 'react'
import { MarkdownRenderer } from '../MarkdownRenderer'
import type { Citation } from '@/types/ragbox'
import type { LayoutProps } from './DossierLayout'

export function ConversationLayout({ content, citations, onNavigateDocument }: LayoutProps) {
  return (
    <div>
      <MarkdownRenderer
        content={content}
        onCitationClick={(idx) => {
          const cite = citations?.find((c, i) => (c.citationIndex ?? i) + 1 === idx)
          if (cite) onNavigateDocument(cite.documentId)
        }}
      />
      {/* Inline citation chips below answer */}
      {citations && citations.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-[var(--border-subtle)]">
          {citations.map((c, i) => (
            <button
              key={i}
              onClick={() => onNavigateDocument(c.documentId)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--brand-blue)]/10 text-[var(--brand-blue)] text-[11px] font-medium hover:bg-[var(--brand-blue)]/20 hover:shadow-[0_0_8px_var(--brand-blue)] transition-all"
              title={c.excerpt?.slice(0, 120)}
            >
              <span className="font-bold">[{(c.citationIndex ?? i) + 1}]</span>
              <span className="truncate max-w-[120px]">{c.documentName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
