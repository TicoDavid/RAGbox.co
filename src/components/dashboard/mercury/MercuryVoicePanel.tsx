'use client'

import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic,
  MicOff,
  Power,
  Volume2,
  VolumeX,
  Radio,
  AlertCircle,
} from 'lucide-react'
import { useSovereignAgentVoice } from '@/hooks/useSovereignAgentVoice'

// ============================================================================
// AUDIO LEVEL BAR (Compact version)
// ============================================================================

function AudioLevelBar({ level, isActive }: { level: number; isActive: boolean }) {
  return (
    <div className="w-full h-2 bg-slate-800/50 rounded-full overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${
          isActive
            ? 'bg-gradient-to-r from-cyan-500 to-emerald-400'
            : 'bg-slate-600'
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
  connectionState,
  isVADActive,
  isSpeaking
}: {
  connectionState: string
  isVADActive: boolean
  isSpeaking: boolean
}) {
  const getStateConfig = () => {
    if (connectionState === 'connecting') {
      return { color: 'text-amber-400', pulse: true, label: 'Connecting...' }
    }
    if (connectionState === 'error') {
      return { color: 'text-red-400', pulse: false, label: 'Error' }
    }
    if (connectionState !== 'connected') {
      return { color: 'text-slate-500', pulse: false, label: 'Offline' }
    }
    if (isSpeaking) {
      return { color: 'text-cyan-400', pulse: true, label: 'Speaking' }
    }
    if (isVADActive) {
      return { color: 'text-emerald-400', pulse: true, label: 'Listening' }
    }
    return { color: 'text-slate-400', pulse: false, label: 'Ready' }
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
  const {
    connect,
    disconnect,
    connectionState,
    error,
    transcript,
    agentText,
    isVADActive,
    audioLevel,
    enableVAD,
    disableVAD,
  } = useSovereignAgentVoice()

  const transcriptRef = useRef<HTMLDivElement>(null)
  const isPoweredOn = connectionState === 'connected'
  const isSpeaking = (agentText?.length ?? 0) > 0

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [transcript, agentText])

  // Toggle power
  const handlePowerToggle = async () => {
    if (isPoweredOn) {
      disableVAD()
      disconnect()
    } else {
      await connect()
      enableVAD()
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
      <div className="shrink-0 px-4 py-3 border-b border-white/5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <Mic className="w-4 h-4 text-cyan-400" />
            Mercury
          </h3>
          <StateIndicator
            connectionState={connectionState}
            isVADActive={isVADActive}
            isSpeaking={isSpeaking}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden p-4 gap-4">
        {/* Power Button - Main CTA */}
        <div className="flex justify-center">
          <motion.button
            onClick={handlePowerToggle}
            disabled={connectionState === 'connecting'}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`
              relative w-20 h-20 rounded-full flex items-center justify-center
              transition-all duration-300
              ${isPoweredOn
                ? 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-[0_0_30px_rgba(0,240,255,0.5)]'
                : 'bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600'
              }
              ${connectionState === 'connecting' ? 'animate-pulse' : ''}
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            <Power className={`w-8 h-8 ${isPoweredOn ? 'text-white' : 'text-slate-400'}`} />

            {/* Outer ring animation when active */}
            {isPoweredOn && isVADActive && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-cyan-400"
                initial={{ scale: 1, opacity: 0.8 }}
                animate={{ scale: 1.3, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
          </motion.button>
        </div>

        {/* Audio Level */}
        {isPoweredOn && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Audio Level</span>
              <span>{((audioLevel ?? 0) * 100).toFixed(0)}%</span>
            </div>
            <AudioLevelBar level={audioLevel ?? 0} isActive={isVADActive ?? false} />
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
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-600'
              }
            `}
          >
            <Radio className="w-4 h-4" />
            {isVADActive ? 'VAD Active' : 'Enable VAD'}
          </button>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          </div>
        )}

        {/* Transcript Area */}
        <div
          ref={transcriptRef}
          className="flex-1 overflow-y-auto bg-slate-900/50 rounded-lg border border-white/5 p-3"
        >
          {!isPoweredOn ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-xs text-slate-600 text-center">
                Press power to activate<br />Mercury voice agent
              </p>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              {/* User transcript */}
              {transcript && (
                <div className="text-slate-300">
                  <span className="text-xs text-cyan-500 block mb-1">You</span>
                  {transcript}
                </div>
              )}

              {/* Agent response */}
              {agentText && (
                <div className="text-slate-200">
                  <span className="text-xs text-emerald-500 block mb-1">Mercury</span>
                  {agentText}
                </div>
              )}

              {/* Empty state */}
              {!transcript && !agentText && (
                <p className="text-xs text-slate-600 text-center py-4">
                  Start speaking to Mercury
                </p>
              )}
            </div>
          )}
        </div>

        {/* Status Footer */}
        <div className="shrink-0 text-center">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider">
            {isPoweredOn ? 'Hands-free voice mode' : 'Voice agent offline'}
          </p>
        </div>
      </div>
    </div>
  )
}
