'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  X, Save, Loader2,
  User, Brain, Link2, Cpu, Mic, Mail, MessageSquare,
  Shield, Palette, Bell, Lock,
} from 'lucide-react'
import { toast } from 'sonner'
import { useSettings, type DensityId } from '@/contexts/SettingsContext'
import { AIModelSettings } from '../settings/AIModelSettings'

// ============================================================================
// TYPES
// ============================================================================

type SectionId =
  | 'identity' | 'intelligence' | 'connections' | 'ai-model'
  | 'voice' | 'email' | 'whatsapp' | 'permissions'
  | 'appearance' | 'alerts' | 'security'

interface SectionDef {
  id: SectionId
  label: string
  icon: React.ElementType
  group: string
}

const SECTIONS: SectionDef[] = [
  { id: 'identity', label: 'Name & Persona', icon: User, group: 'IDENTITY' },
  { id: 'intelligence', label: 'Silence Protocol', icon: Brain, group: 'INTELLIGENCE' },
  { id: 'connections', label: 'Connections', icon: Link2, group: 'INTELLIGENCE' },
  { id: 'ai-model', label: 'AI Model', icon: Cpu, group: 'INTELLIGENCE' },
  { id: 'voice', label: 'Voice', icon: Mic, group: 'CHANNELS' },
  { id: 'email', label: 'Email', icon: Mail, group: 'CHANNELS' },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, group: 'CHANNELS' },
  { id: 'permissions', label: 'Permissions', icon: Shield, group: 'CHANNELS' },
  { id: 'appearance', label: 'Appearance', icon: Palette, group: 'INTERFACE' },
  { id: 'alerts', label: 'Alerts', icon: Bell, group: 'SYSTEM' },
  { id: 'security', label: 'Security', icon: Lock, group: 'SYSTEM' },
]

// Group sections by group label
function groupSections() {
  const groups: Record<string, SectionDef[]> = {}
  for (const s of SECTIONS) {
    if (!groups[s.group]) groups[s.group] = []
    groups[s.group].push(s)
  }
  return groups
}

const GROUPED = groupSections()

// ============================================================================
// CONFIG STATE (pulled from MercuryConfigModal)
// ============================================================================

interface ChannelConfig {
  email: { enabled: boolean; address?: string }
  whatsapp: { enabled: boolean }
  voice: { enabled: boolean; voiceId?: string }
}

interface ConfigState {
  name: string
  title: string
  greeting: string
  personalityPrompt: string
  voiceGender: 'male' | 'female'
  silenceThreshold: number
  channels: ChannelConfig
}

const DEFAULT_CONFIG: ConfigState = {
  name: 'Mercury',
  title: 'AI Assistant',
  greeting: 'Welcome to RAGbox. Upload documents to your vault and ask me anything.',
  personalityPrompt: '',
  voiceGender: 'female',
  silenceThreshold: 0.60,
  channels: {
    email: { enabled: false },
    whatsapp: { enabled: false },
    voice: { enabled: true },
  },
}

const PRESETS = [
  { key: 'professional', label: 'Professional', group: 'style' },
  { key: 'friendly', label: 'Friendly', group: 'style' },
  { key: 'technical', label: 'Technical', group: 'style' },
  { key: 'ceo', label: 'CEO', group: 'csuite' },
  { key: 'cfo', label: 'CFO', group: 'csuite' },
  { key: 'cmo', label: 'CMO', group: 'csuite' },
  { key: 'coo', label: 'COO', group: 'csuite' },
  { key: 'cpo', label: 'CPO', group: 'csuite' },
  { key: 'cto', label: 'CTO', group: 'csuite' },
  { key: 'legal', label: 'Legal', group: 'specialist' },
  { key: 'compliance', label: 'Compliance', group: 'specialist' },
  { key: 'auditor', label: 'Auditor', group: 'specialist' },
  { key: 'whistleblower', label: 'Whistleblower', group: 'specialist' },
] as const

