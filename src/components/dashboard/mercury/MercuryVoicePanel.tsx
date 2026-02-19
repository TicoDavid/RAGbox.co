'use client'

import React, { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Mic,
  Power,
  Radio,
  PowerOff,
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useSovereignAgentVoice, type AgentVoiceState } from '@/hooks/useSovereignAgentVoice'
import { usePrivilegeStore } from '@/stores/privilegeStore'

// ============================================================================
// AUDIO LEVEL BAR (Compact version)
// ============================================================================

function AudioLevelBar({ level, isActive }: { level: number; isActive: boolean }) {
  return (
    <div className="w-full h-2 bg-[var(--bg-tertiary)]/50 rounded-full overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${
          isActive
            ? 'bg-gradient-to-r from-[var(--brand-blue)] to-[var(--success)]'
            : 'bg-[var(--bg-elevated)]'
        }`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(level * 100 * 5, 100)}%` }}
        transition={{ duration: 0.05 }}
      />
    </div>
  )
}

// ============================================================================
// STATE INDICATOR
// ============================================================================

function StateIndicator({
  state,
  isVADActive,
  isSpeaking,
  isConnected,
}: {
  state: AgentVoiceState
  isVADActive: boolean
  isSpeaking: boolean
  isConnected: boolean
}) {
  const getStateConfig = () => {
    if (state === 'connecting') {
      return { color: 'text-[var(--warning)]', pulse: true, label: 'Connecting...' }
    }
    if (state === 'error') {
      return { color: 'text-[var(--danger)]', pulse: false, label: 'Error' }
    }
    if (!isConnected) {
      return { color: 'text-[var(--text-tertiary)]', pulse: false, label: 'Offline' }
    }
    if (isSpeaking) {
      return { color: 'text-[var(--brand-blue)]', pulse: true, label: 'Speaking' }
    }
    if (state === 'processing') {
      return { color: 'text-[var(--warning)]', pulse: true, label: 'Processing' }
    }
    if (state === 'listening') {
      return { color: 'text-[var(--success)]', pulse: true, label: 'Listening' }
    }
    if (isVADActive) {
      return { color: 'text-[var(--success)]', pulse: true, label: 'Listening' }
    }
    return { color: 'text-[var(--brand-blue)]', pulse: false, label: 'Online' }
  }

  const config = getStateConfig()

  return (
    <div className="flex items-center gap-2">
      <div className={`relative w-2 h-2 rounded-full ${config.color} bg-current`}>
        {config.pulse && (
          <span className={`absolute inset-0 rounded-full ${config.color} bg-current animate-ping opacity-75`} />
        )}
      </div>
      <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
    </div>
  )
}

// ============================================================================
// MAIN PANEL
// ============================================================================

