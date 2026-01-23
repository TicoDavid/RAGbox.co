'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRagSounds } from '@/hooks/useRagSounds'

/**
 * TheBox Component - The Sovereign Drop Zone
 *
 * Design: Sync.so / Linear aesthetic - Clean, professional, premium
 *
 * Features:
 * - Dashed border that highlights on hover
 * - Solid shield icon with shadow
 * - Clean file type badges
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
        playDropSound()
        setIsAbsorbing(true)
        setTimeout(() => {
          router.push('/login')
        }, 800)
      }
    },
    [router, playDropSound]
  )

  const handleClick = useCallback(() => {
    setIsAbsorbing(true)
    setTimeout(() => {
      router.push('/login')
    }, 800)
  }, [router])

  const isActive = isDragOver || isHovered

  return (
    <div className="w-full max-w-lg">
      {/* The Drop Zone Card */}
      <motion.div
        className={cn(
          'relative aspect-square md:aspect-[4/3] rounded-3xl',
          'flex flex-col items-center justify-center gap-4',
          'cursor-pointer',
          'transition-all duration-300 ease-out',
          // Background
          'bg-slate-50 dark:bg-white/5',
          // Border: Dashed, highlights on hover
          'border-2 border-dashed',
          isActive || isAbsorbing
            ? 'border-blue-500 dark:border-blue-500/50'
            : 'border-slate-300 dark:border-white/10',
          // Hover background tint
          isActive && 'bg-blue-50/50 dark:bg-blue-900/10'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        animate={
          isAbsorbing
            ? { scale: [1, 1.02, 1] }
            : { scale: 1 }
        }
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {/* Icon Container */}
        <AnimatePresence mode="wait">
          {isAbsorbing ? (
            <motion.div
              key="check"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="p-4 rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/25"
            >
              <Check className="w-8 h-8 text-white" strokeWidth={3} />
            </motion.div>
          ) : isDragOver ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/25"
            >
              <Upload className="w-8 h-8 text-white" strokeWidth={2} />
            </motion.div>
          ) : (
            <motion.div
              key="shield"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={cn(
                'p-4 rounded-2xl mb-2',
                'bg-white dark:bg-white/10',
                'shadow-xl shadow-slate-200/50 dark:shadow-none',
                'transition-transform duration-300',
                isHovered && 'scale-110'
              )}
            >
              {/* Solid Shield Icon */}
              <svg
                className="w-8 h-8 text-blue-600 dark:text-blue-400"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V8.26l7-3.89v8.63z" />
              </svg>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Text */}
        <div className="space-y-1 text-center">
          <h3
            className={cn(
              'text-lg font-semibold',
              'text-slate-900 dark:text-white',
              isActive && 'text-blue-600 dark:text-blue-400'
            )}
          >
            {isAbsorbing
              ? 'Processing...'
              : isDragOver
                ? 'Release to Analyze'
                : 'Securely Upload for Analysis'}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isAbsorbing
              ? 'Redirecting to secure login'
              : 'Drag & drop or click to browse'}
          </p>
        </div>

        {/* File Type Badges */}
        {!isAbsorbing && (
          <motion.div
            className="flex gap-3 mt-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {['PDF', 'DOCX', 'TXT'].map((type) => (
              <span
                key={type}
                className={cn(
                  'px-2 py-1 rounded',
                  'text-[10px] font-bold uppercase tracking-wide',
                  'bg-slate-200 dark:bg-white/10',
                  'text-slate-500 dark:text-slate-400'
                )}
              >
                {type}
              </span>
            ))}
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
