'use client'

/**
 * Mercury User Profile Settings
 *
 * Settings → Mercury → Profile tab:
 * - Display name (auto-filled from auth)
 * - Role dropdown
 * - Company name
 * - Current priorities (editable list, drag to reorder)
 * - Communication style dropdown
 * - Timezone (auto-detect with override)
 *
 * Reads/writes: GET/PUT /api/mercury/profile
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Bot,
  Loader2,
  Save,
  Plus,
  X,
  GripVertical,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

interface MercuryProfile {
  displayName: string
  role: string
  companyName: string
  priorities: string[]
  communicationStyle: string
  timezone: string
}

const ROLES = [
  'CPO',
  'CEO',
  'CTO',
  'CFO',
  'Developer',
  'Manager',
  'Analyst',
  'Attorney',
  'Consultant',
  'Custom',
]

const COMMUNICATION_STYLES = [
  { value: 'direct', label: 'Direct', description: 'Brief, action-oriented responses' },
  { value: 'detailed', label: 'Detailed', description: 'Thorough explanations with context' },
  { value: 'executive', label: 'Executive Summary', description: 'Key takeaways and recommendations' },
  { value: 'casual', label: 'Casual', description: 'Conversational, approachable tone' },
]

const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
  'Pacific/Auckland',
]

function formatTimezone(tz: string): string {
  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short',
    })
    const parts = formatter.formatToParts(now)
    const tzName = parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
    return `${tz.replace(/_/g, ' ').replace(/\//g, ' / ')} (${tzName})`
  } catch {
    return tz
  }
}

// ============================================================================
// DEFAULT PROFILE
// ============================================================================

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'America/New_York'
  }
}

const DEFAULT_PROFILE: MercuryProfile = {
  displayName: '',
  role: 'Manager',
  companyName: '',
  priorities: [],
  communicationStyle: 'direct',
  timezone: detectTimezone(),
}

// ============================================================================
// PAGE
// ============================================================================

export default function MercurySettings() {
  const [profile, setProfile] = useState<MercuryProfile>(DEFAULT_PROFILE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newPriority, setNewPriority] = useState('')
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  const fetchProfile = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/mercury/profile')
      if (res.ok) {
        const json = await res.json()
        if (json.data) {
          setProfile({
            ...DEFAULT_PROFILE,
            ...json.data,
            timezone: json.data.timezone || detectTimezone(),
          })
        }
      }
    } catch {
      // Use defaults on error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const saveProfile = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/mercury/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
      if (!res.ok) throw new Error('Failed to save')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Failed to save profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const updateField = <K extends keyof MercuryProfile>(key: K, value: MercuryProfile[K]) => {
    setProfile((prev) => ({ ...prev, [key]: value }))
  }

  const addPriority = () => {
    const trimmed = newPriority.trim()
    if (!trimmed || profile.priorities.includes(trimmed)) return
    updateField('priorities', [...profile.priorities, trimmed])
    setNewPriority('')
  }

  const removePriority = (idx: number) => {
    updateField('priorities', profile.priorities.filter((_, i) => i !== idx))
  }

  const handleDragStart = (idx: number) => {
    setDragIdx(idx)
  }

  const handleDragOver = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === targetIdx) return
    const items = [...profile.priorities]
    const [dragged] = items.splice(dragIdx, 1)
    items.splice(targetIdx, 0, dragged)
    updateField('priorities', items)
    setDragIdx(targetIdx)
  }

  const handleDragEnd = () => {
    setDragIdx(null)
  }

  return (
    <div className="max-w-lg">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
        <Bot size={16} className="text-[var(--brand-blue)]" />
        Mercury Profile
      </h3>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-[var(--text-tertiary)] animate-spin" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Display Name */}
          <FieldGroup label="Display Name" description="How Mercury addresses you">
            <input
              type="text"
              value={profile.displayName}
              onChange={(e) => updateField('displayName', e.target.value)}
              placeholder="e.g., David"
              className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--bg-primary)] border border-[var(--bg-tertiary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-blue)] transition-colors"
            />
          </FieldGroup>

          {/* Role */}
          <FieldGroup label="Role" description="Mercury adjusts tone and recommendations based on your role">
            <select
              value={profile.role}
              onChange={(e) => updateField('role', e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--bg-primary)] border border-[var(--bg-tertiary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-blue)] transition-colors"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </FieldGroup>

          {/* Company Name */}
          <FieldGroup label="Company" description="Used in email signatures and reports">
            <input
              type="text"
              value={profile.companyName}
              onChange={(e) => updateField('companyName', e.target.value)}
              placeholder="e.g., Acme Corp"
              className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--bg-primary)] border border-[var(--bg-tertiary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-blue)] transition-colors"
            />
          </FieldGroup>

          {/* Priorities */}
          <FieldGroup label="Current Priorities" description="Drag to reorder. Mercury factors these into responses.">
            <div className="space-y-1.5 mb-2">
              {profile.priorities.map((p, idx) => (
                <div
                  key={`${p}-${idx}`}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                    dragIdx === idx
                      ? 'bg-[var(--brand-blue)]/10 border-[var(--brand-blue)]/30'
                      : 'bg-[var(--bg-primary)] border-[var(--bg-tertiary)]'
                  }`}
                >
                  <GripVertical className="w-3.5 h-3.5 text-[var(--text-tertiary)] cursor-grab shrink-0" />
                  <span className="text-sm text-[var(--text-primary)] flex-1">{p}</span>
                  <button
                    onClick={() => removePriority(idx)}
                    className="p-0.5 rounded text-[var(--text-tertiary)] hover:text-[var(--danger)] transition-colors shrink-0"
                    aria-label={`Remove priority: ${p}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPriority()}
                placeholder="Add a priority..."
                className="flex-1 px-3 py-1.5 rounded-lg text-sm bg-[var(--bg-primary)] border border-[var(--bg-tertiary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-blue)] transition-colors"
              />
              <button
                onClick={addPriority}
                disabled={!newPriority.trim()}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--brand-blue)]/10 text-[var(--brand-blue)] hover:bg-[var(--brand-blue)]/20 disabled:opacity-30 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </FieldGroup>

          {/* Communication Style */}
          <FieldGroup label="Communication Style" description="How Mercury formats and delivers information">
            <div className="grid grid-cols-2 gap-2">
              {COMMUNICATION_STYLES.map((style) => (
                <button
                  key={style.value}
                  onClick={() => updateField('communicationStyle', style.value)}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    profile.communicationStyle === style.value
                      ? 'bg-[var(--brand-blue)]/10 border-[var(--brand-blue)]/30 text-[var(--brand-blue)]'
                      : 'bg-[var(--bg-primary)] border-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:border-[var(--bg-elevated)]'
                  }`}
                >
                  <p className="text-xs font-medium">{style.label}</p>
                  <p className="text-[10px] mt-0.5 opacity-60">{style.description}</p>
                </button>
              ))}
            </div>
          </FieldGroup>

          {/* Timezone */}
          <FieldGroup label="Timezone" description="Auto-detected. Override if needed.">
            <select
              value={profile.timezone}
              onChange={(e) => updateField('timezone', e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--bg-primary)] border border-[var(--bg-tertiary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-blue)] transition-colors"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{formatTimezone(tz)}</option>
              ))}
            </select>
          </FieldGroup>

          {/* Save button + feedback */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={saveProfile}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-[var(--brand-blue)] text-white hover:bg-[var(--brand-blue-hover)] disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Profile
            </button>

            {saved && (
              <span className="flex items-center gap-1 text-xs text-[var(--success)]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Saved
              </span>
            )}

            {error && (
              <span className="flex items-center gap-1 text-xs text-[var(--danger)]">
                <AlertTriangle className="w-3.5 h-3.5" />
                {error}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// FIELD GROUP — reusable label + description wrapper
// ============================================================================

function FieldGroup({
  label,
  description,
  children,
}: {
  label: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-[var(--bg-tertiary)] bg-[var(--bg-primary)] p-4">
      <div className="mb-2">
        <p className="text-xs font-medium text-[var(--text-primary)]">{label}</p>
        <p className="text-[10px] text-[var(--text-tertiary)]">{description}</p>
      </div>
      {children}
    </div>
  )
}
