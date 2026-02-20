'use client'

import { useState } from 'react'
import { Brain, ChevronRight } from 'lucide-react'
import { PERSONAS, type PersonaMeta } from '@/lib/personas'

export default function PersonasSettingsPage() {
  const [selected, setSelected] = useState<PersonaMeta | null>(null)

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Brain className="w-5 h-5 text-[var(--brand-blue)]" />
          Neural Shift Personas
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Each persona changes how Mercury reads and interprets your documents.
          These prompts are managed by the backend — this view is read-only.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {PERSONAS.map((p) => {
          const isOpen = selected?.id === p.id
          return (
            <div key={p.id}>
              <button
                onClick={() => setSelected(isOpen ? null : p)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-all ${
                  isOpen
                    ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/10'
                    : 'border-[var(--border-default)] bg-[var(--bg-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-[var(--bg-tertiary)] text-xs font-bold text-[var(--brand-blue)]">
                    {p.label.slice(0, 3)}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {p.label}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">{p.role}</p>
                  </div>
                </div>
                <ChevronRight
                  className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform ${
                    isOpen ? 'rotate-90' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="mt-2 mb-2 px-1">
                  <textarea
                    readOnly
                    value={p.prompt}
                    rows={Math.min(p.prompt.split('\n').length + 1, 16)}
                    className="w-full px-3 py-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-secondary)] text-xs font-mono leading-relaxed resize-none cursor-default focus:outline-none"
                  />
                  <p className="text-[10px] text-[var(--text-tertiary)] mt-1 px-1">
                    Source: backend/internal/service/prompts/persona_{p.id}.txt
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
