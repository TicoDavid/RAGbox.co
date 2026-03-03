'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Mic,
  Power,
  Radio,
  PowerOff,
  Send,
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useSovereignAgentVoice, type AgentVoiceState } from '@/hooks/useSovereignAgentVoice'
import { usePrivilegeStore } from '@/stores/privilegeStore'
import { useMercuryStore } from '@/stores/mercuryStore'
import type { ChatMessage } from '@/types/ragbox'

// Channel badge icons for the unified conversation
const CHANNEL_ICON: Record<string, string> = {
  dashboard: '\u{1F4AC}',
  voice: '\u{1F3A4}',
  whatsapp: '\u{1F4F1}',
  roam: '\u{1F3E0}',
  email: '\u{1F4E7}',
  sms: '\u{1F4AC}',
}

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

interface MercuryVoicePanelProps {
  agentName?: string
}

export function MercuryVoicePanel({ agentName = 'Mercury' }: MercuryVoicePanelProps) {
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
    disconnect,
    enableVAD,
    disableVAD,
  } = useSovereignAgentVoice({
    userId,
    privilegeMode,
  })

  // Mercury store — unified thread
  const messages = useMercuryStore((s) => s.messages)
  const isStreaming = useMercuryStore((s) => s.isStreaming)
  const streamingContent = useMercuryStore((s) => s.streamingContent)
  const setInputValue = useMercuryStore((s) => s.setInputValue)
  const sendMessage = useMercuryStore((s) => s.sendMessage)
  const loadThread = useMercuryStore((s) => s.loadThread)
  const threadLoaded = useMercuryStore((s) => s.threadLoaded)

  const transcriptRef = useRef<HTMLDivElement>(null)
  const [textInput, setTextInput] = useState('')
  const isPoweredOn = isConnected
  const isConnecting = state === 'connecting'

  // Load thread on mount (if not already loaded by MercuryPanel)
  useEffect(() => {
    if (!threadLoaded) loadThread()
  }, [threadLoaded, loadThread])

  // Sync voice events to Mercury store when MercuryPanel is unmounted (voice mode).
  // This mirrors the listeners in MercuryPanel.tsx so voice messages appear in
  // the unified thread and persist to the backend.
  useEffect(() => {
    const handleVoiceQuery = (e: Event) => {
      const detail = (e as CustomEvent).detail as { text: string }
      const msg: ChatMessage = {
        id: `voice-u-${Date.now()}`,
        role: 'user',
        content: detail.text,
        timestamp: new Date(),
        channel: 'voice',
      }
      useMercuryStore.setState((s) => ({
        messages: [...s.messages, msg],
      }))
      const tid = useMercuryStore.getState().threadId
      fetch('/api/mercury/thread/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: tid, role: 'user', channel: 'voice', content: detail.text }),
      }).catch(() => {})
    }

    const handleVoiceResponse = (e: Event) => {
      const detail = (e as CustomEvent).detail as { text: string }
      const msg: ChatMessage = {
        id: `voice-a-${Date.now()}`,
        role: 'assistant',
        content: detail.text,
        timestamp: new Date(),
        channel: 'voice',
      }
      useMercuryStore.setState((s) => ({
        messages: [...s.messages, msg],
      }))
      const tid = useMercuryStore.getState().threadId
      fetch('/api/mercury/thread/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: tid, role: 'assistant', channel: 'voice', content: detail.text }),
      }).catch(() => {})
    }

    window.addEventListener('mercury:voice-query', handleVoiceQuery)
    window.addEventListener('mercury:voice-response', handleVoiceResponse)
    return () => {
      window.removeEventListener('mercury:voice-query', handleVoiceQuery)
      window.removeEventListener('mercury:voice-response', handleVoiceResponse)
    }
  }, [])

  // Auto-scroll conversation
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [messages, transcript, streamingContent])

  // Toggle power — BUG-039 Part B: Call enableVAD() directly instead of
  // connect() + setTimeout(enableVAD, 500). enableVAD already calls connect()
  // internally and waits for OPEN before starting audio capture.
  const handlePowerToggle = async () => {
    if (isPoweredOn) {
      disableVAD()
      disconnect()
    } else {
      try {
        await enableVAD()
      } catch {
        // enableVAD → connect() rejected — voice server unreachable.
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

  // Send text message through Mercury chat pipeline
  const handleSend = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    const text = textInput.trim()
    if (!text || isStreaming) return
    setTextInput('')
    setInputValue(text)
    await sendMessage(privilegeMode)
  }, [textInput, isStreaming, setInputValue, sendMessage, privilegeMode])

  // Non-final voice transcript entries = real-time typing indicators
  const interimEntries = transcript.filter((e) => !e.isFinal)

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
            <Mic className="w-4 h-4 text-[var(--brand-blue)]" />
            {agentName}
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
      <div className="flex-1 flex flex-col overflow-hidden p-4 gap-3">
        {/* Voice Controls — power + audio level + VAD in a compact row */}
        <div className="shrink-0 flex items-center gap-3">
          {/* Power Button */}
          <motion.button
            onClick={handlePowerToggle}
            disabled={isConnecting}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`
              relative w-12 h-12 rounded-full flex items-center justify-center shrink-0
              transition-all duration-300
              ${isPoweredOn
                ? 'bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-blue-dim)] shadow-[0_0_20px_rgba(0,240,255,0.4)]'
                : 'bg-[var(--bg-tertiary)]/80 hover:bg-[var(--bg-elevated)]/80 border border-[var(--border-strong)]'
              }
              ${isConnecting ? 'animate-pulse bg-[var(--warning)]/50' : ''}
              disabled:cursor-not-allowed
            `}
          >
            {isPoweredOn ? (
              <Power className="w-5 h-5 text-[var(--text-primary)]" />
            ) : (
              <PowerOff className="w-5 h-5 text-[var(--text-secondary)]" />
            )}
            {isPoweredOn && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-[var(--brand-blue)]"
                initial={{ scale: 1, opacity: 0.8 }}
                animate={{ scale: 1.4, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
            {isSpeaking && (
              <motion.div
                className="absolute inset-0 rounded-full bg-[var(--brand-blue)]/30"
                initial={{ opacity: 0.3 }}
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
            )}
          </motion.button>

          {/* Audio Level + VAD (when powered on) */}
          {isPoweredOn ? (
            <div className="flex-1 flex flex-col gap-1.5">
              <AudioLevelBar level={audioLevel} isActive={isVADActive} />
              <button
                onClick={handleVADToggle}
                className={`
                  flex items-center justify-center gap-1.5 py-1 px-3 rounded-md
                  transition-all text-xs font-medium
                  ${isVADActive
                    ? 'bg-[var(--success)]/20 text-[var(--success)] border border-[var(--success)]/30'
                    : 'bg-[var(--bg-tertiary)]/50 text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-strong)]'
                  }
                `}
              >
                <Radio className="w-3 h-3" />
                {isVADActive ? 'VAD Active' : 'Enable VAD'}
              </button>
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">
              Press power for voice, or type below
            </p>
          )}
        </div>

        {/* Conversation Thread — unified messages + real-time voice */}
        <div
          ref={transcriptRef}
          className="flex-1 overflow-y-auto bg-[var(--bg-primary)]/50 rounded-lg border border-[var(--border-subtle)] p-3"
        >
          <div className="space-y-3 text-sm">
            {/* Unified messages from Mercury store */}
            {messages.map((msg) => (
              <div key={msg.id}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className={`text-xs font-medium ${
                      msg.role === 'user' ? 'text-[var(--brand-blue)]' : 'text-[var(--success)]'
                    }`}
                  >
                    {msg.role === 'user' ? 'You' : agentName}
                  </span>
                  {msg.channel && (
                    <span className="text-[10px]">
                      {CHANNEL_ICON[msg.channel] || ''}
                    </span>
                  )}
                </div>
                <span className={msg.role === 'user' ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}>
                  {msg.content}
                </span>
              </div>
            ))}

            {/* Streaming text response */}
            {isStreaming && streamingContent && (
              <div>
                <span className="text-xs font-medium text-[var(--success)] block mb-1">
                  {agentName}
                </span>
                <span className="text-[var(--text-primary)] opacity-60">
                  {streamingContent}
                  <span className="animate-pulse ml-0.5">{'\u{258B}'}</span>
                </span>
              </div>
            )}

            {/* Real-time voice transcript (non-final entries = typing indicators) */}
            {interimEntries.map((entry) => (
              <div key={entry.id} className="opacity-50 italic">
                <span className={`text-xs block mb-1 ${
                  entry.type === 'user' ? 'text-[var(--brand-blue)]' : 'text-[var(--success)]'
                }`}>
                  {entry.type === 'user' ? 'You \u{1F3A4}' : `${agentName} \u{1F3A4}`}
                </span>
                <span className="text-[var(--text-tertiary)]">{entry.text}</span>
              </div>
            ))}

            {/* Empty state */}
            {messages.length === 0 && interimEntries.length === 0 && !isStreaming && (
              <p className="text-xs text-[var(--text-muted)] text-center py-4">
                {isPoweredOn
                  ? `Speak to ${agentName} or type below`
                  : `Type a message or enable voice`}
              </p>
            )}
          </div>
        </div>

        {/* Text Input Bar */}
        <form onSubmit={handleSend} className="shrink-0 flex items-center gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={`Ask ${agentName}...`}
            disabled={isStreaming}
            className="flex-1 bg-[var(--bg-tertiary)]/50 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-lg px-3 py-2 border border-[var(--border-default)] focus:border-[var(--brand-blue)] focus:outline-none transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!textInput.trim() || isStreaming}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--brand-blue)] text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--brand-blue-hover)] transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        {/* Status Footer — dynamic voice state */}
        <div className="shrink-0 text-center">
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
            {state === 'connecting' ? 'Connecting...'
              : state === 'listening' ? 'Listening...'
              : isSpeaking ? `${agentName} is speaking...`
              : state === 'processing' ? 'Processing...'
              : state === 'error' ? 'Voice unavailable'
              : isPoweredOn ? 'Voice + text active'
              : `Voice + text \u{00B7} ${agentName}`}
          </p>
        </div>
      </div>
    </div>
  )
}
