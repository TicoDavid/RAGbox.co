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
  Loader2,
  Network,
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

/** Matches API shape: ContextPackClaim from /api/cygraph/context-pack */
export interface CyGraphClaim {
  id: string
  predicate: string
  objectValue: string
  confidence: number
  subjectEntity: string
}

/** Matches API shape: ContextPackEdge from /api/cygraph/context-pack */
export interface CyGraphEdge {
  fromEntity: string
  toEntity: string
  relationType: string
  weight: number
}

interface ContextPack {
  claims: CyGraphClaim[]
  edges: CyGraphEdge[]
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
      const res = await fetch('/api/cygraph/context-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: messageId }),
      })
      if (!res.ok) {
        if (res.status === 404) {
          setData({ claims: [], edges: [] })
          return
        }
        throw new Error(`${res.status}`)
      }
      const json = await res.json()
      setData({
        claims: json.data?.claims ?? [],
        edges: json.data?.relationships ?? [],
      })
    } catch {
      setError('Could not load knowledge graph data.')
      setData({ claims: [], edges: [] })
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
}: {
  claims: CyGraphClaim[]
  loading: boolean
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
            {/* Subject → Predicate → Object */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-xs font-medium">
                {claim.subjectEntity}
              </span>
              <ArrowRight className="w-3 h-3 text-[var(--text-tertiary)]" />
              <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 text-xs font-mono font-medium uppercase">
                {claim.predicate}
              </span>
              {claim.objectValue && (
                <>
                  <ArrowRight className="w-3 h-3 text-[var(--text-tertiary)]" />
                  <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-xs font-medium">
                    {claim.objectValue}
                  </span>
                </>
              )}
            </div>

            {/* Confidence */}
            <div className="flex items-center justify-end">
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
  edges,
  loading,
}: {
  edges: CyGraphEdge[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-[var(--text-tertiary)] animate-spin" />
      </div>
    )
  }

  if (edges.length === 0) {
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
  const grouped = edges.reduce<Record<string, CyGraphEdge[]>>((acc, edge) => {
    const key = edge.fromEntity
    if (!acc[key]) acc[key] = []
    acc[key].push(edge)
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
          </div>

          {/* Relationship chains */}
          <div className="space-y-2">
            {rels.map((edge, idx) => {
              const pct = Math.round(edge.weight * 100)
              return (
                <div key={`${edge.fromEntity}-${edge.relationType}-${edge.toEntity}-${idx}`} className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-[var(--text-secondary)]">{edge.fromEntity}</span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-mono font-medium uppercase">
                    {edge.relationType}
                  </span>
                  <ArrowRight className="w-3 h-3 text-[var(--text-tertiary)]" />
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                    {edge.toEntity}
                  </span>
                  <span className="ml-auto text-[10px] font-mono text-[var(--text-tertiary)]">
                    {pct}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
