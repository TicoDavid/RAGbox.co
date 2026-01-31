'use client'

import React from 'react'
import { MessageSquare } from 'lucide-react'
import { useMercuryStore } from '@/stores/mercuryStore'

const SUGGESTIONS = [
  'Summarize Q4 projections',
  'Find contract clauses',
  'Compare revenue models',
]

export function EmptyState() {
  const setInputValue = useMercuryStore((s) => s.setInputValue)

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
      <MessageSquare className="w-12 h-12 text-[var(--text-tertiary)] opacity-40" />
      <div className="text-center">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
          Ask anything about your documents
        </h3>
        <p className="text-sm text-[var(--text-tertiary)] mt-1 max-w-md">
          Your private RAG — queries only search your vaults, never the web.
        </p>
      </div>

      <div className="flex gap-2 mt-2">
        {SUGGESTIONS.map((text) => (
          <button
            key={text}
            onClick={() => setInputValue(text)}
            className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}
