'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Zap, Lock, Search, X, Check, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { useSettings, type SecureConnection, type ActiveIntelligence } from '@/contexts/SettingsContext'

// ============================================================================
// MODEL CATALOG — curated per-provider model list
// ============================================================================

interface ModelEntry {
  id: string
  name: string
}

const MODEL_CATALOG: Record<string, { label: string; models: ModelEntry[] }> = {
  openrouter: {
    label: 'OpenRouter',
    models: [
      { id: 'anthropic/claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
      { id: 'openai/gpt-4o', name: 'GPT-4o' },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
      { id: 'google/gemini-2.0-pro', name: 'Gemini 2.0 Pro' },
      { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B' },
      { id: 'mistralai/mistral-large', name: 'Mistral Large' },
    ],
  },
  openai: {
    label: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'o1', name: 'o1' },
      { id: 'o1-mini', name: 'o1-mini' },
    ],
  },
  anthropic: {
    label: 'Anthropic',
    models: [
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
    ],
  },
  google: {
    label: 'Google AI',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.0-pro', name: 'Gemini 2.0 Pro' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    ],
  },
}

// ============================================================================
// BYOLLM SELECTOR MODAL
// ============================================================================

interface ByollmSelectorProps {
  isOpen: boolean
  onClose: () => void
  connection: SecureConnection
  currentModelId: string
  onSelect: (modelId: string, displayName: string) => void
}

