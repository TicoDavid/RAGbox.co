'use client'

/**
 * AnalystLayout — Split 60/40 view
 *
 * Answer on the left (60%), evidence panel on the right (40%).
 * No tabs — answer and evidence visible simultaneously.
 * Clickable citations highlight the matching source card.
 */

import React, { useState } from 'react'
import { FileText } from 'lucide-react'
import { MarkdownRenderer } from '../MarkdownRenderer'
import type { ChatMessage, Citation } from '@/types/ragbox'
import type { LayoutProps } from './DossierLayout'

export function AnalystLayout({ content, citations, confidence, message, onNavigateDocument }: LayoutProps) {
  const [highlightedCitation, setHighlightedCitation] = useState<number | null>(null)
  const pct = confidence != null ? Math.round(confidence * 100) : null
  const confColor =
    pct != null
      ? pct >= 85
        ? 'text-[var(--success)]'
        : pct >= 60
          ? 'text-[var(--warning)]'
          : 'text-[var(--danger)]'
      : ''

  const meta = message.metadata as Record<string, unknown> | undefined
  const docsSearched = (meta?.docsSearched as number) ?? null
  const chunksEvaluated = (meta?.chunksEvaluated as number) ?? null

  return (
    <div className="flex gap-4">
      {/* Left: Answer (60%) */}
      <div className="w-[60%] min-w-0">
        <MarkdownRenderer
          content={content}
          onCitationClick={(idx) => {
            setHighlightedCitation(idx)
            const cite = citations?.find((c, i) => (c.citationIndex ?? i) + 1 === idx)
            if (cite) onNavigateDocument(cite.documentId)
          }}
        />
      </div>

      {/* Right: Evidence (40%) */}
      <div className="w-[40%] min-w-0 border-l border-[var(--border-subtle)] pl-4 space-y-3">
        {/* Confidence */}
        {pct != null && (
          <div className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)]">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold mb-1">
              Confidence
            </p>
            <p className={`text-2xl font-bold ${confColor}`}>{pct}%</p>
          </div>
        )}

        {/* Retrieval stats */}
        {(docsSearched != null || chunksEvaluated != null) && (
          <div className="grid grid-cols-2 gap-2">
            {docsSearched != null && (
              <div className="p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)]">
                <p className="text-lg font-bold text-[var(--text-primary)]">{docsSearched}</p>
                <p className="text-[10px] text-[var(--text-tertiary)]">Docs searched</p>
              </div>
            )}
            {chunksEvaluated != null && (
              <div className="p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)]">
                <p className="text-lg font-bold text-[var(--text-primary)]">{chunksEvaluated}</p>
                <p className="text-[10px] text-[var(--text-tertiary)]">Chunks evaluated</p>
              </div>
            )}
          </div>
        )}

        {/* Sources list */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold mb-2">
            Sources
          </p>
          {citations && citations.length > 0 ? (
            <div className="space-y-2">
              {citations.map((c, i) => {
                const idx = (c.citationIndex ?? i) + 1
                const isHighlighted = highlightedCitation === idx
                return (
                  <button
                    key={i}
                    onClick={() => onNavigateDocument(c.documentId)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                      isHighlighted
                        ? 'bg-[var(--brand-blue)]/10 border-[var(--brand-blue)]/30'
                        : 'bg-[var(--bg-secondary)] border-[var(--border-default)] hover:border-[var(--brand-blue)]/20'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <FileText className="w-3 h-3 text-[var(--brand-blue)]" />
                      <span className="text-xs font-medium text-[var(--text-primary)] truncate flex-1">
                        {c.documentName}
                      </span>
                      <span className="text-[10px] font-bold text-[var(--brand-blue)]">[{idx}]</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-tertiary)] line-clamp-2">{c.excerpt}</p>
                    {c.relevanceScore != null && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div className="flex-1 h-1 rounded-full bg-[var(--bg-tertiary)]">
                          <div
                            className="h-full rounded-full bg-[var(--brand-blue)]"
                            style={{ width: `${Math.round(c.relevanceScore * 100)}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-[var(--text-tertiary)]">
                          {Math.round(c.relevanceScore * 100)}%
                        </span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-tertiary)]">No sources cited</p>
          )}
        </div>
      </div>
    </div>
  )
}
