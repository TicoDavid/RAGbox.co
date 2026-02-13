'use client'

import { useState, useCallback, useRef } from 'react'
import { DeepgramClient } from '@/lib/voice/deepgram-client'
import { apiFetch } from '@/lib/api'
import type { VoiceState, VoiceCallbacks } from '@/lib/voice/types'

interface UseVoiceRAGOptions {
  privilegeMode?: boolean
  persona?: string
  onTranscript?: (text: string, isFinal: boolean) => void
  onAnswer?: (answer: string, citations: unknown[]) => void
  onSpeechStart?: () => void
  onSpeechEnd?: () => void
  onError?: (error: Error) => void
}

interface UseVoiceRAGReturn {
  state: VoiceState
  isListening: boolean
  isSpeaking: boolean
  lastTranscript: string
  lastAnswer: string
  start: () => Promise<void>
  stop: () => void
}

export function useVoiceRAG(options: UseVoiceRAGOptions = {}): UseVoiceRAGReturn {
  const [state, setState] = useState<VoiceState>('idle')
  const [lastTranscript, setLastTranscript] = useState('')
  const [lastAnswer, setLastAnswer] = useState('')

  const deepgramRef = useRef<DeepgramClient | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const optionsRef = useRef(options)
  optionsRef.current = options

  const speakAnswer = useCallback(async (text: string) => {
    setState('speaking')
    optionsRef.current.onSpeechStart?.()

    try {
      // Strip citation markers for speech
      const cleanText = text.replace(/\[\d+\]/g, '').trim()

      // Limit to first 500 chars for voice response
      const speechText = cleanText.length > 500
        ? cleanText.slice(0, 497) + '...'
        : cleanText

      const res = await apiFetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: speechText,
          voice: 'aria',
          speakingRate: 1.0,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.audioContent) {
          const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`)
          audio.onended = () => {
            setState('idle')
            optionsRef.current.onSpeechEnd?.()
          }
          await audio.play()
          return
        }
      }
    } catch (err) {
      console.error('TTS failed:', err)
    }

    setState('idle')
    optionsRef.current.onSpeechEnd?.()
  }, [])

  const queryRAGbox = useCallback(async (transcript: string) => {
    setState('processing')
    try {
      const res = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: transcript,
          privilegeMode: optionsRef.current.privilegeMode ?? false,
          mode: 'concise',
          persona: optionsRef.current.persona ?? 'default',
        }),
      })

      if (!res.ok) throw new Error('Chat request failed')

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let fullAnswer = ''
      let citations: unknown[] = []

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = decoder.decode(value, { stream: true })
          const lines = text.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.type === 'token') {
                  fullAnswer += data.content ?? data.text ?? ''
                } else if (data.type === 'citations') {
                  citations = data.citations
                } else if (data.type === 'complete') {
                  fullAnswer = data.answer || fullAnswer
                  citations = data.citations || citations
                }
              } catch {
                // Skip malformed SSE lines
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

      setLastAnswer(fullAnswer)
      optionsRef.current.onAnswer?.(fullAnswer, citations)

      if (fullAnswer) {
        await speakAnswer(fullAnswer)
      }
    } catch (err) {
      optionsRef.current.onError?.(err as Error)
      setState('error')
    }
  }, [speakAnswer])

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true },
      })
      mediaStreamRef.current = stream

      audioContextRef.current = new AudioContext({ sampleRate: 16000 })
      const source = audioContextRef.current.createMediaStreamSource(stream)
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      const callbacks: VoiceCallbacks = {
        onTranscriptInterim: (text) => {
          setLastTranscript(text)
          optionsRef.current.onTranscript?.(text, false)
        },
        onTranscriptFinal: (text) => {
          setLastTranscript(text)
          optionsRef.current.onTranscript?.(text, true)
          if (text.trim().length > 2) {
            queryRAGbox(text)
          }
        },
        onStateChange: setState,
        onError: (err) => {
          optionsRef.current.onError?.(err)
          setState('error')
        },
      }

      deepgramRef.current = new DeepgramClient(callbacks)
      await deepgramRef.current.connect()

      processor.onaudioprocess = (e) => {
        if (deepgramRef.current) {
          const inputData = e.inputBuffer.getChannelData(0)
          const int16 = new Int16Array(inputData.length)
          for (let i = 0; i < inputData.length; i++) {
            int16[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF
          }
          deepgramRef.current.sendAudio(int16.buffer)
        }
      }

      source.connect(processor)
      processor.connect(audioContextRef.current.destination)

      setState('listening')
    } catch (err) {
      optionsRef.current.onError?.(err as Error)
      setState('error')
    }
  }, [queryRAGbox])

  const stop = useCallback(() => {
    deepgramRef.current?.disconnect()
    deepgramRef.current = null

    processorRef.current?.disconnect()
    processorRef.current = null

    audioContextRef.current?.close()
    audioContextRef.current = null

    mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
    mediaStreamRef.current = null

    setState('idle')
    setLastTranscript('')
  }, [])

  return {
    state,
    isListening: state === 'listening',
    isSpeaking: state === 'speaking',
    lastTranscript,
    lastAnswer,
    start,
    stop,
  }
}
