'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Shield, Check, FileText, FileType, File } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRagSounds } from '@/hooks/useRagSounds'

/**
 * TheBox Component - The Sovereign Drop Zone
 *
 * Design: "Stark Industries Interface" - Premium, tactile, empowering
 *
 * Features:
 * - Glassmorphism card with solid glowing border (no dashed lines)
 * - Shield icon that transforms on hover/drop
 * - Breathing animation when idle (2% scale pulse)
 * - Heavy spring physics (stiffness: 300, damping: 30)
 * - File type indicators for reduced cognitive load
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
        {/* Glow effect - behind the box (Dark mode only) */}
        <motion.div
          className={cn(
            'absolute inset-0 rounded-3xl',
            'pointer-events-none',
            // Dark mode: Electric blue glow
            'dark:bg-electric-600/20 dark:blur-3xl',
            // Light mode: No glow (clean floating shadow instead)
            'bg-transparent blur-none'
          )}
          animate={{
            opacity: isAbsorbing ? 1 : isActive ? 0.8 : 0.4,
            scale: isAbsorbing ? 1.5 : isActive ? 1.3 : 1.1,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />

        {/* The Drop Zone Card - Premium floating container */}
        <motion.div
          className={cn(
            'relative z-10',
            'w-80 h-80 md:w-96 md:h-96',
            'rounded-3xl',
            'flex flex-col items-center justify-center gap-4',
            'cursor-pointer',
            'transition-all duration-300',
            // Dark mode: Elevated surface with subtle fill
            'dark:bg-[#111111]',
            // Light mode: Clean white card
            'bg-white',
            'backdrop-blur-xl',
            // Border: thin with glow in dark, grey in light
            'border',
            'dark:border-electric-600/30',
            'border-slate-200',
            // Shadows: Layered glow (dark) vs floating shadow (light)
            isAbsorbing
              ? 'dark:shadow-[0_0_80px_-10px_rgba(37,99,235,0.7)] shadow-2xl'
              : isActive
                ? 'dark:shadow-[0_0_50px_-10px_rgba(37,99,235,0.5)] shadow-xl'
                : 'dark:shadow-[0_0_30px_-10px_rgba(37,99,235,0.3)] shadow-lg'
          )}
        >
          {/* Shield Icon - Premium, secure feel */}
          <AnimatePresence mode="wait">
            {isAbsorbing ? (
              <motion.div
                key="absorbed"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="relative"
              >
                <div className="w-20 h-20 rounded-full bg-electric-600 flex items-center justify-center shadow-glow">
                  <Check className="w-10 h-10 text-white" strokeWidth={3} />
                </div>
              </motion.div>
            ) : isDragOver ? (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <Upload
                  className="w-16 h-16 text-electric-500"
                  strokeWidth={2}
                />
              </motion.div>
            ) : (
              <motion.div
                key="shield"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="relative"
              >
                <motion.div
                  animate={{
                    scale: isHovered ? 1.1 : 1,
                  }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                >
                  <Shield
                    className={cn(
                      'w-16 h-16',
                      'dark:text-white/60 text-slate-400',
                      isHovered && 'dark:text-electric-400 text-electric-600'
                    )}
                    strokeWidth={2.5}
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Text */}
          <div className="text-center px-6">
            <motion.p
              className={cn(
                'text-lg font-semibold mb-2',
                'dark:text-white text-slate-900'
              )}
              animate={{
                color: isActive ? '#2563eb' : undefined,
              }}
            >
              {isAbsorbing
                ? 'Processing...'
                : isDragOver
                  ? 'Release to Analyze'
                  : 'Securely Upload for Analysis'}
            </motion.p>
            <p className="text-sm dark:text-slate-400 text-slate-500 mb-4">
              {isAbsorbing
                ? 'Redirecting to secure login'
                : 'Drag documents here or click to browse'}
            </p>

            {/* File Type Indicators - Reduces cognitive load */}
            {!isAbsorbing && (
              <motion.div
                className="flex items-center justify-center gap-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center gap-1.5 text-xs dark:text-slate-500 text-slate-400">
                  <FileText className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs dark:text-slate-500 text-slate-400">
                  <FileType className="w-3.5 h-3.5" />
                  <span>DOCX</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs dark:text-slate-500 text-slate-400">
                  <File className="w-3.5 h-3.5" />
                  <span>TXT</span>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

