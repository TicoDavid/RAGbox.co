'use client'

import React from 'react'
import { useForgeStore } from '@/stores/forgeStore'
import { useMercuryStore } from '@/stores/mercuryStore'
import { FileText, BarChart3, Presentation, PieChart, Image, Table } from 'lucide-react'
import type { AssetType } from '@/types/ragbox'

const ASSET_TYPES: Array<{ type: AssetType; label: string; icon: React.ElementType }> = [
  { type: 'pdf', label: 'PDF', icon: FileText },
  { type: 'report', label: 'Report', icon: BarChart3 },
  { type: 'slides', label: 'Slides', icon: Presentation },
  { type: 'chart', label: 'Chart', icon: PieChart },
  { type: 'image', label: 'Image', icon: Image },
  { type: 'table', label: 'Table', icon: Table },
]

export function GeneratePopover() {
  const generate = useForgeStore((s) => s.generate)
  const isGenerating = useForgeStore((s) => s.isGenerating)
  const messages = useMercuryStore((s) => s.messages)

  const hasContext = messages.length > 0
  const conversationText = messages.map(m => `${m.role}: ${m.content}`).join('\n')

  return (
    <div className="w-56 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-xl overflow-hidden">
      <div className="px-3 py-2 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider border-b border-[var(--border-subtle)]">
        Generate from Conversation
      </div>
      <div className="grid grid-cols-3 gap-1 p-2">
        {ASSET_TYPES.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            onClick={() => generate(type, conversationText)}
            disabled={!hasContext || isGenerating}
            className="flex flex-col items-center gap-1 p-2 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </div>
      {!hasContext && (
        <p className="px-3 pb-2 text-[10px] text-[var(--text-tertiary)]">
          Start a conversation first
        </p>
      )}
    </div>
  )
}
