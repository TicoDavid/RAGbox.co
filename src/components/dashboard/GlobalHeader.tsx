'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import { useSession, signOut } from 'next-auth/react'
import { usePrivilegeStore } from '@/stores/privilegeStore'
import { useUserRole } from '@/hooks/useUserRole'
import { useVaultStore } from '@/stores/vaultStore'
import {
  Search,
  Settings,
  Moon,
  Sun,
  ChevronDown,
  Check,
  Briefcase,
  User,
  Users,
  LogOut,
  Key,
  Bell,
  Palette,
  X,
  Globe,
  CreditCard,
  Monitor,
  Lock,
  Shield,
  FileText,
  MessageSquare,
  ExternalLink,
  ChevronRight,
  Zap,
  LayoutGrid,
  Sparkles,
  AlertTriangle,
  Glasses,
  Brain,
  Plug,
  Server,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { PrivilegeKeyIcon, IdentityIcon, LanternIcon } from './icons/SovereignIcons'
import { useMercuryStore } from '@/stores/mercuryStore'
import { PERSONAS } from './mercury/personaData'
import { useSettings, type CachedModel, LANGUAGES, type LanguageId, type DensityId } from '@/contexts/SettingsContext'
import { getModelDisplayName, OPENROUTER_ENDPOINT } from '@/services/OpenRouterService'
import { AIModelSettings } from './settings/AIModelSettings'
import IntegrationsSettings from '@/app/dashboard/settings/integrations/page'

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
  const [searchOpen, setSearchOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [activeProfile, setActiveProfile] = useState<string>('work')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsInitialSection, setSettingsInitialSection] = useState<SettingsSection | undefined>(undefined)
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

  // Search: wire to vault store with 300ms debounce
  const setSearchQuery = useVaultStore((s) => s.setSearchQuery)
  const fetchDocuments = useVaultStore((s) => s.fetchDocuments)
  const [searchInput, setSearchInput] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        setSearchQuery(value)
        fetchDocuments()
      }, 300)
    },
    [setSearchQuery, fetchDocuments]
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // Focus search input when search bar opens
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [searchOpen])

  // Keyboard shortcut: Cmd/Ctrl+K toggles search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((prev) => !prev)
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [searchOpen])

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

        {/* Center Section - Search (Absolutely Centered) */}
        <div className="absolute left-1/2 -translate-x-1/2">
          {searchOpen ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[var(--brand-blue)] ring-1 ring-[var(--brand-blue)]/30 bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors" style={{ minWidth: 320 }}>
              <Search className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />
              <input
                ref={searchInputRef}
                id="global-search"
                name="global-search"
                type="text"
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search documents..."
                aria-label="Search documents"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-tertiary)]"
              />
              {searchInput && (
                <button
                  onClick={() => { handleSearchChange(''); setSearchOpen(false) }}
                  className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <kbd className="text-[10px] font-mono bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] px-1.5 py-0.5 rounded shrink-0">Esc</kbd>
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-tertiary)] hover:border-[var(--border-strong)] transition-colors"
              style={{ minWidth: 200 }}
              aria-label="Search documents"
            >
              <Search className="w-4 h-4" />
              <span className="text-sm">Search documents...</span>
              <kbd className="ml-auto text-[10px] font-mono bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">&#8984;K</kbd>
            </button>
          )}
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
                    onClick={() => signOut()}
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

// ============================================================================
// SYSTEM CONTROL PANEL - Sovereign Configuration Engine
// ============================================================================

type SettingsSection =
  | 'profile' | 'language' | 'billing'  // General
  | 'connections' | 'aimodel' | 'integrations'         // Intelligence
  | 'appearance'                         // Interface
  | 'alerts' | 'security'                // System
  | 'docs' | 'report'                     // Support

interface SidebarCategory {
  id: string
  label: string
  items: { id: SettingsSection; label: string; icon: React.ReactNode }[]
}

