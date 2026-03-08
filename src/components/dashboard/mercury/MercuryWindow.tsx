'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { Settings, Mic, Power, PowerOff, Terminal } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { MercuryPanel } from './MercuryPanel'
import { MatrixRain } from './MatrixRain'
import { MercurySettingsModal } from './MercurySettingsModal'
import { useMercuryVoice, type VoiceStatus } from '@/hooks/useMercuryVoice'
import { useMercuryStore } from '@/stores/mercuryStore'
import type { ChatMessage } from '@/types/ragbox'

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
// STATUS LABEL MAP
// ============================================================================

const STATUS_LABELS: Record<VoiceStatus, string> = {
  off: 'Voice off',
  ready: 'Ready',
  listening: 'Listening...',
  thinking: 'Thinking...',
  speaking: 'Speaking...',
}

const STATUS_COLORS: Record<VoiceStatus, string> = {
  off: 'text-[var(--text-tertiary)]',
  ready: 'text-[var(--text-secondary)]',
  listening: 'text-[var(--success)]',
  thinking: 'text-[var(--warning)]',
  speaking: 'text-[var(--brand-blue)]',
}

// ============================================================================
// MERCURY WINDOW — Unified thread with inline voice controls
// ============================================================================

export function MercuryWindow() {
  const [configOpen, setConfigOpen] = useState(false)
  const [agentName, setAgentName] = useState('Evelyn Monroe')
  const [agentTitle, setAgentTitle] = useState('AI Assistant')
  const [greeting, setGreeting] = useState('')
  const greetingInjectedRef = useRef(false)

  // Matrix rain speed — persisted in localStorage
  const [matrixSpeed, setMatrixSpeed] = useState(() => {
    if (typeof window === 'undefined') return 30
    try {
      return parseInt(localStorage.getItem('mercury-matrix-speed') || '30', 10)
    } catch {
      return 30
    }
  })

  const { data: session } = useSession()
  const { status, audioLevel, connect, disconnect } = useMercuryVoice()
  const isStreaming = useMercuryStore((s) => s.isStreaming)

  // Auto-ramp matrix speed during AI streaming
  const effectiveSpeed = isStreaming ? 45 : matrixSpeed

  const isPoweredOn = status !== 'off'

  const handlePowerToggle = async () => {
    if (isPoweredOn) {
      disconnect()
    } else {
      await connect()
    }
  }

  // Load agent identity from config on mount
  const loadIdentity = useCallback(async () => {
    try {
      const res = await fetch('/api/mercury/config', { credentials: 'include' })
      if (!res.ok) return
      const json = await res.json()
      if (json.success && json.data?.config) {
        setAgentName(json.data.config.name || 'Evelyn Monroe')
        setAgentTitle(json.data.config.title || 'AI Assistant')
        setGreeting(json.data.config.greeting || '')
      }
    } catch { /* use defaults */ }
  }, [])

  useEffect(() => { loadIdentity() }, [loadIdentity])

  // Greeting wiring: inject greeting into Mercury thread when voice powers on
  useEffect(() => {
    if (isPoweredOn && greeting && !greetingInjectedRef.current) {
      greetingInjectedRef.current = true
      const greetingMsg: ChatMessage = {
        id: `voice-greeting-${Date.now()}`,
        role: 'assistant',
        content: greeting,
        timestamp: new Date(),
        channel: 'voice',
      }
      useMercuryStore.setState((s) => ({
        messages: [...s.messages, greetingMsg],
      }))
    }
    if (!isPoweredOn) {
      greetingInjectedRef.current = false
    }
  }, [isPoweredOn, greeting])

  // Persist matrix speed preference
  useEffect(() => {
    try {
      localStorage.setItem('mercury-matrix-speed', String(matrixSpeed))
    } catch { /* storage unavailable */ }
  }, [matrixSpeed])

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] overflow-hidden">
      {/* ─── Header — glass effect for rain visibility ─── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/80 backdrop-blur-md relative z-20">
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

      {/* ─── Voice Controls Subheader — glass effect ─── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/60 backdrop-blur-sm relative z-20">
        {/* Power Button */}
        <motion.button
          onClick={handlePowerToggle}
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

        {/* Audio Level Bar — only visible when voice is active */}
        {isPoweredOn && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <AudioLevelBar level={audioLevel} isActive={status === 'listening'} />
            <span className={`text-[10px] font-medium shrink-0 ${STATUS_COLORS[status]}`}>
              {STATUS_LABELS[status]}
            </span>
          </div>
        )}

        {/* Spacer when voice is off */}
        {!isPoweredOn && <div className="flex-1" />}

        {/* Matrix Rain speed control */}
        <div className="flex items-center gap-2 bg-[var(--bg-tertiary)]/40 px-3 py-1.5 rounded-full border border-[var(--border-default)] backdrop-blur-sm">
          <Terminal
            size={14}
            className={effectiveSpeed > 0 ? 'text-[var(--brand-blue)]' : 'text-[var(--text-tertiary)]'}
          />
          <span className="text-[10px] font-medium text-[var(--text-tertiary)]">Matrix</span>
          <input
            type="range"
            aria-label="Matrix rain animation speed"
            min="0"
            max="60"
            step="10"
            value={matrixSpeed}
            onChange={(e) => setMatrixSpeed(parseInt(e.target.value, 10))}
            className="w-20 h-1 bg-[var(--bg-elevated)] rounded-lg appearance-none cursor-pointer accent-[var(--brand-blue)]"
          />
          <span className="text-[10px] font-mono text-[var(--text-tertiary)] w-8">
            {matrixSpeed === 0 ? 'OFF' : matrixSpeed <= 10 ? 'SLOW' : matrixSpeed <= 30 ? 'ON' : 'FAST'}
          </span>
        </div>
      </div>

      {/* ─── Unified Mercury Panel — always rendered, with Matrix rain behind ─── */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {/* Matrix rain — behind everything */}
        <MatrixRain
          opacity={0.7}
          color="#60a5fa"
          backgroundColor="#0b1120"
          speed={effectiveSpeed}
        />
        {/* Chat panel — on top with glass effect */}
        <div className="relative z-10 h-full">
          <MercuryPanel />
        </div>
      </div>

      {/* ─── Settings Modal ─── */}
      <MercurySettingsModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        onSaved={({ name, title, greeting: g }) => {
          setAgentName(name || 'Evelyn Monroe')
          setAgentTitle(title || 'AI Assistant')
          if (g !== undefined) setGreeting(g)
        }}
      />
    </div>
  )
}
