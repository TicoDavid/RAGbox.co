'use client'

import { useEffect, useRef } from 'react'

// ============================================================================
// MATRIX RAIN — Canvas-based digital rain scoped to Mercury panel
// Adapted from TicoDavid/Mercury-Chat-Window_MatrixEffect reference
// ============================================================================

interface MatrixRainProps {
  opacity?: number         // Default 0.15 (subtle for production)
  color?: string           // Default '#60a5fa' (Blue 400)
  backgroundColor?: string // Default '#0A192F' (Midnight Cobalt --bg-primary)
  speed?: number           // 0=paused, 10=slow, 30=normal, 60=fast
}

// Greek alphabet + numbers character set
const GREEK = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρστυφχψω'
const NUMS = '0123456789'
const ALPHABET = GREEK + NUMS

const FONT_SIZE = 16

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 10, g: 25, b: 47 } // fallback to #0A192F
}

export function MatrixRain({
  opacity = 0.15,
  color = '#60a5fa',
  backgroundColor = '#0A192F',
  speed = 30,
}: MatrixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Use refs for dynamic values so the animation loop reads them
  // without tearing down and restarting on prop changes
  const opacityRef = useRef(opacity)
  const colorRef = useRef(color)
  const bgRef = useRef(backgroundColor)
  const speedRef = useRef(speed)

  useEffect(() => { opacityRef.current = opacity }, [opacity])
  useEffect(() => { colorRef.current = color }, [color])
  useEffect(() => { bgRef.current = backgroundColor }, [backgroundColor])
  useEffect(() => { speedRef.current = speed }, [speed])

  // Single animation loop — never restarts on prop changes
  useEffect(() => {
    // Respect prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches
    if (prefersReducedMotion) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const parent = canvas.parentElement
    if (!parent) return

    let animationFrameId: number
    let isVisible = true

    // NOTE: rainDrops is intentionally mutated as an imperative canvas data buffer.
    // It is not React state and never triggers re-renders.
    const rainDrops: number[] = []

    // Size canvas to parent container, not viewport
    const resizeCanvas = () => {
      const rect = parent.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height

      const columns = Math.floor(canvas.width / FONT_SIZE)
      while (rainDrops.length < columns) {
        rainDrops.push(Math.floor(Math.random() * (canvas.height / FONT_SIZE)))
      }
      rainDrops.length = columns
    }

    resizeCanvas()

    // Use ResizeObserver for parent-scoped sizing
    const resizeObserver = new ResizeObserver(resizeCanvas)
    resizeObserver.observe(parent)

    // Pause animation when canvas is off-screen
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => { isVisible = entry.isIntersecting },
      { threshold: 0.01 }
    )
    intersectionObserver.observe(canvas)

    const draw = () => {
      const currentOpacity = opacityRef.current
      const currentColor = colorRef.current
      const bgRgb = hexToRgb(bgRef.current)

      // Translucent fill creates the trail effect
      ctx.fillStyle = `rgba(${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b}, 0.05)`
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = currentColor
      ctx.font = `${FONT_SIZE}px monospace`

      for (let i = 0; i < rainDrops.length; i++) {
        const text = ALPHABET.charAt(
          Math.floor(Math.random() * ALPHABET.length)
        )

        // Random opacity variation for dynamic appearance
        ctx.globalAlpha = Math.random() * 0.5 + currentOpacity

        ctx.fillText(text, i * FONT_SIZE, rainDrops[i] * FONT_SIZE)

        // Reset raindrop when past canvas with random chance
        if (
          rainDrops[i] * FONT_SIZE > canvas.height &&
          Math.random() > 0.975
        ) {
          rainDrops[i] = 0
        }
        rainDrops[i]++
      }
      ctx.globalAlpha = 1.0
    }

    let lastTime = 0

    const render = (time: number) => {
      const currentSpeed = speedRef.current
      if (isVisible && currentSpeed > 0) {
        const interval = 1000 / currentSpeed
        if (time - lastTime > interval) {
          draw()
          lastTime = time
        }
      }
      animationFrameId = requestAnimationFrame(render)
    }

    animationFrameId = requestAnimationFrame(render)

    return () => {
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      cancelAnimationFrame(animationFrameId)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-0"
      style={{
        opacity: speed > 0 ? 1 : 0,
        transition: 'opacity 0.5s ease',
      }}
    />
  )
}
