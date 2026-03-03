'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Settings, Mic, Power, PowerOff, Radio } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { MercuryPanel } from './MercuryPanel'
import { MercurySettingsModal } from './MercurySettingsModal'
import { useSovereignAgentVoice } from '@/hooks/useSovereignAgentVoice'
import { usePrivilegeStore } from '@/stores/privilegeStore'

// ============================================================================
// AUDIO LEVEL BAR — Compact inline visualization
// ============================================================================

function AudioLevelBar({ level, isActive }: { level: number; isActive: boolean }) {
  return (
    <div className="w-full h-1.5 bg-[var(--bg-tertiary)]/50 rounded-full overflow-hidden">
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
// MERCURY WINDOW — Unified thread with inline voice controls
// ============================================================================

export function MercuryWindow() {
  const [configOpen, setConfigOpen] = useState(false)
  const [agentName, setAgentName] = useState('Mercury')
  const [agentTitle, setAgentTitle] = useState('AI Assistant')

  // Voice state
  const { data: session } = useSession()
  const privilegeMode = usePrivilegeStore((s) => s.isEnabled)
  const userId = (session?.user as { id?: string })?.id || session?.user?.email || 'anonymous'

  const {
    state,
    isConnected,
    isSpeaking,
    isVADActive,
    audioLevel,
    disconnect,
    enableVAD,
    disableVAD,
  } = useSovereignAgentVoice({ userId, privilegeMode })

  const isPoweredOn = isConnected
  const isConnecting = state === 'connecting'

  const handlePowerToggle = async () => {
    if (isPoweredOn) {
      disableVAD()
      disconnect()
    } else {
      try {
        await enableVAD()
      } catch {
        // enableVAD → connect() rejected — voice server unreachable
      }
    }
  }

  const handleVADToggle = () => {
    if (isVADActive) {
      disableVAD()
    } else {
      enableVAD()
    }
  }

  // Load agent identity from config on mount
  const loadIdentity = useCallback(async () => {
    try {
      const res = await fetch('/api/mercury/config', { credentials: 'include' })
      if (!res.ok) return
      const json = await res.json()
      if (json.success && json.data?.config) {
        setAgentName(json.data.config.name || 'Mercury')
        setAgentTitle(json.data.config.title || 'AI Assistant')
      }
    } catch { /* use defaults */ }
  }, [])

  useEffect(() => { loadIdentity() }, [loadIdentity])

  // Voice state label for the subheader
  const voiceStateLabel = isConnecting
    ? 'Connecting...'
    : state === 'error'
      ? 'Voice error'
      : isSpeaking
        ? 'Speaking'
        : state === 'listening' || (isPoweredOn && isVADActive)
          ? 'Listening'
          : state === 'processing'
            ? 'Processing'
            : isPoweredOn
              ? 'Voice ready'
              : 'Voice off'

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] overflow-hidden">
      {/* ─── Header ─── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-subtle)]">
        {/* Agent identity */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-[var(--bg-tertiary)] to-[var(--bg-primary)] border border-[var(--border-default)] flex items-center justify-center">
            <span className="text-xs font-bold text-[var(--warning)]/90">
              {agentName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                {agentName}
              </h2>
              {/* Online indicator */}
              <span className="shrink-0 flex items-center gap-1.5">
                <span className="relative w-2 h-2 rounded-full bg-[var(--success)]">
                  <span className="absolute inset-0 rounded-full bg-[var(--success)] animate-ping opacity-75" />
                </span>
                <span className="text-[10px] font-medium text-[var(--success)]">Online</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Mic icon — voice state indicator */}
          <div
            className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
              isPoweredOn
                ? 'text-[var(--brand-blue)]'
                : 'text-[var(--text-tertiary)]'
            }`}
          >
            <Mic className="w-4 h-4" />
          </div>

          {/* Gear icon */}
          <button
            onClick={() => setConfigOpen(true)}
            aria-label="Mercury configuration"
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg rail-icon-glow
                       text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─── Voice Controls Subheader — compact one-row ─── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-[var(--border-subtle)]">
        {/* Power Button */}
        <motion.button
          onClick={handlePowerToggle}
          disabled={isConnecting}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label={isPoweredOn ? 'Disconnect voice' : 'Connect voice'}
          className={`
            relative shrink-0 w-8 h-8 rounded-full flex items-center justify-center
            transition-all duration-300
            ${isPoweredOn
              ? 'bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-blue-dim)] shadow-[0_0_12px_rgba(36,99,235,0.4)]'
              : 'bg-[var(--bg-tertiary)]/80 hover:bg-[var(--bg-elevated)]/80 border border-[var(--border-strong)]'
            }
            ${isConnecting ? 'animate-pulse bg-[var(--warning)]/50' : ''}
            disabled:cursor-not-allowed
          `}
        >
          {isPoweredOn ? (
            <Power className="w-3.5 h-3.5 text-[var(--text-primary)]" />
          ) : (
            <PowerOff className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          )}
          {isPoweredOn && (
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-[var(--brand-blue)]"
              initial={{ scale: 1, opacity: 0.8 }}
              animate={{ scale: 1.4, opacity: 0 }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
        </motion.button>

        {/* Audio Level Bar */}
        <div className="flex-1 min-w-0">
          <AudioLevelBar level={isPoweredOn ? audioLevel : 0} isActive={isPoweredOn && isVADActive} />
        </div>

        {/* VAD Toggle + State Label */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-medium ${
            isPoweredOn
              ? isSpeaking ? 'text-[var(--brand-blue)]'
                : isVADActive ? 'text-[var(--success)]'
                : 'text-[var(--text-secondary)]'
              : 'text-[var(--text-tertiary)]'
          }`}>
            {voiceStateLabel}
          </span>
          <button
            onClick={handleVADToggle}
            disabled={!isPoweredOn}
            aria-label={isVADActive ? 'Disable VAD' : 'Enable VAD'}
            className={`
              flex items-center gap-1 py-1 px-2 rounded-md
              transition-all text-[10px] font-semibold uppercase tracking-wider
              ${isVADActive
                ? 'bg-[var(--success)]/20 text-[var(--success)] border border-[var(--success)]/30'
                : isPoweredOn
                  ? 'bg-[var(--bg-tertiary)]/50 text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-strong)]'
                  : 'bg-[var(--bg-tertiary)]/30 text-[var(--text-tertiary)]/50 border border-[var(--border-subtle)] cursor-not-allowed'
              }
            `}
          >
            <Radio className="w-2.5 h-2.5" />
            VAD
          </button>
        </div>
      </div>

      {/* ─── Unified Mercury Panel — always rendered ─── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <MercuryPanel />
      </div>

      {/* ─── Settings Modal ─── */}
      <MercurySettingsModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        onSaved={({ name, title }) => {
          setAgentName(name || 'Mercury')
          setAgentTitle(title || 'AI Assistant')
        }}
      />
    </div>
  )
}
