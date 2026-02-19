'use client'

import { Archive } from 'lucide-react'

interface NavItem {
  icon: React.ElementType
  label: string
  id: string
}

export interface SidebarProps {
  onNavigate?: (itemId: string) => void
  activePanelId?: string | null
}

export function Sidebar({ onNavigate, activePanelId }: SidebarProps) {
  const navItems: NavItem[] = [
    { icon: Archive, label: 'The Box', id: 'box' },
  ]

  return (
    <div
      className="h-full flex flex-col bg-[var(--bg-primary)] border-r border-[var(--border-default)]"
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
          const active = activePanelId === item.id
          return (
            <div key={item.id} className="relative group">
              <button
                onClick={() => onNavigate?.(item.id)}
                aria-label={item.label}
                className={`
                  relative w-11 h-11 flex items-center justify-center rounded-xl
                  transition-all duration-200
                  ${active
                    ? 'bg-[var(--brand-blue)]/15 text-[var(--brand-blue)] shadow-[0_0_20px_rgba(36,99,235,0.4)]'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50'
                  }
                `}
              >
                {active && (
                  <div className="absolute top-1 bottom-1 left-0 w-0.5 bg-[var(--brand-blue)] rounded-full shadow-[0_0_8px_rgba(36,99,235,0.8)]" />
                )}
                <Icon className={`w-5 h-5 ${active ? 'drop-shadow-[0_0_6px_rgba(36,99,235,0.6)]' : ''}`} />
              </button>

              {/* Tooltip — right side */}
              <div className="absolute top-1/2 -translate-y-1/2 left-full ml-2 px-2.5 py-1.5 rounded-lg
                            bg-[var(--bg-primary)]/95 backdrop-blur-sm border border-[var(--border-default)] shadow-xl
                            text-xs font-medium text-[var(--text-primary)] whitespace-nowrap
                            opacity-0 pointer-events-none group-hover:opacity-100
                            transition-opacity duration-200 z-50">
                {item.label}
              </div>
            </div>
          )
        })}
      </nav>
    </div>
  )
}
