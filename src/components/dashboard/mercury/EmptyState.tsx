'use client'

import React from 'react'
import Image from 'next/image'
import { useMercuryStore } from '@/stores/mercuryStore'

// High-value mission prompts
const MISSIONS = [
  { text: 'Conduct Forensic Audit', description: 'Deep compliance search' },
  { text: 'Extract Liability Clauses', description: 'Legal clause isolation' },
  { text: 'Synthesize Executive Briefing', description: 'C-Suite summary' },
]

export function EmptyState() {
  const setInputValue = useMercuryStore((s) => s.setInputValue)

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 relative">
      {/* Ambient Spotlight - The Stage */}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/30 via-blue-950/10 to-transparent pointer-events-none"
        aria-hidden="true"
      />

      {/* Sovereign Emblem - The Reactor Core */}
      <div className="relative mb-6">
        {/* Reactor Glow - Background bleed */}
        <div className="absolute inset-0 blur-2xl opacity-50 bg-[#2563EB] rounded-full scale-150" />
        <Image
          src="https://storage.googleapis.com/connexusai-assets/RAGb%C3%B6x_ICON.png"
          alt="RAGbox Sovereign Emblem"
          width={160}
          height={160}
          className="h-40 w-auto relative drop-shadow-[0_0_35px_rgba(37,99,235,0.5)]"
          priority
        />
      </div>

      {/* Sovereign Copy */}
      <div className="text-center relative z-10 space-y-3">
        <h2 className="text-xl font-bold text-[#E5E7EB] tracking-tight">
          Sovereign Intelligence Active
        </h2>
        <p className="text-sm text-[#94A3B8] max-w-md leading-relaxed">
          Your vault is sealed. The outside world is locked out.<br />
          Query your isolated data with absolute privacy.
        </p>
      </div>

      {/* Mission Prompts - Glass Action Buttons */}
      <div className="flex flex-wrap justify-center gap-3 mt-2 relative z-10">
        {MISSIONS.map((mission) => (
          <button
            key={mission.text}
            onClick={() => setInputValue(mission.text)}
            className="group px-4 py-2.5 text-sm font-medium rounded-xl
              bg-white/5 border border-white/10
              text-[#C0C0C0]
              hover:text-white hover:bg-white/10
              hover:border-[#2463EB]/50
              hover:shadow-[0_0_20px_-5px_rgba(36,99,235,0.4)]
              transition-all duration-300"
          >
            <span className="group-hover:text-[#60A5FA] transition-colors">
              {mission.text}
            </span>
          </button>
        ))}
      </div>

      {/* Status indicator - subtle "system online" feel */}
      <div className="flex items-center gap-2 mt-4 relative z-10">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">
          System Ready
        </span>
      </div>
    </div>
  )
}
