'use client'

import React, { useState } from 'react'
import {
  Settings,
  User,
  Globe,
  CreditCard,
  Key,
  Brain,
  Palette,
  Bell,
  Shield,
  FileText,
  MessageSquare,
  X,
} from 'lucide-react'
import { ProfileSettings } from './ProfileSettings'
import { LanguageSettings, BillingSettings } from './LanguageBillingSettings'
import { SecuritySettings } from './SecuritySettings'
import { DocumentationSettings, ReportIssueSettings } from './SupportSettings'
import { APIKeysSettings } from './APIKeysSettings'
import { AIModelSettings } from './AIModelSettings'
import { AppearanceSettings, NotificationSettings } from './AppearanceSettings'

export type SettingsSection =
  | 'profile' | 'language' | 'billing'
  | 'connections' | 'aimodel'
  | 'appearance'
  | 'alerts' | 'security'
  | 'docs' | 'report'

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
    ],
  },
]

export function SettingsModal({ onClose, initialSection }: { onClose: () => void; initialSection?: SettingsSection }) {
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection || 'connections')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Modal - Wide layout */}
      <div className="relative w-full max-w-4xl mx-4 h-[80vh] max-h-[700px] bg-[var(--bg-secondary)] backdrop-blur-xl border border-[var(--border-default)] rounded-2xl shadow-2xl overflow-hidden flex flex-col" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-[var(--brand-blue)]/20 to-[var(--brand-blue)]/10 rounded-lg">
              <Settings className="w-5 h-5 text-[var(--brand-blue)]" />
            </div>
            <div>
              <h2 id="settings-title" className="text-lg font-semibold text-[var(--text-primary)]">System Control Panel</h2>
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
