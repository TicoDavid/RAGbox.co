'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { VoiceState } from '@/lib/voice/types'

interface VoiceStateIndicatorProps {
  state: VoiceState
}

const stateConfig: Record<Exclude<VoiceState, 'idle' | 'error'>, { color: string; label: string; dotColor: string }> = {
  listening: { color: 'text-emerald-400', label: 'Listening...', dotColor: 'bg-emerald-400' },
  processing: { color: 'text-amber-400', label: 'Thinking...', dotColor: 'bg-amber-400' },
  speaking: { color: 'text-cyan-400', label: 'Speaking...', dotColor: 'bg-cyan-400' },
}

export function VoiceStateIndicator({ state }: VoiceStateIndicatorProps) {
  if (state === 'idle' || state === 'error') return null

  const config = stateConfig[state]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.2 }}
        className="flex items-center gap-2 px-3 py-1.5"
      >
        {/* Pulsing dot */}
        <span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dotColor} opacity-75`} />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dotColor}`} />
        </span>

        <span className={`text-xs font-medium ${config.color}`}>
          {config.label}
        </span>

        {/* Simple waveform for listening state */}
        {state === 'listening' && (
          <div className="flex items-center gap-0.5 h-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                className="w-0.5 bg-emerald-400 rounded-full"
                animate={{ height: ['4px', '12px', '4px'] }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.1,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
