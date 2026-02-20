'use client'

import { useMercuryStore } from '@/stores/mercuryStore'
import { MessageSquare } from 'lucide-react'

export function CenterHeader() {
  const messages = useMercuryStore((s) => s.messages)
  const threadTitle = useMercuryStore((s) => s.threadTitle)
  const queryCount = messages.filter((m) => m.role === 'user').length

  return (
    <div className="shrink-0 flex items-center justify-between px-8 py-3 border-b border-[var(--border-default)]">
      <div className="flex items-center gap-2 text-sm">
        <MessageSquare className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
        <span className="text-[var(--text-primary)] font-medium truncate max-w-[300px]">
          {threadTitle || 'New Chat'}
        </span>
      </div>
      <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
        {queryCount > 0 && <span>{queryCount} {queryCount === 1 ? 'query' : 'queries'}</span>}
      </div>
    </div>
  )
}
