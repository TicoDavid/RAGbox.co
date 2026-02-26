'use client'

import React from 'react'
import { MessageSquare, Sparkles } from 'lucide-react'
import { useMercuryStore } from '@/stores/mercuryStore'

const SUGGESTED_PROMPTS = [
  'What should I know about these documents?',
  'Are there any risks or red flags I should worry about?',
  'Give me an executive brief I can forward to my team',
  'Walk me through the key dates and deadlines',
]

export function EmptyState() {
  const setInputValue = useMercuryStore((s) => s.setInputValue)

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 pb-24">
      {/* Icon */}
      <div className="w-14 h-14 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-default)] flex items-center justify-center mb-5">
        <MessageSquare className="w-7 h-7 text-[var(--text-tertiary)]" />
      </div>

      <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1.5">
        Start a conversation
      </h3>
      <p className="text-sm text-[var(--text-tertiary)] mb-8 text-center max-w-sm">
        Drop a question about your documents — or try one of these:
      </p>

      {/* Suggested prompts */}
      <div className="w-full max-w-md space-y-2">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => setInputValue(prompt)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl
                       bg-[var(--bg-secondary)] border border-[var(--border-default)]
                       hover:border-[var(--brand-blue)]/40 hover:bg-[var(--brand-blue)]/5
                       transition-all text-left group"
          >
            <Sparkles className="w-4 h-4 text-[var(--brand-blue)] shrink-0 group-hover:scale-110 transition-transform" />
            <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
              {prompt}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