function ByollmSelectorModal({ isOpen, onClose, connection, currentModelId, onSelect }: ByollmSelectorProps) {
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // Focus search on open
  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setTimeout(() => searchRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  // Build model list: catalog + any from connection.availableModels
  const catalog = MODEL_CATALOG[connection.type]
  const providerLabel = catalog?.label || connection.type

  const allModels = useMemo(() => {
    const catalogModels = catalog?.models || []
    const connectionModels = (connection.availableModels || []).map((m) => ({
      id: m.id,
      name: m.name || m.id.split('/').pop() || m.id,
    }))

    // Merge: catalog first, then any connection models not already in catalog
    const catalogIds = new Set(catalogModels.map((m) => m.id))
    const extra = connectionModels.filter((m) => !catalogIds.has(m.id))
    return [...catalogModels, ...extra]
  }, [catalog, connection.availableModels])

  const filtered = useMemo(() => {
    if (!search.trim()) return allModels
    const q = search.toLowerCase()
    return allModels.filter(
      (m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
    )
  }, [allModels, search])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-md max-h-[70vh] flex flex-col rounded-2xl
                     bg-[var(--bg-secondary)]/95 backdrop-blur-xl
                     border border-[var(--border-default)]
                     shadow-2xl shadow-black/50 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="shrink-0 px-5 pt-5 pb-3">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Select Model
                </h3>
                <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                  via {providerLabel}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center
                           text-[var(--text-tertiary)] hover:text-[var(--text-primary)]
                           hover:bg-[var(--bg-elevated)] transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search models..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg
                           bg-[var(--bg-primary)] border border-[var(--border-default)]
                           text-[var(--text-primary)] placeholder-[var(--text-tertiary)]
                           focus:outline-none focus:border-[var(--warning)]/50
                           transition-colors"
              />
            </div>
          </div>

          {/* Model list */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-thin scrollbar-thumb-[var(--bg-elevated)] scrollbar-track-transparent">
            {filtered.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-[var(--text-tertiary)]">No models found</p>
              </div>
            ) : (
              <div className="space-y-1">
                {filtered.map((model) => {
                  const isSelected = currentModelId === model.id
                  return (
                    <button
                      key={model.id}
                      onClick={() => {
                        onSelect(model.id, model.name)
                        onClose()
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150
                        ${isSelected
                          ? 'bg-[var(--warning)]/10 border border-[var(--warning)]/40'
                          : 'border border-transparent hover:bg-[var(--bg-elevated)]/50 hover:border-[var(--border-default)]'
                        }`}
                    >
                      {/* Selection indicator */}
                      <div className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
                        ${isSelected
                          ? 'border-[var(--warning)] bg-[var(--warning)]'
                          : 'border-[var(--border-strong)]'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-black" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isSelected ? 'text-[var(--warning)]' : 'text-[var(--text-primary)]'}`}>
                          {model.name}
                        </p>
                        <p className="text-[10px] text-[var(--text-tertiary)] truncate">
                          {model.id}
                        </p>
                      </div>

                      {isSelected && (
                        <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-[var(--warning)]">
                          Active
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer accent */}
          <div className="shrink-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--warning)]/40 to-transparent" />
        </div>
      </div>
    </>
  )
}

// ============================================================================
// LLM PICKER — AEGIS + Private LLM cards
// ============================================================================

interface LlmPickerProps {
  activeIntel?: ActiveIntelligence
  onIntelChange?: (intel: ActiveIntelligence) => void
}

export function LlmPicker({ activeIntel, onIntelChange }: LlmPickerProps = {}) {
  const {
    connections,
    activeIntelligence,
    setActiveIntelligence,
    llmPolicy,
  } = useSettings()

  // Use prop overrides when provided (Mercury independent mode)
  const currentIntel = activeIntel ?? activeIntelligence
  const updateIntel = onIntelChange ?? setActiveIntelligence

  const [selectorOpen, setSelectorOpen] = useState(false)

  // Persist last BYOLLM selection in localStorage
  const BYOLLM_STORAGE_KEY = 'ragbox:lastByollmModel'

  const saveByollmChoice = (modelId: string, displayName: string, provider: string) => {
    try {
      localStorage.setItem(BYOLLM_STORAGE_KEY, JSON.stringify({ modelId, displayName, provider }))
    } catch { /* localStorage unavailable */ }
  }

  const loadByollmChoice = (): { modelId: string; displayName: string; provider: string } | null => {
    try {
      const stored = localStorage.getItem(BYOLLM_STORAGE_KEY)
      if (stored) return JSON.parse(stored)
    } catch { /* localStorage unavailable */ }
    return null
  }

  const byollmConnection = connections.find(
    (c) => c.verified && c.selectedModel && c.type !== 'local' && c.type !== 'custom'
  )

  const isAegis = currentIntel.tier === 'native'
  const modelName = byollmConnection?.selectedModel?.split('/').pop() || ''
  const providerName = byollmConnection?.type || ''

  // Nothing to pick if policy locks to one option
  if (llmPolicy === 'aegis_only') return null
  if (llmPolicy === 'byollm_only' && !byollmConnection) return null

  const switchToAegis = () => {
    if (isAegis || llmPolicy === 'byollm_only') return
    updateIntel({
      id: 'aegis-core',
      displayName: 'Aegis',
      provider: 'RAGbox',
      tier: 'native',
    })
    toast.success('Switched to AEGIS', { description: 'Sovereign RAG pipeline' })
  }

  const handleModelSelect = (modelId: string, displayName: string) => {
    if (!byollmConnection) return
    updateIntel({
      id: modelId,
      displayName,
      provider: byollmConnection.type,
      tier: 'private',
    })
    saveByollmChoice(modelId, displayName, byollmConnection.type)
    toast.success(`Switched to ${displayName}`, { description: `via ${providerName}` })
  }

  const handlePrivateCardClick = () => {
    if (!byollmConnection?.selectedModel) return
    // If already on AEGIS, switch to Private — restore last BYOLLM choice
    if (isAegis) {
      const saved = loadByollmChoice()
      const restoredId = saved?.modelId || byollmConnection.selectedModel!
      const restoredName = saved?.displayName || modelName
      updateIntel({
        id: restoredId,
        displayName: restoredName,
        provider: byollmConnection.type,
        tier: 'private',
      })
    }
    // Open the selector modal
    setSelectorOpen(true)
  }

  return (
    <>
      <div className="flex gap-2">
        {/* AEGIS Card */}
        {llmPolicy !== 'byollm_only' && (
          <button
            onClick={switchToAegis}
            className={`flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all duration-200 text-left
              ${isAegis
                ? 'border-[var(--warning)]/50 bg-[var(--warning)]/8'
                : 'border-[var(--border-default)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]/20'
              }`}
          >
            <div className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center
              ${isAegis ? 'bg-[var(--warning)]/20 text-[var(--warning)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'}`}>
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className={`block text-xs font-bold tracking-wide ${isAegis ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'}`}>
                AEGIS
              </span>
              <span className={`block text-[10px] leading-tight ${isAegis ? 'text-[var(--warning)]/60' : 'text-[var(--text-tertiary)]'}`}>
                ConnexUS Sovereign AI
              </span>
            </div>
          </button>
        )}

        {/* Private LLM Card — clickable, opens selector modal */}
        {byollmConnection?.selectedModel ? (
          <button
            onClick={handlePrivateCardClick}
            className={`flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all duration-200 text-left
              ${!isAegis
                ? 'border-[var(--warning)]/50 bg-[var(--warning)]/8'
                : 'border-[var(--border-default)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]/20'
              }`}
          >
            <div className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center
              ${!isAegis ? 'bg-[var(--brand-blue)]/20 text-[var(--brand-blue)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'}`}>
              <Lock className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className={`block text-xs font-bold tracking-wide truncate ${!isAegis ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                {isAegis ? modelName : currentIntel.displayName}
              </span>
              <span className="block text-[10px] leading-tight text-[var(--text-tertiary)]">
                via {providerName}
              </span>
            </div>
            <ChevronRight className={`shrink-0 w-3.5 h-3.5 transition-colors ${!isAegis ? 'text-[var(--text-secondary)]' : 'text-[var(--text-tertiary)]'}`} />
          </button>
        ) : (
          <div className="flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg border border-dashed border-[var(--border-default)]">
            <div className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-[var(--text-tertiary)]">Private LLM</span>
              <span className="block text-[10px] text-[var(--brand-blue)] leading-tight">Configure in Settings {'\u2192'}</span>
            </div>
          </div>
        )}
      </div>

      {/* BYOLLM Selector Modal */}
      {byollmConnection && (
        <ByollmSelectorModal
          isOpen={selectorOpen}
          onClose={() => setSelectorOpen(false)}
          connection={byollmConnection}
          currentModelId={currentIntel.id}
          onSelect={handleModelSelect}
        />
      )}
    </>
  )
}

// Backward compatibility
export { LlmPicker as ChatModelPicker }
