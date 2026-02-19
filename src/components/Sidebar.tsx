'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { Box, Scale, Settings, Sun, Moon, User, UserCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api'

interface NavItem {
  icon: React.ReactNode
  label: string
  subtitle?: string
  id: string
  href?: string       // Only for route-based items (My Agent)
  statusDot?: boolean
}

export interface SidebarProps {
  /** Called when a panel item is clicked (box, audit, settings) */
  onNavigate?: (itemId: string) => void
  /** Currently active panel id for highlighting */
  activePanelId?: string | null
}

/**
 * Sidebar Component - Left Navigation
 *
 * Panel items (The Box, Truth & Audit, Settings) call onNavigate
 * to toggle DashboardLayout panels. My Agent keeps href navigation
 * since the agent page is a real route.
 */
export function Sidebar({ onNavigate, activePanelId }: SidebarProps) {
  const pathname = usePathname()
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [agentId, setAgentId] = useState<string | null>(null)
  const [agentName, setAgentName] = useState<string>('My Agent')
  const [agentActive, setAgentActive] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch persona for agent nav item
  useEffect(() => {
    async function loadPersona() {
      try {
        const res = await apiFetch('/api/persona')
        if (res.ok) {
          const data = await res.json()
          const persona = data.data?.persona
          if (persona?.id) {
            setAgentId(persona.id)
            setAgentName(`${persona.firstName}${persona.lastName ? ' ' + persona.lastName : ''}`)
            setAgentActive(true)
          }
        }
      } catch {
        // Silent — nav still works without persona
      }
    }
    loadPersona()
  }, [])

  const isDark = resolvedTheme === 'dark'

  const navItems: NavItem[] = [
    { icon: <Box className="w-5 h-5" strokeWidth={2.5} />, label: 'The Box', id: 'box' },
    {
      icon: <UserCircle className="w-5 h-5" strokeWidth={2.5} />,
      label: 'My Agent',
      subtitle: agentName,
      id: 'agent',
      href: agentId ? `/dashboard/agents/${agentId}` : '/dashboard/agents',
      statusDot: agentActive,
    },
    { icon: <Scale className="w-5 h-5" strokeWidth={2.5} />, label: 'Truth & Audit', id: 'audit' },
    { icon: <Settings className="w-5 h-5" strokeWidth={2.5} />, label: 'Settings', id: 'settings' },
  ]

  // Active state: route items use pathname, panel items use activePanelId prop
  const isItemActive = (item: NavItem) => {
    if (item.href) {
      return pathname.startsWith('/dashboard/agents')
    }
    return activePanelId === item.id
  }

  // Shared classes for nav items
  const getItemClasses = (item: NavItem) =>
    cn(
      'w-full flex items-center gap-3 px-4 py-3 rounded-2xl',
      'transition-all duration-200',
      'text-left',
      isItemActive(item)
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
    )

  // Shared inner content for nav items
  const renderItemContent = (item: NavItem) => (
    <>
      <div className="relative">
        {item.icon}
        {item.statusDot && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[var(--bg-primary)] animate-pulse" />
        )}
      </div>
      <div className="flex flex-col">
        <span className="font-bold">{item.label}</span>
        {item.subtitle && (
          <span className="text-xs dark:text-white/40 text-black/40 -mt-0.5">
            {item.subtitle}
          </span>
        )}
      </div>
    </>
  )

  return (
    <motion.aside
      className={cn(
        'h-full w-64 flex flex-col',
        'border-r',
        'dark:bg-void dark:border-white/10',
        'bg-ceramic border-black/5'
      )}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Logo - DOMINANT presence at top left */}
      <div className="p-6">
        <motion.div
          className="flex items-center w-[144px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <img
            src="https://storage.googleapis.com/connexusai-assets/BabyBlue_RAGb%C3%B6x.png"
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
              {item.href ? (
                <Link href={item.href} className={getItemClasses(item)}>
                  {renderItemContent(item)}
                </Link>
              ) : (
                <button
                  onClick={() => onNavigate?.(item.id)}
                  className={getItemClasses(item)}
                >
                  {renderItemContent(item)}
                </button>
              )}
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
