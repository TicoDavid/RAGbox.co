'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Save, Loader2, Settings2 } from 'lucide-react'
import { toast } from 'sonner'

interface MercuryConfigModalProps {
  isOpen: boolean
  onClose: () => void
}

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
  name: 'M.E.R.C.U.R.Y.',
  title: 'AI Assistant',
  greeting: '',
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
  { key: 'professional', label: 'Professional' },
  { key: 'friendly', label: 'Friendly' },
  { key: 'technical', label: 'Technical' },
] as const

export function MercuryConfigModal({ isOpen, onClose }: MercuryConfigModalProps) {
  const [config, setConfig] = useState<ConfigState>(DEFAULT_CONFIG)
  const [presets, setPresets] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

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
    if (isOpen) fetchConfig()
  }, [isOpen, fetchConfig])

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
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const updateField = <K extends keyof ConfigState>(key: K, value: ConfigState[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
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
  }

  const applyPreset = (key: string) => {
    if (presets[key]) {
      updateField('personalityPrompt', presets[key])
    }
  }

  const activePreset = PRESETS.find((p) => presets[p.key] === config.personalityPrompt)?.key

  return (
    <AnimatePresence>
      {isOpen && (
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
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] shrink-0">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-[var(--brand-blue)]" />
                  <h2 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                    Mercury Configuration
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close configuration"
                  className="w-8 h-8 flex items-center justify-center rounded-lg
                             text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]
                             transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin text-[var(--text-tertiary)]" />
                  </div>
                ) : (
                  <>
                    {/* Identity */}
                    <Section title="Identity">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Name">
                          <input
                            type="text"
                            value={config.name}
                            onChange={(e) => updateField('name', e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-blue)]"
                            placeholder="M.E.R.C.U.R.Y."
                          />
                        </Field>
                        <Field label="Title">
                          <input
                            type="text"
                            value={config.title}
                            onChange={(e) => updateField('title', e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-blue)]"
                            placeholder="AI Assistant"
                          />
                        </Field>
                      </div>
                      <Field label="Greeting Message">
                        <input
                          type="text"
                          value={config.greeting}
                          onChange={(e) => updateField('greeting', e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-blue)]"
                          placeholder="Welcome to RAGbox..."
                        />
                      </Field>
                    </Section>

                    {/* Personality */}
                    <Section title="Personality">
                      <div className="flex gap-2 mb-2">
                        {PRESETS.map((p) => (
                          <button
                            key={p.key}
                            onClick={() => applyPreset(p.key)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                              activePreset === p.key
                                ? 'bg-[var(--brand-blue)] text-white' /* THEME-EXEMPT: white on brand */
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
                        className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-blue)] resize-none font-mono text-xs"
                        placeholder="Describe your agent's personality..."
                      />
                    </Section>

                    {/* Confidence */}
                    <Section title="Silence Protocol">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[var(--text-tertiary)]">Silence Threshold</span>
                        <span className="text-xs font-mono text-[var(--brand-blue)]">
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
                        className="w-full accent-[var(--brand-blue)]"
                      />
                      <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
                        Below this confidence, Mercury will decline to answer rather than speculate.
                      </p>
                    </Section>

                    {/* Channels */}
                    <Section title="Channels">
                      <ChannelToggle
                        label="Voice"
                        enabled={config.channels.voice.enabled}
                        onToggle={(v) => updateChannel('voice', 'enabled', v)}
                      />
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-[var(--text-tertiary)] w-20">Voice Gender</span>
                        <div className="flex gap-2">
                          {(['female', 'male'] as const).map((g) => (
                            <button
                              key={g}
                              onClick={() => updateField('voiceGender', g)}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                config.voiceGender === g
                                  ? 'bg-[var(--brand-blue)] text-white' /* THEME-EXEMPT: white on brand */
                                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                              }`}
                            >
                              {g.charAt(0).toUpperCase() + g.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                      <ChannelToggle
                        label="Email"
                        enabled={config.channels.email.enabled}
                        onToggle={(v) => updateChannel('email', 'enabled', v)}
                        detail={config.channels.email.address}
                      />
                      <ChannelToggle
                        label="WhatsApp"
                        enabled={config.channels.whatsapp.enabled}
                        onToggle={(v) => updateChannel('whatsapp', 'enabled', v)}
                      />
                    </Section>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-3 border-t border-[var(--border-subtle)] shrink-0">
                <a
                  href="/dashboard/settings/mercury"
                  className="text-xs text-[var(--text-tertiary)] hover:text-[var(--brand-blue)] transition-colors"
                >
                  Advanced Settings
                </a>
                <button
                  onClick={handleSave}
                  disabled={saving || loading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--brand-blue)] text-white text-sm font-medium hover:bg-[var(--brand-blue-hover)] disabled:opacity-50 transition-colors" /* THEME-EXEMPT: white on brand */
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-[var(--text-tertiary)] mb-1">{label}</label>
      {children}
    </div>
  )
}

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
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--text-secondary)]">{label}</span>
        {detail && <span className="text-[10px] text-[var(--text-tertiary)]">({detail})</span>}
      </div>
      <button
        onClick={() => onToggle(!enabled)}
        className={`relative w-9 h-5 rounded-full transition-colors ${
          enabled ? 'bg-[var(--brand-blue)]' : 'bg-[var(--bg-elevated)]'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
