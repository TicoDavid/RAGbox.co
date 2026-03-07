'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  X, Save, Loader2, Check, Play, Search, ChevronDown,
  User, Brain, Cpu, Mic, Sparkles, Plug, Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'
import { NeuralShiftSection } from './NeuralShiftSection'
import { IntegrationsSettings } from '@/components/settings/IntegrationsSettings'

// ============================================================================
// TYPES
// ============================================================================

type SectionId = 'identity' | 'voice' | 'persona' | 'intelligence' | 'neuralshift' | 'integrations'

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
  { id: 'neuralshift', label: 'Neural Shift', icon: Users, group: 'PERSONA' },
  { id: 'intelligence', label: 'Silence Protocol', icon: Brain, group: 'INTELLIGENCE' },
  { id: 'integrations', label: 'Integrations', icon: Plug, group: 'CONNECTIONS' },
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

interface VoiceChannelConfig {
  enabled: boolean
  voiceId?: string
  expressiveness?: number  // 0-1, maps to TTS temperature
  speakingRate?: number    // 0.5-2.0, TTS speaking rate
  ttsModel?: string        // e.g. 'inworld-tts-1.5-max'
  sampleRate?: number      // e.g. 24000 or 48000
}

interface ChannelConfig {
  email: { enabled: boolean; address?: string }
  whatsapp: { enabled: boolean }
  voice: VoiceChannelConfig
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
  name: 'Evelyn Monroe',
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

interface VoiceEntry {
  id: string
  label: string
  description: string
  gender: 'female' | 'male'
  language: string
  accent?: string
  tags: string[]
}

const MERCURY_VOICES: VoiceEntry[] = [
  { id: 'Ashley', label: 'Ashley', description: 'Warm conversationalist', gender: 'female', language: 'en-US', accent: 'American', tags: ['warm', 'professional'] },
  { id: 'Elizabeth', label: 'Elizabeth', description: 'Professional narrator', gender: 'female', language: 'en-US', accent: 'American', tags: ['formal', 'clear'] },
  { id: 'Olivia', label: 'Olivia', description: 'Friendly British warmth', gender: 'female', language: 'en-GB', accent: 'British', tags: ['british', 'warm'] },
  { id: 'Luna', label: 'Luna', description: 'Calm meditation guide', gender: 'female', language: 'en-US', accent: 'American', tags: ['calm', 'soothing'] },
  { id: 'Sophia', label: 'Sophia', description: 'Confident executive', gender: 'female', language: 'en-US', accent: 'American', tags: ['authoritative', 'clear'] },
  { id: 'Dennis', label: 'Dennis', description: 'Authoritative deep', gender: 'male', language: 'en-US', accent: 'American', tags: ['authoritative', 'deep'] },
  { id: 'Mark', label: 'Mark', description: 'Calm, measured', gender: 'male', language: 'en-US', accent: 'American', tags: ['calm', 'measured'] },
  { id: 'James', label: 'James', description: 'Classic professional', gender: 'male', language: 'en-US', accent: 'American', tags: ['professional', 'clear'] },
  { id: 'David', label: 'David', description: 'Friendly narrator', gender: 'male', language: 'en-US', accent: 'American', tags: ['friendly', 'warm'] },
  { id: 'Brian', label: 'Brian', description: 'Technical expert', gender: 'male', language: 'en-US', accent: 'American', tags: ['precise', 'measured'] },
]

type GenderFilter = 'all' | 'female' | 'male'

// ============================================================================
// MODAL
// ============================================================================

interface MercurySettingsModalProps {
  open: boolean
  onClose: () => void
  onSaved?: (config: { name: string; title: string; greeting?: string }) => void
}

export function MercurySettingsModal({ open, onClose, onSaved }: MercurySettingsModalProps) {
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
      onSaved?.({ name: config.name, title: config.title, greeting: config.greeting })
      onClose()
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
                      {activeSection === 'neuralshift' && (
                        <NeuralShiftSection />
                      )}
                      {activeSection === 'integrations' && (
                        <IntegrationsSettings />
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* ─── Footer ─── */}
              <div className="shrink-0 flex items-center justify-end px-6 py-3 border-t border-[var(--border-default)]">
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
// SECTION: Voice Library (catalog grid, filters, tuning, advanced)
// ============================================================================

function VoiceSection({
  config,
  updateField,
}: {
  config: ConfigState
  updateField: <K extends keyof ConfigState>(key: K, value: ConfigState[K]) => void
}) {
  const currentVoiceId = config.channels.voice?.voiceId || ''
  const expressiveness = config.channels.voice?.expressiveness ?? 0.6
  const speakingRate = config.channels.voice?.speakingRate ?? 1.05
  const [voices, setVoices] = useState<VoiceEntry[]>(MERCURY_VOICES)
  const [voicesLoading, setVoicesLoading] = useState(true)
  const [previewingId, setPreviewingId] = useState<string | null>(null)
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Stop any playing preview audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // Fetch dynamic voice list — static fallback
  useEffect(() => {
    setVoicesLoading(true)
    fetch('/api/voice/list')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const list = json?.data?.voices
        if (Array.isArray(list) && list.length > 0) {
          setVoices(list.map((v: VoiceEntry) => ({
            id: v.id,
            label: v.label || v.id,
            description: v.description || '',
            gender: v.gender || 'female',
            language: v.language || 'en-US',
            accent: v.accent,
            tags: v.tags || [],
          })))
        }
      })
      .catch(() => {})
      .finally(() => setVoicesLoading(false))
  }, [])

  const updateVoice = (patch: Partial<VoiceChannelConfig>) => {
    updateField('channels', {
      ...config.channels,
      voice: { ...config.channels.voice, ...patch },
    })
  }

  // Filter voices by gender and search
  const filteredVoices = voices.filter((v) => {
    if (genderFilter !== 'all' && v.gender !== genderFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        v.label.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.tags.some((t) => t.toLowerCase().includes(q))
      )
    }
    return true
  })

