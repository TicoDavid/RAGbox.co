'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { Loader2, Save, User, MessageSquare, Shield, Mail, CheckCircle, AlertTriangle, Unlink, Send } from 'lucide-react'

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

interface EmailStatus {
  connected: boolean
  emailAddress?: string
  provider?: string
  isActive?: boolean
  lastRefreshed?: string
  errorCount?: number
  lastError?: string
  watchExpires?: string
}

const PRESETS = [
  { key: 'professional', label: 'Professional', desc: 'Precise, formal, citation-focused' },
  { key: 'friendly', label: 'Friendly', desc: 'Warm, conversational, accessible' },
  { key: 'technical', label: 'Technical', desc: 'Detailed, thorough, cross-referencing' },
  { key: 'custom', label: 'Custom', desc: 'Write your own personality prompt' },
]

export default function MercurySettingsPage() {
  const searchParams = useSearchParams()
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

  // Email state
  const [emailStatus, setEmailStatus] = useState<EmailStatus>({ connected: false })
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailAction, setEmailAction] = useState<string | null>(null)
  const [emailToast, setEmailToast] = useState<string | null>(null)
  const [disconnectConfirm, setDisconnectConfirm] = useState(false)

  // Show toast on OAuth redirect
  useEffect(() => {
    if (searchParams.get('email') === 'connected') {
      setEmailToast('Gmail connected successfully')
      setTimeout(() => setEmailToast(null), 5000)
    }
    const emailError = searchParams.get('email_error')
    if (emailError) {
      setEmailToast(`Gmail connection failed: ${emailError}`)
      setTimeout(() => setEmailToast(null), 8000)
    }
  }, [searchParams])

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

          // Fetch email status for this persona
          loadEmailStatus(p.id)
        }
      } catch {
        // Silent
      } finally {
        setLoading(false)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadEmailStatus = async (agentId: string) => {
    try {
      setEmailLoading(true)
      const res = await apiFetch(`/api/agent/${agentId}/email`)
      if (res.ok) {
        const data = await res.json()
        setEmailStatus(data)
      }
    } catch {
      // Silent
    } finally {
      setEmailLoading(false)
    }
  }

  const handleConnectGmail = async () => {
    if (!persona) return
    setEmailAction('connecting')
    try {
      const res = await apiFetch(`/api/agent/${persona.id}/email/connect`)
      if (res.ok) {
        const data = await res.json()
        window.location.href = data.url
      } else {
        const data = await res.json().catch(() => ({ error: 'unknown' }))
        setEmailToast(`Gmail connection failed: ${data.error || res.statusText}`)
        setTimeout(() => setEmailToast(null), 5000)
      }
    } catch {
      setEmailToast('Failed to start Gmail connection')
      setTimeout(() => setEmailToast(null), 5000)
    } finally {
      setEmailAction(null)
    }
  }

  const handleDisconnectGmail = async () => {
    if (!persona) return
    setEmailAction('disconnecting')
    try {
      const res = await apiFetch(`/api/agent/${persona.id}/email/disconnect`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setEmailStatus({ connected: false })
        setDisconnectConfirm(false)
        setEmailToast('Gmail disconnected')
        setTimeout(() => setEmailToast(null), 5000)
      }
    } catch {
      setEmailToast('Failed to disconnect Gmail')
      setTimeout(() => setEmailToast(null), 5000)
    } finally {
      setEmailAction(null)
    }
  }

  const handleTestEmail = async () => {
    if (!persona) return
    setEmailAction('testing')
    try {
      const res = await apiFetch(`/api/agent/${persona.id}/email/test`, {
        method: 'POST',
      })
      if (res.ok) {
        setEmailToast('Test email sent! Check your inbox.')
        setTimeout(() => setEmailToast(null), 5000)
      } else {
        const data = await res.json()
        setEmailToast(`Test email failed: ${data.error || 'unknown error'}`)
        setTimeout(() => setEmailToast(null), 5000)
      }
    } catch {
      setEmailToast('Failed to send test email')
      setTimeout(() => setEmailToast(null), 5000)
    } finally {
      setEmailAction(null)
    }
  }

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
      {/* Toast notification */}
      {emailToast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg transition-all ${
          emailToast.includes('failed') || emailToast.includes('Failed') || emailToast.includes('error')
            ? 'bg-red-500/90 text-white'
            : 'bg-emerald-500/90 text-white'
        }`}>
          {emailToast}
        </div>
      )}

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

      {/* Email Integration */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Mail className="w-4 h-4" />
          Gmail Integration
        </h2>
        <p className="text-xs text-slate-500">
          Connect a Gmail account so Mercury can send and receive emails as your agent.
        </p>

        {emailLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading email status...
          </div>
        ) : emailStatus.connected ? (
          <div className="space-y-3 p-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium text-emerald-400">Connected</span>
              </div>
              {emailStatus.errorCount && emailStatus.errorCount > 0 ? (
                <div className="flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-amber-400">{emailStatus.errorCount} error{emailStatus.errorCount > 1 ? 's' : ''}</span>
                </div>
              ) : null}
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Email</span>
                <span className="text-sm text-white font-mono">{emailStatus.emailAddress}</span>
              </div>
              {emailStatus.lastRefreshed && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Last refreshed</span>
                  <span className="text-xs text-slate-300">
                    {new Date(emailStatus.lastRefreshed).toLocaleString()}
                  </span>
                </div>
              )}
              {emailStatus.watchExpires && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Watch expires</span>
                  <span className="text-xs text-slate-300">
                    {new Date(emailStatus.watchExpires).toLocaleString()}
                  </span>
                </div>
              )}
              {emailStatus.lastError && (
                <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/20">
                  <span className="text-xs text-red-400">Last error: {emailStatus.lastError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-default)]">
              <button
                onClick={handleTestEmail}
                disabled={emailAction === 'testing'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white text-xs font-medium transition-colors disabled:opacity-50"
              >
                {emailAction === 'testing' ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Send className="w-3 h-3" />
                )}
                Send Test Email
              </button>

              {disconnectConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400">Are you sure?</span>
                  <button
                    onClick={handleDisconnectGmail}
                    disabled={emailAction === 'disconnecting'}
                    className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {emailAction === 'disconnecting' ? 'Disconnecting...' : 'Yes, disconnect'}
                  </button>
                  <button
                    onClick={() => setDisconnectConfirm(false)}
                    className="px-3 py-1.5 rounded-md border border-[var(--border-default)] text-slate-400 text-xs hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDisconnectConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/10 transition-colors"
                >
                  <Unlink className="w-3 h-3" />
                  Disconnect Gmail
                </button>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={handleConnectGmail}
            disabled={emailAction === 'connecting'}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {emailAction === 'connecting' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
            Connect Gmail
          </button>
        )}
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
