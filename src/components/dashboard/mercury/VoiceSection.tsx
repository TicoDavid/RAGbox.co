'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Loader2, Play, Search, ChevronDown, Check } from 'lucide-react'
import { toast } from 'sonner'
import {
  type ConfigState,
  type VoiceChannelConfig,
  type UpdateFieldFn,
  SectionHeader,
  inputClass,
} from './mercurySettingsShared'

// ============================================================================
// VOICE TYPES & DATA
// ============================================================================

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
  { id: 'Dennis', label: 'Dennis', description: 'Authoritative deep', gender: 'male', language: 'en-US', accent: 'American', tags: ['authoritative', 'deep'] },
  { id: 'Mark', label: 'Mark', description: 'Calm, measured', gender: 'male', language: 'en-US', accent: 'American', tags: ['calm', 'measured'] },
  { id: 'James', label: 'James', description: 'Classic professional', gender: 'male', language: 'en-US', accent: 'American', tags: ['professional', 'clear'] },
  { id: 'Brian', label: 'Brian', description: 'Technical expert', gender: 'male', language: 'en-US', accent: 'American', tags: ['precise', 'measured'] },
]

type GenderFilter = 'all' | 'female' | 'male'

// ============================================================================
// VOICE SECTION
// ============================================================================

export function VoiceSection({
  config,
  updateField,
}: {
  config: ConfigState
  updateField: UpdateFieldFn
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

      {/* Voice Tuning */}
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

      {/* Advanced Settings (collapsible) */}
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
