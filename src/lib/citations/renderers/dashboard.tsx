/**
 * Dashboard Citation Card Renderer
 *
 * React component that renders a CitationBlock with:
 * - Color-coded left border (green/amber/red)
 * - Source name header + confidence badge pill
 * - Excerpt blockquote
 * - Clickable document link
 * - Expandable audit details
 */

'use client'

import { useState } from 'react'
import type { CitationBlock } from '../types'

const BORDER_COLORS: Record<string, string> = {
  green: 'border-l-emerald-500',
  amber: 'border-l-amber-500',
  red: 'border-l-red-500',
}

const BADGE_COLORS: Record<string, string> = {
  green: 'bg-emerald-500/20 text-emerald-400',
  amber: 'bg-amber-500/20 text-amber-400',
  red: 'bg-red-500/20 text-red-400',
}

const CONFIDENCE_LABELS: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

interface CitationCardProps {
  block: CitationBlock
  index: number
}

export function CitationCard({ block, index }: CitationCardProps) {
  const [expanded, setExpanded] = useState(false)

  const borderColor = BORDER_COLORS[block.confidenceColor] ?? 'border-l-slate-500'
  const badgeColor = BADGE_COLORS[block.confidenceColor] ?? 'bg-slate-500/20 text-slate-400'
  const label = CONFIDENCE_LABELS[block.confidenceLevel] ?? 'Unknown'

  return (
    <div
      className={`border-l-4 ${borderColor} bg-[var(--bg-secondary)] rounded-r-lg p-3 mb-2`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-[var(--text-tertiary)] font-mono shrink-0">
            [{index + 1}]
          </span>
          <span className="text-sm font-medium text-[var(--text-primary)] truncate">
            {block.sourceName}
          </span>
        </div>
        <span
          className={`${badgeColor} text-xs font-medium px-2 py-0.5 rounded-full shrink-0`}
        >
          {label} ({Math.round(block.confidenceScore * 100)}%)
        </span>
      </div>

      {/* Excerpt */}
      <blockquote className="text-sm text-[var(--text-secondary)] border-l-2 border-[var(--border-default)] pl-3 my-2 italic">
        &ldquo;{block.excerpt}&rdquo;
      </blockquote>

      {/* Document link */}
      <div className="flex items-center justify-between mt-2">
        <a
          href={block.documentUrl}
          className="text-xs text-[var(--brand-blue)] hover:text-[var(--brand-blue-hover)] transition-colors"
        >
          View source document
        </a>
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
        >
          {expanded ? 'Hide details' : 'Audit details'}
        </button>
      </div>

      {/* Expandable audit details */}
      {expanded && (
        <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] text-xs text-[var(--text-tertiary)] font-mono space-y-1">
          <div>Source: {block.sourceType}</div>
          <div>Doc ID: {block.documentId}</div>
          {block.chunkId && <div>Chunk: {block.chunkId}</div>}
          <div>Retrieved: {block.retrievalTimestamp}</div>
          <div>Query hash: {block.queryHash.slice(0, 16)}…</div>
          <div>Response hash: {block.responseHash.slice(0, 16)}…</div>
        </div>
      )}
    </div>
  )
}
