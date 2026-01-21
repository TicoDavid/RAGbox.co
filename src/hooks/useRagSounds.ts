'use client'

import useSound from 'use-sound'

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
 * Place MP3 files in /public/sounds/:
 * - /sounds/drop.mp3 (Deep impact thud / Server hum)
 * - /sounds/lock.mp3 (Deadbolt lock click)
 * - /sounds/whip.mp3 (Whip crack / Snap)
 */
export function useRagSounds() {
  // Volume settings for each sound type
  const dropVolume = 0.5
  const lockVolume = 0.6
  const snapVolume = 0.7

  // Sound hooks - gracefully fail if files don't exist
  const [playDrop] = useSound('/sounds/drop.mp3', {
    volume: dropVolume,
    interrupt: true,
  })

  const [playLock] = useSound('/sounds/lock.mp3', {
    volume: lockVolume,
    interrupt: true,
  })

  const [playSnap] = useSound('/sounds/whip.mp3', {
    volume: snapVolume,
    interrupt: true,
  })

  return {
    /**
     * Play when a file is dropped into The Box
     * Low-frequency sci-fi hum / thud
     */
    playDropSound: playDrop,

    /**
     * Play when privilege toggle is clicked
     * Sharp metallic deadbolt click
     */
    playLockSound: playLock,

    /**
     * Play when Mercury delivers an answer
     * Crisp whip crack - "The RAG Snap"
     */
    playSnapSound: playSnap,
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
