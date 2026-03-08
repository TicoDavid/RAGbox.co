'use client'

/**
 * InsightCard — EPIC-028 Phase 4: Proactive insight card
 *
 * Displays a compact insight with type icon, title, summary,
 * dismiss button, and optional click-to-navigate to source document.
 */

import React from 'react'
import { Calendar, FileText, AlertTriangle, TrendingUp, CheckCircle, X, ExternalLink } from 'lucide-react'
import type { InsightData, InsightType } from '@/stores/mercuryStore'

const TYPE_ICON: Record<InsightType, React.ElementType> = {
  deadline: Calendar,
  expiring: FileText,
  anomaly: AlertTriangle,
  trend: TrendingUp,
  reminder: CheckCircle,
}

const TYPE_COLOR: Record<InsightType, string> = {
  deadline: 'text-[var(--warning)] bg-[var(--warning)]/15',
  expiring: 'text-[var(--warning)] bg-[var(--warning)]/15',
  anomaly: 'text-[var(--danger)] bg-[var(--danger)]/15',
  trend: 'text-[var(--brand-blue)] bg-[var(--brand-blue)]/15',
  reminder: 'text-[var(--success)] bg-[var(--success)]/15',
}

const TYPE_BORDER: Record<InsightType, string> = {
  deadline: 'border-l-[var(--warning)]',
  expiring: 'border-l-[var(--warning)]',
  anomaly: 'border-l-[var(--danger)]',
  trend: 'border-l-[var(--brand-blue)]',
  reminder: 'border-l-[var(--success)]',
}

interface InsightCardProps {
  insight: InsightData
  onAcknowledge: (id: string) => void
  onNavigate?: (documentId: string) => void
}

export function InsightCard({ insight, onAcknowledge, onNavigate }: InsightCardProps) {
  const Icon = TYPE_ICON[insight.insightType] || CheckCircle
  const iconColor = TYPE_COLOR[insight.insightType] || TYPE_COLOR.reminder
  const borderColor = TYPE_BORDER[insight.insightType] || TYPE_BORDER.reminder

  const handleClick = () => {
    if (insight.documentId && onNavigate) {
      onNavigate(insight.documentId)
    }
  }

  return (
    <div
      className={`
        rounded-lg border-l-[3px] ${borderColor} border border-[var(--border-default)]
        bg-[var(--bg-secondary)]/80 p-3 transition-colors
        ${insight.documentId ? 'cursor-pointer hover:bg-[var(--bg-elevated)]/50' : ''}
      `}
      onClick={handleClick}
      role={insight.documentId ? 'button' : undefined}
      tabIndex={insight.documentId ? 0 : undefined}
    >
      <div className="flex items-start gap-2.5">
        {/* Type icon */}
        <div className={`shrink-0 p-1.5 rounded-md ${iconColor}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
              {insight.title}
            </p>
            {insight.documentId && (
              <ExternalLink className="w-3 h-3 text-[var(--text-tertiary)] shrink-0" />
            )}
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 line-clamp-2 leading-relaxed">
            {insight.summary}
          </p>
        </div>

        {/* Dismiss */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onAcknowledge(insight.id)
          }}
          className="shrink-0 p-1 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50 transition-colors"
          aria-label="Dismiss insight"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
