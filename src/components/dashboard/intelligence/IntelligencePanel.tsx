'use client'

import React, { useState } from 'react'
import { ContentGapPanel } from './ContentGapPanel'
import { KBHealthPanel } from './KBHealthPanel'

type IntelTab = 'gaps' | 'health'

export function IntelligencePanel() {
  const [activeTab, setActiveTab] = useState<IntelTab>('gaps')
  // TODO: Replace with actual vault selection once vault listing is wired
  const defaultVaultId = 'default'

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* Tab Bar */}
      <div className="shrink-0 flex items-center gap-1 px-4 py-3 border-b border-white/5">
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
          : 'text-slate-500 hover:text-white hover:bg-white/5'
      }`}
    >
      {label}
    </button>
  )
}
