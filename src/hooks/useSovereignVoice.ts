'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

// ============================================================================
// TYPES
// ============================================================================

export type VoiceState = 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking' | 'error'

export interface SovereignVoiceConfig {
  autoSendOnSilence?: boolean
  silenceThreshold?: number // ms of silence before auto-send
  onTranscript?: (text: string, isFinal: boolean) => void
  onResponse?: (text: string) => void
  onError?: (error: string) => void
}

export interface SovereignVoiceReturn {
  state: VoiceState
  isActive: boolean
  transcript: string
  error: string | null
  connect: () => Promise<void>
  disconnect: () => void
  toggleVoice: () => void
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

  // Refs for audio handling
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  // Cleanup function
  const cleanup = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
  }, [])

  // Connect to voice service
  const connect = useCallback(async () => {
    try {
      setState('connecting')
      setError(null)
      setTranscript('')

      // Check for browser support
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!SpeechRecognition) {
        throw new Error('Speech recognition not supported in this browser')
      }

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      })
      streamRef.current = stream

      // Set up audio context for visualization
      audioContextRef.current = new AudioContext()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      source.connect(analyserRef.current)

      // Set up speech recognition
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onresult = (event) => {
        let interimTranscript = ''
        let finalTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript
          } else {
            interimTranscript += transcript
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
            // Auto-send after silence
            onResponse?.(finalTranscript)
          }, silenceThreshold)
        }
      }

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error)
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
          } catch (e) {
            // Ignore if already started
          }
        }
      }

      recognitionRef.current = recognition
      recognition.start()
      setState('listening')

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect to voice service'
      setError(message)
      onError?.(message)
      setState('error')
      cleanup()
    }
  }, [autoSendOnSilence, silenceThreshold, onTranscript, onResponse, onError, cleanup, state])

  // Disconnect from voice service
  const disconnect = useCallback(() => {
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
    connect,
    disconnect,
    toggleVoice,
  }
}

// ============================================================================
// TYPE DECLARATIONS FOR SPEECH RECOGNITION
// ============================================================================

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}
