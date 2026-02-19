'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Archive, UserCircle, Scale } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface NavItem {
  icon: React.ElementType
  label: string
  id: string
  href?: string
  statusDot?: boolean
}

export interface SidebarProps {
  onNavigate?: (itemId: string) => void
  activePanelId?: string | null
}

export function Sidebar({ onNavigate, activePanelId }: SidebarProps) {
  const pathname = usePathname()
  const [agentId, setAgentId] = useState<string | null>(null)
  const [agentActive, setAgentActive] = useState(false)

  useEffect(() => {
    async function loadPersona() {
      try {
        const res = await apiFetch('/api/persona')
        if (res.ok) {
          const data = await res.json()
          const persona = data.data?.persona
          if (persona?.id) {
            setAgentId(persona.id)
            setAgentActive(true)
          }
        }
      } catch {
        // Silent
      }
    }
    loadPersona()
  }, [])

  const navItems: NavItem[] = [
    { icon: Archive, label: 'The Box', id: 'box' },
    {
      icon: UserCircle,
      label: 'My Agent',
      id: 'agent',
      href: agentId ? `/dashboard/agents/${agentId}` : '/dashboard/agents',
      statusDot: agentActive,
    },
    { icon: Scale, label: 'Truth & Audit', id: 'audit' },
  ]

  const isItemActive = (item: NavItem) => {
    if (item.href) return pathname.startsWith('/dashboard/agents')
    return activePanelId === item.id
  }

  return (
    <div
      className="h-full flex flex-col bg-[var(--bg-primary)] border-r border-white/10"
      style={{ width: 64 }}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="flex items-center justify-center py-4">
        <img
          src="https://storage.googleapis.com/connexusai-assets/BabyBlue_RAGb%C3%B6x.png"
          alt="RAGbox"
          className="w-8 h-8 object-contain"
        />
      </div>

      {/* Icon Stack */}
      <nav className="flex-1 flex flex-col items-center gap-2 py-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isItemActive(item)
          const button = (
            <div key={item.id} className="relative group">
              <button
                onClick={() => {
                  if (item.href) return // Link handles navigation
                  onNavigate?.(item.id)
                }}
                aria-label={item.label}
                className={`
                  relative w-11 h-11 flex items-center justify-center rounded-xl
                  transition-all duration-200
                  ${active
                    ? 'bg-[var(--brand-blue)]/15 text-[var(--brand-blue)] shadow-[0_0_20px_rgba(36,99,235,0.4)]'
                    : 'text-slate-500 hover:text-white hover:bg-white/5'
                  }
                `}
              >
                {active && (
                  <div className="absolute top-1 bottom-1 left-0 w-0.5 bg-[var(--brand-blue)] rounded-full shadow-[0_0_8px_rgba(36,99,235,0.8)]" />
                )}
                <Icon className={`w-5 h-5 ${active ? 'drop-shadow-[0_0_6px_rgba(36,99,235,0.6)]' : ''}`} />
                {item.statusDot && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[var(--bg-primary)] animate-pulse" />
                )}
              </button>

              {/* Tooltip — right side */}
              <div className="absolute top-1/2 -translate-y-1/2 left-full ml-2 px-2.5 py-1.5 rounded-lg
                            bg-[var(--bg-primary)]/95 backdrop-blur-sm border border-white/10 shadow-xl
                            text-xs font-medium text-white whitespace-nowrap
                            opacity-0 pointer-events-none group-hover:opacity-100
                            transition-opacity duration-200 z-50">
                {item.label}
              </div>
            </div>
          )

          if (item.href) {
            return (
              <Link key={item.id} href={item.href}>
                {button}
              </Link>
            )
          }
          return button
        })}
      </nav>
    </div>
  )
}
