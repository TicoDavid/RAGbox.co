'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  MessageCircle,
  Mic,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Send,
  X,
  Eye,
  EyeOff,
  Link2,
  Unlink,
  Copy,
  ExternalLink,
  Phone,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { toast } from 'sonner'

// ============================================================================
// TYPES
// ============================================================================

interface IntegrationSettingsData {
  whatsappEnabled: boolean
  whatsappProvider: string
  vonageApiKey: string | null
  vonageApiSecret: string | null
  vonageApplicationId: string | null
  vonageWhatsAppNumber: string | null
  metaAccessToken: string | null
  metaPhoneNumberId: string | null
  metaAppSecret: string | null
  mercuryVoiceEnabled: boolean
  mercuryVoiceModel: string
  mercuryAutoReply: boolean
  whatsappAllowInbound: boolean
  whatsappAllowOutbound: boolean
  whatsappAllowVoiceNotes: boolean
  whatsappAllowedNumbers: string[]
  defaultVaultId: string | null
}

interface Vault {
  id: string
  name: string
}

interface RoamGroup {
  id: string
  name: string
  description?: string
  memberCount?: number
}

interface RoamStatus {
  status: 'connected' | 'disconnected' | 'error'
  targetGroupName?: string
  targetGroupId?: string
  mentionOnly?: boolean
  meetingSummaries?: boolean
  connectedAt?: string
  error?: string
}

const VOICE_MODELS = [
  { value: 'aura-asteria-en', label: 'Asteria (Female, US)' },
  { value: 'aura-luna-en', label: 'Luna (Female, US)' },
  { value: 'aura-stella-en', label: 'Stella (Female, US)' },
  { value: 'aura-athena-en', label: 'Athena (Female, UK)' },
  { value: 'aura-hera-en', label: 'Hera (Female, US)' },
  { value: 'aura-orion-en', label: 'Orion (Male, US)' },
]

// ============================================================================
// COMPONENT
// ============================================================================

