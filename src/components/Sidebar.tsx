'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { Box, Scale, Settings, Sun, Moon, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  icon: React.ReactNode
  label: string
  id: string
  href: string
}

const navItems: NavItem[] = [
  { icon: <Box className="w-5 h-5" strokeWidth={2.5} />, label: 'The Box', id: 'box', href: '/dashboard' },
  { icon: <Scale className="w-5 h-5" strokeWidth={2.5} />, label: 'Truth & Audit', id: 'audit', href: '/dashboard/audit' },
  { icon: <Settings className="w-5 h-5" strokeWidth={2.5} />, label: 'Settings', id: 'settings', href: '/dashboard/settings' },
]

/**
 * Sidebar Component - Left Navigation
 *
 * Features:
 * - RAGbox.co logo at top
 * - Vertical navigation with icons + labels
 * - User profile pill with theme toggle at bottom
 */
export function Sidebar() {
  const pathname = usePathname()
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = resolvedTheme === 'dark'

  // Determine active item based on current pathname
  const getActiveItem = () => {
    if (pathname === '/dashboard') return 'box'
    if (pathname.startsWith('/dashboard/audit')) return 'audit'
    if (pathname.startsWith('/dashboard/settings')) return 'settings'
    return 'box'
  }
  const activeItem = getActiveItem()

  return (
    <motion.aside
      className={cn(
        'h-screen w-64 flex flex-col',
        'border-r',
        'dark:bg-void-card dark:border-sterling/10',
        'bg-ceramic border-black/5'
      )}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Logo - DOMINANT presence at top left */}
      <div className="p-6">
        <motion.div
          className="flex items-center w-48"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <img
            src="https://storage.googleapis.com/connexusai-assets/Primary_RagBoxCo_Colored_Black.png"
            alt="RAGbox.co"
            className="w-full h-auto"
          />
        </motion.div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item, index) => (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
            >
              <Link
                href={item.href}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-2xl',
                  'transition-all duration-200',
                  'text-left',
                  activeItem === item.id
                    ? cn(
                        'dark:bg-electric-600/20 bg-electric-100',
                        'dark:text-electric-400 text-electric-600',
                        'shadow-glow-sm'
                      )
                    : cn(
                        'dark:text-white/60 text-black/60',
                        'dark:hover:bg-white/5 hover:bg-black/5',
                        'dark:hover:text-white hover:text-black'
                      )
                )}
              >
                {item.icon}
                <span className="font-bold">{item.label}</span>
              </Link>
            </motion.li>
          ))}
        </ul>
      </nav>

      {/* User Profile + Theme Toggle */}
      <div className="p-4 border-t dark:border-white/10 border-black/5">
        <motion.div
          className={cn(
            'flex items-center justify-between',
            'p-3 rounded-2xl',
            'dark:bg-white/5 bg-black/5'
          )}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {/* User */}
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center',
                'dark:bg-electric-600/20 bg-electric-100',
                'dark:text-electric-400 text-electric-600'
              )}
            >
              <User className="w-4 h-4" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium dark:text-white text-black">
                User
              </span>
              <span className="text-xs dark:text-white/40 text-black/40">
                Partner
              </span>
            </div>
          </div>

          {/* Theme Toggle */}
          {mounted && (
            <motion.button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center',
                'transition-colors duration-200',
                'dark:hover:bg-white/10 hover:bg-black/10',
                'dark:text-white/60 text-black/60'
              )}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Toggle theme"
            >
              {isDark ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </motion.button>
          )}
        </motion.div>
      </div>
    </motion.aside>
  )
}
