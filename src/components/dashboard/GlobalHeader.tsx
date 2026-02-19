'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import { useSession, signOut } from 'next-auth/react'
import { usePrivilegeStore } from '@/stores/privilegeStore'
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
  Mic,
  Monitor,
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
} from 'lucide-react'
import { PrivilegeKeyIcon, IdentityIcon, LanternIcon } from './icons/SovereignIcons'
import { useMercuryStore } from '@/stores/mercuryStore'
import { PERSONAS } from './mercury/personaData'
import { useSettings, type CachedModel, LANGUAGES, type LanguageId, type DensityId } from '@/contexts/SettingsContext'
import { getModelDisplayName, OPENROUTER_ENDPOINT } from '@/services/OpenRouterService'
import { AIModelSettings } from './settings/AIModelSettings'

// Profile types for multi-profile switching
interface Profile {
  id: string
  name: string
  type: 'work' | 'personal' | 'consultant'
  icon: React.ReactNode
  color: string
}

const PROFILES: Profile[] = [
  { id: 'work', name: 'Work Profile', type: 'work', icon: <Briefcase className="w-4 h-4" />, color: 'text-blue-400' },
  { id: 'personal', name: 'Personal Vault', type: 'personal', icon: <User className="w-4 h-4" />, color: 'text-emerald-400' },
  { id: 'consultant', name: 'Consultant Mode', type: 'consultant', icon: <Users className="w-4 h-4" />, color: 'text-purple-400' },
]

