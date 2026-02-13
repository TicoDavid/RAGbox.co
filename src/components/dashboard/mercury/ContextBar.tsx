'use client'

import React from 'react'
import { RefreshCw } from 'lucide-react'
import { useMercuryStore } from '@/stores/mercuryStore'

export function ContextBar() {
  const clearConversation = useMercuryStore((s) => s.clearConversation)
  const sessionQueryCount = useMercuryStore((s) => s.sessionQueryCount)
  const sessionTopics = useMercuryStore((s) => s.sessionTopics)

  return (
    <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-[var(--border-default)] border-t border-t-white/10 bg-[var(--bg-secondary)]">
      {/* Vault tags */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <span className="text-xs text-[var(--text-tertiary)]">All documents</span>
      </div>

      {/* Session progress */}
      {sessionQueryCount > 0 && (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-500">
            Session: {sessionQueryCount} {sessionQueryCount === 1 ? 'query' : 'queries'}
          </span>
          {sessionTopics.length > 0 && (
            <div className="flex items-center gap-1 max-w-[200px] overflow-hidden">
              {sessionTopics.slice(0, 5).map((topic) => (
                <span
                  key={topic}
                  className="bg-[var(--brand-blue)]/10 text-[var(--brand-blue)] text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap"
                >
                  {topic}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

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
