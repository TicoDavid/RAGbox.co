'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  MessageCircle,
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
  ExternalLink,
  Phone,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'
import { Toggle, ToggleRow, ReadOnlyCopyField } from './IntegrationControls'
import { useRoamIntegration } from '@/hooks/useRoamIntegration'

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

// ============================================================================
// COMPONENT
// ============================================================================

export function IntegrationsSettings() {
  const [settings, setSettings] = useState<IntegrationSettingsData | null>(null)
  const [vaults, setVaults] = useState<Vault[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [testPhone, setTestPhone] = useState('')
  const [newNumber, setNewNumber] = useState('')
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ROAM state (extracted to useRoamIntegration hook)
  const {
    roamClientId, setRoamClientId,
    roamApiKey, setRoamApiKey,
    roamKeyVisible, setRoamKeyVisible,
    roamWebhookSecret, setRoamWebhookSecret,
    roamSecretVisible, setRoamSecretVisible,
    roamResponseMode, setRoamResponseMode,
    roamGroups,
    roamSelectedGroup, setRoamSelectedGroup,
    roamStatus,
    roamLoadingGroups,
    roamTesting,
    roamTestResult,
    roamSaving,
    roamSaveSuccess,
    roamDisconnecting,
    roamError, setRoamError,
    resetError: resetRoamError,
    fetchRoamGroups,
    handleRoamTest,
    handleRoamSave,
    handleRoamDisconnect,
  } = useRoamIntegration()

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
        logger.error('Failed to load settings:', error)
        toast.error('Failed to load integration settings')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

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
              <span className="text-[10px] text-[var(--success)]">
                Connected{roamStatus.workspaceName ? ` \u00B7 ${roamStatus.workspaceName}` : ''}
              </span>
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
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-[10px] text-[var(--text-tertiary)]">Workspace</div>
                <div className="text-xs text-[var(--text-primary)] font-medium">
                  {roamStatus.workspaceName || 'ConnexUS Ai Inc'}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[var(--text-tertiary)]">Messages</div>
                <div className="text-xs text-[var(--text-primary)]">
                  {roamStatus.messageCount ?? '\u2014'}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[var(--text-tertiary)]">Last Webhook</div>
                <div className="text-xs text-[var(--text-primary)]">
                  {roamStatus.lastWebhook || '\u2014'}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-[var(--text-primary)] font-medium">{roamStatus.targetGroupName || 'Connected Group'}</div>
                <div className="text-[10px] text-[var(--text-tertiary)]">
                  {roamStatus.responseMode === 'all' ? 'All messages' : roamStatus.responseMode === 'dms_mentions' ? 'DMs + Mentions' : '@mentions only'}
                </div>
              </div>
              <button
                onClick={handleRoamDisconnect}
                disabled={roamDisconnecting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[var(--danger)] border border-[var(--danger)]/30 hover:bg-[var(--danger)]/10 transition-colors disabled:opacity-50"
              >
                {roamDisconnecting ? <Loader2 size={12} className="animate-spin" /> : <Unlink size={12} />}
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
                onClick={resetRoamError}
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
            {/* Client ID */}
            <div>
              <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">Client ID</label>
              <input
                type="text"
                value={roamClientId}
                onChange={(e) => setRoamClientId(e.target.value)}
                placeholder="Enter your ROAM Client ID"
                className="w-full bg-[var(--bg-secondary)] border border-[var(--bg-elevated)] rounded px-2 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--border-default)] focus:outline-none focus:border-[var(--brand-blue)]"
              />
            </div>

            {/* API Key */}
            <div>
              <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">API Key</label>
              <div className="relative">
                <input
                  type={roamKeyVisible ? 'text' : 'password'}
                  value={roamApiKey}
                  onChange={(e) => setRoamApiKey(e.target.value)}
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

            {/* Webhook Signing Secret */}
            <div>
              <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">Webhook Signing Secret</label>
              <div className="relative">
                <input
                  type={roamSecretVisible ? 'text' : 'password'}
                  value={roamWebhookSecret}
                  onChange={(e) => setRoamWebhookSecret(e.target.value)}
                  placeholder="Enter webhook signing secret"
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--bg-elevated)] rounded px-2 py-1.5 pr-8 text-xs text-[var(--text-primary)] placeholder:text-[var(--border-default)] focus:outline-none focus:border-[var(--brand-blue)]"
                />
                <button
                  type="button"
                  onClick={() => setRoamSecretVisible(!roamSecretVisible)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                >
                  {roamSecretVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
            </div>

            {/* Webhook URL (read-only + copy) */}
            <ReadOnlyCopyField
              label="Webhook URL"
              value="https://ragbox-app-100739220279.us-east4.run.app/api/webhooks/roam"
            />

            {/* Interactivity URL (read-only + copy) */}
            <ReadOnlyCopyField
              label="Interactivity URL"
              value="https://ragbox-app-100739220279.us-east4.run.app/api/roam/interactivity"
            />

            {/* Test Connection */}
            <div className="pt-2 border-t border-[var(--bg-tertiary)]">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRoamTest}
                  disabled={roamTesting || !roamApiKey.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--brand-blue)]/30 text-[var(--brand-blue)] hover:bg-[var(--brand-blue)]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {roamTesting ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
                  Test Connection
                </button>
                {roamTestResult && (
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${roamTestResult.success ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'}`} />
                    <span className={`text-[10px] ${roamTestResult.success ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                      {roamTestResult.success ? roamTestResult.workspaceName : roamTestResult.error}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Default Group */}
            <div>
              <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">Default Group</label>
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
                  {roamTestResult?.success ? 'No groups found' : 'Test connection to load groups'}
                </div>
              )}
            </div>

            {/* Response Mode */}
            <div>
              <label className="text-[10px] text-[var(--text-tertiary)] block mb-1.5">Response Mode</label>
              <div className="space-y-1.5">
                {([
                  { value: 'mentions' as const, label: 'Mentions only', desc: 'Respond when @mentioned' },
                  { value: 'all' as const, label: 'All messages', desc: 'Respond to every message in group' },
                  { value: 'dms_mentions' as const, label: 'DMs + Mentions', desc: 'DMs and @mentions' },
                ]).map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      roamResponseMode === opt.value
                        ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]'
                        : 'border-[var(--bg-elevated)] group-hover:border-[var(--text-tertiary)]'
                    }`}>
                      {roamResponseMode === opt.value && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <input
                      type="radio"
                      name="roamResponseMode"
                      value={opt.value}
                      checked={roamResponseMode === opt.value}
                      onChange={() => setRoamResponseMode(opt.value)}
                      className="sr-only"
                    />
                    <div>
                      <div className="text-xs text-[var(--text-primary)]">{opt.label}</div>
                      <div className="text-[10px] text-[var(--text-tertiary)]">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Error */}
            {roamError && (
              <div className="flex items-center gap-1.5 text-xs text-[var(--danger)]">
                <AlertCircle size={12} />
                {roamError}
              </div>
            )}

            {/* Save button */}
            <button
              onClick={handleRoamSave}
              disabled={roamSaving || !roamApiKey.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {roamSaving ? (
                <Loader2 size={12} className="animate-spin" />
              ) : roamSaveSuccess ? (
                <CheckCircle2 size={12} />
              ) : (
                <Link2 size={12} />
              )}
              {roamSaveSuccess ? 'Saved \u2713' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* SECTION 1: WhatsApp */}
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
      {/* Mercury Voice settings removed — consolidated into Mercury Settings Modal (Voice tab) */}
      {/* Voice enable/disable: Mercury header power button */}
      {/* Voice model selection: Mercury Settings > Voice tab */}
      {/* Auto-Reply moved to WhatsApp section above */}
      {/* ================================================================== */}

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

