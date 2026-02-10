'use client'

import React from 'react'
import Image from 'next/image'
import { FileText, Search, Shield } from 'lucide-react'
import { useMercuryStore } from '@/stores/mercuryStore'

// Executive Action Tiles - Refined suggestions
const EXECUTIVE_ACTIONS = [
  {
    id: 'review',
    icon: FileText,
    title: 'Review Documents',
    subtitle: 'Summarize recent uploads',
    prompt: 'Provide an executive summary of my most recent documents.',
  },
  {
    id: 'search',
    icon: Search,
    title: 'Search Vault',
    subtitle: 'Find specific content',
    prompt: 'Search my vault for documents related to ',
  },
  {
    id: 'privileged',
    icon: Shield,
    title: 'Privileged Review',
    subtitle: 'Attorney-client materials',
    prompt: 'Show me all documents marked as privileged.',
  },
]

export function EmptyState() {
  const setInputValue = useMercuryStore((s) => s.setInputValue)

  const handleActionClick = (prompt: string) => {
    setInputValue(prompt)
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 px-8 relative">
      {/* Ambient Spotlight - Warm, Subtle */}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-900/5 via-neutral-950/5 to-transparent pointer-events-none"
        aria-hidden="true"
      />

      {/* Sovereign Emblem - Refined Watermark */}
      <div className="relative mb-4">
        {/* Subtle warm glow */}
        <div className="absolute inset-0 blur-3xl opacity-10 bg-amber-500 rounded-full scale-110" />
        <Image
          src="https://storage.googleapis.com/connexusai-assets/RAGb%C3%B6x_ICON.png"
          alt="RAGbox Sovereign Emblem"
          width={280}
          height={280}
          className="h-72 w-auto relative opacity-20"
          priority
        />
      </div>

      {/* Executive Copy - Platinum Typography */}
      <div className="text-center relative z-10 space-y-4">
        <h2 className="text-xl font-semibold text-gray-200 tracking-wide">
          Sovereign Intelligence Active
        </h2>
        <p className="text-sm text-gray-400 max-w-md leading-relaxed tracking-wide">
          Your vault is sealed. Complete privacy assured.<br />
          Query your documents with absolute confidentiality.
        </p>
      </div>

      {/* Executive Action Tiles - Refined Material */}
      <div className="flex gap-4 mt-6 relative z-10">
        {EXECUTIVE_ACTIONS.map((action) => (
          <button
            key={action.id}
            onClick={() => handleActionClick(action.prompt)}
            className="
              group flex flex-col items-center gap-3 px-6 py-5
              bg-white/[0.02] border border-white/[0.05] backdrop-blur-md rounded-xl
              hover:bg-white/[0.06] hover:border-amber-500/20
              transition-all duration-500 ease-out
              min-w-[140px]
            "
          >
            <div className="
              p-3 rounded-lg
              bg-white/[0.03] group-hover:bg-amber-500/10
              transition-all duration-500 ease-out
            ">
              <action.icon className="w-5 h-5 text-gray-400 group-hover:text-amber-400 transition-colors duration-500" />
            </div>
            <div className="text-center">
              <div className="text-sm font-medium text-gray-300 group-hover:text-gray-200 transition-colors duration-500">
                {action.title}
              </div>
              <div className="text-[11px] text-gray-500 mt-1 tracking-wide">
                {action.subtitle}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Status indicator - Refined */}
      <div className="flex items-center gap-2.5 mt-6 relative z-10">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-50"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
        </span>
        <span className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-medium">
          Ready
        </span>
      </div>
    </div>
  )
}
