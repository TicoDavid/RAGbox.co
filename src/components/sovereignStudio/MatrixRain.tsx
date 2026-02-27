'use client'

import { useEffect, useRef } from 'react'

/**
 * STORY-243: Matrix Rain Loading Spooler for Sovereign Studio
 *
 * Canvas-based falling character animation inspired by The Matrix.
 * Characters: legal/financial symbols, numbers, Latin letters.
 * Color: Sovereign Gold (#D4A853) on dark background.
 * Contained to Studio preview pane, plays during generation.
 */

const CHARS = '§¶©®™°±÷×∑∏∫∆πΩ$€£¥¢%#@&0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const FONT_SIZE = 14
const GOLD = '#D4A853'
const GOLD_DIM = 'rgba(212, 168, 83, 0.3)'

interface MatrixRainProps {
  /** Width in pixels (defaults to 100% of parent via canvas resize) */
  width?: number
  /** Height in pixels */
  height?: number
}

export function MatrixRain({ width: propWidth, height: propHeight }: MatrixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Size canvas to container
    const w = propWidth ?? container.offsetWidth
    const h = propHeight ?? container.offsetHeight
    canvas.width = w
    canvas.height = h

    const columns = Math.floor(w / FONT_SIZE)
    // Each column tracks its current y position (in character rows)
    const drops: number[] = Array.from({ length: columns }, () =>
      Math.random() * -20 | 0
    )

    let animId: number

    function draw() {
      if (!ctx) return

      // Semi-transparent black overlay creates trail fade effect
      ctx.fillStyle = 'rgba(10, 25, 47, 0.12)'
      ctx.fillRect(0, 0, w, h)

      ctx.font = `${FONT_SIZE}px JetBrains Mono, monospace`

      for (let i = 0; i < drops.length; i++) {
        // Random character
        const char = CHARS[Math.random() * CHARS.length | 0]
        const x = i * FONT_SIZE
        const y = drops[i] * FONT_SIZE

        // Leading character is bright gold, trailing chars are dimmer
        ctx.fillStyle = Math.random() > 0.15 ? GOLD_DIM : GOLD
        ctx.fillText(char, x, y)

        // Reset drop to top once it falls off screen, with random delay
        if (y > h && Math.random() > 0.975) {
          drops[i] = 0
        }
        drops[i]++
      }

      animId = requestAnimationFrame(draw)
    }

    // Initial fill — dark background
    ctx.fillStyle = '#0A192F'
    ctx.fillRect(0, 0, w, h)

    animId = requestAnimationFrame(draw)

    return () => cancelAnimationFrame(animId)
  }, [propWidth, propHeight])

  return (
    <div ref={containerRef} className="relative w-full h-full rounded-lg overflow-hidden">
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
      />
      {/* Center overlay text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-sm font-semibold text-[#D4A853] drop-shadow-[0_0_8px_rgba(212,168,83,0.5)]">
          Generating document...
        </p>
        <p className="text-[10px] text-[#D4A853]/60 mt-1">
          Sovereign Studio AI
        </p>
      </div>
    </div>
  )
}
