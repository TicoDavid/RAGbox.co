'use client'

import React from 'react'
import Image from 'next/image'
import { FileText, Search, Shield } from 'lucide-react'
import { useMercuryStore } from '@/stores/mercuryStore'

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
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-900/5 via-neutral-950/5 to-transparent pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative mb-4">
        <div className="absolute inset-0 blur-3xl opacity-20 bg-gradient-to-b from-amber-500 to-amber-700 rounded-full scale-125" />
        <div className="absolute inset-4 blur-2xl opacity-15 bg-amber-400 rounded-full scale-100" />
        <Image
          src="https://storage.googleapis.com/connexusai-assets/RAGb%C3%B6x_ICON.png"
          alt="RAGbox Sovereign Emblem"
          width={280}
          height={280}
          className="h-72 w-auto relative opacity-25 drop-shadow-[0_0_40px_rgba(217,119,6,0.3)]"
          priority
        />
      </div>

      <div className="text-center relative z-10 space-y-4">
        <h2 className="text-xl font-semibold text-amber-100/90 tracking-wide">
          Sovereign Intelligence Active
        </h2>
        <p className="text-sm text-amber-200/50 max-w-md leading-relaxed tracking-wide">
          Your vault is sealed. Complete privacy assured.<br />
          Query your documents with absolute confidentiality.
        </p>
      </div>

      <div className="flex gap-4 mt-6 relative z-10">
        {EXECUTIVE_ACTIONS.map((action) => (
          <button
            key={action.id}
            onClick={() => handleActionClick(action.prompt)}
            className="action-card group flex flex-col items-center gap-3 px-6 py-5 bg-black/40 border border-amber-900/30 backdrop-blur-md rounded-xl hover:bg-amber-950/20 hover:border-amber-500/40 hover:shadow-[0_0_25px_-5px_rgba(251,191,36,0.25)] transition-all duration-500 ease-out min-w-[140px]"
          >
            <div className="p-3 rounded-lg bg-amber-900/10 group-hover:bg-amber-500/20 border border-amber-800/20 group-hover:border-amber-500/30 transition-all duration-500 ease-out">
              <action.icon className="w-5 h-5 text-amber-600 group-hover:text-amber-400 transition-colors duration-500" />
            </div>
            <div className="text-center">
              <div className="text-sm font-medium text-amber-100/80 group-hover:text-amber-100 transition-colors duration-500">
                {action.title}
              </div>
              <div className="text-[11px] text-amber-200/40 mt-1 tracking-wide">
                {action.subtitle}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2.5 mt-6 relative z-10">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-40"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-gradient-to-br from-amber-400 to-amber-600"></span>
        </span>
        <span className="text-[10px] text-amber-500/60 uppercase tracking-[0.25em] font-semibold">
          System Ready
        </span>
      </div>
    </div>
  )
}
