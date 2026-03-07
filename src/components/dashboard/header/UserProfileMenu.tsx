'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import {
  ChevronDown,
  User,
  CreditCard,
  LogOut,
} from 'lucide-react'
import type { SettingsSection } from '../settings/SettingsModal'

interface Profile {
  id: string
  name: string
  type: 'work' | 'personal' | 'consultant'
  icon: React.ReactNode
  color: string
}

interface UserProfileMenuProps {
  currentProfile: Profile
  onOpenSettings: (section: SettingsSection) => void
}

export function UserProfileMenu({ currentProfile, onOpenSettings }: UserProfileMenuProps) {
  const { data: session } = useSession()
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  const userInitials = session?.user?.name
    ? session.user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative ml-1" ref={profileMenuRef}>
      <button
        onClick={() => setProfileMenuOpen(!profileMenuOpen)}
        aria-label="User profile menu"
        aria-expanded={profileMenuOpen}
        className={`flex items-center gap-1.5 p-1 rounded-full transition-all ${
          profileMenuOpen ? 'ring-2 ring-[var(--brand-blue)] ring-offset-2 ring-offset-[var(--bg-secondary)]' : ''
        }`}
      >
        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-semibold transition-all ${
          currentProfile.type === 'work' ? 'bg-[var(--brand-blue)]/15 border-[var(--brand-blue)]/50 text-[var(--brand-blue-hover)]' :
          currentProfile.type === 'personal' ? 'bg-[var(--success)]/15 border-[var(--success)]/50 text-[var(--success)]' :
          'bg-[var(--text-accent)]/15 border-[var(--text-accent)]/50 text-[var(--text-accent)]'
        }`}>
          {userInitials}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-secondary)] transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Profile Dropdown Menu */}
      {profileMenuOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-[var(--bg-primary)]/95 backdrop-blur-xl border border-[var(--border-default)] rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-semibold ${
                currentProfile.type === 'work' ? 'bg-[var(--brand-blue)]/15 border-[var(--brand-blue)]/50 text-[var(--brand-blue-hover)]' :
                currentProfile.type === 'personal' ? 'bg-[var(--success)]/15 border-[var(--success)]/50 text-[var(--success)]' :
                'bg-[var(--text-accent)]/15 border-[var(--text-accent)]/50 text-[var(--text-accent)]'
              }`}>
                {userInitials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{session?.user?.name || 'User'}</p>
                <p className="text-xs text-[var(--text-secondary)] truncate">{session?.user?.email || ''}</p>
                <p className="text-[10px] text-[var(--text-tertiary)] truncate mt-0.5">RAGbox Sovereign</p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            <button
              onClick={() => { setProfileMenuOpen(false); onOpenSettings('profile') }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/30 transition-colors"
            >
              <User className="w-4 h-4" />
              <span className="text-sm">Profile</span>
            </button>
            <button
              onClick={() => { setProfileMenuOpen(false); onOpenSettings('billing') }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/30 transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              <span className="text-sm">Plan & Usage</span>
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-[var(--border-subtle)]" />

          {/* Sign Out */}
          <div className="py-2">
            <button
              onClick={() => {
                try {
                  localStorage.removeItem('ragbox-vault')
                  localStorage.removeItem('ragbox-privilege')
                  localStorage.removeItem('ragbox-chat-storage')
                  localStorage.removeItem('ragbox_user_verified')
                } catch { /* SSR or private browsing */ }
                signOut({ callbackUrl: '/' })
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
