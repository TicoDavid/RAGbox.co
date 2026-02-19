'use client'

import React from 'react'
import { ShieldCheck, Zap, HelpCircle } from 'lucide-react'

/**
 * ConnectionsHelpText — BYOLLM help panel for AI Model Settings
 *
 * Contextual guidance shown alongside the BYOLLM configuration form.
 * Covers supported providers, security assurances, and cost guidance.
 *
 * STORY-028
 */

interface ConnectionsHelpTextProps {
  /** Whether the tenant has a configured BYOLLM connection. */
  isConfigured?: boolean
  /** Currently selected provider name. */
  provider?: string
}

export function ConnectionsHelpText({ isConfigured, provider }: ConnectionsHelpTextProps) {
  return (
    <div className="space-y-4 text-[var(--text-tertiary)] text-xs leading-relaxed">
      {/* Getting started */}
      {!isConfigured && (
        <div className="flex gap-2">
          <Zap size={14} className="mt-0.5 shrink-0 text-[var(--brand-blue)]" />
          <div>
            <p className="font-medium text-[var(--text-secondary)]">Connect your own LLM</p>
            <p className="mt-0.5">
              Paste an API key from OpenRouter, OpenAI, or any OpenAI-compatible provider.
              RAGbox will use your model for answers while keeping all citations,
              confidence scoring, and audit logging intact.
            </p>
          </div>
        </div>
      )}

      {/* Security */}
      <div className="flex gap-2">
        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-500" />
        <div>
          <p className="font-medium text-[var(--text-secondary)]">Your key is safe</p>
          <p className="mt-0.5">
            API keys are encrypted with AES-256-GCM via Google Cloud KMS before storage.
            The plaintext key is never logged, never visible after saving, and never
            shared with third parties.
          </p>
        </div>
      </div>

      {/* Cost guidance */}
      <div className="flex gap-2">
        <HelpCircle size={14} className="mt-0.5 shrink-0 text-[var(--text-tertiary)]" />
        <div>
          <p className="font-medium text-[var(--text-secondary)]">Estimated cost</p>
          <p className="mt-0.5">
            RAGbox uses ~2 LLM calls per question (SelfRAG). At current rates, this is
            roughly $0.001–$0.01 per question depending on the model.
            Billing comes from your provider{provider ? ` (${provider})` : ''}, not RAGbox.
          </p>
        </div>
      </div>

      {/* Supported providers */}
      <div className="border-t border-[var(--border-subtle)] pt-3">
        <p className="font-medium text-[var(--text-secondary)] mb-1">Supported providers</p>
        <ul className="space-y-0.5 list-disc list-inside">
          <li>OpenRouter (recommended — 100+ models from one key)</li>
          <li>OpenAI (GPT-4o, o1)</li>
          <li>Anthropic via OpenRouter (Claude Sonnet, Opus)</li>
          <li>Any OpenAI-compatible API</li>
        </ul>
      </div>

      {/* Fallback note */}
      {isConfigured && (
        <div className="border-t border-[var(--border-subtle)] pt-3">
          <p className="font-medium text-[var(--text-secondary)] mb-1">Fallback behavior</p>
          <p>
            Under &quot;User&apos;s Choice&quot; or &quot;AEGIS Only&quot; policy, RAGbox
            automatically falls back to the built-in AEGIS engine if your provider is
            unreachable. Under &quot;Private LLM Only&quot;, no fallback occurs.
          </p>
        </div>
      )}
    </div>
  )
}
