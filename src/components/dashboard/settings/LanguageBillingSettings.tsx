'use client'

import React, { useState, useEffect } from 'react'
import { Check, CreditCard, Zap, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { useSettings, LANGUAGES, type LanguageId } from '@/contexts/SettingsContext'
import { SectionHeader } from './shared'

export function LanguageSettings() {
  const { language, setLanguage } = useSettings()

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Sovereign Language"
        description="Configure the output language for AI responses and interface"
      />

      <div className="space-y-3">
        {(Object.entries(LANGUAGES) as [LanguageId, typeof LANGUAGES[LanguageId]][]).map(([id, lang]) => (
          <button
            key={id}
            onClick={() => setLanguage(id)}
            className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
              language === id
                ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/10 shadow-[0_0_15px_-5px_var(--brand-blue)]'
                : 'border-[var(--border-default)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]/30'
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-semibold ${
              language === id ? 'bg-[var(--brand-blue)]/20 text-[var(--brand-blue)]' : 'bg-[var(--bg-elevated)]/30 text-[var(--text-secondary)]'
            }`}>
              {lang.nativeName.charAt(0)}
            </div>
            <div className="flex-1 text-left">
              <p className={`text-sm font-medium ${language === id ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                {lang.name}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">{lang.nativeName}</p>
            </div>
            {language === id && (
              <Check className="w-5 h-5 text-[var(--brand-blue)]" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

export function BillingSettings() {
  const [planTier, setPlanTier] = useState<string>('free')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/user/profile', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        if (json.data?.subscriptionTier) {
          setPlanTier(json.data.subscriptionTier)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const planLabels: Record<string, string> = {
    free: 'Free Tier',
    starter: 'Starter',
    professional: 'Professional',
    enterprise: 'Enterprise',
    sovereign: 'Sovereign',
    mercury: 'Starter',
    syndicate: 'Enterprise',
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Plan & Usage"
        description="Monitor your subscription and resource consumption"
      />

      {/* Current Plan Card */}
      <div className="p-6 bg-gradient-to-br from-[var(--brand-blue)]/10 to-[var(--bg-secondary)] border border-[var(--brand-blue)]/30 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-[var(--brand-blue)] font-medium mb-1">CURRENT PLAN</p>
            {loading ? (
              <div className="h-7 w-32 bg-[var(--bg-tertiary)] rounded animate-pulse" />
            ) : (
              <p className="text-xl font-bold text-[var(--text-primary)]">{planLabels[planTier] || planTier}</p>
            )}
          </div>
          <div className="p-3 bg-[var(--brand-blue)]/20 rounded-xl">
            <Zap className="w-6 h-6 text-[var(--brand-blue)]" />
          </div>
        </div>

        <p className="text-xs text-[var(--text-tertiary)]">
          Beta Access — usage tracking coming soon
        </p>
      </div>

      {/* Manage Subscription */}
      <button onClick={async () => {
        try {
          const res = await fetch('/api/billing/portal', { method: 'POST' })
          const data = await res.json()
          if (data.url) window.open(data.url, '_self')
          else toast.error(data.error || 'Unable to open billing portal')
        } catch { toast.error('Unable to open billing portal') }
      }} className="w-full flex items-center justify-between p-4 bg-[var(--bg-elevated)]/30 border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded-xl transition-colors group" aria-label="Manage subscription">
        <div className="flex items-center gap-3">
          <CreditCard className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors" />
          <div className="text-left">
            <p className="text-sm font-medium text-[var(--text-primary)]">Manage Subscription</p>
            <p className="text-xs text-[var(--text-tertiary)]">Update payment method, view invoices</p>
          </div>
        </div>
        <ExternalLink className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] transition-colors" />
      </button>
    </div>
  )
}
