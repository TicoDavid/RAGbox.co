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
        <Loader2 size={24} className="animate-spin text-[#00F0FF]" />
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="text-center py-12 text-[#666] text-sm">
        Failed to load settings. Please refresh the page.
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <MessageCircle size={16} className="text-[#00F0FF]" />
          Integration Settings
        </h3>
        {saving && (
          <span className="text-[10px] text-[#00F0FF] flex items-center gap-1">
            <Loader2 size={10} className="animate-spin" />
            Saving...
          </span>
        )}
      </div>

      {/* ================================================================== */}
      {/* SECTION 1: WhatsApp Connection */}
      {/* ================================================================== */}
      <div className="rounded-lg border border-[#222] bg-[#0a0a0a] p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageCircle size={14} className="text-green-500" />
            <span className="text-xs font-medium text-white">WhatsApp Connection</span>
          </div>
          <Toggle
            checked={settings.whatsappEnabled}
            onChange={(v) => saveField({ whatsappEnabled: v })}
          />
        </div>

        {settings.whatsappEnabled && (
          <div className="space-y-3 mt-3 pt-3 border-t border-[#222]">
            {/* Provider */}
            <div>
              <label className="text-[10px] text-[#666] block mb-1">Provider</label>
              <select
                value={settings.whatsappProvider}
                onChange={(e) => saveField({ whatsappProvider: e.target.value })}
                className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#00F0FF]"
              >
                <option value="vonage">Vonage</option>
                <option value="meta">Meta (WhatsApp Cloud API)</option>
              </select>
            </div>

            {/* Vonage fields */}
            {settings.whatsappProvider === 'vonage' && (
              <>
                <CredentialField
                  label="API Key"
                  value={settings.vonageApiKey}
                  onChange={(v) => saveField({ vonageApiKey: v })}
                />
                <CredentialField
                  label="API Secret"
                  value={settings.vonageApiSecret}
                  onChange={(v) => saveField({ vonageApiSecret: v })}
                  type="password"
                />
                <CredentialField
                  label="Application ID"
                  value={settings.vonageApplicationId}
                  onChange={(v) => saveField({ vonageApplicationId: v })}
                />
                <CredentialField
                  label="WhatsApp Number"
                  value={settings.vonageWhatsAppNumber}
                  onChange={(v) => saveField({ vonageWhatsAppNumber: v })}
                  placeholder="14157386102"
                />
              </>
            )}

            {/* Meta fields */}
            {settings.whatsappProvider === 'meta' && (
              <>
                <CredentialField
                  label="Access Token"
                  value={settings.metaAccessToken}
                  onChange={(v) => saveField({ metaAccessToken: v })}
                  type="password"
                />
                <CredentialField
                  label="Phone Number ID"
                  value={settings.metaPhoneNumberId}
                  onChange={(v) => saveField({ metaPhoneNumberId: v })}
                />
                <CredentialField
                  label="App Secret"
                  value={settings.metaAppSecret}
                  onChange={(v) => saveField({ metaAppSecret: v })}
                  type="password"
                />
              </>
            )}

            {/* Test Connection */}
            <div className="pt-2 border-t border-[#222]">
              <label className="text-[10px] text-[#666] block mb-1">Test Connection</label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="+1234567890"
                  className="flex-1 bg-[#111] border border-[#333] rounded px-2 py-1.5 text-xs text-white placeholder:text-[#444] focus:outline-none focus:border-[#00F0FF]"
                />
                <button
                  onClick={handleTestConnection}
                  disabled={testStatus === 'sending'}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded text-xs text-white transition-colors"
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
        )}
      </div>

      {/* ================================================================== */}
      {/* SECTION 2: Mercury Voice */}
      {/* ================================================================== */}
      <div className="rounded-lg border border-[#222] bg-[#0a0a0a] p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Mic size={14} className="text-[#00F0FF]" />
            <span className="text-xs font-medium text-white">Mercury Voice</span>
          </div>
          <Toggle
            checked={settings.mercuryVoiceEnabled}
            onChange={(v) => saveField({ mercuryVoiceEnabled: v })}
          />
        </div>

        <div className="space-y-3 mt-3 pt-3 border-t border-[#222]">
          {/* Voice Model */}
          <div>
            <label className="text-[10px] text-[#666] block mb-1">Voice Model</label>
            <select
              value={settings.mercuryVoiceModel}
              onChange={(e) => saveField({ mercuryVoiceModel: e.target.value })}
              className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#00F0FF]"
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
              <div className="text-xs text-white">Auto-Reply</div>
              <div className="text-[10px] text-[#666]">
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
      <div className="rounded-lg border border-[#222] bg-[#0a0a0a] p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={14} className="text-amber-500" />
          <span className="text-xs font-medium text-white">Permissions</span>
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
          <div className="pt-2 border-t border-[#222]">
            <label className="text-[10px] text-[#666] block mb-1">
              Allowed Phone Numbers (E.164)
            </label>
            <div className="flex flex-wrap gap-1 mb-2">
              {settings.whatsappAllowedNumbers.map((num) => (
                <span
                  key={num}
                  className="flex items-center gap-1 px-2 py-0.5 bg-[#1a1a1a] border border-[#333] rounded-full text-[10px] text-white"
                >
                  {num}
                  <button
                    onClick={() => removeAllowedNumber(num)}
                    className="text-[#666] hover:text-red-500"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
              {settings.whatsappAllowedNumbers.length === 0 && (
                <span className="text-[10px] text-[#444]">All numbers allowed</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="tel"
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
                placeholder="+1234567890"
                onKeyDown={(e) => e.key === 'Enter' && addAllowedNumber()}
                className="flex-1 bg-[#111] border border-[#333] rounded px-2 py-1 text-xs text-white placeholder:text-[#444] focus:outline-none focus:border-[#00F0FF]"
              />
              <button
                onClick={addAllowedNumber}
                className="px-2 py-1 bg-[#222] hover:bg-[#333] rounded text-xs text-white transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Default Vault */}
          <div className="pt-2 border-t border-[#222]">
            <label className="text-[10px] text-[#666] block mb-1">Default Vault</label>
            <select
              value={settings.defaultVaultId || ''}
              onChange={(e) =>
                saveField({ defaultVaultId: e.target.value || null })
              }
              className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#00F0FF]"
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
        checked ? 'bg-[#00F0FF]' : 'bg-[#333]'
      }`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
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
      <span className="text-xs text-white">{label}</span>
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
      <label className="text-[10px] text-[#666] block mb-1">{label}</label>
      <input
        type={type}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 text-xs text-white placeholder:text-[#444] focus:outline-none focus:border-[#00F0FF]"
      />
    </div>
  )
}
