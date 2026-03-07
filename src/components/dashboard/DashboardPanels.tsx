'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useVaultStore } from '@/stores/vaultStore'
import {
  Star,
  Shield,
  FileText,
  Menu,
  X,
  Wrench,
  MessageSquare,
  HardDrive,
  Bot,
  Layers,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'

// ============================================================================
// PANEL CONTENT COMPONENTS
// ============================================================================

export function RecentFilesPanel() {
  const documents = useVaultStore((s) => s.documents)
  const recentDocs = Object.values(documents)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 10)

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-4 py-3 border-b border-[var(--border-subtle)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">Recent Files</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {recentDocs.length === 0 ? (
          <div className="p-4 text-center text-[var(--text-tertiary)] text-sm">
            No recent files
          </div>
        ) : (
          <div className="space-y-1">
            {recentDocs.map((doc) => (
              <button
                key={doc.id}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg
                         text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50 transition-colors"
              >
                <FileText className="w-4 h-4 text-[var(--brand-blue)] shrink-0" />
                <span className="truncate">{doc.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function StarredPanel() {
  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-4 py-3 border-b border-[var(--border-subtle)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">Starred</h3>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <Star className="w-12 h-12 text-[var(--warning)]/30 mx-auto mb-3" />
          <p className="text-sm text-[var(--text-tertiary)]">No starred documents</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Star important files for quick access</p>
        </div>
      </div>
    </div>
  )
}

export function AuditPanel() {
  const [entries, setEntries] = useState<Array<{ id: string; action: string; createdAt: string; resourceId?: string }>>([])

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch('/api/audit/entries?limit=10')
        if (res.ok) {
          const data = await res.json()
          setEntries(data.data?.entries || [])
        }
      } catch {
        // Silent — fallback to empty
      }
    }
    load()
  }, [])

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  const formatAction = (action: string) =>
    action.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-4 py-3 border-b border-[var(--border-subtle)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
          <Shield className="w-4 h-4 text-[var(--success)]" />
          Audit Log
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {entries.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)] text-center py-4">No audit entries yet</p>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="p-3 rounded-lg bg-[var(--bg-primary)]/50 border border-[var(--border-subtle)]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[var(--success)]">{formatAction(entry.action)}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">{formatTime(entry.createdAt)}</span>
                </div>
                {entry.resourceId && (
                  <p className="text-xs text-[var(--text-secondary)] truncate">{entry.resourceId}</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// MOBILE COMPONENTS
// ============================================================================

interface MobileOverlayProps {
  isOpen: boolean
  onClose: () => void
  side: 'left' | 'right'
  children: React.ReactNode
}

export function MobileOverlay({ isOpen, onClose, side, children }: MobileOverlayProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: side === 'left' ? '-100%' : '100%' }}
            animate={{ x: 0 }}
            exit={{ x: side === 'left' ? '-100%' : '100%' }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className={`fixed top-0 bottom-0 z-50 w-[85vw] max-w-[400px]
              bg-[var(--bg-secondary)] shadow-2xl
              ${side === 'left' ? 'left-0 border-r' : 'right-0 border-l'} border-[var(--border-default)]`}
          >
            {/* Close button */}
            <div className={`absolute top-3 z-10 ${side === 'left' ? 'right-3' : 'left-3'}`}>
              <button
                onClick={onClose}
                aria-label="Close panel"
                className="w-9 h-9 flex items-center justify-center rounded-lg
                           text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]
                           transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="h-full overflow-y-auto">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

interface MobileToolbarProps {
  onLeftOpen: () => void
  onRightOpen: () => void
}

export function MobileToolbar({ onLeftOpen, onRightOpen }: MobileToolbarProps) {
  return (
    <div className="flex md:hidden items-center justify-between px-3 py-1.5
                    bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
      <button
        onClick={onLeftOpen}
        aria-label="Open vault menu"
        className="w-11 h-11 flex items-center justify-center rounded-xl
                   text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]
                   transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
        RAGbox
      </span>

      <button
        onClick={onRightOpen}
        aria-label="Open tools menu"
        className="w-11 h-11 flex items-center justify-center rounded-xl
                   text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]
                   transition-colors"
      >
        <Wrench className="w-5 h-5" />
      </button>
    </div>
  )
}

export type MobileTab = 'chat' | 'vault' | 'mercury' | 'tools'

const MOBILE_TABS: { id: MobileTab; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'vault', label: 'Vault', icon: HardDrive },
  { id: 'mercury', label: 'Mercury', icon: Bot },
  { id: 'tools', label: 'Tools', icon: Layers },
]

export function MobileBottomNav({
  activeTab,
  onTabChange,
}: {
  activeTab: MobileTab
  onTabChange: (tab: MobileTab) => void
}) {
  return (
    <nav className="flex md:hidden shrink-0 bg-[var(--bg-secondary)] border-t border-[var(--border-default)] pb-[env(safe-area-inset-bottom)]">
      {MOBILE_TABS.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] transition-colors ${
              isActive
                ? 'text-[var(--brand-blue)]'
                : 'text-[var(--text-tertiary)]'
            }`}
            aria-label={tab.label}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
