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
 * - Official RAGbox.co logo (same in both modes)
 * - Pill-shaped theme toggle with satisfying spring animation
 */
export function Navbar() {
  const { setTheme, resolvedTheme } = useTheme()
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
        'px-6 h-20',
        'backdrop-blur-md',
        'bg-white/70 dark:bg-[#050505]/70',
        'border-b border-slate-200 dark:border-white/5',
        'transition-colors duration-300'
      )}
    >
      <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
        {/* Logo - Official RAGbox.co Logo */}
        <motion.div
          className="flex items-center cursor-pointer"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <img
            src="https://storage.googleapis.com/connexusai-assets/Primary_RagBoxCo_Colored_white.jpg"
            alt="RAGbox.co"
            className="h-12 md:h-14 w-auto"
          />
        </motion.div>

        {/* Right Controls */}
        <div className="flex items-center gap-6">
          {/* Theme Toggle - Pill shaped */}
          {mounted && (
            <motion.button
              onClick={toggleTheme}
              className={cn(
                'relative w-16 h-8 rounded-full p-1',
                'transition-colors duration-300',
                'dark:bg-white/5 dark:border dark:border-white/10',
                'bg-slate-100 border border-slate-200',
                'focus:outline-none focus:ring-2 focus:ring-blue-500/50'
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
                  'bg-blue-600',
                  'shadow-lg shadow-blue-600/25'
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
          <motion.a
            href="#"
            className={cn(
              'text-sm font-medium',
              'text-slate-600 hover:text-slate-900',
              'dark:text-slate-400 dark:hover:text-white',
              'transition-colors duration-200'
            )}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.15 }}
          >
            Sign In
          </motion.a>

          {/* Request Demo Button */}
          <motion.a
            href="https://theconnexus.ai/"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'px-5 py-2.5 rounded-full',
              'text-sm font-semibold',
              'bg-blue-600 hover:bg-blue-700',
              'text-white',
              'shadow-lg shadow-blue-600/20',
              'transition-all duration-200'
            )}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.2 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Request Demo
          </motion.a>
        </div>
      </div>
    </nav>
  )
}
