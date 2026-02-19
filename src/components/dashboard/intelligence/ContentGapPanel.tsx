'use client'

import React, { useEffect } from 'react'
import { AlertTriangle, X, CheckCircle2 } from 'lucide-react'
import { useContentIntelligenceStore } from '@/stores/contentIntelligenceStore'

function formatRelativeTime(date: Date | string): string {
  const now = Date.now()
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = now - d.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function confidenceColor(score: number): string {
  if (score < 0.5) return 'text-[var(--danger)]'
  if (score < 0.7) return 'text-[var(--warning)]'
  return 'text-[var(--warning)]'
}

function SkeletonCard() {
  return (
    <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] animate-pulse">
      <div className="h-4 bg-[var(--bg-elevated)]/50 rounded w-3/4 mb-3" />
      <div className="h-3 bg-[var(--bg-elevated)]/50 rounded w-1/2 mb-2" />
      <div className="flex gap-2">
        <div className="h-5 bg-[var(--bg-elevated)]/50 rounded-full w-16" />
        <div className="h-5 bg-[var(--bg-elevated)]/50 rounded-full w-20" />
      </div>
    </div>
  )
}

export function ContentGapPanel() {
  const gaps = useContentIntelligenceStore((s) => s.gaps)
  const gapSummary = useContentIntelligenceStore((s) => s.gapSummary)
  const gapsLoading = useContentIntelligenceStore((s) => s.gapsLoading)
  const fetchGaps = useContentIntelligenceStore((s) => s.fetchGaps)
  const dismissGap = useContentIntelligenceStore((s) => s.dismissGap)
  const addressGap = useContentIntelligenceStore((s) => s.addressGap)

  useEffect(() => {
    fetchGaps()
  }, [fetchGaps])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-[var(--border-subtle)]">
        <AlertTriangle className="w-4 h-4 text-[var(--warning)]" />
        <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">
          Knowledge Gaps
        </h3>
        {gapSummary && gapSummary.openGaps > 0 && (
          <span className="bg-[var(--danger)]/10 text-[var(--danger)] text-xs px-2 py-0.5 rounded-full">
            {gapSummary.openGaps}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {gapsLoading && gaps.length === 0 ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : gaps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <CheckCircle2 className="w-10 h-10 text-[var(--success)]/30 mb-3" />
            <p className="text-sm text-[var(--text-tertiary)]">
              No knowledge gaps detected. Your knowledge base is covering queries well.
            </p>
          </div>
        ) : (
          gaps.map((gap) => (
            <div
              key={gap.id}
              className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-default)] transition-colors"
            >
              {/* Query text */}
              <p className="text-sm text-[var(--text-primary)] mb-2 leading-relaxed">
                {gap.queryText.length > 120
                  ? gap.queryText.slice(0, 120) + '...'
                  : gap.queryText}
              </p>

              {/* Confidence + date */}
              <div className="flex items-center gap-3 mb-3">
                <span className={`text-xs font-medium ${confidenceColor(gap.confidenceScore)}`}>
                  {Math.round(gap.confidenceScore * 100)}% confidence
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  {formatRelativeTime(gap.createdAt)}
                </span>
              </div>

              {/* Suggested topics */}
              {gap.suggestedTopics.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {gap.suggestedTopics.map((topic) => (
                    <span
                      key={topic}
                      className="bg-[var(--brand-blue)]/10 text-[var(--brand-blue)] text-xs px-2 py-0.5 rounded-full"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => dismissGap(gap.id)}
                  className="inline-flex items-center gap-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-xs transition-colors"
                >
                  <X className="w-3 h-3" />
                  Dismiss
                </button>
                <button
                  onClick={() => addressGap(gap.id)}
                  className="inline-flex items-center gap-1 bg-[var(--success)]/10 text-[var(--success)] hover:bg-[var(--success)]/20 text-xs px-3 py-1 rounded-lg transition-colors"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Addressed
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
