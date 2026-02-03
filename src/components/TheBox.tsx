'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Box, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRagSounds } from '@/hooks/useRagSounds'

/**
 * TheBox Component - The Sovereign Drop Zone
 *
 * Features:
 * - Breathing animation when idle (2% scale pulse)
 * - ALIVE: Pulsing blue border (opacity 0.4 -> 1.0)
 * - Intensified glow on hover/drag
 * - Wireframe cube visual with Electric Blue glow
 * - Heavy spring physics (stiffness: 300, damping: 30)
 * - HIGH VOLTAGE dark mode glow
 * - TEASER GATE: Redirects to /login after file drop
 */
export function TheBox() {
  const router = useRouter()
  const [isDragOver, setIsDragOver] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isAbsorbing, setIsAbsorbing] = useState(false)

  // Audio UI - The "RAG" sounds
  const { playDropSound } = useRagSounds()

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)

      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        // AUDIO UI: Play the sci-fi absorption sound
        playDropSound()

        // TEASER GATE: Absorb animation then redirect to login
        setIsAbsorbing(true)

        // Wait for absorb animation, then redirect
        setTimeout(() => {
          router.push('/login')
        }, 800)
      }
    },
    [router, playDropSound]
  )

  const handleClick = useCallback(() => {
    // Also trigger on click for demo purposes
    setIsAbsorbing(true)
    setTimeout(() => {
      router.push('/login')
    }, 800)
  }, [router])

  const isActive = isDragOver || isHovered || isAbsorbing

  return (
    <div className="flex flex-col items-center">
      {/* The Box */}
      <motion.div
        className="relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        // Breathing animation when idle, absorb pulse when dropping
        animate={
          isAbsorbing
            ? {
                scale: [1.05, 1.15, 1],
                transition: {
                  duration: 0.6,
                  times: [0, 0.4, 1],
                  ease: 'easeOut',
                },
              }
            : isActive
              ? { scale: 1.05 }
              : {
                  scale: [1, 1.02, 1],
                  transition: {
                    duration: 4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  },
                }
        }
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {/* HIGH VOLTAGE Glow effect - behind the box (Dark Mode) */}
        <motion.div
          className={cn(
            'absolute inset-0 rounded-3xl',
            'bg-electric-600/30 blur-3xl',
            'pointer-events-none',
            // Layered bloom shadow for dark mode
            'dark:shadow-[0_0_60px_-15px_rgba(36,99,235,0.6),0_0_100px_-20px_rgba(36,99,235,0.4)]'
          )}
          animate={{
            opacity: isAbsorbing ? 1 : isActive ? 0.8 : 0.5,
            scale: isAbsorbing ? 1.5 : isActive ? 1.3 : 1.1,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />

        {/* The Drop Zone Card - Polished Glass Surface */}
        <motion.div
          className={cn(
            'relative z-10',
            'w-80 h-80 md:w-96 md:h-96',
            'rounded-3xl',
            'flex flex-col items-center justify-center gap-6',
            'cursor-pointer',
            'transition-all duration-500 ease-out',
            // LIGHT MODE: Clean White Surface
            'bg-white border border-slate-200 shadow-xl shadow-slate-200/50',
            // DARK MODE: Cinematic Glass
            'dark:bg-white/5 dark:border-white/10 dark:shadow-black/50',
            // HOVER EFFECTS: Blue Glow (overridden by animate below for active states)
            'hover:border-electric-500/50 dark:hover:border-electric-500/50',
            'hover:shadow-[0_0_40px_-10px_rgba(36,99,235,0.15)]',
            // HIGH VOLTAGE Shadow - Layered bloom in dark mode
            isAbsorbing
              ? 'dark:shadow-[0_0_100px_-10px_rgba(36,99,235,0.8),0_0_150px_-20px_rgba(36,99,235,0.5)] shadow-glow-intense'
              : isActive
                ? 'dark:shadow-[0_0_60px_-15px_rgba(36,99,235,0.6),0_0_100px_-20px_rgba(36,99,235,0.4)] shadow-glow-lg'
                : ''
          )}
          animate={
            isAbsorbing
              ? {
                  borderColor: '#2463EB',
                  borderWidth: '2px',
                }
              : isActive
                ? {
                    borderColor: '#2463EB',
                    borderWidth: '2px',
                  }
                : {
                    // ALIVE: Subtle pulsing border opacity
                    borderColor: [
                      'rgba(36, 99, 235, 0.2)',
                      'rgba(36, 99, 235, 0.5)',
                      'rgba(36, 99, 235, 0.2)',
                    ],
                    borderWidth: '1px',
                    transition: {
                      duration: 3,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    },
                  }
          }
        >
          {/* Wireframe Cube SVG */}
          <motion.div
            className="relative"
            animate={{
              rotateY: isActive ? 15 : 0,
              rotateX: isActive ? -15 : 0,
              scale: isAbsorbing ? 0.8 : 1,
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <WireframeCube isActive={isActive} isAbsorbing={isAbsorbing} />
          </motion.div>

          {/* Upload Icon - Thicker stroke */}
          <AnimatePresence mode="wait">
            {isAbsorbing ? (
              <motion.div
                key="absorbed"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <div className="w-12 h-12 rounded-full bg-electric-600 flex items-center justify-center">
                  <Check className="w-6 h-6 text-white" strokeWidth={3} />
                </div>
              </motion.div>
            ) : isDragOver ? (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <Upload
                  className={cn('w-12 h-12', 'text-electric-500')}
                  strokeWidth={2.5}
                />
              </motion.div>
            ) : (
              <motion.div
                key="box"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <Box
                  className={cn(
                    'w-12 h-12',
                    'dark:text-white/60 text-black/40',
                    isHovered && 'dark:text-electric-400 text-electric-600'
                  )}
                  strokeWidth={2.5}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Text */}
          <div className="text-center px-6">
            <motion.p
              className={cn(
                'text-lg font-semibold mb-2',
                'text-white'
              )}
              animate={{
                color: isActive ? '#2463EB' : undefined,
              }}
            >
              {isAbsorbing
                ? 'Authenticating...'
                : isDragOver
                  ? 'Release to Upload'
                  : 'Feed the Box'}
            </motion.p>
            <p className="text-sm text-slate-400">
              {isAbsorbing
                ? 'Redirecting to secure login'
                : 'Drag documents here or click to browse'}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

/**
 * Wireframe Cube - 3D isometric cube using SVG
 * STRUCTURAL WEIGHT: strokeWidth 2.5 for solid, safe-like appearance
 */
function WireframeCube({
  isActive,
  isAbsorbing,
}: {
  isActive: boolean
  isAbsorbing: boolean
}) {
  const strokeColor = isActive || isAbsorbing ? '#2463EB' : 'currentColor'
  const strokeOpacity = isActive || isAbsorbing ? 1 : 0.4
  // THICKER strokes for structural weight
  const strokeWidth = 2.5

  return (
    <motion.svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      className={cn('dark:text-white text-slate-900', 'drop-shadow-lg')}
      animate={{
        filter: isAbsorbing
          ? 'drop-shadow(0 0 35px rgba(36, 99, 235, 0.8))'
          : isActive
            ? 'drop-shadow(0 0 25px rgba(36, 99, 235, 0.6))'
            : 'drop-shadow(0 0 15px rgba(36, 99, 235, 0.3))',
      }}
    >
      {/* Back face */}
      <motion.path
        d="M30 45 L60 30 L90 45 L90 75 L60 90 L30 75 Z"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeOpacity={strokeOpacity}
        fill={isAbsorbing ? 'rgba(36, 99, 235, 0.1)' : 'none'}
        strokeLinecap="round"
        strokeLinejoin="round"
        animate={{ strokeOpacity, fill: isAbsorbing ? 'rgba(36, 99, 235, 0.2)' : 'none' }}
        transition={{ duration: 0.3 }}
      />
      {/* Front edges */}
      <motion.path
        d="M30 45 L30 75 M60 30 L60 60 M90 45 L90 75"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeOpacity={strokeOpacity}
        fill="none"
        strokeLinecap="round"
        animate={{ strokeOpacity }}
        transition={{ duration: 0.3 }}
      />
      {/* Center lines */}
      <motion.path
        d="M30 75 L60 60 L90 75 M60 60 L60 90"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeOpacity={strokeOpacity}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        animate={{ strokeOpacity }}
        transition={{ duration: 0.3 }}
      />
      {/* Glowing center point - using CSS transitions to avoid Framer Motion SVG issues */}
      <circle
        cx="60"
        cy="60"
        r={isAbsorbing ? 10 : isActive ? 6 : 4}
        fill="#2463EB"
        opacity={isActive || isAbsorbing ? 1 : 0}
        style={{
          transition: 'all 0.3s ease-out',
        }}
      />
    </motion.svg>
  )
}
