/**
 * useMercuryVoice — Clean WebSocket voice hook for Mercury panel
 *
 * Protocol:
 *   Send: { type: "audio", audio: float32[][] }  — mic audio chunks
 *   Send: { type: "audioSessionEnd" }             — user stopped speaking
 *   Recv: TEXT event                               — agent text (show in thread)
 *   Recv: AUDIO event / binary                     — TTS audio (play via AudioContext)
 *   Recv: INTERACTION_END                          — turn complete
 *
 * Capture: Uses AudioCapture (AudioWorklet + ScriptProcessorNode fallback)
 * Playback: Pre-buffers ~2 chunks before starting to eliminate first-word clipping
 */
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AudioCapture } from '@/lib/voice/audio-capture'

// ============================================================================
// TYPES
// ============================================================================

export type VoiceStatus = 'off' | 'ready' | 'listening' | 'thinking' | 'speaking'

export interface UseMercuryVoiceReturn {
  status: VoiceStatus
  audioLevel: number
  connect: () => Promise<void>
  disconnect: () => void
}

// ============================================================================
// CONSTANTS
// ============================================================================

const VAD_THRESHOLD = 0.015
const VAD_SILENCE_MS = 1500
const VAD_MIN_SPEECH_MS = 300
const CAPTURE_SAMPLE_RATE = 16000
const PRE_BUFFER_CHUNKS = 2

// ============================================================================
// HELPERS
// ============================================================================

/** Convert Int16 PCM ArrayBuffer → Float32Array (range -1..1) */
function int16ToFloat32(buffer: ArrayBuffer): Float32Array {
  const int16 = new Int16Array(buffer)
  const float32 = new Float32Array(int16.length)
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] < 0 ? int16[i] / 0x8000 : int16[i] / 0x7FFF
  }
  return float32
}

// ============================================================================
// HOOK
// ============================================================================

