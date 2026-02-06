'use client'

import React, { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useSession, signOut } from 'next-auth/react'
import { usePrivilegeStore } from '@/stores/privilegeStore'
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
} from 'lucide-react'
import { PrivilegeKeyIcon, IdentityIcon } from './icons/SovereignIcons'
import { useSettings } from '@/contexts/SettingsContext'

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
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [searchOpen, setSearchOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [activeProfile, setActiveProfile] = useState<string>('work')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  const handleThemeToggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.classList.toggle('light', next === 'light')
    document.documentElement.classList.toggle('dark', next === 'dark')
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

  // Close profile menu when clicking outside
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
    <>
      <header
        className={`shrink-0 flex items-center gap-3 px-4 border-b border-[var(--border-default)] border-t border-t-white/10 bg-[var(--bg-secondary)] transition-opacity duration-300 ${
          isSwitching ? 'opacity-50' : 'opacity-100'
        }`}
        style={{ height: 'var(--header-height)' }}
      >
        {/* Logo */}
        <div className="flex items-center shrink-0">
          <Image
            src="https://storage.googleapis.com/connexusai-assets/Primary_RagBoxCo_Colored_Black.png"
            alt="RAGbox"
            width={120}
            height={32}
            className="h-8"
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
          {/* Privilege Toggle with Enhanced Tooltip */}
          <div className="relative group">
            <button
              onClick={() => togglePrivilege()}
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
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Avatar with Multi-Profile Menu */}
          <div className="relative ml-1" ref={profileMenuRef}>
            <button
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
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

// Settings Modal Component
function SettingsModal({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'api' | 'theme' | 'notifications'>('api')

  const tabs = [
    { id: 'api' as const, label: 'API Keys', icon: <Key className="w-4 h-4" /> },
    { id: 'theme' as const, label: 'Theme', icon: <Palette className="w-4 h-4" /> },
    { id: 'notifications' as const, label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-[#0B1221]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-[#60A5FA]" />
            <h2 className="text-lg font-semibold text-white">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-[var(--brand-blue)] border-b-2 border-[var(--brand-blue)] bg-white/5'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {activeTab === 'api' && <APIKeysSettings />}
          {activeTab === 'theme' && <ThemeSettings />}
          {activeTab === 'notifications' && <NotificationSettings />}
        </div>
      </div>
    </div>
  )
}

// Connection type icons
const CONNECTION_ICONS: Record<string, React.ReactNode> = {
  openai: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364l2.0201-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/></svg>,
  anthropic: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.304 3h-3.513l6.21 18h3.513l-6.21-18zM6.696 3H3.183l6.21 18h3.513L6.696 3z"/></svg>,
  google: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>,
  local: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1" fill="currentColor"/><circle cx="6" cy="18" r="1" fill="currentColor"/></svg>,
  custom: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
}

// Universal Connection Manager
function APIKeysSettings() {
  const { connections, addConnection, updateConnection, deleteConnection, verifyConnection, isVerifying } = useSettings()
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ name: '', endpoint: '', apiKey: '' })
  const [showKey, setShowKey] = useState<string | null>(null)

  const handleAddConnection = async () => {
    if (!formData.name || !formData.endpoint || !formData.apiKey) return

    const conn = await addConnection({
      name: formData.name,
      endpoint: formData.endpoint,
      apiKey: formData.apiKey,
      type: 'custom',
    })

    // Auto-verify after adding
    await verifyConnection(conn.id)

    setFormData({ name: '', endpoint: '', apiKey: '' })
    setShowAddForm(false)
  }

  const handleUpdateConnection = async (id: string) => {
    updateConnection(id, formData)
    await verifyConnection(id)
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
          Configure AI model connections. Keys are encrypted and never leave your vault.
        </p>
      </div>

      {/* Active Connections List */}
      <div className="space-y-2">
        {connections.length === 0 && !showAddForm && (
          <div className="p-8 border border-dashed border-slate-700 rounded-xl text-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 text-slate-600">
              <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0-6v6"/>
              <line x1="3" y1="9" x2="9" y2="9"/>
              <line x1="15" y1="9" x2="21" y2="9"/>
              <line x1="3" y1="15" x2="9" y2="15"/>
              <line x1="15" y1="15" x2="21" y2="15"/>
            </svg>
            <p className="text-sm text-slate-400 mb-1">No Secure Uplinks Configured</p>
            <p className="text-xs text-slate-500">Add a connection to enable AI features</p>
          </div>
        )}

        {connections.map((conn) => (
          <div
            key={conn.id}
            className="p-4 bg-[var(--bg-tertiary)] border border-white/10 rounded-xl"
          >
            {editingId === conn.id ? (
              /* Edit Mode */
              <div className="space-y-3">
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Connection Name"
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[var(--brand-blue)]"
                />
                <input
                  type="text"
                  value={formData.endpoint}
                  onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                  placeholder="Endpoint URL"
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[var(--brand-blue)]"
                />
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="API Key"
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[var(--brand-blue)]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdateConnection(conn.id)}
                    disabled={isVerifying === conn.id}
                    className="flex-1 px-4 py-2 bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {isVerifying === conn.id ? (
                      <>
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Testing...
                      </>
                    ) : 'Test & Save'}
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
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div className="p-2.5 rounded-lg bg-white/5 text-slate-400">
                  {CONNECTION_ICONS[conn.type] || CONNECTION_ICONS.custom}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white truncate">{conn.name}</p>
                    {conn.verified ? (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-emerald-900/30 text-emerald-400 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Verified
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
                    onClick={() => verifyConnection(conn.id)}
                    disabled={isVerifying === conn.id}
                    className="p-2 text-slate-400 hover:text-[var(--brand-blue)] hover:bg-white/5 rounded-lg transition-colors"
                    title="Verify"
                  >
                    {isVerifying === conn.id ? (
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
            )}
          </div>
        ))}
      </div>

      {/* Add Connection Form */}
      {showAddForm ? (
        <div className="p-4 bg-[var(--bg-tertiary)] border border-[var(--brand-blue)]/30 rounded-xl space-y-3">
          <p className="text-sm font-medium text-white mb-2">New Secure Connection</p>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Connection Name (e.g., My Local LLM)"
            className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[var(--brand-blue)]"
          />
          <input
            type="text"
            value={formData.endpoint}
            onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
            placeholder="Base URL / Endpoint (e.g., https://api.openai.com/v1)"
            className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[var(--brand-blue)]"
          />
          <input
            type="password"
            value={formData.apiKey}
            onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
            placeholder="API Key"
            className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[var(--brand-blue)]"
          />
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAddConnection}
              disabled={!formData.name || !formData.endpoint || !formData.apiKey || isVerifying !== null}
              className="flex-1 px-4 py-2.5 bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isVerifying ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Testing Connection...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  Test & Save
                </>
              )}
            </button>
            <button
              onClick={() => { setShowAddForm(false); setFormData({ name: '', endpoint: '', apiKey: '' }) }}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full py-3 px-4 border border-dashed border-slate-700 hover:border-[var(--brand-blue)]/50 text-slate-400 hover:text-[var(--brand-blue)] rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Secure Connection
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
  ]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Theme Preferences</h3>
        <p className="text-xs text-slate-400 mb-4">
          Select your operational environment.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
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
