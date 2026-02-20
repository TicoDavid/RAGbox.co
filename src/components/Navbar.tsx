// THEME-EXEMPT: Public landing page, locked to Cobalt palette
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
        'px-4 sm:px-6 md:px-8 py-2',
        // Obsidian background with glass effect
        'bg-[#020408]/90 backdrop-blur-md',
        'border-b border-amber-500/10'
      )}
    >
      <div className="flex items-center justify-between">
        {/* Logo - Compact */}
        <motion.div
          className="flex items-center"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <img
            src="https://storage.googleapis.com/connexusai-assets/BabyBlue_RAGb%C3%B6x.png"
            alt="RAGbox"
            width={360}
            height={96}
            className="h-20 sm:h-24 w-auto -my-4 sm:-my-6"
            style={{ color: 'transparent' }}
          />
        </motion.div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Theme Toggle - Pill shaped */}
          {mounted && (
            <motion.button
              onClick={toggleTheme}
              className={cn(
                'relative w-14 sm:w-16 h-7 sm:h-8 rounded-full p-1',
                'bg-[#0a0a0a] border border-white/10',
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
                  'absolute top-0.5 sm:top-1 w-5 sm:w-6 h-5 sm:h-6 rounded-full',
                  'flex items-center justify-center',
                  'bg-[var(--brand-blue)]',
                  'shadow-[0_0_10px_rgba(var(--brand-blue-rgb),0.5)]'
                )}
                initial={false}
                animate={{
                  left: isDark ? '4px' : 'calc(100% - 24px)',
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                {isDark ? (
                  <Moon className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-white" />
                ) : (
                  <Sun className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-white" />
                )}
              </motion.div>
            </motion.button>
          )}

          {/* Sign In Button - Hidden on very small screens */}
          <motion.button
            onClick={onOpenAuth}
            className={cn(
              'hidden sm:block px-3 sm:px-4 py-2 rounded-2xl',
              'text-xs sm:text-sm font-medium',
              'transition-colors duration-200',
              'text-slate-400 hover:text-white'
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
              'px-3 sm:px-5 py-2 sm:py-2.5 rounded-2xl',
              'text-xs sm:text-sm font-semibold',
              'bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)]',
              'text-white',
              'shadow-[0_0_10px_rgba(var(--brand-blue-rgb),0.5)] hover:shadow-[0_0_15px_rgba(var(--brand-blue-rgb),0.7)]',
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