export function GlobalHeader() {
  const { data: session } = useSession()
  const { isEnabled: privilegeMode, toggle: togglePrivilege } = usePrivilegeStore()
  const activePersona = useMercuryStore((s) => s.activePersona)
  const setPersona = useMercuryStore((s) => s.setPersona)
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [activeProfile, setActiveProfile] = useState<string>('work')
  const [settingsOpen, setSettingsOpen] = useState(false)
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
        className={`shrink-0 relative flex items-center justify-between px-4 border-b border-[var(--border-default)] border-t border-t-white/10 bg-[var(--bg-secondary)] transition-opacity duration-300 ${
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

          {/* Privilege Badge */}
          {privilegeMode && (
            <div className="privilege-badge flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--privilege-bg)] border border-[var(--privilege-border)] text-[var(--privilege-color)] animate-pulse">
              <PrivilegeKeyIcon size={14} color="#FFAB00" />
              <span className="text-xs font-semibold uppercase tracking-wide">Privileged</span>
            </div>
          )}

          {/* Active Profile Indicator */}
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10 ${currentProfile.color}`}>
            {currentProfile.icon}
            <span className="text-xs font-medium">{currentProfile.name}</span>
          </div>

          {/* Active Model Badge */}
          <ActiveModelBadge />
        </div>

        {/* Center Section - Search (Absolutely Centered) */}
        <div className="absolute left-1/2 -translate-x-1/2">
          {searchOpen ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[var(--brand-blue)] bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors" style={{ minWidth: 320 }}>
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
          <div className="relative" ref={personaMenuRef}>
            <button
              onClick={() => setPersonaMenuOpen(!personaMenuOpen)}
              aria-label={`Select persona: ${currentPersona.label}`}
              aria-expanded={personaMenuOpen}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300
                ${isWhistleblowerMode
                  ? 'bg-amber-900/30 border border-amber-500/50 text-amber-400 hover:bg-amber-900/50 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                  : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20'
                }
              `}
            >
              {isWhistleblowerMode ? (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              ) : (
                <Glasses className="w-4 h-4" />
              )}
              <CurrentPersonaIcon
                size={16}
                color={isWhistleblowerMode ? '#FBBF24' : '#94a3b8'}
              />
              <span className="hidden lg:inline text-xs">{currentPersona.label}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${personaMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Persona Dropdown */}
            {personaMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-[#0B1221]/98 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 py-2 overflow-hidden">
                {/* System Prompt Preview (on hover) */}
                {hoveredPersona && (
                  <div className="px-4 py-3 bg-slate-900/80 border-b border-white/10">
                    <p className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider mb-1">
                      System Instruction
                    </p>
                    <p className="text-xs text-slate-400 italic">
                      &quot;{PERSONAS.find(p => p.id === hoveredPersona)?.systemPrompt}&quot;
                    </p>
                  </div>
                )}

                {/* Executive Section */}
                <div className="px-4 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-white/5">
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
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors ${
                        isSelected ? 'bg-cyan-500/10' : ''
                      }`}
                    >
                      <Icon
                        size={18}
                        color={isSelected ? '#22d3ee' : '#94a3b8'}
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${isSelected ? 'text-cyan-400' : 'text-slate-300'}`}>
                          {persona.label}
                        </div>
                        <div className="text-xs text-slate-500 truncate">{persona.description}</div>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-cyan-400" />
                      )}
                    </button>
                  )
                })}

                <div className="border-t border-white/5 my-1" />

                {/* Compliance Section */}
                <div className="px-4 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Compliance & Oversight
                </div>
                {compliancePersonas.map((persona) => {
                  const Icon = persona.Icon
                  const isSelected = persona.id === activePersona
                  const iconColor = persona.isWhistleblower
                    ? (isSelected ? '#FBBF24' : '#D97706')
                    : (isSelected ? '#22d3ee' : '#94a3b8')

                  return (
                    <button
                      key={persona.id}
                      onClick={() => { setPersona(persona.id as typeof activePersona); setPersonaMenuOpen(false); setHoveredPersona(null) }}
                      onMouseEnter={() => setHoveredPersona(persona.id)}
                      onMouseLeave={() => setHoveredPersona(null)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors ${
                        isSelected
                          ? persona.isWhistleblower
                            ? 'bg-amber-900/20'
                            : 'bg-cyan-500/10'
                          : ''
                      }`}
                    >
                      <Icon size={18} color={iconColor} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${
                            isSelected
                              ? persona.isWhistleblower ? 'text-amber-400' : 'text-cyan-400'
                              : persona.isWhistleblower ? 'text-amber-400/80' : 'text-slate-300'
                          }`}>
                            {persona.label}
                          </span>
                          {persona.isWhistleblower && (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          )}
                        </div>
                        <div className={`text-xs truncate ${persona.isWhistleblower ? 'text-amber-500/60' : 'text-slate-500'}`}>
                          {persona.description}
                        </div>
                      </div>
                      {isSelected && (
                        <Check className={persona.isWhistleblower ? 'w-4 h-4 text-amber-400' : 'w-4 h-4 text-cyan-400'} />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Privilege Toggle with Enhanced Tooltip */}
          <div className="relative group">
            <button
              onClick={() => togglePrivilege()}
              aria-label={privilegeMode ? 'Disable privilege mode' : 'Enable privilege mode'}
              aria-pressed={privilegeMode}
              className={`p-2 rounded-md transition-all duration-300 ${
                privilegeMode
                  ? 'text-amber-400 bg-amber-900/30 shadow-[0_0_15px_rgba(255,171,0,0.4)] animate-[pulse-glow_2s_ease-in-out_infinite]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              <PrivilegeKeyIcon size={20} color={privilegeMode ? '#FFAB00' : '#C0C0C0'} />
            </button>
            {/* Enhanced Tooltip */}
            <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-[#0B1221]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="flex items-center gap-2 mb-2">
                <PrivilegeKeyIcon size={16} color={privilegeMode ? '#FFAB00' : '#C0C0C0'} />
                <span className={`text-sm font-semibold ${privilegeMode ? 'text-amber-400' : 'text-slate-300'}`}>
                  {privilegeMode ? 'Privilege Mode Active' : 'Privilege Mode'}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Administrator Override: Bypass Standard Access Filters to view privileged documents.
              </p>
              <div className="mt-2 pt-2 border-t border-white/5 text-[10px] text-slate-500">
                {privilegeMode ? 'Click to disable' : 'Click to enable'}
              </div>
            </div>
          </div>

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
                currentProfile.type === 'work' ? 'bg-blue-900/50 border-blue-500/50 text-blue-300' :
                currentProfile.type === 'personal' ? 'bg-emerald-900/50 border-emerald-500/50 text-emerald-300' :
                'bg-purple-900/50 border-purple-500/50 text-purple-300'
              }`}>
                {userInitials}
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Profile Dropdown Menu */}
            {profileMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-[#0B1221]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                {/* User Info Header */}
                <div className="px-4 py-3 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-semibold ${
                      currentProfile.type === 'work' ? 'bg-blue-900/50 border-blue-500/50 text-blue-300' :
                      currentProfile.type === 'personal' ? 'bg-emerald-900/50 border-emerald-500/50 text-emerald-300' :
                      'bg-purple-900/50 border-purple-500/50 text-purple-300'
                    }`}>
                      {userInitials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{session?.user?.name || 'User'}</p>
                      <p className="text-xs text-slate-400 truncate">{session?.user?.email || 'user@example.com'}</p>
                    </div>
                  </div>
                </div>

                {/* Profile Switcher */}
                <div className="py-2">
                  <div className="px-4 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Switch Profile
                  </div>
                  {PROFILES.map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() => handleProfileSwitch(profile.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors ${
                        profile.id === activeProfile ? 'bg-white/5' : ''
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${
                        profile.type === 'work' ? 'bg-blue-900/30 text-blue-400' :
                        profile.type === 'personal' ? 'bg-emerald-900/30 text-emerald-400' :
                        'bg-purple-900/30 text-purple-400'
                      }`}>
                        {profile.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${profile.id === activeProfile ? profile.color : 'text-slate-300'}`}>
                          {profile.name}
                        </p>
                      </div>
                      {profile.id === activeProfile && (
                        <Check className={`w-4 h-4 ${profile.color}`} />
                      )}
                    </button>
                  ))}
                </div>

                {/* Divider */}
                <div className="border-t border-white/5" />

                {/* Quick Actions */}
                <div className="py-2">
                  <button
                    onClick={() => { setProfileMenuOpen(false); setSettingsOpen(true); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    <span className="text-sm">Settings</span>
                  </button>
                  <button
                    onClick={() => signOut()}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-red-400 hover:bg-red-500/10 transition-colors"
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
        <SettingsModal onClose={() => setSettingsOpen(false)} />
      )}

      {/* Profile Switch Overlay */}
      {isSwitching && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <IdentityIcon size={48} color="#60A5FA" className="animate-pulse" />
            <p className="text-white font-medium">Switching Profile...</p>
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
  | 'connections' | 'voice' | 'aimodel'  // Intelligence
  | 'appearance' | 'density'             // Interface
  | 'alerts' | 'security'                // System
  | 'docs' | 'report' | 'community'      // Support

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
      { id: 'voice', label: 'Voice', icon: <Mic className="w-4 h-4" /> },
      { id: 'aimodel', label: 'AI Model', icon: <Brain className="w-4 h-4" /> },
    ],
  },
  {
    id: 'interface',
    label: 'Interface',
    items: [
      { id: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
      { id: 'density', label: 'Density', icon: <LayoutGrid className="w-4 h-4" /> },
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
      { id: 'community', label: 'Community', icon: <Users className="w-4 h-4" /> },
    ],
  },
]

