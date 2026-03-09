'use client'

import React, { useState, useCallback } from 'react'
import type { ChatMessage, MercuryChannel, Citation } from '@/types/ragbox'
import { extractTextContent } from '@/stores/mercuryStore.types'
import { ConfidenceBadge } from './ConfidenceBadge'
import { ModelBadge } from './ModelBadge'
import { MarkdownRenderer } from './MarkdownRenderer'
import { Copy, Check, ThumbsUp, ThumbsDown, Share2, FileText, ExternalLink, Sparkles } from 'lucide-react'

// ============================================================================
// JSON GUARD — same fix as CenterMessage (BUG-009 / BUG-019 / HOTFIX)
// Parse structured JSON: extract answer, citations, and confidence.
// ============================================================================

interface ParsedResponse {
  content: string
  citations?: Citation[]
  confidence?: number
}

function parseStructuredResponse(
  raw: string,
  existingCitations?: Citation[],
  existingConfidence?: number,
): ParsedResponse {
  // Guard: ensure raw is always a string (database can return null via thread loading)
  const safeRaw = typeof raw === 'string' ? raw : String(raw ?? '')
  let cleaned = safeRaw.trim()

  // BUG-040: Strip markdown code fences (```json ... ```)
  if (cleaned.startsWith('```')) {
    const lines = cleaned.split('\n')
    if (lines.length >= 3) {
      cleaned = lines.slice(1, -1).join('\n').trim()
    }
  }

  // Helper: try to extract answer from a JSON string
  const tryExtract = (jsonStr: string): ParsedResponse | null => {
    try {
      const json = JSON.parse(jsonStr)
      const data = json.data ?? json
      const answer = data.answer
      if (typeof answer !== 'string') return null

      const jsonCitations = Array.isArray(data.citations) ? data.citations : undefined
      const citations = existingCitations && existingCitations.length > 0
        ? existingCitations
        : jsonCitations
      const confidence = existingConfidence ?? (typeof data.confidence === 'number' ? data.confidence : undefined)
      return { content: answer, citations, confidence }
    } catch {
      return null
    }
  }

  // Case 1: Content IS JSON (starts with {)
  if (cleaned.startsWith('{')) {
    const result = tryExtract(cleaned)
    if (result) return result
    return { content: safeRaw, citations: existingCitations, confidence: existingConfidence }
  }

  // BUG-053: Case 2: JSON embedded after preamble text
  const jsonIdx = cleaned.indexOf('{"answer"')
  const jsonIdx2 = jsonIdx === -1 ? cleaned.indexOf('{"data"') : jsonIdx
  const idx = jsonIdx !== -1 ? jsonIdx : jsonIdx2
  if (idx > 0) {
    const result = tryExtract(cleaned.slice(idx))
    if (result) return result
  }

  // Not JSON — return as-is
  return { content: safeRaw, citations: existingCitations, confidence: existingConfidence }
}

/** Extract prose only — used by ConversationThread streaming indicator */
export function extractProse(raw: string): string {
  return parseStructuredResponse(raw).content
}