export function MercuryVoicePanel() {
  const { data: session } = useSession()
  const privilegeMode = usePrivilegeStore((s) => s.isEnabled)

  // Get user ID from session - use the Google account ID or email as fallback
  const userId = (session?.user as { id?: string })?.id || session?.user?.email || 'anonymous'

  const {
    state,
    isConnected,
    isSpeaking,
    isVADActive,
    audioLevel,
    transcript,
    connect,
    disconnect,
    enableVAD,
    disableVAD,
  } = useSovereignAgentVoice({
    userId,
    privilegeMode,
  })

  const transcriptRef = useRef<HTMLDivElement>(null)
  const isPoweredOn = isConnected
  const isConnecting = state === 'connecting'

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [transcript])

  // Toggle power
  const handlePowerToggle = async () => {
    if (isPoweredOn) {
      disableVAD()
      disconnect()
    } else {
      try {
        await connect()
        // Auto-enable VAD after connection
        setTimeout(() => enableVAD(), 500)
      } catch {
        // connect() rejected — voice server unreachable.
        // State is reset to 'error' inside the hook.
      }
    }
  }

  // Toggle VAD while connected
  const handleVADToggle = () => {
    if (isVADActive) {
      disableVAD()
    } else {
      enableVAD()
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
            <Mic className="w-4 h-4 text-[var(--brand-blue)]" />
            Mercury
          </h3>
          <StateIndicator
            state={state}
            isVADActive={isVADActive}
            isSpeaking={isSpeaking}
            isConnected={isConnected}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden p-4 gap-4">
        {/* Power Button - Main CTA */}
        <div className="flex justify-center">
          <motion.button
            onClick={handlePowerToggle}
            disabled={isConnecting}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`
              relative w-20 h-20 rounded-full flex items-center justify-center
              transition-all duration-300
              ${isPoweredOn
                ? 'bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-blue-dim)] shadow-[0_0_30px_rgba(0,240,255,0.5)]'
                : 'bg-[var(--bg-tertiary)]/80 hover:bg-[var(--bg-elevated)]/80 border border-[var(--border-strong)]'
              }
              ${isConnecting ? 'animate-pulse bg-[var(--warning)]/50' : ''}
              disabled:cursor-not-allowed
            `}
          >
            {isPoweredOn ? (
              <Power className="w-8 h-8 text-[var(--text-primary)]" />
            ) : (
              <PowerOff className="w-8 h-8 text-[var(--text-secondary)]" />
            )}

            {/* Outer ring animation when active and listening */}
            {isPoweredOn && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-[var(--brand-blue)]"
                initial={{ scale: 1, opacity: 0.8 }}
                animate={{ scale: 1.3, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}

            {/* Pulsing glow when speaking */}
            {isSpeaking && (
              <motion.div
                className="absolute inset-0 rounded-full bg-[var(--brand-blue)]/30"
                initial={{ opacity: 0.3 }}
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
            )}
          </motion.button>
        </div>

        {/* Audio Level */}
        {isPoweredOn && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
              <span>Audio Level</span>
              <span>{(audioLevel * 100).toFixed(0)}%</span>
            </div>
            <AudioLevelBar level={audioLevel} isActive={isVADActive} />
          </div>
        )}

        {/* VAD Toggle */}
        {isPoweredOn && (
          <button
            onClick={handleVADToggle}
            className={`
              flex items-center justify-center gap-2 py-2 px-4 rounded-lg
              transition-all text-sm font-medium
              ${isVADActive
                ? 'bg-[var(--success)]/20 text-[var(--success)] border border-[var(--success)]/30'
                : 'bg-[var(--bg-tertiary)]/50 text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-strong)]'
              }
            `}
          >
            <Radio className="w-4 h-4" />
            {isVADActive ? 'VAD Active' : 'Enable VAD'}
          </button>
        )}

        {/* Transcript Area */}
        <div
          ref={transcriptRef}
          className="flex-1 overflow-y-auto bg-[var(--bg-primary)]/50 rounded-lg border border-[var(--border-subtle)] p-3"
        >
          {!isPoweredOn ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-xs text-[var(--text-muted)] text-center">
                Press power to activate<br />Mercury voice agent
              </p>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              {/* Render all transcript entries */}
              {transcript.map((entry) => (
                <div
                  key={entry.id}
                  className={`${
                    entry.type === 'user'
                      ? 'text-[var(--text-secondary)]'
                      : entry.type === 'agent'
                      ? 'text-[var(--text-primary)]'
                      : 'text-[var(--text-tertiary)] italic'
                  }`}
                >
                  {entry.type !== 'system' && (
                    <span
                      className={`text-xs block mb-1 ${
                        entry.type === 'user' ? 'text-[var(--brand-blue)]' : 'text-[var(--success)]'
                      }`}
                    >
                      {entry.type === 'user' ? 'You' : 'Mercury'}
                    </span>
                  )}
                  <span className={!entry.isFinal ? 'opacity-60' : ''}>
                    {entry.text}
                  </span>
                </div>
              ))}

              {/* Empty state */}
              {transcript.length === 0 && (
                <p className="text-xs text-[var(--text-muted)] text-center py-4">
                  Start speaking to Mercury
                </p>
              )}
            </div>
          )}
        </div>

        {/* Status Footer */}
        <div className="shrink-0 text-center">
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
            {isPoweredOn ? 'Hands-free voice mode' : 'Voice agent offline'}
          </p>
        </div>
      </div>
    </div>
  )
}
