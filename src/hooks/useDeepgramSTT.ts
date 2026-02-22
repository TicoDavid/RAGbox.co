'use client'

import { useState, useRef, useCallback } from 'react'
import { DeepgramClient } from '@/lib/voice/deepgram-client'
import { AudioCapture } from '@/lib/voice/audio-capture'

interface UseDeepgramSTTReturn {
  isListening: boolean
  transcript: string
  audioLevel: number       // 0-1 range for UI visualization
  error: string | null
  startListening: () => Promise<void>
  stopListening: () => void
}

export function useDeepgramSTT(): UseDeepgramSTTReturn {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [audioLevel, setAudioLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const deepgramRef = useRef<DeepgramClient | null>(null)
  const captureRef = useRef<AudioCapture | null>(null)

  const startListening = useCallback(async () => {
    setError(null)

    // 1. Create AudioCapture + check mic permission
    const capture = new AudioCapture()
    const permission = await capture.requestPermission()
    if (permission === 'denied') {
      setError('Microphone access denied. Check browser permissions.')
      return
    }

    // 2. Create DeepgramClient with transcript handlers
    const deepgram = new DeepgramClient({
      onTranscriptInterim: (text: string) => {
        setTranscript(text)
      },
      onTranscriptFinal: (text: string) => {
        setTranscript((prev) => {
          // Append final transcript (space-separated if previous exists)
          const combined = prev ? `${prev} ${text}` : text
          return combined
        })
      },
      onError: (err: Error) => {
        setError(err.message)
      },
    })

    // 3. Connect to Deepgram (fetches temporary token from /api/voice/token)
    try {
      await deepgram.connect()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to speech service')
      return
    }

    // 4. Start audio capture → stream PCM to Deepgram
    try {
      await capture.start(
        (audioData: ArrayBuffer) => deepgram.sendAudio(audioData),
        (level: number) => setAudioLevel(level / 255), // Normalize 0-255 → 0-1
      )
    } catch (err) {
      deepgram.disconnect()
      setError(err instanceof Error ? err.message : 'Failed to start microphone')
      return
    }

    deepgramRef.current = deepgram
    captureRef.current = capture
    setTranscript('')
    setIsListening(true)
  }, [])

  const stopListening = useCallback(() => {
    captureRef.current?.stop()
    deepgramRef.current?.disconnect()
    captureRef.current = null
    deepgramRef.current = null
    setIsListening(false)
    setAudioLevel(0)
  }, [])

  return { isListening, transcript, audioLevel, error, startListening, stopListening }
}
