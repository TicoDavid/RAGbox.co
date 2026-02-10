'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic,
  MicOff,
  Loader2,
  Waves,
  X,
  Volume2,
  Zap,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileSearch,
  FolderOpen,
  Shield,
  Navigation,
  Power,
  Radio,
} from 'lucide-react'
import {
  useSovereignAgentVoice,
  type AgentVoiceState,
  type TranscriptEntry,
  type ToolCallInfo,
} from '@/hooks/useSovereignAgentVoice'

// ============================================================================
// TYPES
// ============================================================================

interface AgentDriverPanelProps {
  isOpen: boolean
  onClose: () => void
  userId?: string
  role?: 'User' | 'Admin' | 'Viewer'
  privilegeMode?: boolean
  onPrivilegeModeChange?: (enabled: boolean) => void
}

// ============================================================================
// TOOL ICONS
// ============================================================================

const TOOL_ICONS: Record<string, React.ReactNode> = {
  search_documents: <FileSearch className="w-4 h-4" />,
  open_document: <FolderOpen className="w-4 h-4" />,
  toggle_privilege_mode: <Shield className="w-4 h-4" />,
  navigate_to: <Navigation className="w-4 h-4" />,
  default: <Zap className="w-4 h-4" />,
}

function getToolIcon(name: string): React.ReactNode {
  return TOOL_ICONS[name] || TOOL_ICONS.default
}

// ============================================================================
// TOOL EXECUTION CARD
// ============================================================================