// ============================================================================
// MODAL
// ============================================================================

interface MercurySettingsModalProps {
  open: boolean
  onClose: () => void
  onSaved?: (config: { name: string; title: string }) => void
}

export function MercurySettingsModal({ open, onClose, onSaved }: MercurySettingsModalProps) {
  const [activeSection, setActiveSection] = useState<SectionId>('identity')
  const [config, setConfig] = useState<ConfigState>(DEFAULT_CONFIG)
  const [presets, setPresets] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/mercury/config')
      if (!res.ok) throw new Error('Failed to load config')
      const json = await res.json()
      if (json.success && json.data?.config) {
        setConfig(json.data.config)
      }
      if (json.data?.presets) {
        setPresets(json.data.presets)
      }
    } catch {
      toast.error('Failed to load Mercury configuration')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchConfig()
      setDirty(false)
    }
  }, [open, fetchConfig])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/mercury/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Save failed')
      }
      toast.success('Mercury configuration saved')
      setDirty(false)
      onSaved?.({ name: config.name, title: config.title })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const updateField = <K extends keyof ConfigState>(key: K, value: ConfigState[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  const updateChannel = <K extends keyof ChannelConfig>(
    channel: K,
    field: string,
    value: unknown,
  ) => {
    setConfig((prev) => ({
      ...prev,
      channels: {
        ...prev.channels,
        [channel]: { ...prev.channels[channel], [field]: value },
      },
    }))
    setDirty(true)
  }

  const applyPreset = (key: string) => {
    if (presets[key]) {
      updateField('personalityPrompt', presets[key])
    }
  }

  const activePreset = PRESETS.find((p) => presets[p.key] === config.personalityPrompt)?.key

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="w-full max-w-[960px] h-[80vh] max-h-[720px] flex flex-col rounded-2xl
                         bg-[var(--bg-secondary)]/95 backdrop-blur-xl
                         border border-[var(--border-default)] shadow-2xl shadow-black/50 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* ─── Header ─── */}
              <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)]">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-[var(--warning)]/20 to-[var(--warning)]/10 rounded-lg">
                    <Cpu className="w-5 h-5 text-[var(--warning)]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">Mercury Settings</h2>
                    <p className="text-xs text-[var(--text-tertiary)]">Agent Configuration Engine</p>
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

              {/* ─── Body: Sidebar + Content ─── */}
              <div className="flex flex-1 overflow-hidden">
                {/* Left Nav — 220px */}
                <nav className="w-[220px] shrink-0 border-r border-[var(--border-default)] overflow-y-auto py-4 bg-[var(--bg-secondary)]/50">
                  {Object.entries(GROUPED).map(([group, items]) => (
                    <div key={group} className="mb-4">
                      <div className="px-4 py-1.5 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                        {group}
                      </div>
                      {items.map((section) => {
                        const Icon = section.icon
                        const isActive = activeSection === section.id
                        return (
                          <button
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all ${
                              isActive
                                ? 'text-[var(--text-primary)] bg-[var(--warning)]/8 border-l-2 border-[var(--warning)]'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/30 border-l-2 border-transparent'
                            }`}
                          >
                            <Icon className={`w-4 h-4 ${isActive ? 'text-[var(--warning)]' : ''}`} />
                            {section.label}
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </nav>

                {/* Right Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  {loading ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="w-6 h-6 animate-spin text-[var(--text-tertiary)]" />
                    </div>
                  ) : (
                    <>
                      {activeSection === 'identity' && (
                        <IdentitySection
                          config={config}
                          updateField={updateField}
                          presets={presets}
                          activePreset={activePreset}
                          applyPreset={applyPreset}
                        />
                      )}
                      {activeSection === 'intelligence' && (
                        <IntelligenceSection config={config} updateField={updateField} />
                      )}
                      {activeSection === 'connections' && <ConnectionsSection />}
                      {activeSection === 'ai-model' && <AIModelSection />}
                      {activeSection === 'voice' && (
                        <VoiceSection config={config} updateField={updateField} updateChannel={updateChannel} />
                      )}
                      {activeSection === 'email' && (
                        <EmailSection config={config} updateChannel={updateChannel} />
                      )}
                      {activeSection === 'whatsapp' && (
                        <WhatsAppSection config={config} updateChannel={updateChannel} />
                      )}
                      {activeSection === 'permissions' && <PermissionsSection />}
                      {activeSection === 'appearance' && <AppearanceSection />}
                      {activeSection === 'alerts' && <AlertsSection />}
                      {activeSection === 'security' && <SecuritySection />}
                    </>
                  )}
                </div>
              </div>

              {/* ─── Footer ─── */}
              <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-3 border-t border-[var(--border-default)]">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/30 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || loading || !dirty}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all
                             bg-[var(--warning)] hover:bg-[var(--warning)]/90 text-black
                             disabled:opacity-40 disabled:cursor-not-allowed
                             shadow-lg shadow-[var(--warning)]/20"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ============================================================================
// SHARED HELPERS
// ============================================================================

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="text-xs text-[var(--text-tertiary)] mt-1">{description}</p>
    </div>
  )
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{label}</label>
      {children}
    </div>
  )
}

const inputClass =
  'w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--warning)]/50 transition-colors'

function ChannelToggle({
  label,
  enabled,
  onToggle,
  detail,
}: {
  label: string
  enabled: boolean
  onToggle: (v: boolean) => void
  detail?: string
}) {
  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-[var(--bg-tertiary)]/50">
      <div className="flex items-center gap-2">
        <span className="text-sm text-[var(--text-primary)]">{label}</span>
        {detail && <span className="text-[10px] text-[var(--text-tertiary)]">({detail})</span>}
      </div>
      <button
        onClick={() => onToggle(!enabled)}
        className={`relative w-10 h-5.5 rounded-full transition-colors ${
          enabled ? 'bg-[var(--warning)]' : 'bg-[var(--bg-elevated)]'
        }`}
        style={{ width: 40, height: 22 }}
      >
        <span
          className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-[18px]' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

// ============================================================================
// SECTION: Identity
// ============================================================================

function IdentitySection({
  config,
  updateField,
  presets,
  activePreset,
  applyPreset,
}: {
  config: ConfigState
  updateField: <K extends keyof ConfigState>(key: K, value: ConfigState[K]) => void
  presets: Record<string, string>
  activePreset?: string
  applyPreset: (key: string) => void
}) {
  return (
    <div className="space-y-6">
      <SectionHeader title="Name & Persona" description="Configure your Mercury agent's identity and personality." />

      {/* Name & Title */}
      <div className="grid grid-cols-2 gap-4">
        <FieldLabel label="Agent Name">
          <input
            type="text"
            value={config.name}
            onChange={(e) => updateField('name', e.target.value)}
            className={inputClass}
            placeholder="Mercury"
          />
        </FieldLabel>
        <FieldLabel label="Title">
          <input
            type="text"
            value={config.title}
            onChange={(e) => updateField('title', e.target.value)}
            className={inputClass}
            placeholder="AI Assistant"
          />
        </FieldLabel>
      </div>

      {/* Greeting */}
      <FieldLabel label="Greeting Message">
        <input
          type="text"
          value={config.greeting}
          onChange={(e) => updateField('greeting', e.target.value)}
          className={inputClass}
          placeholder="Welcome to RAGbox..."
        />
      </FieldLabel>

      {/* Personality Presets */}
      <div>
        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">Personality</label>
        {/* Style presets */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {PRESETS.filter((p) => p.group === 'style').map((p) => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activePreset === p.key
                  ? 'bg-[var(--warning)] text-black'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {/* C-Suite */}
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider w-full">C-Suite</span>
          {PRESETS.filter((p) => p.group === 'csuite').map((p) => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                activePreset === p.key
                  ? 'bg-[var(--warning)] text-black'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {/* Specialist */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider w-full">Specialist</span>
          {PRESETS.filter((p) => p.group === 'specialist').map((p) => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                activePreset === p.key
                  ? 'bg-[var(--warning)] text-black'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <textarea
          value={config.personalityPrompt}
          onChange={(e) => updateField('personalityPrompt', e.target.value)}
          rows={4}
          className={`${inputClass} resize-none font-mono text-xs`}
          placeholder="Describe your agent's personality..."
        />
      </div>
    </div>
  )
}

// ============================================================================
// SECTION: Intelligence (Silence Protocol)
// ============================================================================

function IntelligenceSection({
  config,
  updateField,
}: {
  config: ConfigState
  updateField: <K extends keyof ConfigState>(key: K, value: ConfigState[K]) => void
}) {
  return (
    <div className="space-y-6">
      <SectionHeader title="Silence Protocol" description="Controls when Mercury declines to answer rather than speculate." />

      <div className="p-5 rounded-xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-default)]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-[var(--text-primary)]">Silence Threshold</span>
          <span className="text-sm font-mono text-[var(--warning)]">
            {(config.silenceThreshold * 100).toFixed(0)}%
          </span>
        </div>
        <input
          type="range"
          min={40}
          max={85}
          step={5}
          value={config.silenceThreshold * 100}
          onChange={(e) => updateField('silenceThreshold', Number(e.target.value) / 100)}
          className="w-full accent-[var(--warning)]"
        />
        <div className="flex justify-between text-[10px] text-[var(--text-tertiary)] mt-2">
          <span>40% (Permissive)</span>
          <span>85% (Strict)</span>
        </div>
        <p className="text-xs text-[var(--text-tertiary)] mt-3">
          Below this confidence, Mercury will decline to answer rather than speculate.
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// SECTION: Connections (delegates to SCP)
// ============================================================================

function ConnectionsSection() {
  return (
    <div className="space-y-6">
      <SectionHeader title="Connections" description="Manage API keys and model provider gateways." />
      <div className="p-8 rounded-xl border border-dashed border-[var(--border-default)] text-center">
        <Link2 className="w-8 h-8 text-[var(--text-tertiary)] mx-auto mb-3" />
        <p className="text-sm text-[var(--text-secondary)] mb-1">Managed in System Control Panel</p>
        <p className="text-xs text-[var(--text-tertiary)]">
          Open the gear icon in the top header to configure API connections, OpenRouter keys, and model providers.
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// SECTION: AI Model
// ============================================================================

function AIModelSection() {
  return (
    <div className="space-y-6">
      <SectionHeader title="AI Model" description="Configure AEGIS and Private LLM routing." />
      <AIModelSettings />
    </div>
  )
}

// ============================================================================
// SECTION: Voice
// ============================================================================

function VoiceSection({
  config,
  updateField,
  updateChannel,
}: {
  config: ConfigState
  updateField: <K extends keyof ConfigState>(key: K, value: ConfigState[K]) => void
  updateChannel: <K extends keyof ChannelConfig>(channel: K, field: string, value: unknown) => void
}) {
  return (
    <div className="space-y-6">
      <SectionHeader title="Voice" description="Configure Mercury's voice interface." />

      <ChannelToggle
        label="Voice Channel Enabled"
        enabled={config.channels.voice.enabled}
        onToggle={(v) => updateChannel('voice', 'enabled', v)}
      />

      <div className="p-4 rounded-xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-default)]">
        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-3">Voice Gender</label>
        <div className="flex gap-3">
          {(['female', 'male'] as const).map((g) => (
            <button
              key={g}
              onClick={() => updateField('voiceGender', g)}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                config.voiceGender === g
                  ? 'bg-[var(--warning)]/15 text-[var(--warning)] border border-[var(--warning)]/40'
                  : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-strong)]'
              }`}
            >
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Status */}
      <div className="p-4 bg-[var(--success)]/10 border border-[var(--success)]/30 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
          <div>
            <p className="text-sm font-medium text-[var(--success)]">Mercury Voice Engine Connected</p>
            <p className="text-xs text-[var(--text-tertiary)]">Voice: mercury_professional</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SECTION: Email
// ============================================================================

function EmailSection({
  config,
  updateChannel,
}: {
  config: ConfigState
  updateChannel: <K extends keyof ChannelConfig>(channel: K, field: string, value: unknown) => void
}) {
  return (
    <div className="space-y-6">
      <SectionHeader title="Email Channel" description="Enable Mercury to send and receive emails." />

      <ChannelToggle
        label="Email Channel Enabled"
        enabled={config.channels.email.enabled}
        onToggle={(v) => updateChannel('email', 'enabled', v)}
        detail={config.channels.email.address}
      />

      <div className="p-5 rounded-xl border border-dashed border-[var(--border-default)] text-center">
        <Mail className="w-8 h-8 text-[var(--text-tertiary)] mx-auto mb-3" />
        <p className="text-sm text-[var(--text-secondary)] mb-1">Connect Gmail</p>
        <p className="text-xs text-[var(--text-tertiary)] mb-4">
          Link a Gmail account so Mercury can send and receive emails as your agent.
        </p>
        <a
          href="/dashboard/settings/mercury"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--brand-blue)] text-white text-sm font-medium hover:bg-[var(--brand-blue-hover)] transition-colors" /* THEME-EXEMPT: white on brand */
        >
          <Mail className="w-4 h-4" />
          Configure in Mercury Settings
        </a>
      </div>
    </div>
  )
}

// ============================================================================
// SECTION: WhatsApp
// ============================================================================

function WhatsAppSection({
  config,
  updateChannel,
}: {
  config: ConfigState
  updateChannel: <K extends keyof ChannelConfig>(channel: K, field: string, value: unknown) => void
}) {
  return (
    <div className="space-y-6">
      <SectionHeader title="WhatsApp Channel" description="Connect WhatsApp Business to let Mercury handle conversations." />

      <ChannelToggle
        label="WhatsApp Channel Enabled"
        enabled={config.channels.whatsapp.enabled}
        onToggle={(v) => updateChannel('whatsapp', 'enabled', v)}
      />

      <div className="p-5 rounded-xl border border-dashed border-[var(--border-default)] text-center">
        <MessageSquare className="w-8 h-8 text-[var(--success)]/50 mx-auto mb-3" />
        <p className="text-sm text-[var(--text-secondary)] mb-1">WhatsApp Business</p>
        <p className="text-xs text-[var(--text-tertiary)]">
          Configure WhatsApp integration in the Integrations settings page.
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// SECTION: Permissions
// ============================================================================

function PermissionsSection() {
  return (
    <div className="space-y-6">
      <SectionHeader title="Permissions" description="Control what Mercury can access and do." />

      <div className="space-y-3">
        {[
          { label: 'Read Vault Documents', description: 'Allow Mercury to search and cite your uploaded documents', enabled: true },
          { label: 'Create Audit Entries', description: 'Log all Mercury interactions to the audit trail', enabled: true },
          { label: 'External URL Scraping', description: 'Allow Mercury to fetch and analyze external URLs', enabled: false },
          { label: 'Document Upload', description: 'Allow Mercury to accept file uploads during chat', enabled: true },
        ].map((perm) => (
          <div key={perm.label} className="flex items-center justify-between py-3 px-4 rounded-lg bg-[var(--bg-tertiary)]/50 border border-[var(--border-default)]">
            <div>
              <p className="text-sm text-[var(--text-primary)]">{perm.label}</p>
              <p className="text-xs text-[var(--text-tertiary)]">{perm.description}</p>
            </div>
            <div className={`w-10 h-[22px] rounded-full relative ${perm.enabled ? 'bg-[var(--warning)]' : 'bg-[var(--bg-elevated)]'}`}>
              <span className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white transition-transform ${perm.enabled ? 'translate-x-[18px]' : ''}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// SECTION: Appearance
// ============================================================================

function ThemeThumbnail({ bg, accent }: { bg: string; accent: string }) {
  return (
    <svg viewBox="0 0 200 120" className="w-full rounded-lg overflow-hidden" aria-hidden="true">
      <rect width="200" height="120" fill={bg} />
      <rect x="0" y="0" width="4" height="120" fill={accent} opacity="0.8" />
      <rect x="4" y="0" width="36" height="120" fill={accent} opacity="0.08" />
      <circle cx="22" cy="20" r="4" fill={accent} opacity="0.4" />
      <circle cx="22" cy="36" r="4" fill={accent} opacity="0.25" />
      <circle cx="22" cy="52" r="4" fill={accent} opacity="0.25" />
      <rect x="40" y="0" width="160" height="16" fill={accent} opacity="0.06" />
      <rect x="40" y="16" width="160" height="1" fill={accent} opacity="0.15" />
      <rect x="48" y="5" width="40" height="6" rx="2" fill={accent} opacity="0.2" />
      <rect x="50" y="30" width="70" height="6" rx="2" fill={accent} opacity="0.15" />
      <rect x="50" y="42" width="55" height="4" rx="1.5" fill={accent} opacity="0.08" />
      <rect x="50" y="50" width="62" height="4" rx="1.5" fill={accent} opacity="0.08" />
      <rect x="50" y="64" width="50" height="14" rx="4" fill={accent} opacity="0.12" />
      <rect x="55" y="69" width="30" height="3" rx="1" fill={accent} opacity="0.2" />
      <rect x="148" y="17" width="52" height="103" fill={accent} opacity="0.04" />
      <rect x="148" y="17" width="1" height="103" fill={accent} opacity="0.15" />
      <rect x="155" y="24" width="28" height="4" rx="1.5" fill={accent} opacity="0.18" />
      <rect x="155" y="36" width="36" height="3" rx="1" fill={accent} opacity="0.1" />
      <rect x="155" y="44" width="28" height="3" rx="1" fill={accent} opacity="0.1" />
      <rect x="50" y="90" width="88" height="18" rx="9" fill={accent} opacity="0.08" />
      <rect x="60" y="96" width="40" height="4" rx="2" fill={accent} opacity="0.12" />
    </svg>
  )
}

function AppearanceSection() {
  const { theme, setTheme, density, setDensity } = useSettings()

  const themes = [
    { id: 'cobalt' as const, name: 'Midnight Cobalt', subtitle: 'Default sovereign blue', description: 'Best for extended sessions', bg: '#0B1120', accent: '#2563EB' },
    { id: 'noir' as const, name: 'Cyber Noir', subtitle: 'OLED black, neon cyan', description: 'Maximum contrast, minimal glare', bg: '#000000', accent: '#06B6D4' },
    { id: 'forest' as const, name: 'Forest Dark', subtitle: 'Military field dark', description: 'Low visibility environments', bg: '#0A1F0A', accent: '#22C55E' },
    { id: 'obsidian' as const, name: 'Obsidian Gold', subtitle: 'Executive luxury', description: 'Premium client-facing mode', bg: '#0B1120', accent: '#D4A843' },
  ]

  const densityOptions: { id: DensityId; label: string; description: string }[] = [
    { id: 'compact', label: 'Compact', description: 'Tighter spacing, more content' },
    { id: 'comfortable', label: 'Comfortable', description: 'Standard spacing, easier reading' },
  ]

  return (
    <div className="space-y-8">
      <SectionHeader title="Appearance" description="Theme and display density preferences." />

      <div className="grid grid-cols-2 gap-3">
        {themes.map((t) => {
          const isSelected = theme === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`relative text-left rounded-xl border-2 overflow-hidden transition-all duration-300 ${
                isSelected
                  ? 'border-[var(--warning)]/60 shadow-[0_0_20px_-5px_var(--warning)]'
                  : 'border-[var(--border-default)] hover:border-[var(--border-strong)]'
              }`}
            >
              {isSelected && (
                <div
                  className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: t.accent }}
                >
                  <svg className="w-3 h-3 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              )}
              <ThemeThumbnail bg={t.bg} accent={t.accent} />
              <div className="px-3 py-2.5">
                <p className={`text-sm font-semibold mb-0.5 ${isSelected ? 'text-[var(--warning)]' : 'text-[var(--text-primary)]'}`}>
                  {t.name}
                </p>
                <p className="text-[10px] text-[var(--text-tertiary)] leading-tight">{t.subtitle}</p>
                <p className="text-[10px] text-[var(--text-tertiary)] leading-tight mt-0.5 italic">{t.description}</p>
              </div>
            </button>
          )
        })}
      </div>

      <div className="border-t border-[var(--border-subtle)]" />

      <div>
        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-3">Display Density</label>
        <div className="grid grid-cols-2 gap-3">
          {densityOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setDensity(option.id)}
              className={`p-3 rounded-xl border-2 transition-all text-left ${
                density === option.id
                  ? 'border-[var(--warning)]/50 bg-[var(--warning)]/8'
                  : 'border-[var(--border-default)] hover:border-[var(--border-strong)]'
              }`}
            >
              <p className={`text-sm font-semibold mb-0.5 ${density === option.id ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'}`}>
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

// ============================================================================
// SECTION: Alerts
// ============================================================================

function AlertsSection() {
  return (
    <div className="space-y-6">
      <SectionHeader title="Alerts" description="Configure notification preferences." />

      <div className="space-y-3">
        {[
          { label: 'Email Notifications', description: 'Receive updates about document processing', enabled: true },
          { label: 'Push Notifications', description: 'Browser push for real-time alerts', enabled: false },
          { label: 'Audit Trail Alerts', description: 'Notify when privileged documents are accessed', enabled: true },
        ].map((alert) => (
          <div key={alert.label} className="flex items-center justify-between py-3 px-4 rounded-lg bg-[var(--bg-tertiary)]/50 border border-[var(--border-default)]">
            <div>
              <p className="text-sm text-[var(--text-primary)]">{alert.label}</p>
              <p className="text-xs text-[var(--text-tertiary)]">{alert.description}</p>
            </div>
            <div className={`w-10 h-[22px] rounded-full relative ${alert.enabled ? 'bg-[var(--warning)]' : 'bg-[var(--bg-elevated)]'}`}>
              <span className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white transition-transform ${alert.enabled ? 'translate-x-[18px]' : ''}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// SECTION: Security
// ============================================================================

function SecuritySection() {
  return (
    <div className="space-y-6">
      <SectionHeader title="Security" description="Manage sessions and access controls." />

      {/* Active session */}
      <div className="p-4 bg-[var(--bg-tertiary)]/50 border border-[var(--border-default)] rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[var(--success)]/20 rounded-lg">
            <Shield className="w-4 h-4 text-[var(--success)]" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-[var(--text-primary)]">Current Session</p>
              <span className="text-[10px] px-1.5 py-0.5 bg-[var(--success)]/20 text-[var(--success)] rounded">Active</span>
            </div>
            <p className="text-xs text-[var(--text-tertiary)]">Started this session</p>
          </div>
        </div>
      </div>

      {/* 2FA */}
      <div className="p-4 bg-[var(--bg-tertiary)]/50 border border-[var(--border-default)] rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock className="w-4 h-4 text-[var(--text-secondary)]" />
            <span className="text-sm text-[var(--text-secondary)]">Two-Factor Authentication</span>
          </div>
          <span className="text-xs text-[var(--success)]">Enabled</span>
        </div>
      </div>
    </div>
  )
}
