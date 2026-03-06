/**
 * useMercuryVoice — Clean WebSocket voice hook for Mercury panel
 *
 * Protocol:
 *   Send: { type: "audio", audio: float32[][] }  — mic audio chunks
 *   Send: { type: "audioSessionEnd" }             — user stopped speaking
 *   Recv: TEXT event                               — agent text (show in thread)
 *   Recv: AUDIO event / binary                     — TTS audio (play via AudioContext)
 *   Recv: INTERACTION_END                          — turn complete
 */
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

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

// ============================================================================
// HOOK
// ============================================================================

export function useMercuryVoice(): UseMercuryVoiceReturn {
  const [status, setStatus] = useState<VoiceStatus>('off')
  const [audioLevel, setAudioLevel] = useState(0)

  const wsRef = useRef<WebSocket | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const captureCtxRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
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
      playNext()
    }
  }, [playNext])

  // ── Cleanup ───────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    processorRef.current?.disconnect()
    try { captureCtxRef.current?.close() } catch { /* already closed */ }
    mediaStreamRef.current?.getTracks().forEach(t => t.stop())
    try { playbackCtxRef.current?.close() } catch { /* already closed */ }

    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {
      wsRef.current.close()
    }

    processorRef.current = null
    captureCtxRef.current = null
    mediaStreamRef.current = null
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
  }, [queueAudio])

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

    // Start mic capture with VAD
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: CAPTURE_SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      mediaStreamRef.current = stream

      const actx = new AudioContext({ sampleRate: CAPTURE_SAMPLE_RATE })
      captureCtxRef.current = actx
      const source = actx.createMediaStreamSource(stream)
      const processor = actx.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      source.connect(processor)
      processor.connect(actx.destination)

      processor.onaudioprocess = (e) => {
        const pcm = e.inputBuffer.getChannelData(0)

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
      }

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
