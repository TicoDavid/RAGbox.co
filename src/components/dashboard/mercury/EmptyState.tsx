'use client'

import React from 'react'
import Image from 'next/image'

export function EmptyState() {

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 relative">
      {/* Ambient Spotlight - Subtle */}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-blue-950/5 to-transparent pointer-events-none"
        aria-hidden="true"
      />

      {/* Sovereign Emblem - Watermark Style */}
      <div className="relative mb-6">
        {/* Subtle glow */}
        <div className="absolute inset-0 blur-3xl opacity-15 bg-[#2563EB] rounded-full scale-125" />
        <Image
          src="https://storage.googleapis.com/connexusai-assets/RAGb%C3%B6x_ICON.png"
          alt="RAGbox Sovereign Emblem"
          width={320}
          height={320}
          className="h-80 w-auto relative opacity-30"
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
