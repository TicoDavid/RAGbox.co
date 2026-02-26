'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  X, Save, Loader2,
  User, Brain, Cpu, Mic, Sparkles, Plug,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'

// ============================================================================
// TYPES
// ============================================================================

type SectionId = 'identity' | 'voice' | 'persona' | 'intelligence'

interface SectionDef {
  id: SectionId
  label: string
  icon: React.ElementType
  group: string
}

const SECTIONS: SectionDef[] = [
  { id: 'identity', label: 'Identity', icon: User, group: 'IDENTITY' },
  { id: 'voice', label: 'Voice', icon: Mic, group: 'IDENTITY' },
  { id: 'persona', label: 'Persona', icon: Sparkles, group: 'PERSONA' },
  { id: 'intelligence', label: 'Silence Protocol', icon: Brain, group: 'INTELLIGENCE' },
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
// CONFIG STATE
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
  personality: string
  role: string
  personalityPrompt: string
  voiceGender: 'male' | 'female'
  silenceThreshold: number
  channels: ChannelConfig
}

const DEFAULT_CONFIG: ConfigState = {
  name: 'Mercury',
  title: 'AI Assistant',
  greeting: 'Welcome to RAGbox. Upload documents to your vault and ask me anything.',
  personality: '',
  role: '',
  personalityPrompt: '',
  voiceGender: 'female',
  silenceThreshold: 0.60,
  channels: {
    email: { enabled: false },
    whatsapp: { enabled: false },
    voice: { enabled: true },
  },
}

const PERSONALITIES = [
  { key: 'professional', label: 'Professional' },
  { key: 'friendly', label: 'Friendly' },
  { key: 'technical', label: 'Technical' },
] as const

