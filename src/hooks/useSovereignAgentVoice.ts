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
 *
 * VAD MODE: When enabled, the mic stays on and automatically detects
 * when you start/stop speaking - no button presses needed!
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// ============================================================================
// TYPES
// ============================================================================

export type AgentVoiceState =
  | 'disconnected'
  | 'connecting'
  | 'idle'          // VAD mode: connected but waiting for speech
  | 'listening'     // VAD mode: speech detected, capturing
  | 'processing'
  | 'speaking'
  | 'executing'     // executing a tool
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
  /** VAD sensitivity (0-1, lower = more sensitive) */
  vadThreshold?: number
  /** Silence duration before ending speech (ms) */
  vadSilenceMs?: number
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
  /** Whether VAD mode is active */
  isVADActive: boolean
  /** Current audio level (0-1) for visualization */
  audioLevel: number
  /** Conversation transcript */
  transcript: TranscriptEntry[]
  /** Currently executing tool (if any) */
  currentTool: ToolCallInfo | null
  /** Connect to voice server */
  connect: () => Promise<void>
  /** Disconnect */
  disconnect: () => void
  /** Enable VAD mode (hands-free) */
  enableVAD: () => Promise<void>
  /** Disable VAD mode */
  disableVAD: () => void
  /** Manual start listening (non-VAD mode) */
  startListening: () => void
  /** Manual stop listening (non-VAD mode) */
  stopListening: () => void
  /** Interrupt agent speech */
  bargeIn: () => void
  /** Clear transcript */
  clearTranscript: () => void
  /** Update privilege mode */
  setPrivilegeMode: (enabled: boolean) => void
}

// ============================================================================
// VAD CONFIGURATION
// ============================================================================

const VAD_DEFAULTS = {
  threshold: 0.015,      // RMS threshold for voice detection (lowered for sensitivity)
  silenceMs: 1500,       // Ms of silence before ending speech
  minSpeechMs: 300,      // Minimum speech duration to trigger
  smoothingFactor: 0.3,  // Exponential smoothing for audio level
}

// ============================================================================
// AUDIO CAPTURE WITH VAD
// ============================================================================

interface AudioCaptureWithVAD {
  start: () => Promise<void>
  stop: () => void
  isActive: () => boolean
  getAudioLevel: () => number
}

function createAudioCaptureWithVAD(
  sampleRate: number,
  onChunk: (pcm: ArrayBuffer) => void,
  onVADStateChange: (isSpeaking: boolean) => void,
  vadConfig: typeof VAD_DEFAULTS
): AudioCaptureWithVAD {
  let mediaStream: MediaStream | null = null
  let audioContext: AudioContext | null = null
  let processor: ScriptProcessorNode | null = null
  let analyser: AnalyserNode | null = null
  let active = false

  // VAD state
  let isSpeaking = false
  let silenceStart: number | null = null
  let speechStart: number | null = null
  let smoothedLevel = 0
  let currentLevel = 0

  // Calculate RMS of audio buffer
  function calculateRMS(buffer: Float32Array): number {
    let sum = 0
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i]
    }
    return Math.sqrt(sum / buffer.length)
  }

  return {
    async start() {
      if (active) return

      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      audioContext = new AudioContext({ sampleRate })
      const source = audioContext.createMediaStreamSource(mediaStream)

      // Create analyser for visualization
      analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)

      processor = audioContext.createScriptProcessor(4096, 1, 1)

      processor.onaudioprocess = (e) => {
        if (!active) return

        const float32 = e.inputBuffer.getChannelData(0)
        const rms = calculateRMS(float32)

        // Smooth the level for visualization
        smoothedLevel = smoothedLevel * (1 - vadConfig.smoothingFactor) + rms * vadConfig.smoothingFactor
        currentLevel = Math.min(1, smoothedLevel * 10) // Normalize to 0-1

        const now = Date.now()
        const isVoice = rms > vadConfig.threshold

        if (isVoice) {
          silenceStart = null

          if (!isSpeaking) {
            if (!speechStart) {
              speechStart = now
            } else if (now - speechStart >= vadConfig.minSpeechMs) {
              // Speech confirmed - start capturing
              isSpeaking = true
              onVADStateChange(true)
            }
          }
        } else {
          speechStart = null

          if (isSpeaking) {
            if (!silenceStart) {
              silenceStart = now
            } else if (now - silenceStart >= vadConfig.silenceMs) {
              // Silence confirmed - stop capturing
              isSpeaking = false
              onVADStateChange(false)
            }
          }
        }

        // Only send audio when speaking
        if (isSpeaking) {
          const int16 = new Int16Array(float32.length)
          for (let i = 0; i < float32.length; i++) {
            int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768))
          }
          onChunk(int16.buffer)
        }
      }

      source.connect(processor)
      processor.connect(audioContext.destination)
      active = true
      isSpeaking = false
      silenceStart = null
      speechStart = null
    },

    stop() {
      if (isSpeaking) {
        isSpeaking = false
        onVADStateChange(false)
      }
      active = false
      processor?.disconnect()
      analyser?.disconnect()
      audioContext?.close()
      mediaStream?.getTracks().forEach(t => t.stop())
      processor = null
      analyser = null
      audioContext = null
      mediaStream = null
      smoothedLevel = 0
      currentLevel = 0
    },

    isActive() {
      return active
    },

    getAudioLevel() {
      return currentLevel
    },
  }
}

