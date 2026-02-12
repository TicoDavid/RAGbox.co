'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Loader2, Waves, X, Volume2, VolumeX, Settings } from 'lucide-react'
import { useAgentWebSocket, type AgentState, type TranscriptMessage } from '@/hooks/useAgentWebSocket'

// ============================================================================
// TYPES
// ============================================================================

interface VoicePanelProps {
  /** WebSocket URL for voice server (auto-detects if not provided) */
  wsUrl?: string
  /** Whether the panel is open */
  isOpen: boolean
  /** Close the panel */
  onClose: () => void
  /** Called when agent sends final text response */
  onAgentResponse?: (text: string) => void
  /** Called when user speech is finalized */
  onUserSpeech?: (text: string) => void
}

// ============================================================================
// WAVEFORM VISUALIZER
// ============================================================================

function WaveformBars({ isActive, color = 'cyan' }: { isActive: boolean; color?: 'cyan' | 'emerald' | 'amber' }) {
  const colorClasses = {
    cyan: 'from-cyan-400 to-blue-500',
    emerald: 'from-emerald-400 to-teal-500',
    amber: 'from-amber-400 to-orange-500',
  }

  return (
    <div className="flex items-center justify-center gap-1 h-8">
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          animate={isActive ? {
            height: [8, 24, 16, 32, 12],
            opacity: [0.5, 1, 0.7, 1, 0.6],
          } : { height: 8, opacity: 0.3 }}
          transition={{
            duration: 0.5,
            repeat: isActive ? Infinity : 0,
            delay: i * 0.1,
          }}
          className={`w-1 rounded-full bg-gradient-to-t ${colorClasses[color]}`}
        />
      ))}
    </div>
  )
}

// ============================================================================
// TRANSCRIPT DISPLAY
// ============================================================================

function TranscriptView({ messages }: { messages: TranscriptMessage[] }) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-700" role="log" aria-label="Voice transcript" aria-live="polite">
      {messages.length === 0 ? (
        <div className="text-center text-gray-500 text-sm py-8">
          <Mic className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Start speaking to begin</p>
        </div>
      ) : (
        messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`
                max-w-[80%] px-4 py-2 rounded-2xl text-sm
                ${msg.type === 'user'
                  ? 'bg-cyan-500/20 text-cyan-100 rounded-br-sm border border-cyan-500/30'
                  : 'bg-[#1a1a2e] text-gray-200 rounded-bl-sm border border-gray-700'
                }
                ${!msg.isFinal ? 'opacity-70' : ''}
              `}
            >
              {msg.text}
              {!msg.isFinal && (
                <span className="ml-1 inline-block w-1.5 h-4 bg-current animate-pulse" />
              )}
            </div>
          </motion.div>
        ))
      )}
    </div>
  )
}

// ============================================================================
// STATE INDICATOR
// ============================================================================