const SIDEBAR_CATEGORIES: SidebarCategory[] = [
  {
    id: 'general',
    label: 'General',
    items: [
      { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
      { id: 'language', label: 'Language', icon: <Globe className="w-4 h-4" /> },
      { id: 'billing', label: 'Plan & Usage', icon: <CreditCard className="w-4 h-4" /> },
    ],
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    items: [
      { id: 'connections', label: 'Connections', icon: <Key className="w-4 h-4" /> },
      { id: 'aimodel', label: 'AI Model', icon: <Brain className="w-4 h-4" /> },
      { id: 'integrations', label: 'Integrations', icon: <Plug className="w-4 h-4" /> },
    ],
  },
  {
    id: 'interface',
    label: 'Interface',
    items: [
      { id: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { id: 'alerts', label: 'Alerts', icon: <Bell className="w-4 h-4" /> },
      { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
    ],
  },
  {
    id: 'support',
    label: 'Support',
    items: [
      { id: 'docs', label: 'Documentation', icon: <FileText className="w-4 h-4" /> },
      { id: 'report', label: 'Report Issue', icon: <MessageSquare className="w-4 h-4" /> },
      // Community section — hidden until destinations are wired (Discord/GitHub)
    ],
  },
]

function SettingsModal({ onClose, initialSection }: { onClose: () => void; initialSection?: SettingsSection }) {
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection || 'connections')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Modal - Wide layout */}
      <div className="relative w-full max-w-4xl mx-4 h-[80vh] max-h-[700px] bg-[var(--bg-secondary)] backdrop-blur-xl border border-[var(--border-default)] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-[var(--brand-blue)]/20 to-[var(--brand-blue)]/10 rounded-lg">
              <Settings className="w-5 h-5 text-[var(--brand-blue)]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">System Control Panel</h2>
              <p className="text-xs text-[var(--text-tertiary)]">Sovereign Configuration Engine</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50 transition-colors"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body - Sidebar + Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar */}
          <nav className="w-56 shrink-0 bg-[var(--bg-tertiary)]/50 border-r border-[var(--border-default)] overflow-y-auto py-4" aria-label="Settings navigation">
            {SIDEBAR_CATEGORIES.map((category) => (
              <div key={category.id} className="mb-4">
                <div className="px-4 py-1.5 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                  {category.label}
                </div>
                {category.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all ${
                      activeSection === item.id
                        ? 'text-[var(--brand-blue)] bg-[var(--brand-blue)]/10 border-r-2 border-[var(--brand-blue)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/30'
                    }`}
                  >
                    <span className={activeSection === item.id ? 'text-[var(--brand-blue)]' : ''}>
                      {item.icon}
                    </span>
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          {/* Right Content Panel */}
          <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg-primary)]">
            {activeSection === 'profile' && <ProfileSettings />}
            {activeSection === 'language' && <LanguageSettings />}
            {activeSection === 'billing' && <BillingSettings />}
            {activeSection === 'connections' && <APIKeysSettings />}
            {activeSection === 'aimodel' && <AIModelSettings />}
            {activeSection === 'integrations' && <IntegrationsSettings />}
            {activeSection === 'appearance' && <AppearanceSettings />}
            {activeSection === 'alerts' && <NotificationSettings />}
            {activeSection === 'security' && <SecuritySettings />}
            {activeSection === 'docs' && <DocumentationSettings />}
            {activeSection === 'report' && <ReportIssueSettings />}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// GENERAL SECTION COMPONENTS
// ============================================================================

function ProfileSettings() {
  const { data: session, update: updateSession } = useSession()
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState(session?.user?.name || '')
  const [saving, setSaving] = useState(false)

  const userInitials = (editing ? displayName : session?.user?.name)
    ? (editing ? displayName : session?.user?.name || '').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  const handleEdit = () => {
    setDisplayName(session?.user?.name || '')
    setEditing(true)
  }

  const handleCancel = () => {
    setDisplayName(session?.user?.name || '')
    setEditing(false)
  }

  const handleSave = async () => {
    const trimmed = displayName.trim()
    if (!trimmed) {
      toast.error('Display name cannot be empty')
      return
    }
    if (trimmed.length > 100) {
      toast.error('Display name must be 100 characters or less')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: trimmed }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to update profile')
      }
      toast.success('Profile updated')
      setEditing(false)
      await updateSession()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Profile"
        description="Manage your identity and organizational role"
      />

      <div className="p-6 bg-[var(--bg-elevated)]/30 border border-[var(--border-default)] rounded-xl">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--brand-blue)]/30 to-[var(--brand-blue)]/20 border-2 border-[var(--brand-blue)]/50 flex items-center justify-center text-xl font-semibold text-[var(--text-primary)]">
            {userInitials}
          </div>
          <div className="flex-1">
            {editing ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={100}
                  className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-primary)]/50 border border-[var(--border-default)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-blue)] transition-colors"
                  placeholder="Display name"
                  autoFocus
                />
                <p className="text-sm text-[var(--text-tertiary)]" title="Email cannot be changed">
                  {session?.user?.email || 'user@example.com'}
                </p>
              </div>
            ) : (
              <>
                <p className="text-lg font-semibold text-[var(--text-primary)]">{session?.user?.name || 'Sovereign User'}</p>
                <p className="text-sm text-[var(--text-secondary)]">{session?.user?.email || 'user@example.com'}</p>
              </>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] px-2 py-0.5 bg-[var(--warning)]/20 text-[var(--warning)] rounded-full font-medium">
                ADMINISTRATOR
              </span>
            </div>
          </div>
          {editing ? (
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                disabled={saving}
                className="px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-default)] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !displayName.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                Save
              </button>
            </div>
          ) : (
            <button
              onClick={handleEdit}
              className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded-lg transition-colors"
              aria-label="Edit profile"
            >
              Edit Profile
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-[var(--bg-elevated)]/30 border border-[var(--border-default)] rounded-lg">
          <p className="text-xs text-[var(--text-tertiary)] mb-1">Organization</p>
          <p className="text-sm font-medium text-[var(--text-primary)]">RAGböx</p>
        </div>
        <div className="p-4 bg-[var(--bg-elevated)]/30 border border-[var(--border-default)] rounded-lg">
          <p className="text-xs text-[var(--text-tertiary)] mb-1">Role</p>
          <p className="text-sm font-medium text-[var(--text-primary)]">Sovereign Administrator</p>
        </div>
      </div>

      {/* Work Profile Sub-Section */}
      <WorkProfileSettings />
    </div>
  )
}

const INDUSTRIES = [
  'Legal', 'Finance', 'Healthcare', 'Technology', 'Government',
  'Education', 'Consulting', 'Real Estate', 'Insurance', 'Manufacturing', 'Other',
] as const

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+'] as const

function WorkProfileSettings() {
  const [workProfile, setWorkProfile] = useState({
    companyName: '',
    jobTitle: '',
    industry: '',
    companySize: '',
    useCase: '',
  })
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/user/work-profile')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setWorkProfile({
            companyName: json.data.companyName || '',
            jobTitle: json.data.jobTitle || '',
            industry: json.data.industry || '',
            companySize: json.data.companySize || '',
            useCase: json.data.useCase || '',
          })
        }
        setLoaded(true)
      })
      .catch((err) => {
        console.error('Failed to load work profile:', err)
        setLoaded(true)
      })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/user/work-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: workProfile.companyName || null,
          jobTitle: workProfile.jobTitle || null,
          industry: workProfile.industry || null,
          companySize: workProfile.companySize || null,
          useCase: workProfile.useCase || null,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to save work profile')
      }
      toast.success('Work profile saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save work profile')
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field: string, value: string) => {
    setWorkProfile((prev) => ({ ...prev, [field]: value }))
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--text-tertiary)]" />
      </div>
    )
  }

  return (
    <div className="space-y-4 pt-4 border-t border-[var(--border-default)]">
      <div>
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">Work Profile</h4>
        <p className="text-xs text-[var(--text-tertiary)]">Your professional details for personalized experiences</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-[var(--text-tertiary)] mb-1">Company Name</label>
          <input
            type="text"
            value={workProfile.companyName}
            onChange={(e) => updateField('companyName', e.target.value)}
            maxLength={200}
            className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-primary)]/50 border border-[var(--border-default)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-blue)] transition-colors"
            placeholder="Acme Corp"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-tertiary)] mb-1">Job Title</label>
          <input
            type="text"
            value={workProfile.jobTitle}
            onChange={(e) => updateField('jobTitle', e.target.value)}
            maxLength={100}
            className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-primary)]/50 border border-[var(--border-default)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-blue)] transition-colors"
            placeholder="General Counsel"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-[var(--text-tertiary)] mb-1">Industry</label>
          <select
            value={workProfile.industry}
            onChange={(e) => updateField('industry', e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-primary)]/50 border border-[var(--border-default)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-blue)] transition-colors"
          >
            <option value="">Select industry</option>
            {INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[var(--text-tertiary)] mb-1">Company Size</label>
          <select
            value={workProfile.companySize}
            onChange={(e) => updateField('companySize', e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-primary)]/50 border border-[var(--border-default)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-blue)] transition-colors"
          >
            <option value="">Select size</option>
            {COMPANY_SIZES.map((size) => (
              <option key={size} value={size}>{size} employees</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-[var(--text-tertiary)] mb-1">Use Case</label>
        <textarea
          value={workProfile.useCase}
          onChange={(e) => updateField('useCase', e.target.value)}
          maxLength={500}
          rows={3}
          className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-primary)]/50 border border-[var(--border-default)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-blue)] resize-none transition-colors"
          placeholder="Describe how you plan to use RAGbox..."
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white rounded-lg transition-colors disabled:opacity-50"
      >
        {saving && <Loader2 className="w-3 h-3 animate-spin" />}
        Save Work Profile
      </button>
    </div>
  )
}

function LanguageSettings() {
  const { language, setLanguage } = useSettings()

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Sovereign Language"
        description="Configure the output language for AI responses and interface"
      />

      <div className="space-y-3">
        {(Object.entries(LANGUAGES) as [LanguageId, typeof LANGUAGES[LanguageId]][]).map(([id, lang]) => (
          <button
            key={id}
            onClick={() => setLanguage(id)}
            className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
              language === id
                ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/10 shadow-[0_0_15px_-5px_var(--brand-blue)]'
                : 'border-[var(--border-default)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]/30'
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-semibold ${
              language === id ? 'bg-[var(--brand-blue)]/20 text-[var(--brand-blue)]' : 'bg-[var(--bg-elevated)]/30 text-[var(--text-secondary)]'
            }`}>
              {lang.nativeName.charAt(0)}
            </div>
            <div className="flex-1 text-left">
              <p className={`text-sm font-medium ${language === id ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                {lang.name}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">{lang.nativeName}</p>
            </div>
            {language === id && (
              <Check className="w-5 h-5 text-[var(--brand-blue)]" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

function BillingSettings() {
  const { subscription } = useSettings()
  const usagePercent = (subscription.tokensUsed / subscription.tokensLimit) * 100

  const planLabels: Record<string, string> = {
    free: 'Free Tier',
    starter: 'Starter',
    professional: 'Professional',
    enterprise: 'Enterprise',
    sovereign: 'Sovereign',
    // Legacy (backward compat for any cached UI state)
    mercury: 'Starter',
    syndicate: 'Enterprise',
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Plan & Usage"
        description="Monitor your subscription and resource consumption"
      />

      {/* Current Plan Card */}
      <div className="p-6 bg-gradient-to-br from-[var(--brand-blue)]/10 to-[var(--bg-secondary)] border border-[var(--brand-blue)]/30 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-[var(--brand-blue)] font-medium mb-1">CURRENT PLAN</p>
            <p className="text-xl font-bold text-[var(--text-primary)]">{planLabels[subscription.plan]}</p>
          </div>
          <div className="p-3 bg-[var(--brand-blue)]/20 rounded-xl">
            <Zap className="w-6 h-6 text-[var(--brand-blue)]" />
          </div>
        </div>

        {/* Token Usage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--text-secondary)]">Tokens Used</span>
            <span className="text-[var(--text-primary)] font-medium">
              {(subscription.tokensUsed / 1000000).toFixed(2)}M / {(subscription.tokensLimit / 1000000).toFixed(0)}M
            </span>
          </div>
          <div className="h-2 bg-[var(--bg-tertiary)]rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-blue-dim)] rounded-full transition-all"
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
          <p className="text-xs text-[var(--text-tertiary)]">
            Renews on {new Date(subscription.renewalDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Manage Subscription */}
      <button onClick={async () => {
        try {
          const res = await fetch('/api/billing/portal', { method: 'POST' })
          const data = await res.json()
          if (data.url) window.open(data.url, '_self')
          else toast.error(data.error || 'Unable to open billing portal')
        } catch { toast.error('Unable to open billing portal') }
      }} className="w-full flex items-center justify-between p-4 bg-[var(--bg-elevated)]/30 border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded-xl transition-colors group" aria-label="Manage subscription">
        <div className="flex items-center gap-3">
          <CreditCard className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors" />
          <div className="text-left">
            <p className="text-sm font-medium text-[var(--text-primary)]">Manage Subscription</p>
            <p className="text-xs text-[var(--text-tertiary)]">Update payment method, view invoices</p>
          </div>
        </div>
        <ExternalLink className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] transition-colors" />
      </button>
    </div>
  )
}

// ============================================================================
// INTERFACE SECTION COMPONENTS
// ============================================================================

// DensitySettings merged into AppearanceSettings above

// ============================================================================
// SYSTEM SECTION COMPONENTS
// ============================================================================

function SecuritySettings() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [revoking, setRevoking] = useState(false)

  const handleRevoke = async () => {
    setRevoking(true)
    try {
      const res = await fetch('/api/v1/sessions', { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'Failed to revoke sessions')
      }
      toast.success('All other sessions revoked')
      setConfirmOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke sessions')
    } finally {
      setRevoking(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Security"
        description="Manage sessions, access controls, and security policies"
      />

      {/* Active Sessions */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Active Sessions</p>

        <div className="p-4 bg-[var(--bg-elevated)]/30 border border-[var(--border-default)] rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--success)]/20 rounded-lg">
              <Monitor className="w-4 h-4 text-[var(--success)]" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-[var(--text-primary)]">Current Session</p>
                <span className="text-[10px] px-1.5 py-0.5 bg-[var(--success)]/20 text-[var(--success)] rounded">Active</span>
              </div>
              <p className="text-xs text-[var(--text-tertiary)]">Windows · Chrome · Started 2 hours ago</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Lock className="w-8 h-8 text-[var(--text-tertiary)] mb-3" />
          <p className="text-sm text-[var(--text-secondary)]">No other active sessions</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">You are only signed in on this device</p>
        </div>
      </div>

      {/* Security Actions */}
      <div className="space-y-3">
        <button className="w-full flex items-center justify-between p-4 bg-[var(--bg-elevated)]/30 border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded-lg transition-colors group" aria-label="Two-factor authentication settings">
          <div className="flex items-center gap-3">
            <Shield className="w-4 h-4 text-[var(--text-secondary)]" />
            <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">Two-Factor Authentication</span>
          </div>
          <span className="text-xs text-[var(--success)]">Enabled</span>
        </button>

        <button
          onClick={() => setConfirmOpen(true)}
          className="w-full flex items-center justify-between p-4 bg-[var(--danger)]/10 border border-[var(--danger)]/30 hover:border-[var(--danger)]/50 rounded-lg transition-colors"
          aria-label="Sign out all other devices"
        >
          <div className="flex items-center gap-3">
            <LogOut className="w-4 h-4 text-[var(--danger)]" />
            <span className="text-sm text-[var(--danger)]">Sign Out Other Devices</span>
          </div>
          <ChevronRight className="w-4 h-4 text-[var(--danger)]" />
        </button>
      </div>

      {/* Revoke Confirmation Dialog */}
      {confirmOpen && (
        <div className="p-4 bg-[var(--danger)]/5 border border-[var(--danger)]/30 rounded-xl space-y-3">
          <p className="text-sm font-medium text-[var(--text-primary)]">Sign out of all other devices?</p>
          <p className="text-xs text-[var(--text-secondary)]">
            This will revoke all sessions except your current one. You will stay signed in on this device.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRevoke}
              disabled={revoking}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--danger)] text-white hover:bg-[var(--danger)]/90 transition-colors disabled:opacity-50"
            >
              {revoking ? 'Revoking...' : 'Confirm Revoke'}
            </button>
            <button
              onClick={() => setConfirmOpen(false)}
              className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// SUPPORT SECTION COMPONENTS
// ============================================================================

function DocumentationSettings() {
  const docs = [
    {
      title: 'Protocol Alpha: Initialization',
      description: 'Quick start guide for new sovereign operators',
      href: '/docs/getting-started',
      icon: <Zap className="w-4 h-4" />,
    },
    {
      title: 'The Sovereign Uplink (API)',
      description: 'Programmatic access to the RAGbox intelligence system',
      href: '/docs/api-reference',
      icon: <FileText className="w-4 h-4" />,
    },
    {
      title: 'The Fortress Architecture',
      description: 'Encryption, compliance, and data sovereignty',
      href: '/docs/security-compliance',
      icon: <Shield className="w-4 h-4" />,
    },
    {
      title: 'Tactical Prompting',
      description: 'Master the art of intelligence extraction',
      href: '/docs/best-practices',
      icon: <Sparkles className="w-4 h-4" />,
    },
    {
      title: 'MCP Server Spec',
      description: 'Model Context Protocol integration for AI agents',
      href: '/docs/mcp-server-spec',
      icon: <Server className="w-4 h-4" />,
    },
  ]

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Documentation"
        description="Access guides, references, and best practices"
      />

      <div className="space-y-3">
        {docs.map((doc) => (
          <a
            key={doc.title}
            href={doc.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 bg-[var(--bg-elevated)]/30 border border-[var(--border-default)] hover:border-[var(--brand-blue)]/30 hover:bg-[var(--brand-blue)]/5 rounded-xl transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[var(--bg-tertiary)]group-hover:bg-[var(--brand-blue)]/20 rounded-lg transition-colors">
                <span className="text-[var(--text-secondary)] group-hover:text-[var(--brand-blue)] transition-colors">
                  {doc.icon}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--brand-blue)] transition-colors">{doc.title}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{doc.description}</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--brand-blue)] transition-colors" />
          </a>
        ))}
      </div>
    </div>
  )
}

function ReportIssueSettings() {
  const [issueType, setIssueType] = useState<'bug' | 'feature' | 'question'>('bug')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!description.trim() || description.trim().length < 10) {
      toast.error('Description must be at least 10 characters')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/report-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: issueType,
          description: description.trim(),
          currentUrl: typeof window !== 'undefined' ? window.location.href : undefined,
          browserInfo: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to submit report')
      }
      toast.success('Report submitted successfully')
      setDescription('')
      setIssueType('bug')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit report')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Report Issue"
        description="Submit a bug report or request a feature"
      />

      {/* Issue Type */}
      <div>
        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">Issue Type</label>
        <div className="grid grid-cols-3 gap-2">
          {(['bug', 'feature', 'question'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setIssueType(type)}
              className={`p-3 rounded-lg border text-sm font-medium capitalize transition-all ${
                issueType === type
                  ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/10 text-[var(--brand-blue)]'
                  : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="bug-description" className="block text-xs font-medium text-[var(--text-secondary)] mb-2">Description</label>
        <textarea
          id="bug-description"
          name="bug-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue or feature request in detail..."
          rows={5}
          className="w-full px-4 py-3 bg-[var(--bg-primary)]/50 border border-[var(--border-default)]/50 rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--brand-blue)] resize-none"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!description.trim() || submitting}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-primary)] text-sm font-medium rounded-lg transition-colors"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        Submit Report
      </button>
    </div>
  )
}

function CommunitySettings() {
  const links = [
    { title: 'Discord Community', description: 'Join The Syndicate for real-time support', icon: <Users className="w-5 h-5" /> },
    { title: 'GitHub Discussions', description: 'Participate in open-source discussions', icon: <MessageSquare className="w-5 h-5" /> },
    { title: 'Twitter/X', description: 'Follow for updates and announcements', icon: <ExternalLink className="w-5 h-5" /> },
  ]

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Community"
        description="Connect with other RAGbox users and contributors"
      />

      <div className="space-y-3">
        {links.map((link) => (
          <div
            key={link.title}
            title="Community coming soon"
            className="flex items-center gap-4 p-4 bg-[var(--bg-elevated)]/30 border border-[var(--border-default)] rounded-xl opacity-50 cursor-not-allowed"
          >
            <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl">
              <span className="text-[var(--text-secondary)]">
                {link.icon}
              </span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {link.title}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">{link.description}</p>
            </div>
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Coming soon</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// SHARED COMPONENTS
// ============================================================================

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[var(--text-primary)] to-[var(--text-tertiary)]">
        {title}
      </h3>
      <p className="text-sm text-[var(--text-tertiary)] mt-1">{description}</p>
    </div>
  )
}

// Active Model Badge Component
function ActiveModelBadge() {
  const { activeIntelligence, isAegisActive } = useSettings()

  // Always show the badge - Aegis is the default
  const isNative = isAegisActive

  return (
    <div className={`
      flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors
      ${isNative
        ? 'bg-gradient-to-r from-[var(--warning)]/10 to-[var(--warning)]/5 border border-[var(--warning)]/30'
        : 'bg-gradient-to-r from-[var(--brand-blue)]/10 to-[var(--brand-blue-dim)]/10 border border-[var(--brand-blue)]/30'
      }
    `}>
      {isNative ? (
        // Aegis Shield Icon
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--warning)]">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      ) : (
        // Other model icon
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--brand-blue)]">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      )}
      <span className={`text-xs font-medium ${isNative ? 'text-[var(--warning)]' : 'text-[var(--brand-blue)]'}`}>
        M.E.R.C.U.R.Y.
      </span>
    </div>
  )
}

// Integration status dots — wired to live APIs (STORY-133)
type DotStatus = 'connected' | 'error' | 'hidden'

function IntegrationStatusDots() {
  const [roam, setRoam] = useState<DotStatus>('hidden')
  const [whatsapp, setWhatsapp] = useState<DotStatus>('hidden')
  const [loaded, setLoaded] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const [roamRes, waRes] = await Promise.allSettled([
        fetch('/api/integrations/roam/status'),
        fetch('/api/settings/integrations'),
      ])

      // ROAM status
      if (roamRes.status === 'fulfilled' && roamRes.value.ok) {
        const { data } = await roamRes.value.json()
        if (data?.status === 'connected' || data?.healthStatus === 'healthy') {
          setRoam('connected')
        } else if (data?.status === 'error' || data?.healthStatus === 'error') {
          setRoam('error')
        } else {
          setRoam('hidden')
        }
      }

      // WhatsApp — derive from integration settings
      if (waRes.status === 'fulfilled' && waRes.value.ok) {
        const { data } = await waRes.value.json()
        if (data?.whatsappEnabled) {
          setWhatsapp('connected')
        } else {
          setWhatsapp('hidden')
        }
      }
    } catch {
      // Silent — dots just stay hidden
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 60_000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  // Don't render until first fetch returns
  if (!loaded) return null

  // Hide entirely if nothing is connected/errored
  if (roam === 'hidden' && whatsapp === 'hidden') return null

  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-[var(--bg-elevated)]/20 border border-[var(--border-subtle)]">
      {roam !== 'hidden' && (
        <div className="flex items-center gap-1" title={roam === 'connected' ? 'ROAM connected' : 'ROAM error'}>
          <span className={`w-1.5 h-1.5 rounded-full ${roam === 'connected' ? 'bg-[var(--success)] animate-pulse' : 'bg-[var(--danger)]'}`} />
          <span className="text-[10px] font-medium text-[var(--text-tertiary)]">ROAM</span>
        </div>
      )}
      {whatsapp !== 'hidden' && (
        <div className="flex items-center gap-1" title={whatsapp === 'connected' ? 'WhatsApp connected' : 'WhatsApp error'}>
          <span className={`w-1.5 h-1.5 rounded-full ${whatsapp === 'connected' ? 'bg-[#25D366] animate-pulse' : 'bg-[var(--danger)]'}`} />
          <span className="text-[10px] font-medium text-[var(--text-tertiary)]">WhatsApp</span>
        </div>
      )}
    </div>
  )
}

// Connection type icons
const CONNECTION_ICONS: Record<string, React.ReactNode> = {
  openrouter: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
  openai: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364l2.0201-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/></svg>,
  anthropic: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.304 3h-3.513l6.21 18h3.513l-6.21-18zM6.696 3H3.183l6.21 18h3.513L6.696 3z"/></svg>,
  google: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>,
  local: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1" fill="currentColor"/><circle cx="6" cy="18" r="1" fill="currentColor"/></svg>,
  custom: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
}

// Provider presets
type ProviderPreset = 'openrouter' | 'openai' | 'custom'

const PROVIDER_PRESETS: { id: ProviderPreset; name: string; description: string; endpoint: string; recommended?: boolean }[] = [
  { id: 'openrouter', name: 'OpenRouter', description: 'Access 100+ models via single key', endpoint: OPENROUTER_ENDPOINT, recommended: true },
  { id: 'openai', name: 'OpenAI Direct', description: 'Direct OpenAI API connection', endpoint: 'https://api.openai.com/v1' },
  { id: 'custom', name: 'Custom / Local', description: 'Self-hosted or other providers', endpoint: '' },
]

// Universal Connection Manager with OpenRouter Gateway
function APIKeysSettings() {
  const { connections, addConnection, updateConnection, deleteConnection, verifyConnection, setConnectionModel, isVerifying } = useSettings()
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<ProviderPreset>('openrouter')
  const [formData, setFormData] = useState({ name: '', endpoint: '', apiKey: '' })
  const [fetchingModels, setFetchingModels] = useState<string | null>(null)
  const [modelError, setModelError] = useState<string | null>(null)

  // Get current provider preset
  const currentPreset = PROVIDER_PRESETS.find(p => p.id === selectedProvider)

  // Handle provider selection - auto-fill endpoint for presets
  const handleProviderChange = (providerId: ProviderPreset) => {
    setSelectedProvider(providerId)
    const preset = PROVIDER_PRESETS.find(p => p.id === providerId)
    if (preset && preset.endpoint) {
      setFormData(prev => ({
        ...prev,
        endpoint: preset.endpoint,
        name: preset.name === 'OpenRouter' ? 'OpenRouter Gateway' : prev.name
      }))
    } else {
      setFormData(prev => ({ ...prev, endpoint: '' }))
    }
    setModelError(null)
  }

  // Handle OpenRouter verification via server-side proxy (key never leaves server)
  const handleOpenRouterVerify = async (connectionId: string, apiKey: string) => {
    setFetchingModels(connectionId)
    setModelError(null)

    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      })

      const result = await res.json()

      if (!result.success) {
        setModelError(result.error || 'Verification failed')
        updateConnection(connectionId, { verified: false })
        return false
      }

      // Convert to cached models
      const cachedModels: CachedModel[] = (result.models || []).slice(0, 500).map((m: { id: string; name: string; context_length: number }) => ({
        id: m.id,
        name: m.name,
        contextLength: m.context_length
      }))

      // Update connection with models and mark verified
      updateConnection(connectionId, {
        verified: true,
        availableModels: cachedModels,
        selectedModel: cachedModels[0]?.id // Default to first model
      })

      return true
    } catch {
      setModelError('Network error')
      return false
    } finally {
      setFetchingModels(null)
    }
  }

  const handleAddConnection = async () => {
    if (!formData.apiKey) return

    const endpoint = selectedProvider === 'custom' ? formData.endpoint : (currentPreset?.endpoint || formData.endpoint)
    const name = formData.name || currentPreset?.name || 'Custom Connection'

    if (!endpoint) return

    const conn = await addConnection({
      name,
      endpoint,
      apiKey: formData.apiKey,
      type: selectedProvider === 'openrouter' ? 'openrouter' : selectedProvider === 'openai' ? 'openai' : 'custom',
    })

    // For OpenRouter, fetch models
    if (selectedProvider === 'openrouter') {
      await handleOpenRouterVerify(conn.id, formData.apiKey)
    } else {
      await verifyConnection(conn.id)
    }

    setFormData({ name: '', endpoint: '', apiKey: '' })
    setShowAddForm(false)
    setSelectedProvider('openrouter')
  }

  const handleUpdateConnection = async (id: string) => {
    const conn = connections.find(c => c.id === id)
    updateConnection(id, formData)

    if (conn?.type === 'openrouter') {
      await handleOpenRouterVerify(id, formData.apiKey)
    } else {
      await verifyConnection(id)
    }

    setEditingId(null)
    setFormData({ name: '', endpoint: '', apiKey: '' })
  }

  const startEditing = (conn: typeof connections[0]) => {
    setEditingId(conn.id)
    setFormData({ name: conn.name, endpoint: conn.endpoint, apiKey: conn.apiKey })
  }

  const truncateUrl = (url: string) => {
    try {
      const parsed = new URL(url)
      return parsed.hostname.length > 20 ? parsed.hostname.slice(0, 20) + '...' : parsed.hostname
    } catch {
      return url.slice(0, 25) + '...'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Secure Uplinks</h3>
        <p className="text-xs text-[var(--text-secondary)]">
          Configure AI model connections. OpenRouter recommended for multi-model access.
        </p>
      </div>

      {/* Active Connections List */}
      <div className="space-y-3">
        {connections.length === 0 && !showAddForm && (
          <div className="p-8 border border-dashed border-[var(--border-default)] rounded-xl text-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 text-[var(--text-tertiary)]">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
            <p className="text-sm text-[var(--text-secondary)] mb-1">No Sovereign Gateway Configured</p>
            <p className="text-xs text-[var(--text-tertiary)]">Add OpenRouter to access 100+ AI models</p>
          </div>
        )}

        {connections.map((conn) => (
          <div
            key={conn.id}
            className={`p-4 bg-[var(--bg-tertiary)] border rounded-xl ${
              conn.type === 'openrouter' && conn.verified
                ? 'border-[var(--brand-blue)]/30 shadow-[0_0_15px_-5px_rgba(0,200,255,0.2)]'
                : 'border-[var(--border-default)]'
            }`}
          >
            {editingId === conn.id ? (
              /* Edit Mode */
              <div className="space-y-3">
                <input
                  id="edit-conn-name"
                  name="edit-conn-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Connection Name"
                  className="w-full px-3 py-2 bg-[var(--bg-primary)]/50 border border-[var(--border-default)]/50 rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--brand-blue)]"
                />
                <input
                  id="edit-conn-endpoint"
                  name="edit-conn-endpoint"
                  type="text"
                  value={formData.endpoint}
                  onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                  placeholder="Endpoint URL"
                  disabled={conn.type === 'openrouter'}
                  className="w-full px-3 py-2 bg-[var(--bg-primary)]/50 border border-[var(--border-default)]/50 rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--brand-blue)] disabled:opacity-50"
                />
                <input
                  id="edit-conn-apikey"
                  name="edit-conn-apikey"
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="API Key"
                  className="w-full px-3 py-2 bg-[var(--bg-primary)]/50 border border-[var(--border-default)]/50 rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--brand-blue)]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdateConnection(conn.id)}
                    disabled={isVerifying === conn.id || fetchingModels === conn.id}
                    className="flex-1 px-4 py-2 bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-[var(--text-primary)] text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {(isVerifying === conn.id || fetchingModels === conn.id) ? (
                      <>
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        {conn.type === 'openrouter' ? 'Fetching Models...' : 'Testing...'}
                      </>
                    ) : conn.type === 'openrouter' ? 'Test & Fetch Models' : 'Test & Save'}
                  </button>
                  <button
                    onClick={() => { setEditingId(null); setFormData({ name: '', endpoint: '', apiKey: '' }) }}
                    className="px-4 py-2 bg-[var(--bg-tertiary)]hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-sm rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* View Mode */
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {/* Icon */}
                  <div className={`p-2.5 rounded-lg ${
                    conn.type === 'openrouter'
                      ? 'bg-gradient-to-br from-[var(--brand-blue)]/20 to-[var(--brand-blue)]/10 text-[var(--brand-blue)]'
                      : 'bg-[var(--bg-elevated)]/30 text-[var(--text-secondary)]'
                  }`}>
                    {CONNECTION_ICONS[conn.type] || CONNECTION_ICONS.custom}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{conn.name}</p>
                      {conn.verified ? (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-[var(--success)]/15 text-[var(--success)] rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                          {conn.type === 'openrouter' ? `${conn.availableModels?.length || 0} models` : 'Verified'}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 bg-[var(--warning)]/10 text-[var(--warning)] rounded-full">Unverified</span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-tertiary)] truncate">{truncateUrl(conn.endpoint)}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => conn.type === 'openrouter' ? handleOpenRouterVerify(conn.id, conn.apiKey) : verifyConnection(conn.id)}
                      disabled={isVerifying === conn.id || fetchingModels === conn.id}
                      className="p-2 text-[var(--text-secondary)] hover:text-[var(--brand-blue)] hover:bg-[var(--bg-elevated)]/30 rounded-lg transition-colors"
                      title={conn.type === 'openrouter' ? 'Refresh Models' : 'Verify'}
                    >
                      {(isVerifying === conn.id || fetchingModels === conn.id) ? (
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                      )}
                    </button>
                    <button
                      onClick={() => startEditing(conn)}
                      className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/30 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button
                      onClick={() => deleteConnection(conn.id)}
                      className="p-2 text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                </div>

                {/* Model Selector for OpenRouter */}
                {conn.type === 'openrouter' && conn.verified && conn.availableModels && conn.availableModels.length > 0 && (
                  <div className="pt-3 border-t border-[var(--border-subtle)]">
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">Active Model</label>
                    <select
                      id={`conn-model-${conn.id}`}
                      name={`conn-model-${conn.id}`}
                      value={conn.selectedModel || ''}
                      onChange={(e) => setConnectionModel(conn.id, e.target.value)}
                      className="w-full px-3 py-2.5 bg-[var(--bg-primary)]/50 border border-[var(--border-default)]/50 rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-blue)] appearance-none cursor-pointer"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                    >
                      {conn.availableModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name} ({Math.round(model.contextLength / 1000)}K context)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Connection Form */}
      {showAddForm ? (
        <div className="p-4 bg-[var(--bg-tertiary)] border border-[var(--brand-blue)]/30 rounded-xl space-y-4">
          <p className="text-sm font-medium text-[var(--text-primary)]">New Gateway Connection</p>

          {/* Provider Selection */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">Provider</label>
            <div className="grid grid-cols-3 gap-2">
              {PROVIDER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleProviderChange(preset.id)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    selectedProvider === preset.id
                      ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/10 shadow-[0_0_15px_-5px_var(--brand-blue)]'
                      : 'border-[var(--border-default)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={selectedProvider === preset.id ? 'text-[var(--brand-blue)]' : 'text-[var(--text-secondary)]'}>
                      {CONNECTION_ICONS[preset.id] || CONNECTION_ICONS.custom}
                    </span>
                    <span className={`text-sm font-medium ${selectedProvider === preset.id ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                      {preset.name}
                    </span>
                    {preset.recommended && (
                      <span className="ml-auto text-[9px] px-1.5 py-0.5 bg-[var(--brand-blue)]/20 text-[var(--brand-blue)] rounded font-medium">REC</span>
                    )}
                  </div>
                  <p className="text-[10px] text-[var(--text-tertiary)]">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Connection Name (for custom) */}
          {selectedProvider === 'custom' && (
            <input
              id="add-conn-name"
              name="add-conn-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Connection Name"
              className="w-full px-3 py-2.5 bg-[var(--bg-primary)]/50 border border-[var(--border-default)]/50 rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--brand-blue)]"
            />
          )}

          {/* Endpoint URL */}
          <div>
            <label htmlFor="add-conn-endpoint" className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Endpoint URL</label>
            <input
              id="add-conn-endpoint"
              name="add-conn-endpoint"
              type="text"
              value={selectedProvider === 'custom' ? formData.endpoint : (currentPreset?.endpoint || '')}
              onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
              placeholder="https://api.example.com/v1"
              disabled={selectedProvider !== 'custom'}
              className="w-full px-3 py-2.5 bg-[var(--bg-primary)]/50 border border-[var(--border-default)]/50 rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--brand-blue)] disabled:opacity-60 disabled:cursor-not-allowed"
            />
            {selectedProvider !== 'custom' && (
              <p className="text-[10px] text-[var(--text-tertiary)] mt-1 flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Endpoint locked for {currentPreset?.name}
              </p>
            )}
          </div>

          {/* API Key */}
          <div>
            <label htmlFor="add-conn-apikey" className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">API Key</label>
            <input
              id="add-conn-apikey"
              name="add-conn-apikey"
              type="password"
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              placeholder={selectedProvider === 'openrouter' ? 'sk-or-v1-...' : 'sk-...'}
              className="w-full px-3 py-2.5 bg-[var(--bg-primary)]/50 border border-[var(--border-default)]/50 rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--brand-blue)]"
            />
          </div>

          {/* Error Message */}
          {modelError && (
            <div className="p-3 bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-lg text-sm text-[var(--danger)]">
              {modelError}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAddConnection}
              disabled={!formData.apiKey || (selectedProvider === 'custom' && !formData.endpoint) || isVerifying !== null || fetchingModels !== null}
              className="flex-1 px-4 py-2.5 bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-primary)] text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {(isVerifying || fetchingModels) ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {selectedProvider === 'openrouter' ? 'Connecting & Fetching Models...' : 'Testing Connection...'}
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  {selectedProvider === 'openrouter' ? 'Test & Fetch Models' : 'Test & Save'}
                </>
              )}
            </button>
            <button
              onClick={() => { setShowAddForm(false); setFormData({ name: '', endpoint: '', apiKey: '' }); setModelError(null) }}
              className="px-4 py-2.5 bg-[var(--bg-tertiary)]hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-sm rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full py-3 px-4 border border-dashed border-[var(--border-default)] hover:border-[var(--brand-blue)]/50 text-[var(--text-secondary)] hover:text-[var(--brand-blue)] rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Open New Gateway
        </button>
      )}
    </div>
  )
}

// ============================================================================
// APPEARANCE SETTINGS — Theme thumbnails + Density (merged)
// ============================================================================

// Mini SVG dashboard preview for each theme
function ThemeThumbnail({ bg, accent }: { bg: string; accent: string }) {
  return (
    <svg viewBox="0 0 200 120" className="w-full rounded-lg overflow-hidden" aria-hidden="true">
      {/* Background */}
      <rect width="200" height="120" fill={bg} />
      {/* Sidebar rail */}
      <rect x="0" y="0" width="4" height="120" fill={accent} opacity="0.8" />
      <rect x="4" y="0" width="36" height="120" fill={accent} opacity="0.08" />
      {/* Sidebar icons */}
      <circle cx="22" cy="20" r="4" fill={accent} opacity="0.4" />
      <circle cx="22" cy="36" r="4" fill={accent} opacity="0.25" />
      <circle cx="22" cy="52" r="4" fill={accent} opacity="0.25" />
      {/* Header bar */}
      <rect x="40" y="0" width="160" height="16" fill={accent} opacity="0.06" />
      <rect x="40" y="16" width="160" height="1" fill={accent} opacity="0.15" />
      {/* Header text placeholder */}
      <rect x="48" y="5" width="40" height="6" rx="2" fill={accent} opacity="0.2" />
      {/* Center content area */}
      <rect x="50" y="30" width="70" height="6" rx="2" fill={accent} opacity="0.15" />
      <rect x="50" y="42" width="55" height="4" rx="1.5" fill={accent} opacity="0.08" />
      <rect x="50" y="50" width="62" height="4" rx="1.5" fill={accent} opacity="0.08" />
      {/* Chat message bubble */}
      <rect x="50" y="64" width="50" height="14" rx="4" fill={accent} opacity="0.12" />
      <rect x="55" y="69" width="30" height="3" rx="1" fill={accent} opacity="0.2" />
      {/* Right panel outline (Mercury) */}
      <rect x="148" y="17" width="52" height="103" fill={accent} opacity="0.04" />
      <rect x="148" y="17" width="1" height="103" fill={accent} opacity="0.15" />
      {/* Right panel header */}
      <rect x="155" y="24" width="28" height="4" rx="1.5" fill={accent} opacity="0.18" />
      {/* Right panel message lines */}
      <rect x="155" y="36" width="36" height="3" rx="1" fill={accent} opacity="0.1" />
      <rect x="155" y="44" width="28" height="3" rx="1" fill={accent} opacity="0.1" />
      {/* Input bar at bottom */}
      <rect x="50" y="90" width="88" height="18" rx="9" fill={accent} opacity="0.08" />
      <rect x="60" y="96" width="40" height="4" rx="2" fill={accent} opacity="0.12" />
    </svg>
  )
}

function AppearanceSettings() {
  const { theme, setTheme, density, setDensity } = useSettings()

  const themes: {
    id: 'cobalt' | 'noir' | 'forest' | 'obsidian'
    name: string
    subtitle: string
    description: string
    bg: string
    accent: string
  }[] = [
    { id: 'cobalt', name: 'Midnight Cobalt', subtitle: 'Default sovereign blue', description: 'Best for extended sessions', bg: '#0B1120', accent: '#2563EB' },
    { id: 'noir', name: 'Cyber Noir', subtitle: 'OLED black, neon cyan', description: 'Maximum contrast, minimal glare', bg: '#000000', accent: '#06B6D4' },
    { id: 'forest', name: 'Forest Dark', subtitle: 'Military field dark', description: 'Low visibility environments', bg: '#0A1F0A', accent: '#22C55E' },
    { id: 'obsidian', name: 'Obsidian Gold', subtitle: 'Executive luxury', description: 'Premium client-facing mode', bg: '#0B1120', accent: '#D4A843' },
  ]

  const densityOptions: { id: DensityId; label: string; description: string }[] = [
    { id: 'compact', label: 'Compact', description: 'Tighter spacing, more content visible' },
    { id: 'comfortable', label: 'Comfortable', description: 'Standard spacing, easier reading' },
  ]

  return (
    <div className="space-y-8">
      {/* ── Theme Section ── */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Theme</h3>
        <p className="text-xs text-[var(--text-tertiary)] mb-4">
          Select your operational environment.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {themes.map((t) => {
            const isSelected = theme === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`relative text-left rounded-xl border-2 overflow-hidden transition-all duration-300 ${
                  isSelected
                    ? 'border-[var(--brand-blue)] shadow-[0_0_20px_-5px_var(--brand-blue)]'
                    : 'border-[var(--border-default)] hover:border-[var(--border-strong)]'
                }`}
              >
                {/* Checkmark badge */}
                {isSelected && (
                  <div
                    className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: t.accent }}
                  >
                    <Check className="w-3 h-3 text-black" />
                  </div>
                )}

                {/* SVG thumbnail */}
                <ThemeThumbnail bg={t.bg} accent={t.accent} />

                {/* Info */}
                <div className="px-3 py-2.5">
                  <p className={`text-sm font-semibold mb-0.5 ${isSelected ? 'text-[var(--brand-blue)]' : 'text-[var(--text-primary)]'}`}>
                    {t.name}
                  </p>
                  <p className="text-[10px] text-[var(--text-tertiary)] leading-tight">{t.subtitle}</p>
                  <p className="text-[10px] text-[var(--text-tertiary)] leading-tight mt-0.5 italic">{t.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-[var(--border-subtle)]" />

      {/* ── Density Section ── */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Display Density</h3>
        <p className="text-xs text-[var(--text-tertiary)] mb-4">
          Adjust the spacing and size of interface elements.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {densityOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setDensity(option.id)}
              className={`p-4 rounded-xl border-2 transition-all ${
                density === option.id
                  ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/10 shadow-[0_0_15px_-5px_var(--brand-blue)]'
                  : 'border-[var(--border-default)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]/30'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg mb-3 flex items-center justify-center ${
                density === option.id ? 'bg-[var(--brand-blue)]/20' : 'bg-[var(--bg-elevated)]/30'
              }`}>
                <LayoutGrid className={`w-5 h-5 ${density === option.id ? 'text-[var(--brand-blue)]' : 'text-[var(--text-secondary)]'}`} />
              </div>
              <p className={`text-sm font-semibold mb-1 ${density === option.id ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                {option.label}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">{option.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Notification Settings Tab
function NotificationSettings() {
  const { notifications, setNotification } = useSettings()

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Notification Preferences</h3>
        <p className="text-xs text-[var(--text-secondary)] mb-4">
          Configure how you receive notifications.
        </p>
      </div>

      <div className="space-y-4">
        <ToggleSetting
          label="Email Notifications"
          description="Receive updates about document processing"
          enabled={notifications.email}
          onToggle={() => setNotification('email', !notifications.email)}
        />
        <ToggleSetting
          label="Push Notifications"
          description="Browser push notifications for real-time alerts"
          enabled={notifications.push}
          onToggle={() => setNotification('push', !notifications.push)}
        />
        <ToggleSetting
          label="Audit Trail Alerts"
          description="Get notified when privileged documents are accessed"
          enabled={notifications.audit}
          onToggle={() => setNotification('audit', !notifications.audit)}
        />
      </div>
    </div>
  )
}

// Toggle Setting Component
function ToggleSetting({
  label,
  description,
  enabled,
  onToggle,
}: {
  label: string
  description: string
  enabled: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-[var(--bg-elevated)]/30 border border-[var(--border-default)] rounded-lg">
      <div>
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        <p className="text-xs text-[var(--text-secondary)]">{description}</p>
      </div>
      <button
        onClick={onToggle}
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        className={`w-11 h-6 rounded-full transition-colors ${
          enabled ? 'bg-[var(--brand-blue)]' : 'bg-[var(--bg-tertiary)]'
        }`}
      >
        <div
          className={`w-5 h-5 bg-white rounded-full transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}
