'use client'

import React from 'react'
import { Zap, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { useSettings } from '@/contexts/SettingsContext'

export function LlmPicker() {
  const {
    connections,
    activeIntelligence,
    setActiveIntelligence,
    llmPolicy,
  } = useSettings()

  const byollmConnection = connections.find(
    (c) => c.verified && c.selectedModel && c.type !== 'local' && c.type !== 'custom'
  )

  const isAegis = activeIntelligence.tier === 'native'
  const modelName = byollmConnection?.selectedModel?.split('/').pop() || ''
  const providerName = byollmConnection?.type || ''

  // Nothing to pick if policy locks to one option
  if (llmPolicy === 'aegis_only') return null
  if (llmPolicy === 'byollm_only' && !byollmConnection) return null

  const switchToAegis = () => {
    if (isAegis || llmPolicy === 'byollm_only') return
    setActiveIntelligence({
      id: 'aegis-core',
      displayName: 'Aegis',
      provider: 'RAGbox',
      tier: 'native',
    })
    toast.success('Switched to AEGIS', { description: 'Sovereign RAG pipeline' })
  }

  const switchToPrivate = () => {
    if (!isAegis || !byollmConnection?.selectedModel) return
    setActiveIntelligence({
      id: byollmConnection.selectedModel!,
      displayName: modelName,
      provider: byollmConnection.type,
      tier: 'private',
    })
    toast.success(`Switched to ${modelName}`, { description: `via ${providerName}` })
  }

  return (
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

      {/* Private LLM Card */}
      {byollmConnection?.selectedModel ? (
        <button
          onClick={switchToPrivate}
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
              {modelName}
            </span>
            <span className={`block text-[10px] leading-tight text-[var(--text-tertiary)]`}>
              via {providerName}
            </span>
          </div>
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
  )
}

// Backward compatibility
export { LlmPicker as ChatModelPicker }