function StateIndicator({ state }: { state: AgentState }) {
  const configs: Record<AgentState, { label: string; color: string; icon: React.ReactNode }> = {
    disconnected: { label: 'Disconnected', color: 'text-gray-500', icon: <MicOff className="w-4 h-4" /> },
    connecting: { label: 'Connecting...', color: 'text-blue-400', icon: <Loader2 className="w-4 h-4 animate-spin" /> },
    listening: { label: 'Listening', color: 'text-cyan-400', icon: <Mic className="w-4 h-4" /> },
    processing: { label: 'Processing', color: 'text-amber-400', icon: <Loader2 className="w-4 h-4 animate-spin" /> },
    speaking: { label: 'Mercury Speaking', color: 'text-emerald-400', icon: <Waves className="w-4 h-4" /> },
    idle: { label: 'Ready', color: 'text-gray-400', icon: <Mic className="w-4 h-4" /> },
    error: { label: 'Error', color: 'text-red-400', icon: <MicOff className="w-4 h-4" /> },
  }

  const config = configs[state]

  return (
    <div className={`flex items-center gap-2 text-xs font-medium ${config.color}`}>
      {config.icon}
      <span>{config.label}</span>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function VoicePanel({
  wsUrl,
  isOpen,
  onClose,
  onAgentResponse,
  onUserSpeech,
}: VoicePanelProps) {
  const [isMuted, setIsMuted] = useState(false)

  const handleToolCall = useCallback(async (call: { id: string; name: string; parameters: Record<string, unknown> }) => {
    // Handle tool calls from the agent
    // Example tool handlers
    switch (call.name) {
      case 'search_documents':
        // Could trigger document search UI
        return { results: [] }
      case 'upload_document':
        // Could open file picker
        return { success: false, reason: 'User must upload manually' }
      default:
        return { error: `Unknown tool: ${call.name}` }
    }
  }, [])

  const {
    state,
    isConnected,
    isListening,
    isSpeaking,
    transcript,
    connect,
    disconnect,
    startListening,
    stopListening,
    bargeIn,
    clearTranscript,
  } = useAgentWebSocket({
    wsUrl,
    autoReconnect: true,
    onToolCall: handleToolCall,
    onError: () => {},
  })

  // Auto-connect when panel opens
  useEffect(() => {
    if (isOpen && !isConnected) {
      connect()
    }
  }, [isOpen, isConnected, connect])

  // Notify parent of responses
  useEffect(() => {
    const lastMessage = transcript[transcript.length - 1]
    if (lastMessage?.isFinal) {
      if (lastMessage.type === 'agent') {
        onAgentResponse?.(lastMessage.text)
      } else {
        onUserSpeech?.(lastMessage.text)
      }
    }
  }, [transcript, onAgentResponse, onUserSpeech])

  // Handle main action button
  const handleMainAction = () => {
    if (!isConnected) {
      connect()
    } else if (isSpeaking) {
      bargeIn()
    } else if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  const getMainButtonConfig = () => {
    if (!isConnected) {
      return { icon: <Mic className="w-6 h-6" />, label: 'Connect', color: 'bg-blue-600 hover:bg-blue-500' }
    }
    if (isSpeaking) {
      return { icon: <Volume2 className="w-6 h-6" />, label: 'Interrupt', color: 'bg-emerald-600 hover:bg-emerald-500' }
    }
    if (isListening) {
      return { icon: <MicOff className="w-6 h-6" />, label: 'Stop', color: 'bg-cyan-600 hover:bg-cyan-500' }
    }
    return { icon: <Mic className="w-6 h-6" />, label: 'Speak', color: 'bg-gray-700 hover:bg-gray-600' }
  }

  const mainButton = getMainButtonConfig()

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-4 right-4 w-96 h-[500px] z-50
                   bg-[#0A0A0F]/95 backdrop-blur-xl
                   border border-gray-800 rounded-2xl shadow-2xl
                   flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-gray-600'}`} />
              {isListening && (
                <motion.div
                  animate={{ scale: [1, 1.5, 1], opacity: [1, 0, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="absolute inset-0 rounded-full bg-cyan-500"
                />
              )}
            </div>
            <span className="text-sm font-medium text-gray-200">Mercury Voice</span>
          </div>

          <div className="flex items-center gap-2">
            <StateIndicator state={state} />
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
              aria-label="Close voice panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Visualizer Area */}
        <div className="flex items-center justify-center py-8 border-b border-gray-800/50 bg-gradient-to-b from-gray-900/50 to-transparent">
          {isListening && <WaveformBars isActive={true} color="cyan" />}
          {isSpeaking && <WaveformBars isActive={true} color="emerald" />}
          {state === 'processing' && (
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          )}
          {state === 'idle' && (
            <div className="text-center">
              <Mic className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-500">Click to start speaking</p>
            </div>
          )}
          {!isConnected && (
            <div className="text-center">
              <MicOff className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-500">Click to connect</p>
            </div>
          )}
        </div>

        {/* Transcript */}
        <TranscriptView messages={transcript} />

        {/* Controls */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800 bg-gray-900/50">
          {/* Left controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-2 rounded-lg transition-colors ${
                isMuted ? 'bg-red-900/30 text-red-400' : 'hover:bg-gray-800 text-gray-400'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
              aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              onClick={clearTranscript}
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 text-xs"
              title="Clear transcript"
              aria-label="Clear transcript"
            >
              Clear
            </button>
          </div>

          {/* Main action button */}
          <motion.button
            onClick={handleMainAction}
            whileTap={{ scale: 0.95 }}
            aria-label={mainButton.label}
            className={`
              px-6 py-2.5 rounded-full flex items-center gap-2
              font-medium text-white transition-all
              ${mainButton.color}
              ${isListening ? 'ring-2 ring-cyan-500/50 shadow-[0_0_20px_rgba(0,240,255,0.3)]' : ''}
            `}
          >
            {mainButton.icon}
            <span className="text-sm">{mainButton.label}</span>
          </motion.button>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {isConnected && (
              <button
                onClick={disconnect}
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 text-xs"
                title="Disconnect"
                aria-label="End voice session"
              >
                End
              </button>
            )}
            <button
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-400"
              title="Voice settings"
              aria-label="Voice settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

export default VoicePanel
