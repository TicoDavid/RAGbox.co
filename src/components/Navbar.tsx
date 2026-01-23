'use client'

import { useTheme } from 'next-themes'
import { motion } from 'framer-motion'
import { Sun, Moon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface NavbarProps {
  onOpenAuth?: () => void
}

/**
 * Glass Navbar Component
 *
 * Features:
 * - Sticky positioning with backdrop blur
 * - Pill-shaped theme toggle with satisfying spring animation
 * - RAGbox logo on left, controls on right
 */
export function Navbar({ onOpenAuth }: NavbarProps) {
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
        'px-6 py-0.5',
        // Ghost Strategy: Deeply transparent, floating
        'backdrop-blur-md',
        'dark:bg-black/50 bg-white/90',
        'dark:border-b dark:border-white/5 border-b border-slate-200/50',
        'transition-colors duration-300'
      )}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo - Theme-aware */}
        <motion.div
          className="flex items-center"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {mounted && (
            <img
              src={isDark
                ? "https://storage.googleapis.com/connexusai-assets/Primary_RagBoxCo_Colored_Black.png"
                : "https://storage.googleapis.com/connexusai-assets/Primary_RagBoxCo_Colored_white.jpg"
              }
              alt="RAGbox.co"
              className={cn(
                'h-12 md:h-14 lg:h-16 w-auto',
                'transition-all duration-300'
              )}
            />
          )}
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
            onClick={onOpenAuth}
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
          <motion.a
            href="https://theconnexus.ai/"
            target="_blank"
            rel="noopener noreferrer"
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
          </motion.a>
        </div>
      </div>
    </nav>
  )
}
