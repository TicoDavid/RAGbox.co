/**
 * useSovereignAgentVoice - Agent-Driven Voice Control
 *
 * This hook connects to the Mercury voice agent and lets it DRIVE the UI.
 * Unlike traditional voice input that populates a text field,
 * this agent executes tools and navigates the app autonomously.
 *
 * The agent can:
 * - Search documents
 * - Open files
 * - Navigate between sections
 * - Toggle privilege mode
 * - Extract and analyze content
 *
 * The user speaks -> Agent decides -> Agent acts -> UI updates
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// ============================================================================
// TYPES
// ============================================================================

export type AgentVoiceState =
  | 'disconnected'
  | 'connecting'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'executing'  // New: executing a tool
  | 'idle'
  | 'error'

export interface TranscriptEntry {
  id: string
  type: 'user' | 'agent' | 'system'
  text: string
  isFinal: boolean
  timestamp: number
  toolCall?: ToolCallInfo
}

export interface ToolCallInfo {
  id: string
  name: string
  parameters: Record<string, unknown>
  status: 'pending' | 'executing' | 'success' | 'error'
  result?: unknown
  error?: string
}

export interface UIAction {
  type: string
  [key: string]: unknown
}

export interface UseSovereignAgentVoiceOptions {
  /** WebSocket URL */
  wsUrl?: string
  /** User ID for tool context */
  userId?: string
  /** User role for RBAC */
  role?: 'User' | 'Admin' | 'Viewer'
  /** Privilege mode state */
  privilegeMode?: boolean
  /** Sample rate for audio capture */
  sampleRate?: number
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean
  /** Callback when agent executes a UI action */
  onUIAction?: (action: UIAction) => void
  /** Callback when tool is called */
  onToolCall?: (tool: ToolCallInfo) => void
  /** Callback when tool completes */
  onToolResult?: (tool: ToolCallInfo) => void
  /** Callback for errors */
  onError?: (error: Error) => void
}

export interface UseSovereignAgentVoiceReturn {
  /** Current state */
  state: AgentVoiceState
  /** Whether connected */
  isConnected: boolean
  /** Whether actively listening */
  isListening: boolean
  /** Whether agent is speaking */
  isSpeaking: boolean
  /** Whether executing a tool */
  isExecuting: boolean
  /** Conversation transcript */
  transcript: TranscriptEntry[]
  /** Currently executing tool (if any) */
  currentTool: ToolCallInfo | null
  /** Connect to voice server */
  connect: () => Promise<void>
  /** Disconnect */
  disconnect: () => void
  /** Start listening */
  startListening: () => void
  /** Stop listening */
  stopListening: () => void
  /** Interrupt agent speech */
  bargeIn: () => void
  /** Clear transcript */
  clearTranscript: () => void
  /** Update privilege mode */
  setPrivilegeMode: (enabled: boolean) => void
}

// ============================================================================
// AUDIO CAPTURE
// ============================================================================

async function createAudioCapture(
  sampleRate: number,
  onChunk: (pcm: ArrayBuffer) => void
): Promise<{ start: () => Promise<void>; stop: () => void }> {
  let mediaStream: MediaStream | null = null
  let audioContext: AudioContext | null = null
  let processor: ScriptProcessorNode | null = null
  let active = false

  return {
    async start() {
      if (active) return

      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })

      audioContext = new AudioContext({ sampleRate })
      const source = audioContext.createMediaStreamSource(mediaStream)
      processor = audioContext.createScriptProcessor(4096, 1, 1)

      processor.onaudioprocess = (e) => {
        if (!active) return
        const float32 = e.inputBuffer.getChannelData(0)
        const int16 = new Int16Array(float32.length)
        for (let i = 0; i < float32.length; i++) {
          int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768))
        }
        onChunk(int16.buffer)
      }

      source.connect(processor)
      processor.connect(audioContext.destination)
      active = true
    },

    stop() {
      active = false
      processor?.disconnect()
      audioContext?.close()
      mediaStream?.getTracks().forEach(t => t.stop())
      processor = null
      audioContext = null
      mediaStream = null
    },
  }
}

// ============================================================================
// TTS PLAYER
// ============================================================================