function SettingsModal({ onClose }: { onClose: () => void }) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('connections')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Modal - Wide layout */}
      <div className="relative w-full max-w-4xl mx-4 h-[80vh] max-h-[700px] bg-[#0B1221]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-lg">
              <Settings className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">System Control Panel</h2>
              <p className="text-xs text-slate-500">Sovereign Configuration Engine</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body - Sidebar + Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar */}
          <nav className="w-56 shrink-0 bg-[var(--bg-secondary)]/50 border-r border-white/10 overflow-y-auto py-4" aria-label="Settings navigation">
            {SIDEBAR_CATEGORIES.map((category) => (
              <div key={category.id} className="mb-4">
                <div className="px-4 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  {category.label}
                </div>
                {category.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all ${
                      activeSection === item.id
                        ? 'text-[var(--brand-blue)] bg-[var(--brand-blue)]/10 border-r-2 border-[var(--brand-blue)]'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
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
          <div className="flex-1 overflow-y-auto p-6">
            {activeSection === 'profile' && <ProfileSettings />}
            {activeSection === 'language' && <LanguageSettings />}
            {activeSection === 'billing' && <BillingSettings />}
            {activeSection === 'connections' && <APIKeysSettings />}
            {activeSection === 'voice' && <VoiceSettings />}
            {activeSection === 'aimodel' && <AIModelSettings />}
            {activeSection === 'appearance' && <ThemeSettings />}
            {activeSection === 'density' && <DensitySettings />}
            {activeSection === 'alerts' && <NotificationSettings />}
            {activeSection === 'security' && <SecuritySettings />}
            {activeSection === 'docs' && <DocumentationSettings />}
            {activeSection === 'report' && <ReportIssueSettings />}
            {activeSection === 'community' && <CommunitySettings />}
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
  const { data: session } = useSession()
  const userInitials = session?.user?.name
    ? session.user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Profile"
        description="Manage your identity and organizational role"
      />

      <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/30 border-2 border-cyan-500/50 flex items-center justify-center text-xl font-semibold text-white">
            {userInitials}
          </div>
          <div className="flex-1">
            <p className="text-lg font-semibold text-white">{session?.user?.name || 'Sovereign User'}</p>
            <p className="text-sm text-slate-400">{session?.user?.email || 'user@example.com'}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full font-medium">
                ADMINISTRATOR
              </span>
            </div>
          </div>
          <button className="px-4 py-2 text-sm text-slate-300 hover:text-white border border-white/20 hover:border-white/40 rounded-lg transition-colors" aria-label="Edit profile">
            Edit Profile
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
          <p className="text-xs text-slate-500 mb-1">Organization</p>
          <p className="text-sm font-medium text-white">RAGbox Enterprise</p>
        </div>
        <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
          <p className="text-xs text-slate-500 mb-1">Role</p>
          <p className="text-sm font-medium text-white">Sovereign Administrator</p>
        </div>
      </div>
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
                : 'border-white/10 hover:border-white/30 hover:bg-white/5'
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-semibold ${
              language === id ? 'bg-[var(--brand-blue)]/20 text-[var(--brand-blue)]' : 'bg-white/5 text-slate-400'
            }`}>
              {lang.nativeName.charAt(0)}
            </div>
            <div className="flex-1 text-left">
              <p className={`text-sm font-medium ${language === id ? 'text-white' : 'text-slate-300'}`}>
                {lang.name}
              </p>
              <p className="text-xs text-slate-500">{lang.nativeName}</p>
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

  const planLabels = {
    free: 'Free Tier',
    professional: 'Professional',
    enterprise: 'Sovereign Enterprise',
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Plan & Usage"
        description="Monitor your subscription and resource consumption"
      />

      {/* Current Plan Card */}
      <div className="p-6 bg-gradient-to-br from-cyan-900/20 to-blue-900/20 border border-cyan-500/30 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-cyan-400 font-medium mb-1">CURRENT PLAN</p>
            <p className="text-xl font-bold text-white">{planLabels[subscription.plan]}</p>
          </div>
          <div className="p-3 bg-cyan-500/20 rounded-xl">
            <Zap className="w-6 h-6 text-cyan-400" />
          </div>
        </div>

        {/* Token Usage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Tokens Used</span>
            <span className="text-white font-medium">
              {(subscription.tokensUsed / 1000000).toFixed(2)}M / {(subscription.tokensLimit / 1000000).toFixed(0)}M
            </span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all"
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">
            Renews on {new Date(subscription.renewalDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Manage Subscription */}
      <button className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/10 hover:border-white/30 rounded-xl transition-colors group" aria-label="Manage subscription">
        <div className="flex items-center gap-3">
          <CreditCard className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
          <div className="text-left">
            <p className="text-sm font-medium text-white">Manage Subscription</p>
            <p className="text-xs text-slate-500">Update payment method, view invoices</p>
          </div>
        </div>
        <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
      </button>
    </div>
  )
}

// ============================================================================
// INTELLIGENCE SECTION COMPONENTS
// ============================================================================

function VoiceSettings() {
  const { voice, updateVoice } = useSettings()

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Voice Configuration"
        description="Configure Inworld AI voice interface and speech recognition"
      />

      <div className="space-y-4">
        <ToggleSetting
          label="Voice Input Enabled"
          description="Enable microphone input for voice commands"
          enabled={voice.enabled}
          onToggle={() => updateVoice({ enabled: !voice.enabled })}
        />

        <ToggleSetting
          label="Auto-Submit on Silence"
          description="Automatically send message after silence detection"
          enabled={voice.autoSubmit}
          onToggle={() => updateVoice({ autoSubmit: !voice.autoSubmit })}
        />

        {/* Silence Threshold Slider */}
        <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-white">Silence Threshold</p>
              <p className="text-xs text-slate-400">Time before auto-submit triggers</p>
            </div>
            <span className="text-sm font-mono text-cyan-400">{voice.silenceThreshold}ms</span>
          </div>
          <input
            id="silence-threshold"
            name="silence-threshold"
            type="range"
            min="1000"
            max="5000"
            step="500"
            value={voice.silenceThreshold}
            onChange={(e) => updateVoice({ silenceThreshold: parseInt(e.target.value) })}
            aria-label="Silence threshold"
            className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>1s (Fast)</span>
            <span>5s (Slow)</span>
          </div>
        </div>
      </div>

      {/* Inworld Status */}
      <div className="p-4 bg-emerald-900/20 border border-emerald-500/30 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <div>
            <p className="text-sm font-medium text-emerald-400">Inworld AI Connected</p>
            <p className="text-xs text-slate-500">Voice: mercury_professional</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// INTERFACE SECTION COMPONENTS
// ============================================================================

function DensitySettings() {
  const { density, setDensity } = useSettings()

  const densityOptions: { id: DensityId; label: string; description: string }[] = [
    { id: 'compact', label: 'Compact', description: 'Tighter spacing, more content visible' },
    { id: 'comfortable', label: 'Comfortable', description: 'Standard spacing, easier reading' },
  ]

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Display Density"
        description="Adjust the spacing and size of interface elements"
      />

      <div className="grid grid-cols-2 gap-4">
        {densityOptions.map((option) => (
          <button
            key={option.id}
            onClick={() => setDensity(option.id)}
            className={`p-4 rounded-xl border-2 transition-all ${
              density === option.id
                ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/10 shadow-[0_0_15px_-5px_var(--brand-blue)]'
                : 'border-white/10 hover:border-white/30 hover:bg-white/5'
            }`}
          >
            <div className={`w-10 h-10 rounded-lg mb-3 flex items-center justify-center ${
              density === option.id ? 'bg-[var(--brand-blue)]/20' : 'bg-white/5'
            }`}>
              <LayoutGrid className={`w-5 h-5 ${density === option.id ? 'text-[var(--brand-blue)]' : 'text-slate-400'}`} />
            </div>
            <p className={`text-sm font-semibold mb-1 ${density === option.id ? 'text-white' : 'text-slate-300'}`}>
              {option.label}
            </p>
            <p className="text-xs text-slate-500">{option.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// SYSTEM SECTION COMPONENTS
// ============================================================================

function SecuritySettings() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Security"
        description="Manage sessions, access controls, and security policies"
      />

      {/* Active Sessions */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Active Sessions</p>

        <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <Monitor className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white">Current Session</p>
                <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">Active</span>
              </div>
              <p className="text-xs text-slate-500">Windows · Chrome · Started 2 hours ago</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white/5 border border-white/10 rounded-lg opacity-60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-700 rounded-lg">
              <Monitor className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-300">MacBook Pro</p>
              <p className="text-xs text-slate-500">macOS · Safari · Last active yesterday</p>
            </div>
            <button className="text-xs text-red-400 hover:text-red-300 transition-colors" aria-label="Revoke session">
              Revoke
            </button>
          </div>
        </div>
      </div>

      {/* Security Actions */}
      <div className="space-y-3">
        <button className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/10 hover:border-white/30 rounded-lg transition-colors group" aria-label="Two-factor authentication settings">
          <div className="flex items-center gap-3">
            <Shield className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-300 group-hover:text-white">Two-Factor Authentication</span>
          </div>
          <span className="text-xs text-emerald-400">Enabled</span>
        </button>

        <button className="w-full flex items-center justify-between p-4 bg-red-500/10 border border-red-500/30 hover:border-red-500/50 rounded-lg transition-colors" aria-label="Sign out all devices">
          <div className="flex items-center gap-3">
            <LogOut className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-400">Sign Out All Devices</span>
          </div>
          <ChevronRight className="w-4 h-4 text-red-400" />
        </button>
      </div>
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
    { title: 'Getting Started', description: 'Quick start guide for new users', href: '#' },
    { title: 'API Reference', description: 'Complete API documentation', href: '#' },
    { title: 'Security & Compliance', description: 'SOC 2, HIPAA, and security practices', href: '#' },
    { title: 'Best Practices', description: 'Optimize your RAG workflows', href: '#' },
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
            className="flex items-center justify-between p-4 bg-white/5 border border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/5 rounded-xl transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-800 group-hover:bg-cyan-500/20 rounded-lg transition-colors">
                <span className="text-slate-400 group-hover:text-cyan-400 transition-colors">
                  {doc.icon}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-white group-hover:text-cyan-400 transition-colors">{doc.title}</p>
                <p className="text-xs text-slate-500">{doc.description}</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
          </a>
        ))}
      </div>
    </div>
  )
}

function ReportIssueSettings() {
  const [issueType, setIssueType] = useState<'bug' | 'feature' | 'question'>('bug')
  const [description, setDescription] = useState('')

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Report Issue"
        description="Submit a bug report or request a feature"
      />

      {/* Issue Type */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-2">Issue Type</label>
        <div className="grid grid-cols-3 gap-2">
          {(['bug', 'feature', 'question'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setIssueType(type)}
              className={`p-3 rounded-lg border text-sm font-medium capitalize transition-all ${
                issueType === type
                  ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/10 text-[var(--brand-blue)]'
                  : 'border-white/10 text-slate-400 hover:border-white/30 hover:text-white'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="bug-description" className="block text-xs font-medium text-slate-400 mb-2">Description</label>
        <textarea
          id="bug-description"
          name="bug-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue or feature request in detail..."
          rows={5}
          className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[var(--brand-blue)] resize-none"
        />
      </div>

      <button
        disabled={!description.trim()}
        className="w-full py-3 px-4 bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
      >
        Submit Report
      </button>
    </div>
  )
}

function CommunitySettings() {
  const links = [
    { title: 'Discord Community', description: 'Join The Syndicate for real-time support', icon: <Users className="w-5 h-5" />, href: '#' },
    { title: 'GitHub Discussions', description: 'Participate in open-source discussions', icon: <MessageSquare className="w-5 h-5" />, href: '#' },
    { title: 'Twitter/X', description: 'Follow for updates and announcements', icon: <ExternalLink className="w-5 h-5" />, href: '#' },
  ]

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Community"
        description="Connect with other RAGbox users and contributors"
      />

      <div className="space-y-3">
        {links.map((link) => (
          <a
            key={link.title}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 hover:border-cyan-500/30 rounded-xl transition-all group"
          >
            <div className="p-3 bg-slate-800 group-hover:bg-cyan-500/20 rounded-xl transition-colors">
              <span className="text-slate-400 group-hover:text-cyan-400 transition-colors">
                {link.icon}
              </span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white group-hover:text-cyan-400 transition-colors">
                {link.title}
              </p>
              <p className="text-xs text-slate-500">{link.description}</p>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
          </a>
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
      <h3 className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-slate-200 to-slate-400">
        {title}
      </h3>
      <p className="text-sm text-slate-500 mt-1">{description}</p>
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
        ? 'bg-gradient-to-r from-amber-900/30 to-orange-900/30 border border-amber-500/30'
        : 'bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border border-cyan-500/30'
      }
    `}>
      {isNative ? (
        // Aegis Shield Icon
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      ) : (
        // Other model icon
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-400">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      )}
      <span className={`text-xs font-medium ${isNative ? 'text-amber-400' : 'text-cyan-400'}`}>
        M.E.R.C.U.R.Y.
      </span>
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
      const cachedModels: CachedModel[] = (result.models || []).slice(0, 50).map((m: { id: string; name: string; context_length: number }) => ({
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
        <h3 className="text-sm font-semibold text-white mb-1">Secure Uplinks</h3>
        <p className="text-xs text-slate-400">
          Configure AI model connections. OpenRouter recommended for multi-model access.
        </p>
      </div>

      {/* Active Connections List */}
      <div className="space-y-3">
        {connections.length === 0 && !showAddForm && (
          <div className="p-8 border border-dashed border-slate-700 rounded-xl text-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 text-slate-600">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
            <p className="text-sm text-slate-400 mb-1">No Sovereign Gateway Configured</p>
            <p className="text-xs text-slate-500">Add OpenRouter to access 100+ AI models</p>
          </div>
        )}

        {connections.map((conn) => (
          <div
            key={conn.id}
            className={`p-4 bg-[var(--bg-tertiary)] border rounded-xl ${
              conn.type === 'openrouter' && conn.verified
                ? 'border-cyan-500/30 shadow-[0_0_15px_-5px_rgba(0,200,255,0.2)]'
                : 'border-white/10'
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
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[var(--brand-blue)]"
                />
                <input
                  id="edit-conn-endpoint"
                  name="edit-conn-endpoint"
                  type="text"
                  value={formData.endpoint}
                  onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                  placeholder="Endpoint URL"
                  disabled={conn.type === 'openrouter'}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[var(--brand-blue)] disabled:opacity-50"
                />
                <input
                  id="edit-conn-apikey"
                  name="edit-conn-apikey"
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="API Key"
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[var(--brand-blue)]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdateConnection(conn.id)}
                    disabled={isVerifying === conn.id || fetchingModels === conn.id}
                    className="flex-1 px-4 py-2 bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
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
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors"
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
                      ? 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-cyan-400'
                      : 'bg-white/5 text-slate-400'
                  }`}>
                    {CONNECTION_ICONS[conn.type] || CONNECTION_ICONS.custom}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">{conn.name}</p>
                      {conn.verified ? (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-emerald-900/30 text-emerald-400 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          {conn.type === 'openrouter' ? `${conn.availableModels?.length || 0} models` : 'Verified'}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 bg-amber-900/30 text-amber-400 rounded-full">Unverified</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{truncateUrl(conn.endpoint)}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => conn.type === 'openrouter' ? handleOpenRouterVerify(conn.id, conn.apiKey) : verifyConnection(conn.id)}
                      disabled={isVerifying === conn.id || fetchingModels === conn.id}
                      className="p-2 text-slate-400 hover:text-[var(--brand-blue)] hover:bg-white/5 rounded-lg transition-colors"
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
                      className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button
                      onClick={() => deleteConnection(conn.id)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                </div>

                {/* Model Selector for OpenRouter */}
                {conn.type === 'openrouter' && conn.verified && conn.availableModels && conn.availableModels.length > 0 && (
                  <div className="pt-3 border-t border-white/5">
                    <label className="block text-xs font-medium text-slate-400 mb-2">Active Model</label>
                    <select
                      id={`conn-model-${conn.id}`}
                      name={`conn-model-${conn.id}`}
                      value={conn.selectedModel || ''}
                      onChange={(e) => setConnectionModel(conn.id, e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer"
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
          <p className="text-sm font-medium text-white">New Gateway Connection</p>

          {/* Provider Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Provider</label>
            <div className="grid grid-cols-3 gap-2">
              {PROVIDER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleProviderChange(preset.id)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    selectedProvider === preset.id
                      ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/10 shadow-[0_0_15px_-5px_var(--brand-blue)]'
                      : 'border-white/10 hover:border-white/30 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={selectedProvider === preset.id ? 'text-[var(--brand-blue)]' : 'text-slate-400'}>
                      {CONNECTION_ICONS[preset.id] || CONNECTION_ICONS.custom}
                    </span>
                    <span className={`text-sm font-medium ${selectedProvider === preset.id ? 'text-white' : 'text-slate-300'}`}>
                      {preset.name}
                    </span>
                    {preset.recommended && (
                      <span className="ml-auto text-[9px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded font-medium">REC</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500">{preset.description}</p>
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
              className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[var(--brand-blue)]"
            />
          )}

          {/* Endpoint URL */}
          <div>
            <label htmlFor="add-conn-endpoint" className="block text-xs font-medium text-slate-400 mb-1.5">Endpoint URL</label>
            <input
              id="add-conn-endpoint"
              name="add-conn-endpoint"
              type="text"
              value={selectedProvider === 'custom' ? formData.endpoint : (currentPreset?.endpoint || '')}
              onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
              placeholder="https://api.example.com/v1"
              disabled={selectedProvider !== 'custom'}
              className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[var(--brand-blue)] disabled:opacity-60 disabled:cursor-not-allowed"
            />
            {selectedProvider !== 'custom' && (
              <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Endpoint locked for {currentPreset?.name}
              </p>
            )}
          </div>

          {/* API Key */}
          <div>
            <label htmlFor="add-conn-apikey" className="block text-xs font-medium text-slate-400 mb-1.5">API Key</label>
            <input
              id="add-conn-apikey"
              name="add-conn-apikey"
              type="password"
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              placeholder={selectedProvider === 'openrouter' ? 'sk-or-v1-...' : 'sk-...'}
              className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[var(--brand-blue)]"
            />
          </div>

          {/* Error Message */}
          {modelError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              {modelError}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAddConnection}
              disabled={!formData.apiKey || (selectedProvider === 'custom' && !formData.endpoint) || isVerifying !== null || fetchingModels !== null}
              className="flex-1 px-4 py-2.5 bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
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
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full py-3 px-4 border border-dashed border-slate-700 hover:border-cyan-500/50 text-slate-400 hover:text-cyan-400 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Open New Gateway
        </button>
      )}
    </div>
  )
}

// Theme Settings Tab
function ThemeSettings() {
  const { theme, setTheme } = useSettings()

  const themes = [
    { id: 'cobalt' as const, name: 'Midnight Cobalt', colors: ['#0A192F', '#112240', '#2463EB'], description: 'Default sovereign blue' },
    { id: 'noir' as const, name: 'Cyber Noir', colors: ['#000000', '#0A0A0A', '#00F0FF'], description: 'OLED black, neon cyan' },
    { id: 'forest' as const, name: 'Forest Dark', colors: ['#022c22', '#064e3b', '#10b981'], description: 'Military field ops' },
    { id: 'obsidian' as const, name: 'Obsidian Gold', colors: ['#020408', '#0F0F0F', '#F59E0B'], description: 'Executive luxury' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Theme Preferences</h3>
        <p className="text-xs text-slate-400 mb-4">
          Select your operational environment.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {themes.map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={`p-4 rounded-xl border-2 transition-all duration-300 ${
              theme === t.id
                ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/10 shadow-[0_0_20px_-5px_var(--brand-blue)]'
                : 'border-white/10 hover:border-white/30 hover:bg-white/5'
            }`}
          >
            <div className="flex gap-1.5 mb-3">
              {t.colors.map((color, i) => (
                <div
                  key={i}
                  className="w-7 h-7 rounded-md shadow-inner"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <p className={`text-sm font-semibold mb-1 ${theme === t.id ? 'text-[var(--brand-blue)]' : 'text-white'}`}>
              {t.name}
            </p>
            <p className="text-[10px] text-slate-500">{t.description}</p>
          </button>
        ))}
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
        <h3 className="text-sm font-semibold text-white mb-3">Notification Preferences</h3>
        <p className="text-xs text-slate-400 mb-4">
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
    <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
      <button
        onClick={onToggle}
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        className={`w-11 h-6 rounded-full transition-colors ${
          enabled ? 'bg-[var(--brand-blue)]' : 'bg-slate-700'
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
