'use client'

import { useTheme } from 'next-themes'
import { motion } from 'framer-motion'
import { Sun, Moon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Glass Navbar Component
 *
 * Features:
 * - Sticky positioning with backdrop blur
 * - Pill-shaped theme toggle with satisfying spring animation
 * - RAGbox logo on left, controls on right
 */
export function Navbar() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = resolvedTheme === 'dark'

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark')
  }

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-50',
        'px-6 py-3',
        'backdrop-blur-md',
        'border-b',
        'transition-colors duration-300',
        // Dark mode
        'dark:bg-void/80 dark:border-white/10',
        // Light mode
        'bg-paper/80 border-black/5'
      )}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <motion.div
          className="flex items-center"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <img
            src="https://storage.googleapis.com/connexusai-assets/WhiteLogo_RAGbox.co-removebg-preview.png"
            alt="RAGbox.co"
            className={cn(
              // MAXIMIZED 2x: Mobile h-20, Tablet h-28, Desktop h-32
              'h-20 md:h-28 lg:h-32 w-auto',
              'transition-all duration-300',
              // Invert logo for light mode
              'dark:brightness-100 brightness-0'
            )}
          />
        </motion.div>

        {/* Right Controls */}
        <div className="flex items-center gap-4">
          {/* Theme Toggle - Pill shaped */}
          {mounted && (
            <motion.button
              onClick={toggleTheme}
              className={cn(
                'relative w-16 h-8 rounded-full p-1',
                'transition-colors duration-300',
                'dark:bg-void-elevated dark:border dark:border-white/10',
                'bg-paper-muted border border-black/10',
                'focus:outline-none focus:ring-2 focus:ring-electric-500/50'
              )}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.1 }}
              aria-label="Toggle theme"
            >
              {/* Sliding indicator */}
              <motion.div
                className={cn(
                  'absolute top-1 w-6 h-6 rounded-full',
                  'flex items-center justify-center',
                  'dark:bg-electric-600 bg-electric-500',
                  'shadow-glow-sm'
                )}
                initial={false}
                animate={{
                  left: isDark ? '4px' : 'calc(100% - 28px)',
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                {isDark ? (
                  <Moon className="w-3.5 h-3.5 text-white" />
                ) : (
                  <Sun className="w-3.5 h-3.5 text-white" />
                )}
              </motion.div>
            </motion.button>
          )}

          {/* Sign In Button */}
          <motion.button
            className={cn(
              'px-4 py-2 rounded-2xl',
              'text-sm font-medium',
              'transition-colors duration-200',
              'dark:text-slate-400 dark:hover:text-white',
              'text-slate-600 hover:text-slate-900'
            )}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.15 }}
          >
            Sign In
          </motion.button>

          {/* Request Demo Button */}
          <motion.button
            className={cn(
              'px-5 py-2.5 rounded-2xl',
              'text-sm font-semibold',
              'bg-electric-600 hover:bg-electric-500',
              'text-white',
              'shadow-glow-sm hover:shadow-glow',
              'transition-all duration-200'
            )}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.2 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Request Demo
          </motion.button>
        </div>
      </div>
    </nav>
  )
}
