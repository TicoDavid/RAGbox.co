'use client'

import React from 'react'
import { ClipboardList, Tag, Users, Calendar } from 'lucide-react'

interface EnrichmentData {
  hasTopics: boolean
  hasEntities: boolean
  hasSummary: boolean
  hasKeyDates: boolean
  entityCount: number
  topicCount: number
}

interface EnrichmentBadgesProps {
  enrichment: EnrichmentData | undefined | null
  compact?: boolean
}

const BADGES = [
  {
    key: 'hasSummary' as const,
    label: 'Summary',
    Icon: ClipboardList,
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    countKey: null,
  },
  {
    key: 'hasTopics' as const,
    label: 'Topics',
    Icon: Tag,
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    countKey: 'topicCount' as const,
  },
  {
    key: 'hasEntities' as const,
    label: 'Entities',
    Icon: Users,
    bg: 'bg-green-500/10',
    text: 'text-green-400',
    countKey: 'entityCount' as const,
  },
  {
    key: 'hasKeyDates' as const,
    label: 'Dates',
    Icon: Calendar,
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    countKey: null,
  },
]

export function EnrichmentBadges({ enrichment, compact }: EnrichmentBadgesProps) {
  if (!enrichment) return null

  const activeBadges = BADGES.filter((b) => enrichment[b.key])
  if (activeBadges.length === 0) return null

  const sizeClass = compact
    ? 'text-[10px] px-1.5 py-0.5'
    : 'text-xs px-2 py-0.5'

  return (
    <div className="flex flex-wrap gap-1">
      {activeBadges.map(({ key, label, Icon, bg, text, countKey }) => {
        const count = countKey ? enrichment[countKey] : 0
        return (
          <span
            key={key}
            className={`${sizeClass} ${bg} ${text} rounded-full flex items-center gap-1 font-medium`}
          >
            <Icon className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
            {count > 0 ? `${count} ${label}` : label}
          </span>
        )
      })}
    </div>
  )
}
