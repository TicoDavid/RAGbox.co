'use client'

import React from 'react'
import { RefreshCw } from 'lucide-react'
import { useMercuryStore } from '@/stores/mercuryStore'

export function ContextBar() {
  const clearConversation = useMercuryStore((s) => s.clearConversation)

  return (
    <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-[var(--border-default)] border-t border-t-white/10 bg-[var(--bg-secondary)]">
      {/* Vault tags */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <span className="text-xs text-[var(--text-tertiary)]">All documents</span>
      </div>

      {/* Refresh / Clear Chat */}
      <button
        onClick={clearConversation}
        className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
        title="Clear Chat"
        aria-label="Clear conversation"
      >
        <RefreshCw className="w-4 h-4" />
      </button>
    </div>
  )
}
