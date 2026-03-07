'use client'

import React, { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import { useSession, signOut } from 'next-auth/react'
import { usePrivilegeStore } from '@/stores/privilegeStore'
import { useUserRole } from '@/hooks/useUserRole'
import {
  Settings,
  Moon,
  Sun,
  ChevronDown,
  Check,
  Briefcase,
  User,
  Users,
  LogOut,
  CreditCard,
  AlertTriangle,
  Glasses,
  MessageSquare,
} from 'lucide-react'
import { PrivilegeKeyIcon, IdentityIcon } from './icons/SovereignIcons'
import { useMercuryStore } from '@/stores/mercuryStore'
import { PERSONAS } from './mercury/personaData'
import { FeedbackModal } from './FeedbackModal'
import { ActiveModelBadge } from './ActiveModelBadge'
import { IntegrationStatusDots } from './IntegrationStatusDots'
import { SettingsModal, type SettingsSection } from './settings/SettingsModal'

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
  const { data: session } = useSession()
  const { isEnabled: privilegeMode, toggle: togglePrivilege } = usePrivilegeStore()
  const userRole = useUserRole()
  const canAccessPrivilege = userRole === 'Partner'
  const activePersona = useMercuryStore((s) => s.activePersona)
  const setPersona = useMercuryStore((s) => s.setPersona)
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [activeProfile, setActiveProfile] = useState<string>('work')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsInitialSection, setSettingsInitialSection] = useState<SettingsSection | undefined>(undefined)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)
  const [personaMenuOpen, setPersonaMenuOpen] = useState(false)
  const [hoveredPersona, setHoveredPersona] = useState<string | null>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const personaMenuRef = useRef<HTMLDivElement>(null)

  // Get current persona
  const currentPersona = PERSONAS.find((p) => p.id === activePersona) || PERSONAS[0]
  const CurrentPersonaIcon = currentPersona.Icon
  const isWhistleblowerMode = currentPersona.isWhistleblower

  // Get persona categories
  const executivePersonas = PERSONAS.filter((p) => p.category === 'EXECUTIVE')
  const compliancePersonas = PERSONAS.filter((p) => p.category === 'COMPLIANCE')


  useEffect(() => {
    setMounted(true)
  }, [])


  const handleThemeToggle = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  const userInitials = session?.user?.name
    ? session.user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  const currentProfile = PROFILES.find(p => p.id === activeProfile) || PROFILES[0]

  // Handle profile switch with visual transition
  const handleProfileSwitch = (profileId: string) => {
    if (profileId === activeProfile) {
      setProfileMenuOpen(false)
      return
    }
    setIsSwitching(true)
    setProfileMenuOpen(false)

    // Simulate profile switch animation
    setTimeout(() => {
      setActiveProfile(profileId)
      setIsSwitching(false)
    }, 500)
  }

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false)
      }
      if (personaMenuRef.current && !personaMenuRef.current.contains(e.target as Node)) {
        setPersonaMenuOpen(false)
        setHoveredPersona(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
          {/* Persona Selector - Compact Mask Icon */}
          <div className="relative group/lens" ref={personaMenuRef}>
            <button
              onClick={() => setPersonaMenuOpen(!personaMenuOpen)}
              aria-label={`Select persona: ${currentPersona.label}`}
              aria-expanded={personaMenuOpen}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300
                ${isWhistleblowerMode
                  ? 'bg-[var(--warning)]/10 border border-[var(--warning)]/50 text-[var(--warning)] hover:bg-[var(--warning)]/20 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                  : 'bg-[var(--bg-elevated)]/30 border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50 hover:border-[var(--border-default)]'
                }
              `}
            >
              {isWhistleblowerMode ? (
                <span className="w-2 h-2 rounded-full bg-[var(--danger)] animate-ping" />
              ) : (
                <Glasses className="w-4 h-4" />
              )}
              <CurrentPersonaIcon
                size={16}
                color={isWhistleblowerMode ? 'var(--warning)' : 'var(--text-tertiary)'}
              />
              <span className="hidden lg:inline text-xs">{currentPersona.label}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${personaMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {/* CEO Lens Tooltip */}
            {!personaMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-[var(--bg-primary)]/95 backdrop-blur-xl border border-[var(--border-default)] rounded-lg shadow-2xl opacity-0 invisible group-hover/lens:opacity-100 group-hover/lens:visible transition-all duration-200 z-50 pointer-events-none">
                <div className="flex items-center gap-2 mb-2">
                  <CurrentPersonaIcon size={16} color={isWhistleblowerMode ? 'var(--warning)' : 'var(--brand-blue)'} />
                  <span className={`text-sm font-semibold ${isWhistleblowerMode ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'}`}>
                    CEO Lens: {currentPersona.label}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {currentPersona.description}. Switch personas to change how Mercury analyzes your documents.
                </p>
                <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] text-[10px] text-[var(--text-tertiary)]">
                  Click to switch lens
                </div>
              </div>
            )}

            {/* Persona Dropdown */}
            {personaMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-[var(--bg-primary)]/98 backdrop-blur-xl border border-[var(--border-default)] rounded-xl shadow-2xl z-50 py-2 overflow-hidden">
                {/* System Prompt Preview (on hover) */}
                {hoveredPersona && (
                  <div className="px-4 py-3 bg-[var(--bg-primary)]/80 border-b border-[var(--border-default)]">
                    <p className="text-[10px] font-semibold text-[var(--brand-blue)] uppercase tracking-wider mb-1">
                      System Instruction
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] italic">
                      &quot;{PERSONAS.find(p => p.id === hoveredPersona)?.systemPrompt}&quot;
                    </p>
                  </div>
                )}

                {/* Executive Section */}
                <div className="px-4 py-2 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider border-b border-[var(--border-subtle)]">
                  Executive Leadership
                </div>
                {executivePersonas.map((persona) => {
                  const Icon = persona.Icon
                  const isSelected = persona.id === activePersona
                  return (
                    <button
                      key={persona.id}
                      onClick={() => { setPersona(persona.id as typeof activePersona); setPersonaMenuOpen(false); setHoveredPersona(null) }}
                      onMouseEnter={() => setHoveredPersona(persona.id)}
                      onMouseLeave={() => setHoveredPersona(null)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--bg-elevated)]/30 transition-colors ${
                        isSelected ? 'bg-[var(--brand-blue)]/10' : ''
                      }`}
                    >
                      <Icon
                        size={18}
                        color={isSelected ? 'var(--brand-blue-hover)' : 'var(--text-tertiary)'}
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${isSelected ? 'text-[var(--brand-blue)]' : 'text-[var(--text-secondary)]'}`}>
                          {persona.label}
                        </div>
                        <div className="text-xs text-[var(--text-tertiary)] truncate">{persona.description}</div>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-[var(--brand-blue)]" />
                      )}
                    </button>
                  )
                })}

                <div className="border-t border-[var(--border-subtle)] my-1" />

                {/* Compliance Section */}
                <div className="px-4 py-2 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                  Compliance & Oversight
                </div>
                {compliancePersonas.map((persona) => {
                  const Icon = persona.Icon
                  const isSelected = persona.id === activePersona
                  const iconColor = persona.isWhistleblower
                    ? (isSelected ? 'var(--warning)' : 'var(--warning-dim, #b45309)')
                    : (isSelected ? 'var(--brand-blue-hover)' : 'var(--text-tertiary)')

                  return (
                    <button
                      key={persona.id}
                      onClick={() => { setPersona(persona.id as typeof activePersona); setPersonaMenuOpen(false); setHoveredPersona(null) }}
                      onMouseEnter={() => setHoveredPersona(persona.id)}
                      onMouseLeave={() => setHoveredPersona(null)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--bg-elevated)]/30 transition-colors ${
                        isSelected
                          ? persona.isWhistleblower
                            ? 'bg-[var(--warning)]/10'
                            : 'bg-[var(--brand-blue)]/10'
                          : ''
                      }`}
                    >
                      <Icon size={18} color={iconColor} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${
                            isSelected
                              ? persona.isWhistleblower ? 'text-[var(--warning)]' : 'text-[var(--brand-blue)]'
                              : persona.isWhistleblower ? 'text-[var(--warning)]/80' : 'text-[var(--text-secondary)]'
                          }`}>
                            {persona.label}
                          </span>
                          {persona.isWhistleblower && (
                            <AlertTriangle className="w-3.5 h-3.5 text-[var(--warning)]" />
                          )}
                        </div>
                        <div className={`text-xs truncate ${persona.isWhistleblower ? 'text-[var(--warning)]/60' : 'text-[var(--text-tertiary)]'}`}>
                          {persona.description}
                        </div>
                      </div>
                      {isSelected && (
                        <Check className={persona.isWhistleblower ? 'w-4 h-4 text-[var(--warning)]' : 'w-4 h-4 text-[var(--brand-blue)]'} />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

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

          {/* Feedback */}
          <button
            onClick={() => setFeedbackOpen(true)}
            className="p-2 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            title="Send Feedback"
            aria-label="Send feedback"
          >
            <MessageSquare className="w-5 h-5" />
          </button>

          {/* Settings */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            title="Settings"
            aria-label="Open settings"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Avatar with Multi-Profile Menu */}
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
                    onClick={() => { setProfileMenuOpen(false); setSettingsInitialSection('profile'); setSettingsOpen(true) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/30 transition-colors"
                  >
                    <User className="w-4 h-4" />
                    <span className="text-sm">Profile</span>
                  </button>
                  <button
                    onClick={() => { setProfileMenuOpen(false); setSettingsInitialSection('billing'); setSettingsOpen(true) }}
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
                      // Multi-tenant fix: clear ALL client-side state before signing out
                      // so the next login starts with a clean slate.
                      try {
                        // Clear persisted Zustand stores (localStorage)
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
        </div>
      </header>

      {/* Feedback Modal */}
      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />

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
