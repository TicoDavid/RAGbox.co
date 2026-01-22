'use client'

/**
 * useRagSounds Hook - Audio UI for RAGbox
 *
 * The "RAG" Snap - Visceral audio feedback that turns
 * an acronym into a feeling.
 *
 * Sounds:
 * - Drop: Low-frequency sci-fi hum when file is absorbed
 * - Lock: Metallic deadbolt click for privilege toggle
 * - Snap: Crisp whip crack when Mercury delivers an answer
 *
 * Audio files location: /public/sounds/
 * - /sounds/drop.mp3 (Deep impact thud / Server hum)
 * - /sounds/lock.mp3 (Deadbolt lock click)
 * - /sounds/whip.mp3 (Whip crack / Snap)
 *
 * Uses Web Audio API for zero-dependency audio playback
 */

// Audio context singleton for Web Audio API
let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  }
  return audioContext
}

// Cache for loaded audio buffers
const audioBufferCache = new Map<string, AudioBuffer>()

async function loadAudioBuffer(url: string): Promise<AudioBuffer | null> {
  try {
    const ctx = getAudioContext()
    if (!ctx) return null

    if (audioBufferCache.has(url)) {
      return audioBufferCache.get(url) || null
    }

    const response = await fetch(url)
    if (!response.ok) return null

    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
    audioBufferCache.set(url, audioBuffer)
    return audioBuffer
  } catch {
    // Silently fail if audio file doesn't exist
    return null
  }
}

function playSound(url: string, volume: number): void {
  const ctx = getAudioContext()
  if (!ctx) return

  loadAudioBuffer(url).then(buffer => {
    if (!buffer) return

    const source = ctx.createBufferSource()
    const gainNode = ctx.createGain()

    source.buffer = buffer
    gainNode.gain.value = volume

    source.connect(gainNode)
    gainNode.connect(ctx.destination)

    source.start(0)
  })
}

export function useRagSounds() {
  // Volume settings for each sound type
  const dropVolume = 0.5
  const lockVolume = 0.6
  const snapVolume = 0.7

  return {
    /**
     * Play when a file is dropped into The Box
     * Low-frequency sci-fi hum / thud
     */
    playDropSound: () => playSound('/sounds/drop.mp3', dropVolume),

    /**
     * Play when privilege toggle is clicked
     * Sharp metallic deadbolt click
     */
    playLockSound: () => playSound('/sounds/lock.mp3', lockVolume),

    /**
     * Play when Mercury delivers an answer
     * Crisp whip crack - "The RAG Snap"
     */
    playSnapSound: () => playSound('/sounds/whip.mp3', snapVolume),
  }
}

/**
 * Placeholder hook that does nothing
 * Use this in SSR contexts or when sounds should be disabled
 */
export function useRagSoundsDisabled() {
  const noop = () => {}

  return {
    playDropSound: noop,
    playLockSound: noop,
    playSnapSound: noop,
  }
}
