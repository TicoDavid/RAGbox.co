'use client'

import React, { useEffect, useState } from 'react'
import {
  Upload,
  Search,
  Shield,
  Download,
  Trash2,
  RefreshCw,
  Database,
  Loader2,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface HistoryEvent {
  id: string
  action: string
  description: string
  timestamp: string
  user?: string
}

interface DocumentHistoryTabProps {
  documentId: string
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  uploaded: <Upload className="w-3.5 h-3.5" />,
  indexed: <Database className="w-3.5 h-3.5" />,
  queried: <Search className="w-3.5 h-3.5" />,
  privilege_changed: <Shield className="w-3.5 h-3.5" />,
  downloaded: <Download className="w-3.5 h-3.5" />,
  deleted: <Trash2 className="w-3.5 h-3.5" />,
  recovered: <RefreshCw className="w-3.5 h-3.5" />,
}

const ACTION_COLORS: Record<string, string> = {
  uploaded: 'text-[var(--brand-blue)]',
  indexed: 'text-[var(--success)]',
  queried: 'text-[var(--text-tertiary)]',
  privilege_changed: 'text-[var(--privilege-color)]',
  downloaded: 'text-[var(--text-secondary)]',
  deleted: 'text-[var(--danger)]',
  recovered: 'text-[var(--success)]',
}

function formatTimestamp(ts: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ts))
}

export function DocumentHistoryTab({ documentId }: DocumentHistoryTabProps) {
  const [events, setEvents] = useState<HistoryEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    apiFetch(`/api/documents/${documentId}/history`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load history')
        const json = await res.json()
        if (!cancelled) {
          setEvents(json.data ?? json.events ?? [])
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [documentId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-[var(--text-tertiary)] animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <p className="text-sm text-[var(--text-secondary)] mb-1">History unavailable</p>
        <p className="text-xs text-[var(--text-tertiary)]">{error}</p>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <p className="text-sm text-[var(--text-secondary)]">No history yet</p>
        <p className="text-xs text-[var(--text-tertiary)] mt-1">Events will appear as the document is used.</p>
      </div>
    )
  }

  return (
    <div className="p-4" style={{ fontFamily: 'var(--font-jakarta)' }}>
      {/* Timeline */}
      <div className="relative pl-6">
        {/* Vertical line */}
        <div className="absolute left-[9px] top-2 bottom-2 w-px bg-[var(--border-default)]" />

        {events.map((event, i) => {
          const icon = ACTION_ICONS[event.action] ?? <Database className="w-3.5 h-3.5" />
          const color = ACTION_COLORS[event.action] ?? 'text-[var(--text-tertiary)]'

          return (
            <div key={event.id || i} className="relative mb-4 last:mb-0">
              {/* Dot */}
              <div className={`absolute -left-6 top-0.5 w-[18px] h-[18px] rounded-full bg-[var(--bg-elevated)] border border-[var(--border-default)] flex items-center justify-center ${color}`}>
                {icon}
              </div>

              {/* Content */}
              <div>
                <p className="text-xs text-[var(--text-primary)] font-medium">{event.description}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-[var(--text-tertiary)]">{formatTimestamp(event.timestamp)}</span>
                  {event.user && <span className="text-[10px] text-[var(--text-muted)]">by {event.user}</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
