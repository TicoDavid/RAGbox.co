'use client'

import React, { useEffect } from 'react'
import { ContextBar } from './ContextBar'
import { ConversationThread } from './ConversationThread'
import { InputBar } from './InputBar'
import { useMercuryStore } from '@/stores/mercuryStore'

export function MercuryPanel() {
  const activePersona = useMercuryStore((s) => s.activePersona)
  const isRefocusing = useMercuryStore((s) => s.isRefocusing)

  const isWhistleblowerMode = activePersona === 'whistleblower'

  // Apply theme shift for Whistleblower mode
  useEffect(() => {
    const root = document.documentElement

    if (isWhistleblowerMode) {
      // Nuclear Mode: Shift to Amber/Orange
      root.style.setProperty('--brand-blue', '#F59E0B')
      root.style.setProperty('--brand-blue-hover', '#D97706')
    } else {
      // Normal Mode: Royal Cobalt
      root.style.setProperty('--brand-blue', '#2463EB')
      root.style.setProperty('--brand-blue-hover', '#1D4ED8')
    }

    return () => {
      // Cleanup: Reset to default on unmount
      root.style.setProperty('--brand-blue', '#2463EB')
      root.style.setProperty('--brand-blue-hover', '#1D4ED8')
    }
  }, [isWhistleblowerMode])

  return (
    <div
      className={`
        flex flex-col h-full bg-[var(--bg-primary)] transition-all duration-300
        ${isWhistleblowerMode ? 'ring-2 ring-amber-500/30 ring-inset' : ''}
      `}
    >
      <ContextBar />

      {/* Conversation with Lens Refocus Animation */}
      <div
        className={`
          flex-1 min-h-0
          ${isRefocusing ? 'animate-refocus' : ''}
        `}
      >
        <ConversationThread />
      </div>

      <InputBar />

      {/* Refocus Animation Keyframes */}
      <style jsx global>{`
        @keyframes refocus {
          0% { filter: blur(0px); opacity: 1; }
          50% { filter: blur(4px); opacity: 0.8; }
          100% { filter: blur(0px); opacity: 1; }
        }
        .animate-refocus {
          animation: refocus 0.6s ease-in-out;
        }
      `}</style>
    </div>
  )
}
