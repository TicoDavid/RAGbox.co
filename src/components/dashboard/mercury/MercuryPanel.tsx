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
        relative flex flex-col h-full bg-[var(--bg-primary)] overflow-hidden transition-all duration-300
        ${isWhistleblowerMode ? 'ring-2 ring-amber-500/30 ring-inset' : ''}
      `}
    >
      {/* Layer 2: The Watermark — sits ABOVE bg, BELOW content */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"
        aria-hidden="true"
      >
        <img
          src="https://storage.googleapis.com/connexusai-assets/RAGb%C3%B6x_ICON.png"
          alt=""
          className="w-[600px] h-auto opacity-20 select-none"
          draggable={false}
          style={{ filter: 'sepia(1) hue-rotate(-15deg) saturate(1.5)' }}
        />
      </div>

      {/* Layer 3: All content — transparent bg so watermark shows through */}
      <div className="relative z-10 flex flex-col h-full">
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
      </div>

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
