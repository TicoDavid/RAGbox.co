'use client'

import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Loader2, Waves } from 'lucide-react'
import { useSovereignVoice, type VoiceState } from '@/hooks/useSovereignVoice'

// ============================================================================
// TYPES
// ============================================================================

interface VoiceTriggerProps {
  onTranscript?: (text: string) => void
  onSubmit?: (text: string) => void
  disabled?: boolean
  className?: string
  /** Apply custom size - 'default' (40px) or 'large' (48px) */
  size?: 'default' | 'large'
  /** Inline variant for use inside input bars - no background when idle */
  variant?: 'default' | 'inline'
}

// ============================================================================
// WAVEFORM VISUALIZER
// ============================================================================

function WaveformVisualizer({ isActive }: { isActive: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!isActive || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bars = 5
    const barWidth = 3
    const gap = 2
    const maxHeight = 16

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (let i = 0; i < bars; i++) {
        const height = Math.random() * maxHeight + 4
        const x = i * (barWidth + gap) + (canvas.width - bars * (barWidth + gap)) / 2
        const y = (canvas.height - height) / 2

        // Gradient from gold to amber
        const gradient = ctx.createLinearGradient(x, y, x, y + height)
        gradient.addColorStop(0, '#F59E0B')
        gradient.addColorStop(1, '#D97706')

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.roundRect(x, y, barWidth, height, 1.5)
        ctx.fill()
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isActive])

  return (
    <canvas
      ref={canvasRef}
      width={32}
      height={24}
      className="absolute inset-0 m-auto"
    />
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function VoiceTrigger({
  onTranscript,
  onSubmit,
  disabled = false,
  className = '',
  size = 'default',
  variant = 'default',
}: VoiceTriggerProps) {
  const sizeClasses = size === 'large' ? 'w-12 h-12' : 'w-9 h-9'
  const isInline = variant === 'inline'
  const {
    state,
    isActive,
    transcript,
    error,
    toggleVoice,
  } = useSovereignVoice({
    autoSendOnSilence: false,
    onTranscript: (text, isFinal) => {
      onTranscript?.(text)
      if (isFinal && text.trim()) {
        onSubmit?.(text.trim())
      }
    },
  })

  // Get visual config based on state
  const getStateConfig = (voiceState: VoiceState) => {
    switch (voiceState) {
      case 'connecting':
        return {
          icon: <Loader2 className="w-5 h-5 animate-spin" />,
          bg: 'bg-[var(--brand-blue)]/10',
          text: 'text-[var(--brand-blue)]',
          ring: 'ring-[var(--brand-blue)]/30',
          glow: '',
          pulse: false,
        }
      case 'listening':
        return {
          icon: null, // Use waveform instead
          bg: 'bg-amber-500/20',
          text: 'text-amber-400',
          ring: 'ring-amber-500/50',
          glow: 'shadow-[0_0_20px_rgba(245,158,11,0.5)]',
          pulse: true,
        }
      case 'speaking':
        return {
          icon: <Waves className="w-5 h-5" />,
          bg: 'bg-emerald-500/20',
          text: 'text-emerald-400',
          ring: 'ring-emerald-500/50',
          glow: 'shadow-[0_0_20px_rgba(16,185,129,0.5)]',
          pulse: true,
        }
      case 'processing':
        return {
          icon: <Loader2 className="w-5 h-5 animate-spin" />,
          bg: 'bg-amber-500/20',
          text: 'text-amber-400',
          ring: 'ring-amber-500/30',
          glow: '',
          pulse: false,
        }
      case 'error':
        return {
          icon: <MicOff className="w-5 h-5" />,
          bg: 'bg-red-500/10',
          text: 'text-red-400',
          ring: 'ring-red-500/30',
          glow: '',
          pulse: false,
        }
      default: // idle
        return {
          icon: <Mic className="w-5 h-5" />,
          bg: '',
          text: 'text-amber-700 hover:text-amber-400',
          ring: '',
          glow: '',
          pulse: false,
        }
    }
  }

  const config = getStateConfig(state)

  // Inline variant has more subtle styling
  const inlineClasses = isInline
    ? 'hover:bg-transparent'
    : 'hover:bg-white/5'

  return (
    <div className={`relative ${className}`}>
      {/* Main Button */}
      <motion.button
        onClick={toggleVoice}
        disabled={disabled}
        whileTap={{ scale: 0.95 }}
        className={`
          relative ${sizeClasses} rounded-full flex items-center justify-center
          transition-all duration-300 overflow-hidden
          ${config.bg} ${config.text} ${config.glow}
          ${config.ring ? `ring-2 ${config.ring}` : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : `cursor-pointer ${inlineClasses}`}
        `}
        title={isActive ? 'Stop listening' : 'Start voice input'}
        aria-label={isActive ? 'Stop voice input' : 'Start voice input'}
      >
        {/* Pulse animation ring */}
        <AnimatePresence>
          {config.pulse && (
            <motion.div
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 1.5, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, repeat: Infinity }}
              className={`absolute inset-0 rounded-full ${config.bg}`}
            />
          )}
        </AnimatePresence>

        {/* Icon or Waveform */}
        {state === 'listening' ? (
          <WaveformVisualizer isActive={true} />
        ) : (
          config.icon
        )}

        {/* HAL 9000 Eye Effect when listening */}
        {state === 'listening' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-1 rounded-full bg-gradient-radial from-amber-400/30 to-transparent"
          />
        )}
      </motion.button>

      {/* Live Transcript Tooltip */}
      <AnimatePresence>
        {isActive && transcript && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2
                       px-3 py-2 bg-[#0A192F]/95 backdrop-blur-xl
                       border border-amber-500/30 rounded-lg shadow-xl
                       max-w-xs whitespace-nowrap overflow-hidden text-ellipsis"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs text-amber-400 font-medium truncate">
                {transcript}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Tooltip */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2
                       px-3 py-2 bg-red-900/90 backdrop-blur-xl
                       border border-red-500/30 rounded-lg shadow-xl
                       whitespace-nowrap"
          >
            <span className="text-xs text-red-300">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status indicator dot */}
      {isActive && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full
                     bg-amber-400 border-2 border-[var(--bg-secondary)]"
        />
      )}
    </div>
  )
}

export default VoiceTrigger
