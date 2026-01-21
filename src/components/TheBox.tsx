'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Box } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * TheBox Component - The Sovereign Drop Zone
 *
 * Features:
 * - Breathing animation when idle (2% scale pulse)
 * - Intensified glow on hover/drag
 * - Wireframe cube visual with Electric Blue glow
 * - Heavy spring physics (stiffness: 300, damping: 30)
 */
export function TheBox() {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    // Handle file drop - to be implemented with upload logic
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      // Future: trigger upload flow
    }
  }, [])

  const isActive = isDragOver || isHovered

  return (
    <div className="flex flex-col items-center gap-8">
      {/* The Box */}
      <motion.div
        className="relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        // Breathing animation when idle
        animate={
          isActive
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
        {/* Glow effect - behind the box */}
        <motion.div
          className={cn(
            'absolute inset-0 rounded-3xl',
            'bg-electric-600/20 blur-3xl',
            'pointer-events-none'
          )}
          animate={{
            opacity: isActive ? 0.8 : 0.3,
            scale: isActive ? 1.2 : 1,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />

        {/* The Drop Zone Card */}
        <motion.div
          className={cn(
            'relative z-10',
            'w-80 h-80 md:w-96 md:h-96',
            'rounded-3xl',
            'flex flex-col items-center justify-center gap-6',
            'cursor-pointer',
            'transition-colors duration-300',
            // Border
            'border-2 border-dashed',
            isActive
              ? 'dark:border-electric-500 border-electric-600'
              : 'dark:border-white/20 border-black/10',
            // Background
            'dark:bg-void-card/50 bg-paper-card/50',
            // Shadow
            isActive ? 'shadow-glow-lg' : 'shadow-glow-sm'
          )}
        >
          {/* Wireframe Cube SVG */}
          <motion.div
            className="relative"
            animate={{
              rotateY: isActive ? 15 : 0,
              rotateX: isActive ? -15 : 0,
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <WireframeCube isActive={isActive} />
          </motion.div>

          {/* Upload Icon */}
          <AnimatePresence mode="wait">
            {isDragOver ? (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <Upload
                  className={cn(
                    'w-12 h-12',
                    'text-electric-500'
                  )}
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
                />
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
              {isDragOver ? 'Release to Upload' : 'Feed the Box'}
            </motion.p>
            <p className="text-sm dark:text-slate-400 text-slate-500">
              Drag documents here or click to browse
            </p>
          </div>
        </motion.div>
      </motion.div>

      {/* Tagline */}
      <motion.p
        className={cn(
          'text-xl md:text-2xl font-medium text-center',
          'dark:text-slate-300 text-slate-700',
          'max-w-lg'
        )}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.2 }}
      >
        Document Interrogation in a{' '}
        <span className="text-electric-500 font-semibold">Sovereign Environment</span>
      </motion.p>
    </div>
  )
}

/**
 * Wireframe Cube - 3D isometric cube using SVG
 */
function WireframeCube({ isActive }: { isActive: boolean }) {
  const strokeColor = isActive ? '#2563eb' : 'currentColor'
  const strokeOpacity = isActive ? 1 : 0.3

  return (
    <motion.svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      className={cn(
        'dark:text-white text-slate-900',
        'drop-shadow-lg'
      )}
      animate={{
        filter: isActive
          ? 'drop-shadow(0 0 20px rgba(37, 99, 235, 0.5))'
          : 'drop-shadow(0 0 10px rgba(37, 99, 235, 0.2))',
      }}
    >
      {/* Back face */}
      <motion.path
        d="M30 45 L60 30 L90 45 L90 75 L60 90 L30 75 Z"
        stroke={strokeColor}
        strokeWidth="2"
        strokeOpacity={strokeOpacity}
        fill="none"
        animate={{ strokeOpacity }}
        transition={{ duration: 0.3 }}
      />
      {/* Front edges */}
      <motion.path
        d="M30 45 L30 75 M60 30 L60 60 M90 45 L90 75"
        stroke={strokeColor}
        strokeWidth="2"
        strokeOpacity={strokeOpacity}
        fill="none"
        animate={{ strokeOpacity }}
        transition={{ duration: 0.3 }}
      />
      {/* Center lines */}
      <motion.path
        d="M30 75 L60 60 L90 75 M60 60 L60 90"
        stroke={strokeColor}
        strokeWidth="2"
        strokeOpacity={strokeOpacity}
        fill="none"
        animate={{ strokeOpacity }}
        transition={{ duration: 0.3 }}
      />
      {/* Glowing center point */}
      <motion.circle
        cx="60"
        cy="60"
        r="4"
        fill={isActive ? '#2563eb' : 'transparent'}
        animate={{
          r: isActive ? 6 : 4,
          opacity: isActive ? 1 : 0,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      />
    </motion.svg>
  )
}
