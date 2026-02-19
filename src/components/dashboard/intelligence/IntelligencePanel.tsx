'use client'

import React, { useState } from 'react'
import { BrainCircuit } from 'lucide-react'
import { useContentIntelligenceStore } from '@/stores/contentIntelligenceStore'
import { ContentGapPanel } from './ContentGapPanel'
import { KBHealthPanel } from './KBHealthPanel'

type IntelTab = 'gaps' | 'health'

export function IntelligencePanel() {
  const [activeTab, setActiveTab] = useState<IntelTab>('gaps')
  const defaultVaultId = 'default'

  const gaps = useContentIntelligenceStore((s) => s.gaps)
  const healthChecks = useContentIntelligenceStore((s) => s.healthChecks)
  const gapsLoading = useContentIntelligenceStore((s) => s.gapsLoading)
  const healthLoading = useContentIntelligenceStore((s) => s.healthLoading)

  const isEmpty = gaps.length === 0 && healthChecks.length === 0 && !gapsLoading && !healthLoading

  if (isEmpty) {
    return (
      <div className="flex flex-col h-full bg-[var(--bg-primary)]">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--brand-blue)]/10 flex items-center justify-center mb-4">
            <BrainCircuit className="w-7 h-7 text-[var(--brand-blue)]/40" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Intelligence Idle</h3>
          <p className="text-xs text-[var(--text-tertiary)] leading-relaxed max-w-[240px]">
            Upload documents and start querying to surface knowledge gaps and health insights.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* Tab Bar */}
      <div className="shrink-0 flex items-center gap-1 px-4 py-3 border-b border-[var(--border-subtle)]">
        <TabButton active={activeTab === 'gaps'} onClick={() => setActiveTab('gaps')} label="Knowledge Gaps" />
        <TabButton active={activeTab === 'health'} onClick={() => setActiveTab('health')} label="KB Health" />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'gaps' && <ContentGapPanel />}
        {activeTab === 'health' && <KBHealthPanel vaultId={defaultVaultId} />}
      </div>
    </div>
  )
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
        active
          ? 'bg-[var(--brand-blue)]/10 text-[var(--brand-blue)]'
          : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50'
      }`}
    >
      {label}
    </button>
  )
}