function ToolCard({ tool }: { tool: ToolCallInfo }) {
  const [expanded, setExpanded] = useState(false)

  const statusColors = {
    pending: 'text-gray-400 bg-gray-800',
    executing: 'text-amber-400 bg-amber-900/30 animate-pulse',
    success: 'text-emerald-400 bg-emerald-900/30',
    error: 'text-red-400 bg-red-900/30',
  }

  const statusIcons = {
    pending: <Loader2 className="w-3 h-3 animate-spin" />,
    executing: <Loader2 className="w-3 h-3 animate-spin" />,
    success: <CheckCircle2 className="w-3 h-3" />,
    error: <AlertCircle className="w-3 h-3" />,
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg border ${
        tool.status === 'executing'
          ? 'border-amber-500/50 bg-amber-500/5'
          : tool.status === 'success'
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : tool.status === 'error'
          ? 'border-red-500/30 bg-red-500/5'
          : 'border-gray-700 bg-gray-800/50'
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded ${statusColors[tool.status]}`}>
            {getToolIcon(tool.name)}
          </div>
          <div>
            <div className="text-sm font-medium text-gray-200">
              {tool.name.replace(/_/g, ' ')}
            </div>
            {tool.status === 'error' && tool.error && (
              <div className="text-xs text-red-400 mt-0.5">{tool.error}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 text-xs ${statusColors[tool.status].split(' ')[0]}`}>
            {statusIcons[tool.status]}
            <span className="capitalize">{tool.status}</span>
          </span>
          {tool.result !== undefined && (
            expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {expanded && tool.result !== undefined && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">
              <pre className="text-xs text-gray-400 bg-black/30 rounded p-2 overflow-x-auto">
                {JSON.stringify(tool.result, null, 2)}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ============================================================================
// TRANSCRIPT ENTRY
// ============================================================================

function TranscriptItem({ entry }: { entry: TranscriptEntry }) {
  if (entry.type === 'system') {
    if (entry.toolCall) {
      return <ToolCard tool={entry.toolCall} />
    }
    return (
      <div className="text-center py-2">
        <span className="text-xs text-gray-500 bg-gray-800/50 px-3 py-1 rounded-full">
          {entry.text}
        </span>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${entry.type === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`
          max-w-[85%] px-4 py-2.5 rounded-2xl
          ${entry.type === 'user'
            ? 'bg-cyan-600/20 text-cyan-100 rounded-br-sm border border-cyan-500/30'
            : 'bg-gradient-to-br from-gray-800 to-gray-900 text-gray-100 rounded-bl-sm border border-gray-700'
          }
        `}
      >
        <div className="text-xs text-gray-500 mb-1">
          {entry.type === 'user' ? 'You' : 'Mercury'}
        </div>
        <div className="text-sm leading-relaxed">
          {entry.text}
          {!entry.isFinal && (
            <span className="ml-1 inline-block w-1.5 h-4 bg-current animate-pulse" />
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ============================================================================
// STATE INDICATOR
// ============================================================================

function StateBar({ state, currentTool, isVADActive }: { state: AgentVoiceState; currentTool: ToolCallInfo | null; isVADActive: boolean }) {
  const configs: Record<AgentVoiceState, { label: string; color: string; bg: string }> = {
    disconnected: { label: 'Offline', color: 'text-gray-500', bg: 'bg-gray-800' },
    connecting: { label: 'Connecting...', color: 'text-blue-400', bg: 'bg-blue-900/30' },
    listening: { label: 'Listening', color: 'text-cyan-400', bg: 'bg-cyan-900/30' },
    processing: { label: 'Processing', color: 'text-amber-400', bg: 'bg-amber-900/30' },
    speaking: { label: 'Speaking', color: 'text-emerald-400', bg: 'bg-emerald-900/30' },
    executing: { label: `Executing: ${currentTool?.name || '...'}`, color: 'text-purple-400', bg: 'bg-purple-900/30' },
    idle: { label: isVADActive ? 'Waiting...' : 'Ready', color: 'text-gray-400', bg: 'bg-gray-800' },
    error: { label: 'Error', color: 'text-red-400', bg: 'bg-red-900/30' },
  }

  const config = configs[state]

  return (
    <motion.div
      layout
      className={`px-3 py-1.5 rounded-full ${config.bg} ${config.color} text-xs font-medium flex items-center gap-2`}
    >
      {state === 'listening' && <Waves className="w-3 h-3 animate-pulse" />}
      {state === 'speaking' && <Volume2 className="w-3 h-3" />}
      {state === 'executing' && <Zap className="w-3 h-3 animate-pulse" />}
      {(state === 'connecting' || state === 'processing') && <Loader2 className="w-3 h-3 animate-spin" />}
      {state === 'idle' && isVADActive && <Radio className="w-3 h-3 animate-pulse" />}
      <span>{config.label}</span>
    </motion.div>
  )
}

// ============================================================================
// AUDIO LEVEL VISUALIZER
// ============================================================================

function AudioLevelBar({ level, isActive }: { level: number; isActive: boolean }) {
  if (!isActive) return null

  return (
    <div className="flex items-center gap-1 h-4">
      {[...Array(12)].map((_, i) => {
        const threshold = i / 12
        const isLit = level > threshold
        return (
          <motion.div
            key={i}
            animate={{
              scaleY: isLit ? 1 : 0.3,
              opacity: isLit ? 1 : 0.3,
            }}
            transition={{ duration: 0.05 }}
            className={`w-1 h-full rounded-full ${
              i < 4 ? 'bg-emerald-500' : i < 8 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
          />
        )
      })}
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AgentDriverPanel({
  isOpen,
  onClose,
  userId = 'anonymous',
  role = 'User',
  privilegeMode = false,
  onPrivilegeModeChange,
}: AgentDriverPanelProps) {
  const transcriptEndRef = React.useRef<HTMLDivElement>(null)

  const handleUIAction = useCallback((action: { type: string; [key: string]: unknown }) => {
    if (action.type === 'toggle_privilege' && onPrivilegeModeChange) {
      onPrivilegeModeChange(action.enabled as boolean)
    }
  }, [onPrivilegeModeChange])

  const {
    state,
    isConnected,
    isListening,
    isSpeaking,
    isVADActive,
    audioLevel,
    transcript,
    currentTool,
    connect,
    disconnect,
    enableVAD,
    disableVAD,
    startListening,
    stopListening,
    bargeIn,
    clearTranscript,
  } = useSovereignAgentVoice({
    userId,
    role,
    privilegeMode,
    autoReconnect: true,
    onUIAction: handleUIAction,
  })

  // Auto-connect when panel opens
  useEffect(() => {
    if (isOpen && !isConnected) {
      connect()
    }
  }, [isOpen, isConnected, connect])

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  // Handle VAD toggle
  const handleVADToggle = () => {
    if (isVADActive) {
      disableVAD()
    } else {
      enableVAD()
    }
  }

  // Handle main action (for manual mode)
  const handleMainAction = () => {
    if (isVADActive) {
      // In VAD mode, main button interrupts speech
      if (isSpeaking) {
        bargeIn()
      }
      return
    }

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

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      className="fixed bottom-4 right-4 w-[420px] h-[600px] z-50
                 bg-[#0A0A0F]/98 backdrop-blur-xl
                 border border-gray-800 rounded-2xl shadow-2xl
                 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gradient-to-r from-gray-900/50 to-transparent">
        <div className="flex items-center gap-3">
          <div className="relative">
            <motion.div
              animate={isVADActive ? {
                boxShadow: ['0 0 0 0 rgba(16, 185, 129, 0.4)', '0 0 0 8px rgba(16, 185, 129, 0)', '0 0 0 0 rgba(16, 185, 129, 0)'],
              } : isListening ? {
                boxShadow: ['0 0 0 0 rgba(0, 240, 255, 0.4)', '0 0 0 10px rgba(0, 240, 255, 0)', '0 0 0 0 rgba(0, 240, 255, 0)'],
              } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
              className={`w-3 h-3 rounded-full ${
                isVADActive ? 'bg-emerald-500' : isConnected ? 'bg-cyan-500' : 'bg-gray-600'
              }`}
            />
          </div>
          <div>
            <span className="text-sm font-medium text-gray-200">Mercury Agent</span>
            {isVADActive && (
              <span className="text-xs text-emerald-400 ml-2">Hands-Free</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StateBar state={state} currentTool={currentTool} isVADActive={isVADActive} />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Audio Level (when VAD active) */}
      {isVADActive && (
        <div className="px-4 py-2 border-b border-gray-800/50 bg-gray-900/30 flex items-center justify-between">
          <span className="text-xs text-gray-500">Audio Level</span>
          <AudioLevelBar level={audioLevel} isActive={isVADActive} />
        </div>
      )}

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-700">
        {transcript.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center mb-4">
              <Mic className="w-8 h-8 text-cyan-400" />
            </div>
            <h3 className="text-gray-200 font-medium mb-2">Agent Ready</h3>
            <p className="text-sm text-gray-500 max-w-xs">
              {isVADActive
                ? 'Hands-free mode active. Just speak naturally and Mercury will respond.'
                : 'Enable hands-free mode or click the mic to speak.'}
            </p>
            <div className="mt-6 text-xs text-gray-600 space-y-1">
              <p>&quot;Find all contracts from last month&quot;</p>
              <p>&quot;Open the NDA document&quot;</p>
              <p>&quot;Enable privilege mode&quot;</p>
            </div>
          </div>
        ) : (
          transcript.map(entry => (
            <TranscriptItem key={entry.id} entry={entry} />
          ))
        )}
        <div ref={transcriptEndRef} />
      </div>

      {/* Controls */}
      <div className="border-t border-gray-800 bg-gradient-to-t from-gray-900/50 to-transparent p-4">
        <div className="flex items-center justify-between">
          {/* Left actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={clearTranscript}
              disabled={transcript.length === 0}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            >
              Clear
            </button>
            {isConnected && (
              <button
                onClick={disconnect}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
              >
                Disconnect
              </button>
            )}
          </div>

          {/* Main action button */}
          <div className="flex items-center gap-3">
            {/* VAD Toggle */}
            <motion.button
              onClick={handleVADToggle}
              disabled={!isConnected}
              whileTap={{ scale: 0.95 }}
              className={`
                relative w-12 h-12 rounded-full flex items-center justify-center
                transition-all duration-300
                ${isVADActive
                  ? 'bg-emerald-600 shadow-[0_0_20px_rgba(16,185,129,0.5)]'
                  : 'bg-gray-700 hover:bg-gray-600'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              title={isVADActive ? 'Disable hands-free mode' : 'Enable hands-free mode'}
            >
              <Power className={`w-5 h-5 ${isVADActive ? 'text-white' : 'text-gray-300'}`} />
              {isVADActive && (
                <motion.div
                  animate={{ scale: [1, 1.3], opacity: [0.5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="absolute inset-0 rounded-full bg-emerald-500"
                />
              )}
            </motion.button>

            {/* Mic button (for manual mode or barge-in) */}
            <motion.button
              onClick={handleMainAction}
              disabled={!isConnected && !isVADActive}
              whileTap={{ scale: 0.95 }}
              className={`
                relative w-16 h-16 rounded-full flex items-center justify-center
                transition-all duration-300
                ${isListening
                  ? 'bg-cyan-600 shadow-[0_0_30px_rgba(0,240,255,0.5)]'
                  : isSpeaking
                  ? 'bg-emerald-600 shadow-[0_0_30px_rgba(16,185,129,0.5)]'
                  : isVADActive && state === 'idle'
                  ? 'bg-gray-800 border-2 border-emerald-500/50'
                  : 'bg-gray-700 hover:bg-gray-600'
                }
                disabled:opacity-50
              `}
            >
              {/* Pulse rings when listening */}
              {isListening && (
                <>
                  <motion.div
                    animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="absolute inset-0 rounded-full bg-cyan-500"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.8], opacity: [0.3, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                    className="absolute inset-0 rounded-full bg-cyan-500"
                  />
                </>
              )}

              {/* Icon */}
              {!isConnected ? (
                <Mic className="w-7 h-7 text-white" />
              ) : isListening ? (
                <Waves className="w-7 h-7 text-white animate-pulse" />
              ) : isSpeaking ? (
                <Volume2 className="w-7 h-7 text-white" />
              ) : isVADActive ? (
                <Radio className="w-7 h-7 text-emerald-400" />
              ) : (
                <Mic className="w-7 h-7 text-white" />
              )}
            </motion.button>
          </div>

          {/* Right placeholder for balance */}
          <div className="w-24" />
        </div>

        {/* Help text */}
        <div className="text-center mt-3">
          <span className="text-xs text-gray-600">
            {isVADActive
              ? state === 'idle'
                ? '🎤 Hands-free ON - just speak naturally'
                : state === 'listening'
                ? '🎙️ Listening... keep talking'
                : state === 'processing'
                ? '⏳ Processing your speech...'
                : isSpeaking
                ? '🔊 Mercury speaking... click mic to interrupt'
                : 'Ready'
              : isListening
              ? 'Listening... click to stop'
              : isSpeaking
              ? 'Mercury is speaking... click to interrupt'
              : 'Click power for hands-free, or mic for push-to-talk'}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

export default AgentDriverPanel
