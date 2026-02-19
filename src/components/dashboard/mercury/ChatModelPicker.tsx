'use client'

import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck, Key } from 'lucide-react'
import { toast } from 'sonner'
import { useSettings } from '@/contexts/SettingsContext'
import { useMercuryStore } from '@/stores/mercuryStore'

export function ChatModelPicker() {
  const {
    connections,
    activeIntelligence,
    setActiveIntelligence,
    llmPolicy,
  } = useSettings()
  const setSelectedLlm = useMercuryStore((s) => s.setSelectedLlm)

  // Find the verified BYOLLM connection with a selected model
  const byollmConnection = connections.find(
    (c) => c.verified && c.selectedModel && c.type !== 'local' && c.type !== 'custom'
  )

  const isAegis = activeIntelligence.tier === 'native'

  // Sync selectedLlm in mercuryStore whenever activeIntelligence or policy changes
  useEffect(() => {
    if (llmPolicy === 'aegis_only' || !byollmConnection) {
      setSelectedLlm({ provider: 'aegis', model: 'aegis-core' })
      return
    }
    if (llmPolicy === 'byollm_only' && byollmConnection.selectedModel) {
      setSelectedLlm({ provider: 'byollm', model: byollmConnection.selectedModel })
      return
    }
    // choice mode — follow activeIntelligence
    if (isAegis) {
      setSelectedLlm({ provider: 'aegis', model: 'aegis-core' })
    } else if (byollmConnection.selectedModel) {
      setSelectedLlm({ provider: 'byollm', model: byollmConnection.selectedModel })
    }
  }, [llmPolicy, isAegis, byollmConnection, setSelectedLlm, activeIntelligence])

  // Only visible when: verified BYOLLM exists AND policy === 'choice'
  if (!byollmConnection?.selectedModel || llmPolicy !== 'choice') {
    return null
  }

  const providerLabel = byollmConnection.type === 'openrouter' ? 'OR' : byollmConnection.type.slice(0, 2).toUpperCase()
  const modelName = byollmConnection.selectedModel.split('/').pop() || byollmConnection.selectedModel

  const handleToggle = (toAegis: boolean) => {
    if (toAegis) {
      setActiveIntelligence({
        id: 'aegis-core',
        displayName: 'Aegis',
        provider: 'RAGbox',
        tier: 'native',
      })
      toast.success('Switched to AEGIS', { description: 'Sovereign RAG pipeline' })
    } else {
      setActiveIntelligence({
        id: byollmConnection.selectedModel!,
        displayName: modelName,
        provider: byollmConnection.type,
        tier: 'private',
      })
      toast.success(`Switched to ${modelName}`, { description: `via ${byollmConnection.type}` })
    }
  }

  return (
    <div className="flex items-center justify-center mb-2">
      <div className="inline-flex items-center rounded-full bg-[var(--bg-primary)]/80 border border-[var(--border-default)] p-0.5 relative">
        {/* Sliding background */}
        <motion.div
          className="absolute top-0.5 bottom-0.5 rounded-full bg-[var(--bg-elevated)]"
          animate={{ left: isAegis ? '2px' : '50%', width: '50%' }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          style={{ marginLeft: isAegis ? 0 : '-2px', marginRight: isAegis ? '-2px' : 0 }}
        />

        {/* AEGIS side */}
        <button
          onClick={() => handleToggle(true)}
          className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
            ${isAegis ? 'text-[var(--warning)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          AEGIS
        </button>

        {/* Private LLM side */}
        <button
          onClick={() => handleToggle(false)}
          className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
            ${!isAegis ? 'text-[var(--brand-blue)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
        >
          <Key className="w-3.5 h-3.5" />
          <span className="max-w-[100px] truncate">{modelName}</span>
          <span className="text-[9px] text-[var(--text-muted)] uppercase">{providerLabel}</span>
        </button>
      </div>
    </div>
  )
}