// ============================================================================
// SIMPLE AUDIO CAPTURE (for manual push-to-talk)
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

function createTTSPlayer(sampleRate: number): {
  play: (pcm: ArrayBuffer) => void
  stop: () => void
  isPlaying: () => boolean
} {
  let ctx: AudioContext | null = null
  let queue: AudioBuffer[] = []
  let playing = false
  let currentSource: AudioBufferSourceNode | null = null

  const playNext = () => {
    if (!ctx || queue.length === 0) {
      playing = false
      return
    }

    playing = true
    const buffer = queue.shift()!
    const source = ctx.createBufferSource()
    currentSource = source
    source.buffer = buffer
    source.connect(ctx.destination)
    source.onended = () => {
      currentSource = null
      playNext()
    }
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

      if (!playing) playNext()
    },

    stop() {
      queue = []
      playing = false
      if (currentSource) {
        try {
          currentSource.stop()
        } catch (_e) { /* AudioBufferSourceNode may already be stopped */ }
        currentSource = null
      }
      ctx?.close()
      ctx = null
    },

    isPlaying() {
      return playing
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
    sampleRate = 48000,
    autoReconnect = true,
    onUIAction,
    onToolCall,
    onToolResult,
    onError,
    vadThreshold = VAD_DEFAULTS.threshold,
    vadSilenceMs = VAD_DEFAULTS.silenceMs,
  } = options

  const router = useRouter()

  // State
  const [state, setState] = useState<AgentVoiceState>('disconnected')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [currentTool, setCurrentTool] = useState<ToolCallInfo | null>(null)
  const [privMode, setPrivMode] = useState(privilegeMode)
  const [isVADActive, setIsVADActive] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)

  // Refs
  const wsRef = useRef<WebSocket | null>(null)
  const captureRef = useRef<Awaited<ReturnType<typeof createAudioCapture>> | null>(null)
  const vadCaptureRef = useRef<AudioCaptureWithVAD | null>(null)
  const playerRef = useRef<ReturnType<typeof createTTSPlayer> | null>(null)
  const reconnectRef = useRef<NodeJS.Timeout | null>(null)
  const transcriptIdRef = useRef(0)
  const audioLevelIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const vadSpeakingRef = useRef(false)

  // Derived state
  const isConnected = !['disconnected', 'error'].includes(state)
  const isListening = state === 'listening'
  const isSpeaking = state === 'speaking'
  const isExecuting = state === 'executing'

  // Generate unique transcript ID
  const genId = () => `t_${Date.now()}_${++transcriptIdRef.current}`

  // Handle UI actions from agent
  const handleUIAction = useCallback((action: UIAction) => {
    switch (action.type) {
      case 'navigate':
        router.push(action.path as string)
        break

      case 'open_document':
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

      case 'scroll_to': {
        const element = document.getElementById(action.elementId as string)
        element?.scrollIntoView({ behavior: 'smooth' })
        break
      }

      case 'select_documents':
        window.dispatchEvent(new CustomEvent('agent:select_documents', { detail: action }))
        break
    }

    onUIAction?.(action)
  }, [router, onUIAction])

  // Safe WebSocket send — only sends if connection is OPEN
  const wsSend = useCallback((data: string | ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data)
    }
  }, [])

  // Handle VAD state changes
  const handleVADStateChange = useCallback((speaking: boolean) => {
    vadSpeakingRef.current = speaking

    if (speaking) {
      // Speech started - notify server
      setState('listening')
      wsSend(JSON.stringify({ type: 'start' }))
    } else {
      // Speech ended - notify server to process
      setState('processing')
      wsSend(JSON.stringify({ type: 'stop' }))
    }
  }, [wsSend])

  // Connect to WebSocket — resolves when OPEN, rejects on error/close
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

    // Wait for WebSocket to actually open before resolving
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => {
        setState('idle')
        setTranscript(prev => [...prev, {
          id: genId(),
          type: 'system',
          text: 'Mercury Voice connected. Say something to begin.',
          isFinal: true,
          timestamp: Date.now(),
        }])
        resolve()
      }

      const rejectOnce = () => {
        reject(new Error('WebSocket failed to connect'))
      }
      ws.onerror = rejectOnce
      ws.onclose = rejectOnce
    })

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
            // Only update state if not in VAD mode or if it's a terminal state
            if (!isVADActive || ['speaking', 'processing', 'executing'].includes(msg.state)) {
              setState(msg.state as AgentVoiceState)
            }
            // When agent finishes speaking in VAD mode, go back to idle
            if (isVADActive && msg.state === 'idle') {
              setState('idle')
            }
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
            setState('speaking')
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
            // After agent responds, go back to idle in VAD mode
            if (isVADActive) {
              setTimeout(() => setState('idle'), 500)
            }
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
            onError?.(new Error(msg.message))
            break
        }
      } catch (err) {
      }
    }

    ws.onerror = () => {
      setState('error')
      onError?.(new Error('WebSocket error'))
    }

    ws.onclose = (event) => {
      wsRef.current = null
      captureRef.current?.stop()
      vadCaptureRef.current?.stop()
      playerRef.current?.stop()
      setState('disconnected')
      setIsVADActive(false)

      // Only auto-reconnect if we previously had a successful connection
      if (autoReconnect && event.code !== 1000 && event.code !== 1006) {
        reconnectRef.current = setTimeout(connect, 3000)
      }
    }
  }, [wsUrl, userId, role, privMode, sampleRate, autoReconnect, handleUIAction, handleVADStateChange, isVADActive, onToolCall, onToolResult, onError])

  // Disconnect
  const disconnect = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current)
      reconnectRef.current = null
    }
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current)
      audioLevelIntervalRef.current = null
    }
    captureRef.current?.stop()
    vadCaptureRef.current?.stop()
    playerRef.current?.stop()
    wsRef.current?.close(1000, 'User disconnect')
    wsRef.current = null
    setState('disconnected')
    setIsVADActive(false)
    setAudioLevel(0)
  }, [])

  // Enable VAD mode (hands-free)
  const enableVAD = useCallback(async () => {
    // Connect if not connected — wait for actual OPEN state
    try {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        await connect()
      }
    } catch {
      setState('error')
      onError?.(new Error('Voice server unavailable'))
      return
    }

    // Stop any manual capture
    captureRef.current?.stop()
    captureRef.current = null

    // Create VAD capture
    const vadConfig = {
      ...VAD_DEFAULTS,
      threshold: vadThreshold,
      silenceMs: vadSilenceMs,
    }

    vadCaptureRef.current = createAudioCaptureWithVAD(
      sampleRate,
      (pcm) => wsSend(pcm),
      handleVADStateChange,
      vadConfig
    )

    await vadCaptureRef.current.start()
    setIsVADActive(true)
    setState('idle')

    // Update audio level for visualization
    audioLevelIntervalRef.current = setInterval(() => {
      if (vadCaptureRef.current?.isActive()) {
        setAudioLevel(vadCaptureRef.current.getAudioLevel())
      }
    }, 50)

    setTranscript(prev => [...prev, {
      id: genId(),
      type: 'system',
      text: '🎤 Hands-free mode ON. Just speak naturally.',
      isFinal: true,
      timestamp: Date.now(),
    }])
  }, [connect, sampleRate, vadThreshold, vadSilenceMs, handleVADStateChange, wsSend, onError])

  // Disable VAD mode
  const disableVAD = useCallback(() => {
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current)
      audioLevelIntervalRef.current = null
    }

    vadCaptureRef.current?.stop()
    vadCaptureRef.current = null
    setIsVADActive(false)
    setAudioLevel(0)
    setState('idle')

    setTranscript(prev => [...prev, {
      id: genId(),
      type: 'system',
      text: '🎤 Hands-free mode OFF.',
      isFinal: true,
      timestamp: Date.now(),
    }])
  }, [])

  // Manual start listening (for push-to-talk mode)
  const startListening = useCallback(async () => {
    if (isVADActive) return // Don't use manual mode when VAD is active

    try {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        await connect()
      }
    } catch {
      setState('error')
      return
    }

    if (!captureRef.current) {
      captureRef.current = await createAudioCapture(sampleRate, (pcm) => wsSend(pcm))
    }

    playerRef.current?.stop()
    await captureRef.current.start()
    wsSend(JSON.stringify({ type: 'start' }))
    setState('listening')
  }, [connect, sampleRate, isVADActive, wsSend])

  // Manual stop listening
  const stopListening = useCallback(() => {
    if (isVADActive) return // Don't use manual mode when VAD is active

    captureRef.current?.stop()
    wsSend(JSON.stringify({ type: 'stop' }))
    setState('processing')
  }, [isVADActive, wsSend])

  // Barge-in (interrupt agent speech)
  const bargeIn = useCallback(() => {
    playerRef.current?.stop()
    wsSend(JSON.stringify({ type: 'barge_in' }))
    if (isVADActive) {
      setState('idle')
    }
  }, [isVADActive, wsSend])

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setTranscript([])
  }, [])

  // Update privilege mode
  const setPrivilegeMode = useCallback((enabled: boolean) => {
    setPrivMode(enabled)
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
    setPrivilegeMode,
  }
}
