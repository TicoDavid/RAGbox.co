'use client'

import { useState, useCallback } from 'react'
import { Brain, ChevronRight, Pencil, RotateCcw, Save } from 'lucide-react'
import { PERSONAS, type PersonaMeta } from '@/lib/personas'
import { toast } from 'sonner'

/** Local overrides stored in localStorage under this key. */
const STORAGE_KEY = 'ragbox:persona-prompt-overrides'

function loadOverrides(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveOverrides(overrides: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
}

export default function PersonasSettingsPage() {
  const [selected, setSelected] = useState<PersonaMeta | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftPrompt, setDraftPrompt] = useState('')
  const [overrides, setOverrides] = useState<Record<string, string>>(loadOverrides)

  const getPrompt = useCallback((p: PersonaMeta) => overrides[p.id] ?? p.prompt, [overrides])

  const startEditing = (p: PersonaMeta) => {
    setEditingId(p.id)
    setDraftPrompt(getPrompt(p))
  }

  const handleSave = (id: string) => {
    const next = { ...overrides, [id]: draftPrompt }
    setOverrides(next)
    saveOverrides(next)
    setEditingId(null)
    toast.success('Prompt saved locally')
  }

  const handleReset = (id: string) => {
    const next = { ...overrides }
    delete next[id]
    setOverrides(next)
    saveOverrides(next)
    setEditingId(null)
    toast.success('Prompt reset to default')
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Brain className="w-5 h-5 text-[var(--brand-blue)]" />
          Neural Shift Personas
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Each persona changes how Mercury reads and interprets your documents.
          Click the edit icon to customize a prompt.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {PERSONAS.map((p) => {
          const isOpen = selected?.id === p.id
          const isEditing = editingId === p.id
          const isOverridden = p.id in overrides

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
                    <p className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-1.5">
                      {p.label}
                      {isOverridden && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--warning)]/15 text-[var(--warning)] font-semibold">CUSTOM</span>
                      )}
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
                    readOnly={!isEditing}
                    value={isEditing ? draftPrompt : getPrompt(p)}
                    onChange={isEditing ? (e) => setDraftPrompt(e.target.value) : undefined}
                    rows={Math.min((isEditing ? draftPrompt : getPrompt(p)).split('\n').length + 1, 16)}
                    className={`w-full px-3 py-3 rounded-lg border text-xs font-mono leading-relaxed resize-y focus:outline-none ${
                      isEditing
                        ? 'bg-[var(--bg-primary)] border-[var(--brand-blue)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--brand-blue)]'
                        : 'bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-secondary)] cursor-default'
                    }`}
                  />
                  <div className="flex items-center justify-between mt-1.5 px-1">
                    <p className="text-[10px] text-[var(--text-tertiary)]">
                      Source: backend/internal/service/prompts/persona_{p.id}.txt
                    </p>
                    <div className="flex items-center gap-1.5">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-[10px] px-2 py-1 rounded text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/30 transition-colors"
                          >
                            Cancel
                          </button>
                          {isOverridden && (
                            <button
                              onClick={() => handleReset(p.id)}
                              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded text-[var(--warning)] hover:bg-[var(--warning)]/10 transition-colors"
                              title="Reset to default prompt"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Reset
                            </button>
                          )}
                          <button
                            onClick={() => handleSave(p.id)}
                            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-[var(--brand-blue)] text-white hover:bg-[var(--brand-blue-hover)] transition-colors"
                          >
                            <Save className="w-3 h-3" />
                            Save
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startEditing(p)}
                          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/30 transition-colors"
                          title="Edit prompt"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
