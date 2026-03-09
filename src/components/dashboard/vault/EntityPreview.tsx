'use client'

import React, { useEffect, useState } from 'react'
import { User, Building2, MapPin, Calendar, Lightbulb, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface Entity {
  name: string
  type: 'person' | 'organization' | 'location' | 'date' | 'concept'
  mentions: number
  relationships: { target: string; type: string }[]
}

interface EntityPreviewProps {
  documentId: string
  entities?: Entity[]
  isLoading?: boolean
}

const ENTITY_ICONS: Record<Entity['type'], { Icon: React.FC<{ className?: string }>; color: string }> = {
  person: { Icon: User, color: 'text-blue-400' },
  organization: { Icon: Building2, color: 'text-purple-400' },
  location: { Icon: MapPin, color: 'text-green-400' },
  date: { Icon: Calendar, color: 'text-amber-400' },
  concept: { Icon: Lightbulb, color: 'text-cyan-400' },
}

export function EntityPreview({ documentId, entities: propEntities, isLoading: propLoading }: EntityPreviewProps) {
  const [entities, setEntities] = useState<Entity[]>(propEntities ?? [])
  const [loading, setLoading] = useState(propLoading ?? false)

  useEffect(() => {
    if (propEntities) {
      setEntities(propEntities)
      return
    }

    let cancelled = false
    setLoading(true)
    apiFetch(`/api/documents/${documentId}/entities`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to fetch entities')
        const data = await res.json()
        if (!cancelled) setEntities(data.entities ?? [])
      })
      .catch(() => {
        if (!cancelled) setEntities([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [documentId, propEntities])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-[var(--text-tertiary)] animate-spin" />
      </div>
    )
  }

  if (entities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
        <User className="w-8 h-8 text-[var(--text-tertiary)] opacity-40" />
        <p className="text-sm text-[var(--text-tertiary)]">No entities extracted yet</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
          Entities ({entities.length})
        </h3>
      </div>
      <div className="space-y-0">
        {entities.map((entity, i) => {
          const config = ENTITY_ICONS[entity.type] ?? ENTITY_ICONS.concept
          const { Icon, color } = config
          return (
            <div
              key={`${entity.name}-${i}`}
              className="flex items-start gap-3 py-2 border-b border-[var(--border-subtle)] last:border-0"
            >
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {entity.name}
                  </span>
                  <span className="text-xs text-[var(--text-tertiary)] shrink-0">
                    ×{entity.mentions}
                  </span>
                </div>
                {entity.relationships.length > 0 && (
                  <div className="mt-0.5 space-y-0.5 pl-0">
                    {entity.relationships.slice(0, 3).map((rel, j) => (
                      <p key={j} className="text-xs text-[var(--text-secondary)]">
                        → {rel.type}: {rel.target}
                      </p>
                    ))}
                    {entity.relationships.length > 3 && (
                      <p className="text-xs text-[var(--text-tertiary)] italic">
                        +{entity.relationships.length - 3} more
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
