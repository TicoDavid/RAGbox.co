'use client'

/**
 * DossierLayout — CIA-briefing-style response card
 *
 * Dark card with thin gold left border (#D4A853), confidence badge top-right,
 * answer as clean prose, sources collapsed under "View Evidence" drawer.
 */

import React, { useState } from 'react'
import { ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react'
import { MarkdownRenderer } from '../MarkdownRenderer'
import type { ChatMessage, Citation } from '@/types/ragbox'

export interface LayoutProps {
  content: string
  citations?: Citation[]
  confidence?: number
  message: ChatMessage
  onNavigateDocument: (docId: string) => void
}

export function DossierLayout({ content, citations, confidence, onNavigateDocument }: LayoutProps) {
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const pct = confidence != null ? Math.round(confidence * 100) : null
  const confColor =
    pct != null
      ? pct >= 85
        ? 'text-[var(--success)]'
        : pct >= 60
          ? 'text-[var(--warning)]'
          : 'text-[var(--danger)]'
      : ''

  return (
    <div className="rounded-xl bg-[var(--bg-secondary)] border-l-[3px] border-l-[#D4A853] border border-[var(--border-default)] overflow-hidden">
      {/* Header bar with confidence */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#D4A853]" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#D4A853]">
            Intelligence Briefing
          </span>
        </div>
        {pct != null && (
          <span className={`text-sm font-bold ${confColor}`}>{pct}% confidence</span>
        )}
      </div>

      {/* Answer prose */}
      <div className="px-5 py-4">
        <MarkdownRenderer
          content={content}
          onCitationClick={(idx) => {
            const cite = citations?.find((c, i) => (c.citationIndex ?? i) + 1 === idx)
            if (cite) onNavigateDocument(cite.documentId)
          }}
        />
      </div>

      {/* Collapsible evidence drawer */}
      {citations && citations.length > 0 && (
        <div className="border-t border-[var(--border-subtle)]">
          <button
            onClick={() => setEvidenceOpen(!evidenceOpen)}
            className="w-full flex items-center gap-2 px-5 py-2.5 text-xs font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            {evidenceOpen
              ? <ChevronDown className="w-3.5 h-3.5" />
              : <ChevronRight className="w-3.5 h-3.5" />
            }
            View Evidence ({citations.length} source{citations.length !== 1 ? 's' : ''})
          </button>
          {evidenceOpen && (
            <div className="px-5 pb-4 space-y-2">
              {citations.map((c, i) => (
                <button
                  key={i}
                  onClick={() => onNavigateDocument(c.documentId)}
                  className="w-full text-left p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] hover:border-[#D4A853]/30 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-[#D4A853]">
                      [{(c.citationIndex ?? i) + 1}]
                    </span>
                    <span className="text-xs font-medium text-[var(--text-primary)] truncate flex-1">
                      {c.documentName}
                    </span>
                    {c.relevanceScore != null && (
                      <span className="text-[10px] text-[var(--text-tertiary)]">
                        {Math.round(c.relevanceScore * 100)}%
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)] line-clamp-2">{c.excerpt}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
