'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/api'
import { Loader2, Save, User, MessageSquare, Shield } from 'lucide-react'

interface Persona {
  id: string
  firstName: string
  lastName: string
  title: string | null
  personalityPrompt: string
  voiceId: string | null
  greeting: string | null
  signatureBlock: string | null
  silenceHighThreshold: number
  silenceMedThreshold: number
}

const PRESETS = [
  { key: 'professional', label: 'Professional', desc: 'Precise, formal, citation-focused' },
  { key: 'friendly', label: 'Friendly', desc: 'Warm, conversational, accessible' },
  { key: 'technical', label: 'Technical', desc: 'Detailed, thorough, cross-referencing' },
  { key: 'custom', label: 'Custom', desc: 'Write your own personality prompt' },
]

export default function MercurySettingsPage() {
  const [persona, setPersona] = useState<Persona | null>(null)
  const [presets, setPresets] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<string>('custom')

  // Form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [title, setTitle] = useState('')
  const [personalityPrompt, setPersonalityPrompt] = useState('')
  const [greeting, setGreeting] = useState('')
  const [signatureBlock, setSignatureBlock] = useState('')
  const [silenceHigh, setSilenceHigh] = useState(0.85)
  const [silenceMed, setSilenceMed] = useState(0.70)

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch('/api/persona')
        if (res.ok) {
          const data = await res.json()
          const p = data.data.persona as Persona
          setPersona(p)
          setPresets(data.data.presets || {})
          setFirstName(p.firstName)
          setLastName(p.lastName)
          setTitle(p.title || '')
          setPersonalityPrompt(p.personalityPrompt)
          setGreeting(p.greeting || '')
          setSignatureBlock(p.signatureBlock || '')
          setSilenceHigh(p.silenceHighThreshold)
          setSilenceMed(p.silenceMedThreshold)

          // Detect if current prompt matches a preset
          const matchedPreset = Object.entries(data.data.presets || {}).find(
            ([, v]) => v === p.personalityPrompt
          )
          setSelectedPreset(matchedPreset ? matchedPreset[0] : 'custom')
        }
      } catch {
        // Silent
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handlePresetChange = useCallback((key: string) => {
    setSelectedPreset(key)
    if (key !== 'custom' && presets[key]) {
      setPersonalityPrompt(presets[key])
    }
  }, [presets])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const res = await apiFetch('/api/persona', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          title,
          personalityPrompt,
          greeting,
          signatureBlock,
          silenceHighThreshold: silenceHigh,
          silenceMedThreshold: silenceMed,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setPersona(data.data.persona)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch {
      // Silent
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-blue)]" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-white flex items-center gap-2">
          <User className="w-5 h-5 text-[var(--brand-blue)]" />
          Your Mercury
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Customize your AI assistant&apos;s identity, personality, and behavior.
        </p>
      </div>

      {/* Identity */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Identity</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">First Name *</label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-white text-sm focus:outline-none focus:border-[var(--brand-blue)]"
              placeholder="M.E.R.C.U.R.Y."
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Last Name</label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-white text-sm focus:outline-none focus:border-[var(--brand-blue)]"
              placeholder="Monroe"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-white text-sm focus:outline-none focus:border-[var(--brand-blue)]"
            placeholder="AI Assistant"
          />
        </div>
      </section>

      {/* Personality */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Personality
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => handlePresetChange(p.key)}
              className={`p-3 rounded-lg border text-left transition-all ${
                selectedPreset === p.key
                  ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/10'
                  : 'border-[var(--border-default)] bg-[var(--bg-tertiary)] hover:border-[var(--border-strong)]'
              }`}
            >
              <p className="text-sm font-medium text-white">{p.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{p.desc}</p>
            </button>
          ))}
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Personality Prompt</label>
          <textarea
            value={personalityPrompt}
            onChange={(e) => { setPersonalityPrompt(e.target.value); setSelectedPreset('custom') }}
            rows={4}
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-white text-sm focus:outline-none focus:border-[var(--brand-blue)] resize-none"
            placeholder="Describe how your Mercury should communicate..."
          />
        </div>
      </section>

      {/* Greeting */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Greeting Message</h2>
        <textarea
          value={greeting}
          onChange={(e) => setGreeting(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-white text-sm focus:outline-none focus:border-[var(--brand-blue)] resize-none"
          placeholder="The first message new users see in the chat..."
        />
      </section>

      {/* Email Signature */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Email Signature</h2>
        <textarea
          value={signatureBlock}
          onChange={(e) => setSignatureBlock(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-white text-sm focus:outline-none focus:border-[var(--brand-blue)] resize-none"
          placeholder="Appended to emails Mercury sends on your behalf..."
        />
      </section>

      {/* Silence Thresholds */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Silence Protocol Thresholds
        </h2>
        <p className="text-xs text-slate-500">
          Controls when Mercury refuses to guess. Higher = stricter.
        </p>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-400">High Confidence</label>
              <span className="text-xs text-white font-mono">{Math.round(silenceHigh * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1"
              step="0.05"
              value={silenceHigh}
              onChange={(e) => setSilenceHigh(parseFloat(e.target.value))}
              className="w-full accent-[var(--brand-blue)]"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-400">Medium Confidence</label>
              <span className="text-xs text-white font-mono">{Math.round(silenceMed * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.3"
              max="0.95"
              step="0.05"
              value={silenceMed}
              onChange={(e) => setSilenceMed(parseFloat(e.target.value))}
              className="w-full accent-[var(--brand-blue)]"
            />
          </div>
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center gap-3 pt-4 border-t border-[var(--border-default)]">
        <button
          onClick={handleSave}
          disabled={saving || !firstName.trim()}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        {saved && (
          <span className="text-sm text-emerald-400">Saved successfully</span>
        )}
      </div>
    </div>
  )
}
