'use client'

/**
 * CyGraph Evidence Panels — Claims + Relationships
 *
 * Sub-tab content for the Evidence panel. Fetches CyGraph data
 * from /api/cygraph/context-pack (Sheldon's backend).
 *
 * Empty-state handles pre-population gracefully.
 */

import React, { useEffect, useState, useCallback } from 'react'
import {
  Sparkles,
  ArrowRight,
  FileText,
  Loader2,
  Network,
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

export interface CyGraphClaim {
  id: string
  text: string
  confidence: number
  subject: string
  predicate: string
  object?: string
  sourceDocumentId?: string
  sourceDocumentName?: string
  sourceSection?: string
  sourcePage?: number
}

export interface CyGraphRelationship {
  id: string
  fromEntity: string
  fromType: string
  relationship: string
  toEntity: string
  toType: string
  confidence: number
  sourceDocumentName?: string
}

interface ContextPack {
  claims: CyGraphClaim[]
  relationships: CyGraphRelationship[]
}

// ============================================================================
// DATA FETCHER
// ============================================================================

export function useCyGraphContext(messageId: string) {
  const [data, setData] = useState<ContextPack | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/cygraph/context-pack?messageId=${encodeURIComponent(messageId)}`)
      if (!res.ok) {
        if (res.status === 404) {
          setData({ claims: [], relationships: [] })
          return
        }
        throw new Error(`${res.status}`)
      }
      const json = await res.json()
      setData({
        claims: json.data?.claims ?? [],
        relationships: json.data?.relationships ?? [],
      })
    } catch {
      setError('Could not load knowledge graph data.')
      setData({ claims: [], relationships: [] })
    } finally {
      setLoading(false)
    }
  }, [messageId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error }
}

// ============================================================================
// CLAIMS PANEL
// ============================================================================

export function ClaimsPanel({
  claims,
  loading,
  onNavigate,
}: {
  claims: CyGraphClaim[]
  loading: boolean
  onNavigate?: (docId: string) => void
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-[var(--text-tertiary)] animate-spin" />
      </div>
    )
  }

  if (claims.length === 0) {
    return (
      <div className="py-8 text-center">
        <Sparkles className="w-8 h-8 text-[var(--text-tertiary)] mx-auto mb-2 opacity-40" />
        <p className="text-sm text-[var(--text-tertiary)]">
          Knowledge graph building...
        </p>
        <p className="text-xs text-[var(--text-tertiary)] mt-1">
          Claims and relationships will appear after documents are processed.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {claims.map((claim) => {
        const pct = Math.round(claim.confidence * 100)
        const color = pct >= 85 ? 'text-[var(--success)]' : pct >= 60 ? 'text-[var(--warning)]' : 'text-[var(--danger)]'

        return (
          <div
            key={claim.id}
            className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] hover:border-[var(--brand-blue)]/20 transition-colors"
          >
            {/* Claim text */}
            <p className="text-sm text-[var(--text-primary)] leading-relaxed mb-3">
              &ldquo;{claim.text}&rdquo;
            </p>

            {/* Subject → Predicate → Object */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-xs font-medium">
                {claim.subject}
              </span>
              <ArrowRight className="w-3 h-3 text-[var(--text-tertiary)]" />
              <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 text-xs font-mono font-medium uppercase">
                {claim.predicate}
              </span>
              {claim.object && (
                <>
                  <ArrowRight className="w-3 h-3 text-[var(--text-tertiary)]" />
                  <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-xs font-medium">
                    {claim.object}
                  </span>
                </>
              )}
            </div>

            {/* Source + Confidence */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {claim.sourceDocumentName && (
                  <button
                    onClick={() => claim.sourceDocumentId && onNavigate?.(claim.sourceDocumentId)}
                    className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--brand-blue)] transition-colors"
                  >
                    <FileText className="w-3 h-3" />
                    {claim.sourceDocumentName}
                    {claim.sourceSection && <span> · {claim.sourceSection}</span>}
                    {claim.sourcePage != null && <span> · p.{claim.sourcePage}</span>}
                  </button>
                )}
              </div>
              <span className={`text-xs font-mono font-medium ${color}`}>
                {pct}%
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================================
// RELATIONSHIPS PANEL
// ============================================================================

export function RelationshipsPanel({
  relationships,
  loading,
}: {
  relationships: CyGraphRelationship[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-[var(--text-tertiary)] animate-spin" />
      </div>
    )
  }

  if (relationships.length === 0) {
    return (
      <div className="py-8 text-center">
        <Network className="w-8 h-8 text-[var(--text-tertiary)] mx-auto mb-2 opacity-40" />
        <p className="text-sm text-[var(--text-tertiary)]">
          No entity relationships extracted yet.
        </p>
        <p className="text-xs text-[var(--text-tertiary)] mt-1">
          Relationships will appear after documents are analyzed.
        </p>
      </div>
    )
  }

  // Group by source entity for cleaner display
  const grouped = relationships.reduce<Record<string, CyGraphRelationship[]>>((acc, rel) => {
    const key = rel.fromEntity
    if (!acc[key]) acc[key] = []
    acc[key].push(rel)
    return acc
  }, {})

  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([entity, rels]) => (
        <div
          key={entity}
          className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)]"
        >
          {/* Entity header */}
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-xs font-medium">
              {entity}
            </span>
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">
              {rels[0].fromType}
            </span>
          </div>

          {/* Relationship chains */}
          <div className="space-y-2">
            {rels.map((rel) => {
              const pct = Math.round(rel.confidence * 100)
              return (
                <div key={rel.id} className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-[var(--text-secondary)]">{rel.fromEntity}</span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-mono font-medium uppercase">
                    {rel.relationship}
                  </span>
                  <ArrowRight className="w-3 h-3 text-[var(--text-tertiary)]" />
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                    {rel.toEntity}
                  </span>
                  <span className="text-[10px] text-[var(--text-tertiary)]">
                    {rel.toType}
                  </span>
                  <span className="ml-auto text-[10px] font-mono text-[var(--text-tertiary)]">
                    {pct}%
                  </span>
                </div>
              )
            })}
          </div>

          {/* Source document */}
          {rels[0].sourceDocumentName && (
            <p className="mt-2 text-[10px] text-[var(--text-tertiary)] flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {rels[0].sourceDocumentName}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
