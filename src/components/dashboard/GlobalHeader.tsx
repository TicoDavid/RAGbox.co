'use client'

import React, { useState } from 'react'
import { useSession } from 'next-auth/react'
import { usePrivilegeStore } from '@/stores/privilegeStore'
import {
  Search,
  Settings,
  Moon,
  Sun,
  Shield,
  HardDrive,
} from 'lucide-react'

export function GlobalHeader() {
  const { data: session } = useSession()
  const { isEnabled: privilegeMode, toggle: togglePrivilege } = usePrivilegeStore()
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [searchOpen, setSearchOpen] = useState(false)

  const handleThemeToggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.classList.toggle('light', next === 'light')
    document.documentElement.classList.toggle('dark', next === 'dark')
  }

  const userInitials = session?.user?.name
    ? session.user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  return (
    <header
      className="shrink-0 flex items-center gap-3 px-4 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]"
      style={{ height: 'var(--header-height)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-md bg-[var(--brand-blue)] flex items-center justify-center font-bold text-white text-sm">
          RB
        </div>
        <span className="font-jakarta font-bold text-base text-[var(--text-primary)] tracking-tight">
          RAGbox
        </span>
      </div>

      {/* Privilege Badge */}
      {privilegeMode && (
        <div className="privilege-badge flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--privilege-bg)] border border-[var(--privilege-border)] text-[var(--privilege-color)]">
          <Shield className="w-3.5 h-3.5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Privileged</span>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search */}
      <button
        onClick={() => setSearchOpen(!searchOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-tertiary)] hover:border-[var(--border-strong)] transition-colors"
        style={{ minWidth: 200 }}
      >
        <Search className="w-4 h-4" />
        <span className="text-sm">Search documents...</span>
        <kbd className="ml-auto text-[10px] font-mono bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">⌘K</kbd>
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Privilege Toggle */}
        <button
          onClick={() => togglePrivilege()}
          className={`p-2 rounded-md transition-colors ${
            privilegeMode
              ? 'text-[var(--privilege-color)] bg-[var(--privilege-bg)]'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
          }`}
          title={privilegeMode ? 'Disable Privilege Mode' : 'Enable Privilege Mode'}
        >
          <Shield className="w-5 h-5" />
        </button>

        {/* Storage */}
        <button
          className="p-2 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          title="External Storage"
        >
          <HardDrive className="w-5 h-5" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={handleThemeToggle}
          className="p-2 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>

        {/* Settings */}
        <button
          className="p-2 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* Avatar */}
        <div className="ml-1 w-8 h-8 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-default)] flex items-center justify-center text-xs font-semibold text-[var(--text-secondary)]">
          {userInitials}
        </div>
      </div>
    </header>
  )
}