export function useMercuryVoice(): UseMercuryVoiceReturn {
  const [status, setStatus] = useState<VoiceStatus>('off')
  const [audioLevel, setAudioLevel] = useState(0)

  const wsRef = useRef<WebSocket | null>(null)
  const captureRef = useRef<AudioCapture | null>(null)
  const playbackCtxRef = useRef<AudioContext | null>(null)
  const playbackQueueRef = useRef<AudioBuffer[]>([])
  const isPlayingRef = useRef(false)
  const statusRef = useRef<VoiceStatus>('off')

  // VAD refs
  const isSpeakingRef = useRef(false)
  const silenceStartRef = useRef<number | null>(null)
  const speechStartRef = useRef<number | null>(null)
  const smoothedLevelRef = useRef(0)

  // Keep ref in sync for closures
  statusRef.current = status

  // ── Playback ──────────────────────────────────────────────────────────

  const playNext = useCallback(() => {
    const ctx = playbackCtxRef.current
    if (!ctx || playbackQueueRef.current.length === 0) {
      isPlayingRef.current = false
      // If we were speaking and queue drained, go back to ready
      if (statusRef.current === 'speaking') {
        setStatus('ready')
      }
      return
    }

    isPlayingRef.current = true
    const buffer = playbackQueueRef.current.shift()!
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.onended = () => playNext()
    source.start()
  }, [])

  const queueAudio = useCallback((float32Data: Float32Array, sampleRate: number) => {
    if (float32Data.length === 0) return

    let ctx = playbackCtxRef.current
    if (!ctx || ctx.state === 'closed') {
      ctx = new AudioContext({ sampleRate })
      playbackCtxRef.current = ctx
    }

    const buffer = ctx.createBuffer(1, float32Data.length, sampleRate)
    buffer.getChannelData(0).set(float32Data)
    playbackQueueRef.current.push(buffer)

    if (!isPlayingRef.current) {
      setStatus('speaking')
      // Pre-buffer: wait for enough chunks to eliminate first-word clipping
      if (playbackQueueRef.current.length >= PRE_BUFFER_CHUNKS) {
        playNext()
      }
    }
  }, [playNext])

  // Flush any pre-buffered audio that hasn't started playing yet
  const flushPreBuffer = useCallback(() => {
    if (!isPlayingRef.current && playbackQueueRef.current.length > 0) {
      playNext()
    }
  }, [playNext])

  // ── Cleanup ───────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    captureRef.current?.stop()
    try { playbackCtxRef.current?.close() } catch { /* already closed */ }

    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {
      wsRef.current.close()
    }

    captureRef.current = null
    playbackCtxRef.current = null
    wsRef.current = null
    playbackQueueRef.current = []
    isPlayingRef.current = false
    isSpeakingRef.current = false
    silenceStartRef.current = null
    speechStartRef.current = null
    smoothedLevelRef.current = 0
    setAudioLevel(0)
    setStatus('off')
  }, [])

  // ── WebSocket message handler ─────────────────────────────────────────

  const handleMessage = useCallback((event: MessageEvent) => {
    // Binary frame = raw TTS audio (Float32 PCM)
    if (event.data instanceof ArrayBuffer) {
      const float32 = new Float32Array(event.data)
      if (statusRef.current === 'thinking') setStatus('speaking')
      queueAudio(float32, CAPTURE_SAMPLE_RATE)
      return
    }

    try {
      const msg = JSON.parse(event.data as string)

      switch (msg.type) {
        // ── New protocol ──
        case 'TEXT':
          if (msg.text) {
            window.dispatchEvent(new CustomEvent('mercury:voice-response', {
              detail: { text: msg.text, source: 'voice' },
            }))
          }
          break

        case 'AUDIO': {
          if (statusRef.current === 'thinking') setStatus('speaking')
          const samples = new Float32Array(msg.audio[0])
          queueAudio(samples, msg.sampleRate || CAPTURE_SAMPLE_RATE)
          break
        }

        case 'INTERACTION_END':
          // Flush pre-buffer if response was short (< PRE_BUFFER_CHUNKS)
          flushPreBuffer()
          if (!isPlayingRef.current) {
            setStatus('ready')
          }
          break

        // ── Legacy compat (existing mercury-voice server) ──
        case 'agent_text_final':
          if (msg.text) {
            window.dispatchEvent(new CustomEvent('mercury:voice-response', {
              detail: { text: msg.text, source: 'voice' },
            }))
          }
          break

        case 'asr_final':
          if (msg.text) {
            window.dispatchEvent(new CustomEvent('mercury:voice-query', {
              detail: { text: msg.text, source: 'voice' },
            }))
          }
          break

        case 'state':
          if (msg.state === 'speaking') setStatus('speaking')
          else if (msg.state === 'processing') setStatus('thinking')
          else if (msg.state === 'idle' && !isPlayingRef.current) setStatus('ready')
          break
      }
    } catch { /* ignore parse errors */ }
  }, [queueAudio, flushPreBuffer])

  // ── Connect ───────────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    // Bootstrap session via API
    let wsUrl: string
    try {
      const res = await fetch('/api/agent/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      if (!res.ok) { setStatus('off'); return }
      const data = await res.json()
      if (!data.wsUrl) { setStatus('off'); return }
      wsUrl = data.wsUrl
    } catch {
      setStatus('off')
      return
    }

    // Open WebSocket
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws
    ws.binaryType = 'arraybuffer'

    try {
      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve()
        ws.onerror = () => reject()
        ws.onclose = () => reject()
      })
    } catch {
      wsRef.current = null
      setStatus('off')
      return
    }

    ws.onmessage = handleMessage
    ws.onclose = () => cleanup()
    ws.onerror = () => cleanup()

    // Start mic capture via AudioCapture (AudioWorklet + ScriptProcessorNode fallback)
    try {
      const capture = new AudioCapture()
      captureRef.current = capture

      await capture.start((data: ArrayBuffer) => {
        // Convert Int16 PCM → Float32 for VAD + WebSocket protocol
        const pcm = int16ToFloat32(data)

        // RMS for VAD + visualization
        let sum = 0
        for (let i = 0; i < pcm.length; i++) sum += pcm[i] * pcm[i]
        const rms = Math.sqrt(sum / pcm.length)
        smoothedLevelRef.current = smoothedLevelRef.current * 0.7 + rms * 0.3
        setAudioLevel(smoothedLevelRef.current)

        const now = Date.now()
        const loud = rms > VAD_THRESHOLD

        if (loud) {
          silenceStartRef.current = null
          if (!isSpeakingRef.current) {
            speechStartRef.current = speechStartRef.current || now
            if (now - speechStartRef.current >= VAD_MIN_SPEECH_MS) {
              isSpeakingRef.current = true
              setStatus('listening')
            }
          }
        } else {
          speechStartRef.current = null
          if (isSpeakingRef.current) {
            silenceStartRef.current = silenceStartRef.current || now
            if (now - silenceStartRef.current >= VAD_SILENCE_MS) {
              isSpeakingRef.current = false
              silenceStartRef.current = null
              try {
                ws.send(JSON.stringify({ type: 'audioSessionEnd' }))
              } catch { /* ws may have closed */ }
              setStatus('thinking')
            }
          }
        }

        // Send audio while speaking
        if (isSpeakingRef.current && ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ type: 'audio', audio: [Array.from(pcm)] }))
          } catch { /* ws may have closed */ }
        }
      })

      setStatus('ready')
    } catch {
      cleanup()
    }
  }, [cleanup, handleMessage])

  const disconnect = useCallback(() => cleanup(), [cleanup])

  useEffect(() => {
    return () => cleanup()
  }, [cleanup])

  return { status, audioLevel, connect, disconnect }
}
