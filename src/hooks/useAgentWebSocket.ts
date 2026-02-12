/**
 * @deprecated useAgentWebSocket - Client-side WebSocket hook for voice AI
 *
 * This hook is deprecated. Use `useVoiceChat` from
 * `src/app/dashboard/hooks/useVoiceChat.ts` instead, which is the canonical
 * Deepgram-based voice implementation used in the dashboard.
 *
 * Connects to the RAGbox Voice Server for full-duplex audio streaming.
 * Handles: audio capture, WebSocket messaging, TTS playback, tool calls.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

// ============================================================================
// TYPES
// ============================================================================

type AgentState =
  | 'disconnected'
  | 'connecting'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'idle'
  | 'error'

interface TranscriptMessage {
  type: 'user' | 'agent'
  text: string
  isFinal: boolean
  timestamp: number
}

interface ToolCall {
  id: string
  name: string
  parameters: Record<string, unknown>
}

interface UseAgentWebSocketOptions {
  /** WebSocket URL (default: ws://localhost:3003/agent/ws) */
  wsUrl?: string
  /** Session ID for reconnection */
  sessionId?: string
  /** Audio sample rate in Hz (default: 16000) */
  sampleRate?: number
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean
  /** Callback when tool call is received */
  onToolCall?: (call: ToolCall) => Promise<unknown>
  /** Callback when error occurs */
  onError?: (error: Error) => void
}

interface UseAgentWebSocketReturn {
  /** Current connection state */
  state: AgentState
  /** Whether connected to server */
  isConnected: boolean
  /** Whether actively listening to mic */
  isListening: boolean
  /** Whether agent is speaking */
  isSpeaking: boolean
  /** Transcript of conversation */
  transcript: TranscriptMessage[]
  /** Connect to WebSocket */
  connect: () => Promise<void>
  /** Disconnect from WebSocket */
  disconnect: () => void
  /** Start listening (begins audio capture) */
  startListening: () => void
  /** Stop listening (ends audio capture, triggers processing) */
  stopListening: () => void
  /** Interrupt agent speech (barge-in) */
  bargeIn: () => void
  /** Clear transcript */
  clearTranscript: () => void
}

// ============================================================================
// AUDIO UTILITIES
// ============================================================================

/**
 * Create audio capture for microphone input.
 * Uses AudioWorkletNode (preferred) with automatic fallback to
 * ScriptProcessorNode for older browsers that lack AudioWorklet support.
 */
async function createAudioCapture(
  sampleRate: number,
  onAudioChunk: (pcm: ArrayBuffer) => void
): Promise<{
  start: () => Promise<void>
  stop: () => void
  isActive: () => boolean
}> {
  let mediaStream: MediaStream | null = null
  let audioContext: AudioContext | null = null
  let workletNode: AudioWorkletNode | null = null
  let legacyProcessor: ScriptProcessorNode | null = null
  let sourceNode: MediaStreamAudioSourceNode | null = null
  let active = false

  /**
   * Try to set up AudioWorkletNode. Returns true on success.
   */
  async function trySetupWorklet(
    ctx: AudioContext,
    source: MediaStreamAudioSourceNode
  ): Promise<boolean> {
    try {
      await ctx.audioWorklet.addModule('/audio-capture-processor.js')
      workletNode = new AudioWorkletNode(ctx, 'audio-capture-processor')
      workletNode.port.onmessage = (event: MessageEvent) => {
        if (active) {
          onAudioChunk(event.data as ArrayBuffer)
        }
      }
      source.connect(workletNode)
      workletNode.connect(ctx.destination)
      return true
    } catch {
      return false
    }
  }

  /**
   * Fallback: ScriptProcessorNode for browsers without AudioWorklet.
   */
  function setupLegacyProcessor(
    ctx: AudioContext,
    source: MediaStreamAudioSourceNode
  ): void {
    legacyProcessor = ctx.createScriptProcessor(4096, 1, 1)

    legacyProcessor.onaudioprocess = (event) => {
      if (!active) return

      const float32 = event.inputBuffer.getChannelData(0)
      const int16 = new Int16Array(float32.length)
      for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]))
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
      }
      onAudioChunk(int16.buffer)
    }

    source.connect(legacyProcessor)
    legacyProcessor.connect(ctx.destination)
  }

  return {
    async start() {
      if (active) return

      // Get microphone access
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      // Create audio context
      audioContext = new AudioContext({ sampleRate })
      sourceNode = audioContext.createMediaStreamSource(mediaStream)

      // Try AudioWorklet first, fall back to ScriptProcessorNode
      const workletReady = await trySetupWorklet(audioContext, sourceNode)
      if (!workletReady) {
        setupLegacyProcessor(audioContext, sourceNode)
      }

      active = true
    },

    stop() {
      active = false

      if (workletNode) {
        workletNode.disconnect()
        workletNode = null
      }

      if (legacyProcessor) {
        legacyProcessor.disconnect()
        legacyProcessor = null
      }

      if (sourceNode) {
        sourceNode.disconnect()
        sourceNode = null
      }

      if (audioContext) {
        audioContext.close()
        audioContext = null
      }

      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop())
        mediaStream = null
      }
    },

    isActive() {
      return active
    },
  }
}