export default function IntegrationsSettings() {
  const [settings, setSettings] = useState<IntegrationSettingsData | null>(null)
  const [vaults, setVaults] = useState<Vault[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [testPhone, setTestPhone] = useState('')
  const [newNumber, setNewNumber] = useState('')
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ROAM state
  const [roamApiKey, setRoamApiKey] = useState('')
  const [roamKeyVisible, setRoamKeyVisible] = useState(false)
  const [roamGroups, setRoamGroups] = useState<RoamGroup[]>([])
  const [roamSelectedGroup, setRoamSelectedGroup] = useState('')
  const [roamMentionOnly, setRoamMentionOnly] = useState(true)
  const [roamMeetingSummaries, setRoamMeetingSummaries] = useState(true)
  const [roamStatus, setRoamStatus] = useState<RoamStatus>({ status: 'disconnected' })
  const [roamLoadingGroups, setRoamLoadingGroups] = useState(false)
  const [roamConnecting, setRoamConnecting] = useState(false)
  const [roamError, setRoamError] = useState('')

  // --------------------------------------------------------------------------
  // FETCH SETTINGS + VAULTS
  // --------------------------------------------------------------------------

  useEffect(() => {
    async function load() {
      try {
        const [settingsRes, vaultsRes] = await Promise.all([
          apiFetch('/api/settings/integrations'),
          apiFetch('/api/vaults').catch(() => null),
        ])

        if (settingsRes.ok) {
          const data = await settingsRes.json()
          setSettings(data.data)
        }

        if (vaultsRes?.ok) {
          const data = await vaultsRes.json()
          setVaults(data.data || [])
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
        toast.error('Failed to load integration settings')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // --------------------------------------------------------------------------
  // ROAM: FETCH STATUS ON MOUNT
  // --------------------------------------------------------------------------

  useEffect(() => {
    async function loadRoamStatus() {
      try {
        const res = await apiFetch('/api/integrations/roam/status')
        if (res.ok) {
          const data = await res.json()
          if (data.data) {
            setRoamStatus(data.data)
            if (data.data.mentionOnly !== undefined) setRoamMentionOnly(data.data.mentionOnly)
            if (data.data.meetingSummaries !== undefined) setRoamMeetingSummaries(data.data.meetingSummaries)
          }
        }
      } catch {
        // ROAM status not available yet — that's OK
      }
    }
    loadRoamStatus()
  }, [])

  // --------------------------------------------------------------------------
  // ROAM: FETCH GROUPS ON API KEY BLUR
  // --------------------------------------------------------------------------

  const fetchRoamGroups = useCallback(async () => {
    if (!roamApiKey.trim()) return
    setRoamLoadingGroups(true)
    setRoamError('')
    try {
      const res = await apiFetch('/api/integrations/roam/groups', {
        headers: { 'X-Roam-Api-Key': roamApiKey },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to fetch groups')
      }
      const data = await res.json()
      setRoamGroups(data.data || [])
      if (data.data?.length > 0 && !roamSelectedGroup) {
        setRoamSelectedGroup(data.data[0].id)
      }
    } catch (err) {
      setRoamError(err instanceof Error ? err.message : 'Failed to fetch groups')
      setRoamGroups([])
    } finally {
      setRoamLoadingGroups(false)
    }
  }, [roamApiKey, roamSelectedGroup])

  // --------------------------------------------------------------------------
  // ROAM: CONNECT / DISCONNECT
  // --------------------------------------------------------------------------

  const handleRoamConnect = async () => {
    if (!roamApiKey.trim() || !roamSelectedGroup) {
      toast.error('Enter an API key and select a group')
      return
    }
    setRoamConnecting(true)
    setRoamError('')
    try {
      const res = await apiFetch('/api/integrations/roam/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: roamApiKey,
          targetGroupId: roamSelectedGroup,
          targetGroupName: roamGroups.find((g) => g.id === roamSelectedGroup)?.name || '',
          mentionOnly: roamMentionOnly,
          meetingSummaries: roamMeetingSummaries,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Connection failed')
      }
      const data = await res.json()
      setRoamStatus(data.data || { status: 'connected', targetGroupName: roamGroups.find((g) => g.id === roamSelectedGroup)?.name })
      setRoamApiKey('')
      toast.success('ROAM connected successfully')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed'
      setRoamError(msg)
      setRoamStatus({ status: 'error', error: msg })
      toast.error(msg)
    } finally {
      setRoamConnecting(false)
    }
  }

  const handleRoamDisconnect = async () => {
    setRoamConnecting(true)
    try {
      const res = await apiFetch('/api/integrations/roam/disconnect', { method: 'POST' })
      if (!res.ok) throw new Error('Disconnect failed')
      setRoamStatus({ status: 'disconnected' })
      setRoamGroups([])
      setRoamSelectedGroup('')
      toast.success('ROAM disconnected')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to disconnect')
    } finally {
      setRoamConnecting(false)
    }
  }

  // --------------------------------------------------------------------------
  // AUTO-SAVE
  // --------------------------------------------------------------------------

  const saveField = useCallback(
    async (updates: Partial<IntegrationSettingsData>) => {
      if (!settings) return

      // Optimistic update
      setSettings((prev) => (prev ? { ...prev, ...updates } : prev))

      // Debounce saves
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(async () => {
        setSaving(true)
        try {
          const res = await apiFetch('/api/settings/integrations', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          })
          if (!res.ok) throw new Error('Save failed')
          toast.success('Settings saved')
        } catch {
          toast.error('Failed to save settings')
        } finally {
          setSaving(false)
        }
      }, 500)
    },
    [settings],
  )

  // --------------------------------------------------------------------------
  // TEST CONNECTION
  // --------------------------------------------------------------------------

  const handleTestConnection = async () => {
    if (!testPhone) {
      toast.error('Enter a phone number first')
      return
    }
    setTestStatus('sending')
    try {
      const res = await apiFetch('/api/settings/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: testPhone }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Test failed')
      }
      setTestStatus('success')
      toast.success('Test message sent!')
      setTimeout(() => setTestStatus('idle'), 3000)
    } catch (error) {
      setTestStatus('error')
      toast.error(error instanceof Error ? error.message : 'Test failed')
      setTimeout(() => setTestStatus('idle'), 3000)
    }
  }

  // --------------------------------------------------------------------------
  // ALLOWED NUMBERS
  // --------------------------------------------------------------------------

  const addAllowedNumber = () => {
    if (!newNumber || !settings) return
    const cleaned = newNumber.startsWith('+') ? newNumber : `+${newNumber}`
    if (!/^\+\d{10,15}$/.test(cleaned)) {
      toast.error('Invalid phone number (E.164 format required)')
      return
    }
    if (settings.whatsappAllowedNumbers.includes(cleaned)) {
      toast.error('Number already in list')
      return
    }
    const updated = [...settings.whatsappAllowedNumbers, cleaned]
    saveField({ whatsappAllowedNumbers: updated })
    setNewNumber('')
  }

  const removeAllowedNumber = (number: string) => {
    if (!settings) return
    const updated = settings.whatsappAllowedNumbers.filter((n) => n !== number)
    saveField({ whatsappAllowedNumbers: updated })
  }

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-[var(--brand-blue)]" />
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="text-center py-12 text-[var(--text-tertiary)] text-sm">
        Failed to load settings. Please refresh the page.
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <MessageCircle size={16} className="text-[var(--brand-blue)]" />
          Integration Settings
        </h3>
        {saving && (
          <span className="text-[10px] text-[var(--brand-blue)] flex items-center gap-1">
            <Loader2 size={10} className="animate-spin" />
            Saving...
          </span>
        )}
      </div>

      {/* ================================================================== */}
      {/* SECTION 0: ROAM Integration */}
      {/* ================================================================== */}
      <div className="rounded-lg border border-[var(--bg-tertiary)] bg-[var(--bg-primary)] p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <span className="text-[9px] font-bold text-white">R</span>
            </div>
            <span className="text-xs font-medium text-[var(--text-primary)]">ROAM</span>
          </div>
          {roamStatus.status === 'connected' && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
              <span className="text-[10px] text-[var(--success)]">Connected</span>
            </div>
          )}
          {roamStatus.status === 'error' && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[var(--danger)]" />
              <span className="text-[10px] text-[var(--danger)]">Error</span>
            </div>
          )}
        </div>

        {/* Connected state */}
        {roamStatus.status === 'connected' && (
          <div className="space-y-3 mt-3 pt-3 border-t border-[var(--bg-tertiary)]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-[var(--text-primary)] font-medium">{roamStatus.targetGroupName || 'Connected Group'}</div>
                <div className="text-[10px] text-[var(--text-tertiary)]">
                  {roamStatus.mentionOnly ? '@mentions only' : 'All messages'}
                  {roamStatus.meetingSummaries ? ' · Meeting summaries ON' : ''}
                </div>
              </div>
              <button
                onClick={handleRoamDisconnect}
                disabled={roamConnecting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[var(--danger)] border border-[var(--danger)]/30 hover:bg-[var(--danger)]/10 transition-colors disabled:opacity-50"
              >
                {roamConnecting ? <Loader2 size={12} className="animate-spin" /> : <Unlink size={12} />}
                Disconnect
              </button>
            </div>
          </div>
        )}

        {/* Error state */}
        {roamStatus.status === 'error' && (
          <div className="mt-3 pt-3 border-t border-[var(--bg-tertiary)]">
            <div className="flex items-center justify-between">
              <div className="text-xs text-[var(--danger)]">{roamStatus.error || roamError || 'Connection failed'}</div>
              <button
                onClick={() => { setRoamStatus({ status: 'disconnected' }); setRoamError('') }}
                className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--bg-elevated)]/30 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Disconnected state — setup form */}
        {roamStatus.status === 'disconnected' && (
          <div className="space-y-3 mt-3 pt-3 border-t border-[var(--bg-tertiary)]">
            {/* API Key */}
            <div>
              <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">ROAM API Key</label>
              <div className="relative">
                <input
                  type={roamKeyVisible ? 'text' : 'password'}
                  value={roamApiKey}
                  onChange={(e) => setRoamApiKey(e.target.value)}
                  onBlur={fetchRoamGroups}
                  placeholder="Paste your ROAM API key"
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--bg-elevated)] rounded px-2 py-1.5 pr-8 text-xs text-[var(--text-primary)] placeholder:text-[var(--border-default)] focus:outline-none focus:border-[var(--brand-blue)]"
                />
                <button
                  type="button"
                  onClick={() => setRoamKeyVisible(!roamKeyVisible)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                >
                  {roamKeyVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
            </div>

            {/* Groups dropdown */}
            <div>
              <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">Target Group</label>
              {roamLoadingGroups ? (
                <div className="flex items-center gap-2 py-2 text-[10px] text-[var(--text-tertiary)]">
                  <Loader2 size={12} className="animate-spin" />
                  Loading groups...
                </div>
              ) : roamGroups.length > 0 ? (
                <select
                  value={roamSelectedGroup}
                  onChange={(e) => setRoamSelectedGroup(e.target.value)}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--bg-elevated)] rounded px-2 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-blue)]"
                >
                  {roamGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}{g.memberCount ? ` (${g.memberCount} members)` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-[10px] text-[var(--text-tertiary)] py-1">
                  {roamApiKey ? 'Enter API key and press Tab to load groups' : 'Enter API key above to load groups'}
                </div>
              )}
            </div>

            {/* Toggles */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-[var(--text-primary)]">@mentions only</div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">Only respond when mentioned</div>
                </div>
                <Toggle checked={roamMentionOnly} onChange={setRoamMentionOnly} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-[var(--text-primary)]">Meeting summaries</div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">Post summaries after meetings</div>
                </div>
                <Toggle checked={roamMeetingSummaries} onChange={setRoamMeetingSummaries} />
              </div>
            </div>

            {/* Error message */}
            {roamError && (
              <div className="flex items-center gap-1.5 text-xs text-[var(--danger)]">
                <AlertCircle size={12} />
                {roamError}
              </div>
            )}

            {/* Activate button */}
            <button
              onClick={handleRoamConnect}
              disabled={roamConnecting || !roamApiKey.trim() || !roamSelectedGroup}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {roamConnecting ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
              Activate
            </button>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* SECTION 1: WhatsApp — Vonage Demo */}
      {/* ================================================================== */}
      <div className="rounded-lg border border-[var(--bg-tertiary)] bg-[var(--bg-primary)] p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-[#25D366] flex items-center justify-center">
              <MessageCircle size={11} className="text-white" />
            </div>
            <span className="text-xs font-medium text-[var(--text-primary)]">WhatsApp</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]">Vonage</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
            <span className="text-[10px] text-[var(--success)]">Connected</span>
          </div>
        </div>

        <div className="space-y-3 mt-3 pt-3 border-t border-[var(--bg-tertiary)]">
          {/* Connection info */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-[10px] text-[var(--text-tertiary)]">Phone Number</div>
              <div className="text-xs text-[var(--text-primary)] font-mono flex items-center gap-1">
                <Phone size={10} className="text-[var(--text-tertiary)]" />
                {settings.vonageWhatsAppNumber || '+1 (415) 738-6102'}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[var(--text-tertiary)]">Messages</div>
              <div className="text-xs text-[var(--text-primary)]">—</div>
            </div>
            <div>
              <div className="text-[10px] text-[var(--text-tertiary)]">Last Active</div>
              <div className="text-xs text-[var(--text-primary)]">—</div>
            </div>
          </div>

          {/* Auto-respond toggle */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-[var(--text-primary)]">Auto-respond to inbound</div>
              <div className="text-[10px] text-[var(--text-tertiary)]">Mercury replies to incoming messages</div>
            </div>
            <Toggle
              checked={settings.mercuryAutoReply}
              onChange={(v) => saveField({ mercuryAutoReply: v })}
            />
          </div>

          {/* Test Connection */}
          <div className="pt-2 border-t border-[var(--bg-tertiary)]">
            <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">Test Connection</label>
            <div className="flex gap-2">
              <input
                type="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+1234567890"
                className="flex-1 bg-[var(--bg-secondary)] border border-[var(--bg-elevated)] rounded px-2 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--border-default)] focus:outline-none focus:border-[var(--brand-blue)]"
              />
              <button
                onClick={handleTestConnection}
                disabled={testStatus === 'sending'}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded text-xs text-[var(--text-primary)] transition-colors"
              >
                {testStatus === 'sending' ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : testStatus === 'success' ? (
                  <CheckCircle2 size={12} />
                ) : testStatus === 'error' ? (
                  <AlertCircle size={12} />
                ) : (
                  <Send size={12} />
                )}
                Test
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* SECTION 1b: WhatsApp — Meta Cloud API (Coming Soon) */}
      {/* ================================================================== */}
      <div className="rounded-lg border border-[var(--bg-tertiary)] bg-[var(--bg-primary)] p-4 mb-4 opacity-60">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-[#25D366]/50 flex items-center justify-center">
              <MessageCircle size={11} className="text-white/70" />
            </div>
            <span className="text-xs font-medium text-[var(--text-primary)]">WhatsApp</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]">Meta Cloud API</span>
          </div>
        </div>

        {/* Coming Soon banner */}
        <div className="rounded-lg bg-[var(--warning)]/10 border border-[var(--warning)]/20 px-3 py-2 mb-3">
          <div className="text-xs font-medium text-[var(--warning)]">Coming Soon</div>
          <div className="text-[10px] text-[var(--text-tertiary)]">Meta Business Verification Required</div>
        </div>

        <div className="space-y-3 mt-3 pt-3 border-t border-[var(--bg-tertiary)]">
          {/* Meta Cloud inputs (greyed out) */}
          <div>
            <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">Business Account ID</label>
            <input
              type="text"
              disabled
              placeholder="Enter WhatsApp Business Account ID"
              className="w-full bg-[var(--bg-secondary)] border border-[var(--bg-elevated)] rounded px-2 py-1.5 text-xs text-[var(--text-tertiary)] placeholder:text-[var(--border-default)] cursor-not-allowed"
            />
          </div>
          <div>
            <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">Phone Number ID</label>
            <input
              type="text"
              disabled
              placeholder="Enter Phone Number ID"
              className="w-full bg-[var(--bg-secondary)] border border-[var(--bg-elevated)] rounded px-2 py-1.5 text-xs text-[var(--text-tertiary)] placeholder:text-[var(--border-default)] cursor-not-allowed"
            />
          </div>
          <div>
            <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">Permanent Access Token</label>
            <input
              type="password"
              disabled
              placeholder="Enter Access Token"
              className="w-full bg-[var(--bg-secondary)] border border-[var(--bg-elevated)] rounded px-2 py-1.5 text-xs text-[var(--text-tertiary)] placeholder:text-[var(--border-default)] cursor-not-allowed"
            />
          </div>

          {/* Webhook URL + Verify Token (read-only) */}
          <div className="pt-2 border-t border-[var(--bg-tertiary)]">
            <ReadOnlyCopyField
              label="Webhook URL"
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/whatsapp`}
            />
            <div className="mt-2">
              <ReadOnlyCopyField
                label="Verify Token"
                value="ragbox-whatsapp-verify-token"
              />
            </div>
          </div>

          {/* Meta setup guide link */}
          <a
            href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[10px] text-[var(--brand-blue)] hover:underline"
          >
            <ExternalLink size={10} />
            Meta WhatsApp Cloud API Setup Guide
          </a>
        </div>
      </div>

      {/* ================================================================== */}
      {/* SECTION 2: Mercury Voice */}
      {/* ================================================================== */}
      <div className="rounded-lg border border-[var(--bg-tertiary)] bg-[var(--bg-primary)] p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Mic size={14} className="text-[var(--brand-blue)]" />
            <span className="text-xs font-medium text-[var(--text-primary)]">Mercury Voice</span>
          </div>
          <Toggle
            checked={settings.mercuryVoiceEnabled}
            onChange={(v) => saveField({ mercuryVoiceEnabled: v })}
          />
        </div>

        <div className="space-y-3 mt-3 pt-3 border-t border-[var(--bg-tertiary)]">
          {/* Voice Model */}
          <div>
            <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">Voice Model</label>
            <select
              value={settings.mercuryVoiceModel}
              onChange={(e) => saveField({ mercuryVoiceModel: e.target.value })}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--bg-elevated)] rounded px-2 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-blue)]"
            >
              {VOICE_MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Auto-Reply */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-[var(--text-primary)]">Auto-Reply</div>
              <div className="text-[10px] text-[var(--text-tertiary)]">
                Automatically respond to WhatsApp messages via RAG
              </div>
            </div>
            <Toggle
              checked={settings.mercuryAutoReply}
              onChange={(v) => saveField({ mercuryAutoReply: v })}
            />
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* SECTION 3: Permissions */}
      {/* ================================================================== */}
      <div className="rounded-lg border border-[var(--bg-tertiary)] bg-[var(--bg-primary)] p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={14} className="text-[var(--warning)]" />
          <span className="text-xs font-medium text-[var(--text-primary)]">Permissions</span>
        </div>

        <div className="space-y-3">
          <ToggleRow
            label="Allow Inbound Messages"
            checked={settings.whatsappAllowInbound}
            onChange={(v) => saveField({ whatsappAllowInbound: v })}
          />
          <ToggleRow
            label="Allow Outbound Messages"
            checked={settings.whatsappAllowOutbound}
            onChange={(v) => saveField({ whatsappAllowOutbound: v })}
          />
          <ToggleRow
            label="Allow Voice Notes"
            checked={settings.whatsappAllowVoiceNotes}
            onChange={(v) => saveField({ whatsappAllowVoiceNotes: v })}
          />

          {/* Allowed Numbers */}
          <div className="pt-2 border-t border-[var(--bg-tertiary)]">
            <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">
              Allowed Phone Numbers (E.164)
            </label>
            <div className="flex flex-wrap gap-1 mb-2">
              {settings.whatsappAllowedNumbers.map((num) => (
                <span
                  key={num}
                  className="flex items-center gap-1 px-2 py-0.5 bg-[var(--bg-secondary)] border border-[var(--bg-elevated)] rounded-full text-[10px] text-[var(--text-primary)]"
                >
                  {num}
                  <button
                    onClick={() => removeAllowedNumber(num)}
                    className="text-[var(--text-tertiary)] hover:text-[var(--danger)]"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
              {settings.whatsappAllowedNumbers.length === 0 && (
                <span className="text-[10px] text-[var(--border-default)]">All numbers allowed</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="tel"
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
                placeholder="+1234567890"
                onKeyDown={(e) => e.key === 'Enter' && addAllowedNumber()}
                className="flex-1 bg-[var(--bg-secondary)] border border-[var(--bg-elevated)] rounded px-2 py-1 text-xs text-[var(--text-primary)] placeholder:text-[var(--border-default)] focus:outline-none focus:border-[var(--brand-blue)]"
              />
              <button
                onClick={addAllowedNumber}
                className="px-2 py-1 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] rounded text-xs text-[var(--text-primary)] transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Default Vault */}
          <div className="pt-2 border-t border-[var(--bg-tertiary)]">
            <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">Default Vault</label>
            <select
              value={settings.defaultVaultId || ''}
              onChange={(e) =>
                saveField({ defaultVaultId: e.target.value || null })
              }
              className="w-full bg-[var(--bg-secondary)] border border-[var(--bg-elevated)] rounded px-2 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-blue)]"
            >
              <option value="">No default vault</option>
              {vaults.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`w-10 h-5 rounded-full relative transition-colors ${
        checked ? 'bg-[var(--brand-blue)]' : 'bg-[var(--bg-elevated)]'
      }`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-[var(--text-primary)] transition-all ${
          checked ? 'right-0.5' : 'left-0.5'
        }`}
      />
    </button>
  )
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[var(--text-primary)]">{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}

function CredentialField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string | null
  onChange: (v: string) => void
  type?: 'text' | 'password'
  placeholder?: string
}) {
  const [localValue, setLocalValue] = useState(value || '')
  const [focused, setFocused] = useState(false)

  // When we focus a masked field, clear it for fresh input
  const handleFocus = () => {
    setFocused(true)
    if (value && /^\*+/.test(value)) {
      setLocalValue('')
    }
  }

  const handleBlur = () => {
    setFocused(false)
    if (localValue && localValue !== value) {
      onChange(localValue)
    }
  }

  // Update local value when prop changes (e.g. after save)
  useEffect(() => {
    if (!focused) {
      setLocalValue(value || '')
    }
  }, [value, focused])

  return (
    <div>
      <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">{label}</label>
      <input
        type={type}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="w-full bg-[var(--bg-secondary)] border border-[var(--bg-elevated)] rounded px-2 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--border-default)] focus:outline-none focus:border-[var(--brand-blue)]"
      />
    </div>
  )
}

function ReadOnlyCopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  return (
    <div>
      <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">{label}</label>
      <div className="flex gap-1">
        <input
          type="text"
          readOnly
          value={value}
          className="flex-1 bg-[var(--bg-secondary)] border border-[var(--bg-elevated)] rounded px-2 py-1.5 text-xs text-[var(--text-tertiary)] font-mono cursor-default"
        />
        <button
          onClick={handleCopy}
          className="px-2 py-1.5 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
        >
          {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
        </button>
      </div>
    </div>
  )
}
