'use client'

import { useMercuryStore } from '@/stores/mercuryStore'
import { FileText } from 'lucide-react'

export function CenterHeader() {
  const messages = useMercuryStore((s) => s.messages)
  const queryCount = messages.filter((m) => m.role === 'user').length

  return (
    <div className="shrink-0 flex items-center justify-between px-8 py-3 border-b border-[var(--border-default)]">
      <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
        <FileText className="w-3.5 h-3.5" />
        <span>&gt; All documents</span>
      </div>
      <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
        {queryCount > 0 && <span>Session: {queryCount} {queryCount === 1 ? 'query' : 'queries'}</span>}
      </div>
    </div>
  )
}