/**
 * Create audio player for TTS playback
 */
function createAudioPlayer(sampleRate: number): {
  play: (pcm: ArrayBuffer) => void
  stop: () => void
  isPlaying: () => boolean
} {
  let audioContext: AudioContext | null = null
  let playing = false

  return {
    play(pcm: ArrayBuffer) {
      if (!audioContext) {
        audioContext = new AudioContext({ sampleRate })
      }

      // Convert Int16 PCM to Float32
      const int16 = new Int16Array(pcm)
      const float32 = new Float32Array(int16.length)
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 0x8000
      }

      // Create audio buffer and play
      const buffer = audioContext.createBuffer(1, float32.length, sampleRate)
      buffer.getChannelData(0).set(float32)

      const source = audioContext.createBufferSource()
      source.buffer = buffer
      source.connect(audioContext.destination)

      source.onended = () => {
        playing = false
      }

      playing = true
      source.start()
    },

    stop() {
      if (audioContext) {
        audioContext.close()
        audioContext = null
      }
      playing = false
    },

    isPlaying() {
      return playing
    },
  }
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useAgentWebSocket(
  options: UseAgentWebSocketOptions = {}
): UseAgentWebSocketReturn {
  const {
    wsUrl = typeof window !== 'undefined'
      ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/agent/ws`
      : 'ws://localhost:3000/agent/ws',
    sessionId,
    sampleRate = 16000,
    autoReconnect = true,
    onToolCall,
    onError,
  } = options

  // State
  const [state, setState] = useState<AgentState>('disconnected')
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([])

  // Refs for mutable values
  const wsRef = useRef<WebSocket | null>(null)
  const audioCaptureRef = useRef<Awaited<ReturnType<typeof createAudioCapture>> | null>(null)
  const audioPlayerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Derived state
  const isConnected = state !== 'disconnected' && state !== 'error'
  const isListening = state === 'listening'
  const isSpeaking = state === 'speaking'

  // Connect to WebSocket
  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    setState('connecting')

    const url = sessionId ? `${wsUrl}?sessionId=${encodeURIComponent(sessionId)}` : wsUrl
    const ws = new WebSocket(url)
    wsRef.current = ws

    // Initialize audio player
    audioPlayerRef.current = createAudioPlayer(sampleRate)

    ws.onopen = () => {
    }

    ws.onmessage = async (event) => {
      // Binary = TTS audio chunk
      if (event.data instanceof Blob) {
        const buffer = await event.data.arrayBuffer()
        audioPlayerRef.current?.play(buffer)
        return
      }

      // Text = JSON message
      try {
        const msg = JSON.parse(event.data)

        switch (msg.type) {
          case 'state':
            setState(msg.state as AgentState)
            break

          case 'asr_partial':
            setTranscript((prev) => {
              const last = prev[prev.length - 1]
              if (last?.type === 'user' && !last.isFinal) {
                return [...prev.slice(0, -1), { ...last, text: msg.text }]
              }
              return [...prev, { type: 'user', text: msg.text, isFinal: false, timestamp: Date.now() }]
            })
            break

          case 'asr_final':
            setTranscript((prev) => {
              const last = prev[prev.length - 1]
              if (last?.type === 'user') {
                return [...prev.slice(0, -1), { ...last, text: msg.text, isFinal: true }]
              }
              return [...prev, { type: 'user', text: msg.text, isFinal: true, timestamp: Date.now() }]
            })
            break

          case 'agent_text_partial':
            setTranscript((prev) => {
              const last = prev[prev.length - 1]
              if (last?.type === 'agent' && !last.isFinal) {
                return [...prev.slice(0, -1), { ...last, text: msg.text }]
              }
              return [...prev, { type: 'agent', text: msg.text, isFinal: false, timestamp: Date.now() }]
            })
            break

          case 'agent_text_final':
            setTranscript((prev) => {
              const last = prev[prev.length - 1]
              if (last?.type === 'agent') {
                return [...prev.slice(0, -1), { ...last, text: msg.text, isFinal: true }]
              }
              return [...prev, { type: 'agent', text: msg.text, isFinal: true, timestamp: Date.now() }]
            })
            break

          case 'tool_call':
            if (onToolCall) {
              try {
                const result = await onToolCall(msg.call)
                ws.send(JSON.stringify({ type: 'tool_result', name: msg.call.name, result }))
              } catch (error) {
                ws.send(JSON.stringify({ type: 'tool_result', name: msg.call.name, result: { error: String(error) } }))
              }
            }
            break

          case 'error':
            onError?.(new Error(msg.message))
            break
        }
      } catch (error) {
        // ignored
      }
    }

    ws.onerror = () => {
      setState('error')
      onError?.(new Error('WebSocket connection error'))
    }

    ws.onclose = (event) => {
      wsRef.current = null
      audioCaptureRef.current?.stop()
      audioPlayerRef.current?.stop()
      setState('disconnected')

      // Only auto-reconnect if we previously had a successful connection (code !== 1006)
      // 1006 = abnormal closure (never connected), 1000 = normal close
      if (autoReconnect && event.code !== 1000 && event.code !== 1006) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect()
        }, 3000)
      }
    }
  }, [wsUrl, sessionId, sampleRate, autoReconnect, onToolCall, onError])

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    audioCaptureRef.current?.stop()
    audioPlayerRef.current?.stop()

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnect')
      wsRef.current = null
    }

    setState('disconnected')
  }, [])

  // Start listening (begin audio capture)
  const startListening = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return
    }

    // Initialize audio capture if needed
    if (!audioCaptureRef.current) {
      audioCaptureRef.current = await createAudioCapture(sampleRate, (pcm) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(pcm)
        }
      })
    }

    // Stop any playing audio
    audioPlayerRef.current?.stop()

    // Start capture
    await audioCaptureRef.current.start()

    // Notify server
    wsRef.current.send(JSON.stringify({ type: 'start' }))
  }, [sampleRate])

  // Stop listening (end audio capture, trigger processing)
  const stopListening = useCallback(() => {
    audioCaptureRef.current?.stop()

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }))
    }
  }, [])

  // Barge-in (interrupt agent speech)
  const bargeIn = useCallback(() => {
    audioPlayerRef.current?.stop()

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'barge_in' }))
    }
  }, [])

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setTranscript([])
  }, [])

  // Cleanup on unmount
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
    transcript,
    connect,
    disconnect,
    startListening,
    stopListening,
    bargeIn,
    clearTranscript,
  }
}

export type { AgentState, TranscriptMessage, ToolCall, UseAgentWebSocketOptions }
