'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import { usePrivilegeStore } from '@/stores/privilegeStore'
import { useUserRole } from '@/hooks/useUserRole'
import {
  Settings,
  Moon,
  Sun,
  Briefcase,
  User,
  Users,
} from 'lucide-react'
import { PrivilegeKeyIcon, IdentityIcon } from './icons/SovereignIcons'
import { ActiveModelBadge } from './ActiveModelBadge'
import { IntegrationStatusDots } from './IntegrationStatusDots'
import { SettingsModal, type SettingsSection } from './settings/SettingsModal'
import { PersonaSelector } from './header/PersonaSelector'
import { UserProfileMenu } from './header/UserProfileMenu'

// Profile types for multi-profile switching
interface Profile {
  id: string
  name: string
  type: 'work' | 'personal' | 'consultant'
  icon: React.ReactNode
  color: string
}

const PROFILES: Profile[] = [
  { id: 'work', name: 'Work Profile', type: 'work', icon: <Briefcase className="w-4 h-4" />, color: 'text-[var(--brand-blue)]' },
  { id: 'personal', name: 'Personal Vault', type: 'personal', icon: <User className="w-4 h-4" />, color: 'text-[var(--success)]' },
  { id: 'consultant', name: 'Consultant Mode', type: 'consultant', icon: <Users className="w-4 h-4" />, color: 'text-[var(--text-accent)]' },
]

export function GlobalHeader() {
  const { isEnabled: privilegeMode, toggle: togglePrivilege } = usePrivilegeStore()
  const userRole = useUserRole()
  const canAccessPrivilege = userRole === 'Partner'
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [activeProfile, setActiveProfile] = useState<string>('work')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsInitialSection, setSettingsInitialSection] = useState<SettingsSection | undefined>(undefined)
  const [isSwitching, setIsSwitching] = useState(false)

  const currentProfile = PROFILES.find(p => p.id === activeProfile) || PROFILES[0]

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleThemeToggle = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  const handleOpenSettings = (section: SettingsSection) => {
    setSettingsInitialSection(section)
    setSettingsOpen(true)
  }

  return (
    <>
      <header
        className={`shrink-0 relative flex items-center justify-between px-4 border-b border-[var(--border-default)] border-t border-t-[var(--border-default)] bg-[var(--bg-secondary)] transition-opacity duration-300 ${
          isSwitching ? 'opacity-50' : 'opacity-100'
        }`}
        style={{ height: 'var(--header-height)' }}
      >
        {/* Left Section */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Logo */}
          <div className="flex items-center shrink-0">
            <Image
              src="https://storage.googleapis.com/connexusai-assets/BabyBlue_RAGb%C3%B6x.png"
              alt="RAGbox"
              width={360}
              height={96}
              className="h-24"
              style={{ width: 'auto' }}
              priority
            />
          </div>

          {/* Privilege Badge — only visible for Partner role */}
          {canAccessPrivilege && privilegeMode && (
            <div className="privilege-badge flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--privilege-bg)] border border-[var(--privilege-border)] text-[var(--privilege-color)] animate-pulse">
              <PrivilegeKeyIcon size={14} color="var(--privilege-color)" />
              <span className="text-xs font-semibold uppercase tracking-wide">Privileged</span>
            </div>
          )}

          {/* Active Profile Indicator */}
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--bg-elevated)]/30 border border-[var(--border-default)] ${currentProfile.color}`}>
            {currentProfile.icon}
            <span className="text-xs font-medium">{currentProfile.name}</span>
          </div>

          {/* Active Model Badge */}
          <ActiveModelBadge />

          {/* Integration Status Indicators */}
          <IntegrationStatusDots />
        </div>

        {/* Right Section - Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Persona Selector */}
          <PersonaSelector />

          {/* Privilege Toggle with Enhanced Tooltip — only visible for Partner role */}
          {canAccessPrivilege && (
          <div className="relative group">
            <button
              onClick={() => togglePrivilege()}
              aria-label={privilegeMode ? 'Disable privilege mode' : 'Enable privilege mode'}
              aria-pressed={privilegeMode}
              className={`p-2 rounded-md transition-all duration-300 ${
                privilegeMode
                  ? 'text-[var(--warning)] bg-[var(--warning)]/10 shadow-[0_0_15px_rgba(255,171,0,0.4)] animate-[pulse-glow_2s_ease-in-out_infinite]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              <PrivilegeKeyIcon size={20} color={privilegeMode ? 'var(--privilege-color)' : 'var(--text-tertiary)'} />
            </button>
            {/* Enhanced Tooltip */}
            <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-[var(--bg-primary)]/95 backdrop-blur-xl border border-[var(--border-default)] rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="flex items-center gap-2 mb-2">
                <PrivilegeKeyIcon size={16} color={privilegeMode ? 'var(--privilege-color)' : 'var(--text-tertiary)'} />
                <span className={`text-sm font-semibold ${privilegeMode ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'}`}>
                  {privilegeMode ? 'Privilege Mode Active' : 'Privilege Mode'}
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Enables access to attorney-client privileged documents. Available to Partner and Admin roles only.
              </p>
              <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] text-[10px] text-[var(--text-tertiary)]">
                {privilegeMode ? 'Click to disable' : 'Click to enable'}
              </div>
            </div>
          </div>
          )}

          {/* Theme Toggle — guarded by mounted to prevent hydration mismatch */}
          {mounted && (
            <button
              onClick={handleThemeToggle}
              className="p-2 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
              aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {resolvedTheme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
          )}

          {/* Settings */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            title="Settings"
            aria-label="Open settings"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* User Profile Menu */}
          <UserProfileMenu
            currentProfile={currentProfile}
            onOpenSettings={handleOpenSettings}
          />
        </div>
      </header>

      {/* Settings Modal */}
      {settingsOpen && (
        <SettingsModal onClose={() => { setSettingsOpen(false); setSettingsInitialSection(undefined) }} initialSection={settingsInitialSection} />
      )}

      {/* Profile Switch Overlay */}
      {isSwitching && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <IdentityIcon size={48} color="var(--brand-blue-hover)" className="animate-pulse" />
            <p className="text-[var(--text-primary)] font-medium">Switching Profile...</p>
          </div>
        </div>
      )}

      {/* Custom CSS for privilege glow animation */}
      <style jsx global>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 15px rgba(255, 171, 0, 0.4); }
          50% { box-shadow: 0 0 25px rgba(255, 171, 0, 0.6), 0 0 35px rgba(255, 171, 0, 0.3); }
        }
      `}</style>
    </>
  )
}