const ROLES = [
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

const MERCURY_VOICES = [
  { id: 'Ashley', label: 'Ashley', description: 'Warm, professional' },
  { id: 'Dennis', label: 'Dennis', description: 'Authoritative, deep' },
  { id: 'Luna', label: 'Luna', description: 'Friendly, approachable' },
  { id: 'Mark', label: 'Mark', description: 'Calm, measured' },
]

// ============================================================================
// MODAL
// ============================================================================

interface MercurySettingsModalProps {
  open: boolean
  onClose: () => void
  onSaved?: (config: { name: string; title: string }) => void
}

export function MercurySettingsModal({ open, onClose, onSaved }: MercurySettingsModalProps) {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState<SectionId>('identity')
  const [config, setConfig] = useState<ConfigState>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/mercury/config', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load config')
      const json = await res.json()
      if (json.success && json.data?.config) {
        const c = json.data.config
        setConfig({
          ...DEFAULT_CONFIG,
          ...c,
          // Restore preset keys from persisted DB columns
          personality: c.personalityPreset || '',
          role: c.rolePreset || '',
        })
      }
    } catch (err) {
      logger.error('Mercury config load failed:', err)
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
      const payload = {
        ...config,
        personalityPreset: config.personality,  // Map to what API expects
        rolePreset: config.role,                // Map role preset for API
      }
      const res = await fetch('/api/mercury/config', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
                        <IdentitySection config={config} updateField={updateField} />
                      )}
                      {activeSection === 'voice' && (
                        <VoiceSection config={config} updateField={updateField} />
                      )}
                      {activeSection === 'persona' && (
                        <PersonaSection config={config} updateField={updateField} />
                      )}
                      {activeSection === 'intelligence' && (
                        <IntelligenceSection config={config} updateField={updateField} />
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* ─── Footer ─── */}
              <div className="shrink-0 flex items-center justify-between px-6 py-3 border-t border-[var(--border-default)]">
                <button
                  onClick={() => { onClose(); router.push('/dashboard/settings/integrations') }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/30 transition-colors"
                >
                  <Plug className="w-3.5 h-3.5" />
                  Integrations
                </button>
                <div className="flex items-center gap-3">
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

// ============================================================================
// SECTION: Identity (Name, Title, Greeting)
// ============================================================================

function IdentitySection({
  config,
  updateField,
}: {
  config: ConfigState
  updateField: <K extends keyof ConfigState>(key: K, value: ConfigState[K]) => void
}) {
  return (
    <div className="space-y-6">
      <SectionHeader title="Identity" description="Configure your Mercury agent's name and greeting." />

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
    </div>
  )
}

// ============================================================================
// SECTION: Voice (Voice selector — Ashley/Dennis/Luna/Mark)
// ============================================================================

function VoiceSection({
  config,
  updateField,
}: {
  config: ConfigState
  updateField: <K extends keyof ConfigState>(key: K, value: ConfigState[K]) => void
}) {
  const currentVoiceId = config.channels.voice?.voiceId || ''

  const selectVoice = (voiceId: string) => {
    updateField('channels', {
      ...config.channels,
      voice: { ...config.channels.voice, enabled: true, voiceId },
    })
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Voice" description="Select the voice for Mercury's text-to-speech output." />

      <div className="space-y-2">
        {MERCURY_VOICES.map((v) => (
          <button
            key={v.id}
            onClick={() => selectVoice(v.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
              currentVoiceId === v.id
                ? 'border-[var(--warning)]/60 bg-[var(--warning)]/10'
                : 'border-[var(--border-default)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]/30'
            }`}
          >
            <div
              className={`w-3 h-3 rounded-full border-2 shrink-0 ${
                currentVoiceId === v.id
                  ? 'border-[var(--warning)] bg-[var(--warning)]'
                  : 'border-[var(--text-tertiary)]'
              }`}
            />
            <div>
              <span className="text-sm font-medium text-[var(--text-primary)]">{v.label}</span>
              <span className="text-xs text-[var(--text-tertiary)] ml-2">{v.description}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// SECTION: Persona (Personality, Role, Custom Instructions)
// ============================================================================

function PersonaSection({
  config,
  updateField,
}: {
  config: ConfigState
  updateField: <K extends keyof ConfigState>(key: K, value: ConfigState[K]) => void
}) {
  const togglePersonality = (key: string) => {
    updateField('personality', config.personality === key ? '' : key)
  }

  const toggleRole = (key: string) => {
    updateField('role', config.role === key ? '' : key)
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Persona" description="Set Mercury's personality tone and domain expertise." />

      {/* Personality — tone/style */}
      <div>
        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Personality</label>
        <p className="text-[10px] text-[var(--text-tertiary)] mb-2">Tone and communication style. Does not affect role.</p>
        <div className="flex flex-wrap gap-1.5">
          {PERSONALITIES.map((p) => (
            <button
              key={p.key}
              onClick={() => togglePersonality(p.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                config.personality === p.key
                  ? 'bg-[var(--warning)] text-black'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Role — perspective/skills */}
      <div>
        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Role</label>
        <p className="text-[10px] text-[var(--text-tertiary)] mb-2">Perspective and domain expertise. Does not affect personality.</p>
        {/* C-Suite */}
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider w-full">C-Suite</span>
          {ROLES.filter((r) => r.group === 'csuite').map((r) => (
            <button
              key={r.key}
              onClick={() => toggleRole(r.key)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                config.role === r.key
                  ? 'bg-[var(--warning)] text-black'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {/* Specialist */}
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider w-full">Specialist</span>
          {ROLES.filter((r) => r.group === 'specialist').map((r) => (
            <button
              key={r.key}
              onClick={() => toggleRole(r.key)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                config.role === r.key
                  ? 'bg-[var(--warning)] text-black'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom personality prompt */}
      <div>
        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Custom Instructions</label>
        <textarea
          value={config.personalityPrompt}
          onChange={(e) => updateField('personalityPrompt', e.target.value)}
          rows={3}
          className={`${inputClass} resize-none font-mono text-xs`}
          placeholder="Additional personality instructions..."
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
      <SectionHeader title="Silence Protocol" description="Controls when Mercury tells you it doesn't have enough evidence instead of guessing." />

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
          Below this level, Mercury will tell you it doesn't have enough evidence rather than guess.
        </p>
      </div>
    </div>
  )
}
