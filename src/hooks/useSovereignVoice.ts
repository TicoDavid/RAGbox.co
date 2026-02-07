'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

// ============================================================================
// TYPES
// ============================================================================

export type VoiceState = 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking' | 'error'

export interface AgentSession {
  sessionId: string
  wsUrl: string
  audio: {
    sampleRateHz: number
    encoding: string
    channels: number
    vadSilenceMs: number
    vadThreshold: number
  }
  expiresIn: number
}

export interface SovereignVoiceConfig {
  autoSendOnSilence?: boolean
  silenceThreshold?: number // ms of silence before auto-send
  onTranscript?: (text: string, isFinal: boolean) => void
  onResponse?: (text: string) => void
  onError?: (error: string) => void
  onAgentSpeaking?: (audioData: ArrayBuffer) => void
}

export interface SovereignVoiceReturn {
  state: VoiceState
  isActive: boolean
  transcript: string
  error: string | null
  sessionId: string | null
  connect: () => Promise<void>
  disconnect: () => void
  toggleVoice: () => void
}

// ============================================================================
// SECURE SESSION MANAGEMENT
// ============================================================================

async function createSecureSession(): Promise<AgentSession> {
  const response = await fetch('/api/agent/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `Session creation failed: ${response.status}`)
  }

  const data = await response.json()
  if (!data.success) {
    throw new Error(data.error || 'Session creation failed')
  }

  return data as AgentSession
}

// ============================================================================
// HOOK
// ============================================================================

export function useSovereignVoice(config: SovereignVoiceConfig = {}): SovereignVoiceReturn {
  const {
    autoSendOnSilence = false,
    silenceThreshold = 1500,
    onTranscript,
    onResponse,
    onError,
  } = config

  const [state, setState] = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Refs for audio handling
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const sessionRef = useRef<AgentSession | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  // Cleanup function
  const cleanup = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // Ignore if already stopped
      }
      recognitionRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    sessionRef.current = null
    setSessionId(null)
  }, [])

  // Connect to voice service
  const connect = useCallback(async () => {
    try {
      setState('connecting')
      setError(null)
      setTranscript('')

      // Step 1: Create secure server-side session (no secrets exposed)
      console.log('[Voice] Creating secure session...')
      const session = await createSecureSession()
      sessionRef.current = session
      setSessionId(session.sessionId)
      console.log('[Voice] Session created:', session.sessionId)

      // Step 2: Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: session.audio.sampleRateHz,
          channelCount: session.audio.channels,
        }
      })
      streamRef.current = stream

      // Step 3: Set up audio context for visualization
      audioContextRef.current = new AudioContext({ sampleRate: session.audio.sampleRateHz })
      const source = audioContextRef.current.createMediaStreamSource(stream)
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      source.connect(analyserRef.current)

      // Step 4: Use Web Speech API as fallback (WebSocket full-duplex coming in Phase 2)
      // TODO: Replace with WebSocket connection to session.wsUrl for full Inworld integration
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!SpeechRecognition) {
        throw new Error('Speech recognition not supported in this browser')
      }

      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onresult = (event) => {
        let interimTranscript = ''
        let finalTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += text
          } else {
            interimTranscript += text
          }
        }

        const currentTranscript = finalTranscript || interimTranscript
        setTranscript(currentTranscript)
        onTranscript?.(currentTranscript, !!finalTranscript)

        // Reset silence timeout
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current)
        }

        if (autoSendOnSilence && finalTranscript) {
          silenceTimeoutRef.current = setTimeout(() => {
            onResponse?.(finalTranscript)
          }, silenceThreshold)
        }
      }

      recognition.onerror = (event) => {
        console.error('[Voice] Speech recognition error:', event.error)
        if (event.error !== 'no-speech') {
          setError(`Voice error: ${event.error}`)
          onError?.(`Voice error: ${event.error}`)
          setState('error')
        }
      }

      recognition.onend = () => {
        // Restart if still in listening state
        if (state === 'listening' && recognitionRef.current) {
          try {
            recognitionRef.current.start()
          } catch {
            // Ignore if already started
          }
        }
      }

      recognitionRef.current = recognition
      recognition.start()
      setState('listening')
      console.log('[Voice] Listening started')

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect to voice service'
      console.error('[Voice] Connection failed:', message)
      setError(message)
      onError?.(message)
      setState('error')
      cleanup()
    }
  }, [autoSendOnSilence, silenceThreshold, onTranscript, onResponse, onError, cleanup, state])

  // Disconnect from voice service
  const disconnect = useCallback(() => {
    console.log('[Voice] Disconnecting...')
    cleanup()
    setState('idle')
    setTranscript('')
  }, [cleanup])

  // Toggle voice on/off
  const toggleVoice = useCallback(() => {
    if (state === 'idle' || state === 'error') {
      connect()
    } else {
      disconnect()
    }
  }, [state, connect, disconnect])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    state,
    isActive: state === 'listening' || state === 'speaking',
    transcript,
    error,
    sessionId,
    connect,
    disconnect,
    toggleVoice,
  }
}

// ============================================================================
// TYPE DECLARATIONS FOR SPEECH RECOGNITION
// ============================================================================

// SpeechRecognition types (not available in all TypeScript configurations)
interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor
    webkitSpeechRecognition: SpeechRecognitionConstructor
  }
}