  const handlePreview = async (voiceId: string) => {
    if (previewingId || typeof window === 'undefined') return
    setPreviewingId(voiceId)
    const text = config.greeting || `Hello, I'm ${config.name || 'Evelyn Monroe'}. How can I help you today?`

    try {
      const res = await fetch('/api/voice/synthesize', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId }),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(errBody.error || `TTS failed (${res.status})`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => { setPreviewingId(null); audioRef.current = null; URL.revokeObjectURL(url) }
      audio.onerror = () => { setPreviewingId(null); audioRef.current = null; URL.revokeObjectURL(url) }
      await audio.play()
    } catch (err) {
      setPreviewingId(null)
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error(`Voice preview failed — ${message}`)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Voice Library" description="Browse, audition, and tune Mercury's voice." />

      {/* Filters: Gender tabs + Search */}
      <div className="flex items-center gap-3">
        <div className="flex rounded-lg overflow-hidden border border-[var(--border-default)]">
          {(['all', 'female', 'male'] as GenderFilter[]).map((g) => (
            <button
              key={g}
              onClick={() => setGenderFilter(g)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                genderFilter === g
                  ? 'bg-[var(--warning)] text-black'
                  : 'bg-[var(--bg-tertiary)]/50 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50'
              }`}
            >
              {g === 'all' ? 'All' : g === 'female' ? 'Female' : 'Male'}
            </button>
          ))}
        </div>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search voices..."
            className={`${inputClass} pl-9 py-1.5 text-xs`}
          />
        </div>
      </div>

      {/* Voice Cards Grid */}
      {voicesLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-4 h-4 animate-spin text-[var(--text-tertiary)]" />
          <span className="ml-2 text-xs text-[var(--text-tertiary)]">Loading voices...</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {filteredVoices.map((v) => {
            const isSelected = currentVoiceId === v.id
            const isPreviewing = previewingId === v.id
            return (
              <div
                key={v.id}
                className={`relative rounded-xl border p-3 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[var(--warning)]/60 bg-[var(--warning)]/10'
                    : 'border-[var(--border-default)] bg-[var(--bg-tertiary)]/50 hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]/30'
                }`}
                onClick={() => updateVoice({ enabled: true, voiceId: v.id })}
              >
                {/* Play button */}
                <button
                  onClick={(e) => { e.stopPropagation(); handlePreview(v.id) }}
                  disabled={!!previewingId}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center bg-[var(--bg-elevated)]/80 hover:bg-[var(--brand-blue)]/20 transition-colors"
                  aria-label={`Preview ${v.label}`}
                >
                  {isPreviewing ? (
                    <Loader2 className="w-3 h-3 animate-spin text-[var(--warning)]" />
                  ) : (
                    <Play className="w-3 h-3 text-[var(--text-secondary)]" />
                  )}
                </button>

                {/* Voice name */}
                <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5 pr-7">
                  {v.label}
                </div>

                {/* Description */}
                <div className="text-[10px] text-[var(--text-tertiary)] mb-2 line-clamp-2">
                  {v.description}
                </div>

                {/* Badges row */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    v.gender === 'female'
                      ? 'bg-pink-500/10 text-pink-400'
                      : 'bg-blue-500/10 text-blue-400'
                  }`}>
                    {v.gender === 'female' ? '\u2640' : '\u2642'}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--bg-elevated)]/50 text-[var(--text-tertiary)]">
                    {v.language}
                  </span>
                </div>

                {/* Selected checkmark */}
                {isSelected && (
                  <div className="absolute bottom-2 right-2">
                    <div className="w-5 h-5 rounded-full bg-[var(--warning)] flex items-center justify-center">
                      <Check className="w-3 h-3 text-black" />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {filteredVoices.length === 0 && !voicesLoading && (
        <p className="text-xs text-[var(--text-tertiary)] text-center py-4">No voices match your filters.</p>
      )}

      {/* ═══ VOICE TUNING ═══ */}
      <div className="border-t border-[var(--border-default)] pt-4">
        <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-4">Voice Tuning</h4>

        {/* Expressiveness Slider */}
        <div className="p-5 rounded-xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-default)] mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-sm font-medium text-[var(--text-primary)]">Expressiveness</span>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">Temperature — how dynamic and varied the voice sounds</p>
            </div>
            <span className="text-sm font-mono text-[var(--warning)]">
              {(expressiveness * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={expressiveness * 100}
            onChange={(e) => updateVoice({ expressiveness: Number(e.target.value) / 100 })}
            className="w-full accent-[var(--warning)]"
          />
          <div className="flex justify-between text-[10px] text-[var(--text-tertiary)] mt-2">
            <span>Calm</span>
            <span>Expressive</span>
          </div>
        </div>

        {/* Speaking Rate Slider */}
        <div className="p-5 rounded-xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-default)] mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-sm font-medium text-[var(--text-primary)]">Speaking Rate</span>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">How fast the agent speaks</p>
            </div>
            <span className="text-sm font-mono text-[var(--warning)]">
              {speakingRate.toFixed(2)}&times;
            </span>
          </div>
          <input
            type="range"
            min={50}
            max={200}
            step={5}
            value={speakingRate * 100}
            onChange={(e) => updateVoice({ speakingRate: Number(e.target.value) / 100 })}
            className="w-full accent-[var(--warning)]"
          />
          <div className="flex justify-between text-[10px] text-[var(--text-tertiary)] mt-2">
            <span>0.5&times; Slow</span>
            <span>2.0&times; Fast</span>
          </div>
        </div>

        {/* Preview Voice */}
        <button
          onClick={() => handlePreview(currentVoiceId || 'Ashley')}
          disabled={!!previewingId}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all border ${
            previewingId
              ? 'bg-[var(--warning)]/20 text-[var(--warning)] border-[var(--warning)]/40 cursor-not-allowed'
              : 'bg-[var(--bg-tertiary)]/50 text-[var(--text-secondary)] border-[var(--border-default)] hover:border-[var(--warning)]/40 hover:text-[var(--text-primary)]'
          }`}
        >
          {previewingId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {previewingId ? 'Playing Preview...' : 'Preview Voice'}
        </button>
      </div>

      {/* ═══ ADVANCED SETTINGS (collapsible) ═══ */}
      <div className="border-t border-[var(--border-default)] pt-4">
        <button
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider hover:text-[var(--text-primary)] transition-colors w-full"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${advancedOpen ? 'rotate-0' : '-rotate-90'}`} />
          Advanced Voice Settings
        </button>

        {advancedOpen && (
          <div className="mt-4 p-5 rounded-xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-default)] space-y-4">
            {/* TTS Model */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">TTS Model</label>
              <div className="flex gap-3">
                {[
                  { value: 'inworld-tts-1', label: 'Standard (tts-1)' },
                  { value: 'inworld-tts-1.5-max', label: 'Premium (tts-1.5-max)' },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="ttsModel"
                      checked={config.channels.voice?.ttsModel === opt.value || (!config.channels.voice?.ttsModel && opt.value === 'inworld-tts-1.5-max')}
                      onChange={() => updateVoice({ ttsModel: opt.value })}
                      className="accent-[var(--warning)]"
                    />
                    <span className="text-xs text-[var(--text-primary)]">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Sample Rate */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">Sample Rate</label>
              <div className="flex gap-3">
                {[
                  { value: 24000, label: '24kHz (Standard)' },
                  { value: 48000, label: '48kHz (High Fidelity)' },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sampleRate"
                      checked={config.channels.voice?.sampleRate === opt.value || (!config.channels.voice?.sampleRate && opt.value === 48000)}
                      onChange={() => updateVoice({ sampleRate: opt.value })}
                      className="accent-[var(--warning)]"
                    />
                    <span className="text-xs text-[var(--text-primary)]">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
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
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Custom Instructions</label>
          <span className={`text-[10px] ${config.personalityPrompt.length > 0 ? 'text-[var(--text-secondary)]' : 'text-[var(--text-tertiary)]'}`}>
            {config.personalityPrompt.length} / 2000
          </span>
        </div>
        <textarea
          value={config.personalityPrompt}
          onChange={(e) => updateField('personalityPrompt', e.target.value.slice(0, 2000))}
          rows={6}
          className={`${inputClass} resize-y min-h-[200px] max-h-[400px] font-mono text-xs`}
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
