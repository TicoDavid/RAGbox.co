'use client'

import React from 'react'

// ============================================================================
// TYPES
// ============================================================================

export interface VoiceChannelConfig {
  enabled: boolean
  voiceId?: string
  expressiveness?: number
  speakingRate?: number
  ttsModel?: string
  sampleRate?: number
}

export interface ChannelConfig {
  email: { enabled: boolean; address?: string }
  whatsapp: { enabled: boolean }
  voice: VoiceChannelConfig
}

export interface ConfigState {
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

export const DEFAULT_CONFIG: ConfigState = {
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

export const PERSONALITIES = [
  { key: 'warm', label: 'Warm' },
  { key: 'professional', label: 'Professional' },
  { key: 'casual', label: 'Casual' },
  { key: 'analytical', label: 'Analytical' },
] as const

export const ROLES = [
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
  { key: 'general', label: 'General', group: 'general' },
] as const

// ============================================================================
// SHARED HELPERS
// ============================================================================

export function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="text-xs text-[var(--text-tertiary)] mt-1">{description}</p>
    </div>
  )
}

export function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{label}</label>
      {children}
    </div>
  )
}

export const inputClass =
  'w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--warning)]/50 transition-colors'

export type UpdateFieldFn = <K extends keyof ConfigState>(key: K, value: ConfigState[K]) => void