interface MessageProps {
  message: ChatMessage
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

const CHANNEL_BADGE: Record<MercuryChannel, { label: string; color: string }> = {
  dashboard: { label: 'Dashboard', color: 'bg-[var(--brand-blue)]/20 text-[var(--brand-blue)] border-[var(--brand-blue)]/30' },
  whatsapp: { label: 'WhatsApp', color: 'bg-[var(--success)]/20 text-[var(--success)] border-[var(--success)]/30' },
  voice: { label: 'Voice', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  roam: { label: 'ROAM', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  email: { label: 'Email', color: 'bg-[var(--warning)]/20 text-[var(--warning)] border-[var(--warning)]/30' },
  sms: { label: 'SMS', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  slack: { label: 'Slack', color: 'bg-[#4A154B]/20 text-[#E01E5A] border-[#4A154B]/30' },
  phone: { label: 'Phone', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
}

function ChannelBadge({ channel }: { channel?: MercuryChannel }) {
  if (!channel) return null
  const badge = CHANNEL_BADGE[channel]
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border ${badge.color}`}>
      {badge.label}
    </span>
  )
}

// ============================================================================
// EPIC-028 Phase 3: Intent Classification Badge
// ============================================================================

type IntentType = 'document' | 'conversational' | 'meta' | 'greeting' | 'followup'

const INTENT_COLORS: Record<IntentType, string> = {
  document: 'bg-[var(--brand-blue)]/15 text-[var(--brand-blue)] border-[var(--brand-blue)]/30',
  conversational: 'bg-[var(--bg-elevated)] text-[var(--text-tertiary)] border-[var(--border-default)]',
  meta: 'bg-[var(--warning)]/15 text-[var(--warning)] border-[var(--warning)]/30',
  greeting: 'bg-[var(--success)]/15 text-[var(--success)] border-[var(--success)]/30',
  followup: 'bg-[var(--brand-blue-dim)]/15 text-[var(--brand-blue-dim)] border-[var(--brand-blue-dim)]/30',
}

function IntentBadge({ intent }: { intent?: string }) {
  if (!intent) return null
  const colors = INTENT_COLORS[intent as IntentType]
  if (!colors) return null
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border ${colors}`}>
      {intent}
    </span>
  )
}

// ============================================================================
// STORY-239: Perplexity-style Source Cards
// ============================================================================

function SourceCard({ citation }: { citation: Citation }) {
  const score = Math.round(citation.relevanceScore * 100)

  return (
    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[var(--bg-primary)]/60 border border-[var(--border-subtle)] hover:border-[var(--brand-blue)]/30 transition-colors group/source cursor-pointer">
      {/* Citation index badge */}
      <div className="shrink-0 w-6 h-6 rounded-full bg-[var(--brand-blue)]/20 text-[var(--brand-blue)] text-[10px] font-bold flex items-center justify-center mt-0.5">
        {citation.citationIndex}
      </div>
      <div className="flex-1 min-w-0">
        {/* Document name */}
        <div className="flex items-center gap-1.5">
          <FileText className="w-3 h-3 text-[var(--text-tertiary)] shrink-0" />
          <span className="text-xs font-medium text-[var(--text-primary)] truncate">
            {citation.documentName}
          </span>
          <ExternalLink className="w-3 h-3 text-[var(--text-tertiary)] opacity-0 group-hover/source:opacity-100 transition-opacity shrink-0" />
        </div>
        {/* Excerpt snippet */}
        {citation.excerpt && (
          <p className="text-[11px] text-[var(--text-tertiary)] mt-1 line-clamp-2 leading-relaxed">
            {citation.excerpt}
          </p>
        )}
        {/* Relevance score bar */}
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex-1 h-1 bg-[var(--bg-elevated)] rounded-full overflow-hidden max-w-[60px]">
            <div
              className="h-full bg-[var(--brand-blue)] rounded-full transition-all"
              style={{ width: `${score}%` }}
            />
          </div>
          <span className="text-[9px] text-[var(--text-tertiary)]">{score}% match</span>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// ACTION BUTTONS
// ============================================================================

function ActionButtons({ content }: { content: string }) {
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard may not be available */ }
  }, [content])

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content)
    } catch { /* clipboard may not be available */ }
  }, [content])

  const btnClass = 'p-1 rounded hover:bg-[var(--bg-elevated)] transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'

  return (
    <div className="flex items-center gap-0.5 mt-1.5 -ml-1">
      <button onClick={handleCopy} title="Copy" className={btnClass}>
        {copied ? <Check className="w-3.5 h-3.5 text-[var(--success)]" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
      <button
        onClick={() => setFeedback(feedback === 'up' ? null : 'up')}
        title="Helpful"
        className={`${btnClass} ${feedback === 'up' ? 'text-[var(--success)]' : ''}`}
      >
        <ThumbsUp className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => setFeedback(feedback === 'down' ? null : 'down')}
        title="Not helpful"
        className={`${btnClass} ${feedback === 'down' ? 'text-[var(--danger)]' : ''}`}
      >
        <ThumbsDown className="w-3.5 h-3.5" />
      </button>
      <button onClick={handleShare} title="Share" className={btnClass}>
        <Share2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ============================================================================
// MESSAGE COMPONENT — STORY-239: Perplexity-style layout
//
// User messages: compact right-aligned bubbles (unchanged).
// Assistant messages: full-width, no bubble, source cards below answer.
// ============================================================================

export function Message({ message }: MessageProps) {
  const isUser = message.role === 'user'

  // BUG-060: Ensure content is always a string (voice/thread messages can have object content)
  const safeContent = extractTextContent(message.content)

  // HOTFIX: Parse structured JSON responses — extract answer, citations, confidence
  const parsed = isUser
    ? { content: safeContent, citations: message.citations, confidence: message.confidence }
    : parseStructuredResponse(safeContent, message.citations, message.confidence)

  // EPIC-028 Phase 3: Detect greeting messages + resolve intent
  const isGreeting = message.id.startsWith('voice-greeting-')
  const intent = (message.metadata?.intent as string) || (isGreeting ? 'greeting' : undefined)

  // ── User message: compact right-aligned bubble ──
  if (isUser) {
    return (
      <div className="flex justify-end mb-4 group">
        <div className="max-w-[75%] rounded-xl px-4 py-3 overflow-hidden break-words bg-[var(--brand-blue)] text-[var(--text-primary)]">
          <div className="text-sm whitespace-pre-wrap leading-relaxed">
            {safeContent}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-[var(--text-primary)]/60">
              {formatTime(message.timestamp)}
            </span>
          </div>
        </div>
      </div>
    )
  }

  // E29-012: Proactive notification styling
  const isProactive = !!message.isProactive

  // ── Assistant message: full-width Perplexity-style ──
  return (
    <div className="mb-6 group">
      {/* E29-012: Proactive insight wrapper */}
      {isProactive && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[var(--brand-blue)]" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-blue)]">
            Mercury Insight
          </span>
        </div>
      )}

      {/* Answer content — full-width, clean layout */}
      <div className={
        message.isError
          ? 'p-4 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--text-primary)]'
          : isProactive
            ? 'p-4 rounded-lg bg-[var(--brand-blue)]/5 border border-[var(--brand-blue)]/20 text-[var(--text-secondary)]'
            : isGreeting
              ? 'text-[var(--text-secondary)] italic'
              : 'text-[var(--text-primary)]'
      }>
        <MarkdownRenderer content={parsed.content} />
      </div>

      {/* EPIC-028 Phase 4: Greeting insight accent block */}
      {isGreeting && !!message.metadata?.insightText && (
        <div
          className={`mt-2 pl-3 py-2 border-l-2 rounded-r-md ${
            message.metadata?.insightType === 'deadline' || message.metadata?.insightType === 'expiring'
              ? 'border-l-[var(--warning)] bg-[var(--warning)]/5'
              : 'border-l-[var(--brand-blue)] bg-[var(--brand-blue)]/5'
          }`}
        >
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            {String(message.metadata.insightText)}
            {typeof message.metadata?.insightDocumentId === 'string' && (
              <button
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent('mercury:open-document', {
                      detail: { documentId: String(message.metadata!.insightDocumentId) },
                    })
                  )
                }}
                className="inline-flex items-center ml-1 text-[var(--brand-blue)] hover:text-[var(--brand-blue-hover)] transition-colors"
              >
                <span className="text-sm">&rarr;</span>
              </button>
            )}
          </p>
        </div>
      )}

      {/* Sources — Perplexity-style source cards */}
      {parsed.citations && parsed.citations.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold mb-2">
            Sources
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {parsed.citations.map((citation) => (
              <SourceCard key={citation.citationIndex} citation={citation} />
            ))}
          </div>
        </div>
      )}

      {/* Footer: time + channel + intent + confidence + model */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-[10px] text-[var(--text-tertiary)]">
          {formatTime(message.timestamp)}
        </span>
        <ChannelBadge channel={message.channel} />
        <IntentBadge intent={intent} />
        {parsed.confidence !== undefined && (
          <ConfidenceBadge confidence={parsed.confidence} />
        )}
        <ModelBadge modelUsed={message.modelUsed} provider={message.provider} latencyMs={message.latencyMs} />
      </div>

      {/* Action buttons — visible on hover */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <ActionButtons content={parsed.content} />
      </div>
    </div>
  )
}