function createTTSPlayer(sampleRate: number): { play: (pcm: ArrayBuffer) => void; stop: () => void } {
  let ctx: AudioContext | null = null
  let queue: AudioBuffer[] = []
  let isPlaying = false

  const playNext = () => {
    if (!ctx || queue.length === 0) {
      isPlaying = false
      return
    }

    isPlaying = true
    const buffer = queue.shift()!
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.onended = playNext
    source.start()
  }

  return {
    play(pcm: ArrayBuffer) {
      if (!ctx) ctx = new AudioContext({ sampleRate })

      const int16 = new Int16Array(pcm)
      const float32 = new Float32Array(int16.length)
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768
      }

      const buffer = ctx.createBuffer(1, float32.length, sampleRate)
      buffer.getChannelData(0).set(float32)
      queue.push(buffer)

      if (!isPlaying) playNext()
    },

    stop() {
      queue = []
      isPlaying = false
      ctx?.close()
      ctx = null
    },
  }
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useSovereignAgentVoice(
  options: UseSovereignAgentVoiceOptions = {}
): UseSovereignAgentVoiceReturn {
  const {
    wsUrl = typeof window !== 'undefined'
      ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/agent/ws`
      : 'ws://localhost:3000/agent/ws',
    userId = 'anonymous',
    role = 'User',
    privilegeMode = false,
    sampleRate = 16000,
    autoReconnect = true,
    onUIAction,
    onToolCall,
    onToolResult,
    onError,
  } = options

  const router = useRouter()

  // State
  const [state, setState] = useState<AgentVoiceState>('disconnected')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [currentTool, setCurrentTool] = useState<ToolCallInfo | null>(null)
  const [privMode, setPrivMode] = useState(privilegeMode)

  // Refs
  const wsRef = useRef<WebSocket | null>(null)
  const captureRef = useRef<Awaited<ReturnType<typeof createAudioCapture>> | null>(null)
  const playerRef = useRef<ReturnType<typeof createTTSPlayer> | null>(null)
  const reconnectRef = useRef<NodeJS.Timeout | null>(null)
  const transcriptIdRef = useRef(0)

  // Derived state
  const isConnected = !['disconnected', 'error'].includes(state)
  const isListening = state === 'listening'
  const isSpeaking = state === 'speaking'
  const isExecuting = state === 'executing'

  // Generate unique transcript ID
  const genId = () => `t_${Date.now()}_${++transcriptIdRef.current}`

  // Handle UI actions from agent
  const handleUIAction = useCallback((action: UIAction) => {
    console.log('[AgentVoice] UI Action:', action)

    switch (action.type) {
      case 'navigate':
        router.push(action.path as string)
        break

      case 'open_document':
        // Emit event for document viewer
        window.dispatchEvent(new CustomEvent('agent:open_document', { detail: action }))
        break

      case 'toggle_privilege':
        setPrivMode(action.enabled as boolean)
        window.dispatchEvent(new CustomEvent('agent:toggle_privilege', { detail: action }))
        break

      case 'show_toast':
        window.dispatchEvent(new CustomEvent('agent:toast', { detail: action }))
        break

      case 'open_panel':
        window.dispatchEvent(new CustomEvent('agent:open_panel', { detail: action }))
        break

      case 'scroll_to':
        const element = document.getElementById(action.elementId as string)
        element?.scrollIntoView({ behavior: 'smooth' })
        break

      case 'select_documents':
        window.dispatchEvent(new CustomEvent('agent:select_documents', { detail: action }))
        break
    }

    onUIAction?.(action)
  }, [router, onUIAction])

  // Connect to WebSocket
  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setState('connecting')

    const params = new URLSearchParams({
      userId,
      role,
      privilegeMode: privMode.toString(),
    })
    const ws = new WebSocket(`${wsUrl}?${params}`)
    wsRef.current = ws

    playerRef.current = createTTSPlayer(sampleRate)

    ws.binaryType = 'arraybuffer'

    ws.onopen = () => {
      console.log('[AgentVoice] Connected')
      setTranscript(prev => [...prev, {
        id: genId(),
        type: 'system',
        text: 'Mercury Voice connected. Ready for commands.',
        isFinal: true,
        timestamp: Date.now(),
      }])
    }

    ws.onmessage = async (event) => {
      // Binary = TTS audio
      if (event.data instanceof ArrayBuffer) {
        playerRef.current?.play(event.data)
        return
      }

      try {
        const msg = JSON.parse(event.data)

        switch (msg.type) {
          case 'state':
            setState(msg.state as AgentVoiceState)
            break

          case 'asr_partial':
            setTranscript(prev => {
              const last = prev[prev.length - 1]
              if (last?.type === 'user' && !last.isFinal) {
                return [...prev.slice(0, -1), { ...last, text: msg.text }]
              }
              return [...prev, { id: genId(), type: 'user', text: msg.text, isFinal: false, timestamp: Date.now() }]
            })
            break

          case 'asr_final':
            setTranscript(prev => {
              const last = prev[prev.length - 1]
              if (last?.type === 'user') {
                return [...prev.slice(0, -1), { ...last, text: msg.text, isFinal: true }]
              }
              return [...prev, { id: genId(), type: 'user', text: msg.text, isFinal: true, timestamp: Date.now() }]
            })
            break

          case 'agent_text_partial':
            setTranscript(prev => {
              const last = prev[prev.length - 1]
              if (last?.type === 'agent' && !last.isFinal) {
                return [...prev.slice(0, -1), { ...last, text: msg.text }]
              }
              return [...prev, { id: genId(), type: 'agent', text: msg.text, isFinal: false, timestamp: Date.now() }]
            })
            break

          case 'agent_text_final':
            setTranscript(prev => {
              const last = prev[prev.length - 1]
              if (last?.type === 'agent') {
                return [...prev.slice(0, -1), { ...last, text: msg.text, isFinal: true }]
              }
              return [...prev, { id: genId(), type: 'agent', text: msg.text, isFinal: true, timestamp: Date.now() }]
            })
            break

          case 'tool_call': {
            const tool: ToolCallInfo = {
              id: msg.call.id,
              name: msg.call.name,
              parameters: msg.call.parameters,
              status: 'executing',
            }
            setCurrentTool(tool)
            setState('executing')
            onToolCall?.(tool)

            // Add to transcript
            setTranscript(prev => [...prev, {
              id: genId(),
              type: 'system',
              text: `Executing: ${msg.call.name}`,
              isFinal: true,
              timestamp: Date.now(),
              toolCall: tool,
            }])
            break
          }

          case 'tool_result': {
            const result = msg.result
            const tool: ToolCallInfo = {
              id: result.toolCallId,
              name: result.name,
              parameters: {},
              status: result.success ? 'success' : 'error',
              result: result.result,
              error: result.error,
            }
            setCurrentTool(null)
            onToolResult?.(tool)

            // Update transcript
            setTranscript(prev => prev.map(t =>
              t.toolCall?.id === result.toolCallId
                ? { ...t, toolCall: { ...t.toolCall, ...tool } }
                : t
            ))
            break
          }

          case 'ui_action':
            handleUIAction(msg.action)
            break

          case 'error':
            console.error('[AgentVoice] Server error:', msg.message)
            onError?.(new Error(msg.message))
            break
        }
      } catch (err) {
        console.error('[AgentVoice] Parse error:', err)
      }
    }

    ws.onerror = () => {
      setState('error')
      onError?.(new Error('WebSocket error'))
    }

    ws.onclose = (event) => {
      wsRef.current = null
      captureRef.current?.stop()
      playerRef.current?.stop()
      setState('disconnected')

      if (autoReconnect && event.code !== 1000) {
        reconnectRef.current = setTimeout(connect, 3000)
      }
    }
  }, [wsUrl, userId, role, privMode, sampleRate, autoReconnect, handleUIAction, onToolCall, onToolResult, onError])

  // Disconnect
  const disconnect = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current)
      reconnectRef.current = null
    }
    captureRef.current?.stop()
    playerRef.current?.stop()
    wsRef.current?.close(1000, 'User disconnect')
    wsRef.current = null
    setState('disconnected')
  }, [])

  // Start listening
  const startListening = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      await connect()
    }

    if (!captureRef.current) {
      captureRef.current = await createAudioCapture(sampleRate, (pcm) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(pcm)
        }
      })
    }

    playerRef.current?.stop()
    await captureRef.current.start()
    wsRef.current?.send(JSON.stringify({ type: 'start' }))
  }, [connect, sampleRate])

  // Stop listening
  const stopListening = useCallback(() => {
    captureRef.current?.stop()
    wsRef.current?.send(JSON.stringify({ type: 'stop' }))
  }, [])

  // Barge-in
  const bargeIn = useCallback(() => {
    playerRef.current?.stop()
    wsRef.current?.send(JSON.stringify({ type: 'barge_in' }))
  }, [])

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setTranscript([])
  }, [])

  // Update privilege mode
  const setPrivilegeMode = useCallback((enabled: boolean) => {
    setPrivMode(enabled)
    // Reconnect with new privilege mode if connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      disconnect()
      setTimeout(connect, 100)
    }
  }, [disconnect, connect])

  // Cleanup
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    state,
    isConnected,
    isListening,
    isSpeaking,
    isExecuting,
    transcript,
    currentTool,
    connect,
    disconnect,
    startListening,
    stopListening,
    bargeIn,
    clearTranscript,
    setPrivilegeMode,
  }
}

export type { UIAction, ToolCallInfo }
