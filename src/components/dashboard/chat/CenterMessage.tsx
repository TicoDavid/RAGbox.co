'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import {
  Copy, ThumbsUp, ThumbsDown, Check,
  MessageSquare, FileText, ShieldCheck, RefreshCw, AlertTriangle,
} from 'lucide-react'
import { useVaultStore } from '@/stores/vaultStore'
import { useChatStore } from '@/stores/chatStore'
import { usePrivilegeStore } from '@/stores/privilegeStore'
import type { ChatMessage, Citation } from '@/types/ragbox'

type ResponseTab = 'answer' | 'sources' | 'evidence'

// ============================================================================
// JSON RESPONSE PARSER — Extract answer from raw JSON responses (BUG-009)
// ============================================================================

interface ParsedResponse {
  content: string
  citations?: Citation[]
  confidence?: number
}

function parseMessageContent(raw: string): ParsedResponse {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('{')) return { content: raw }

  try {
    const json = JSON.parse(trimmed)
    if (json.answer || json.data?.answer) {
      return {
        content: json.data?.answer ?? json.answer,
        citations: json.data?.citations ?? json.citations,
        confidence: json.data?.confidence ?? json.confidence,
      }
    }
  } catch {
    // Not valid JSON — render as-is
  }
  return { content: raw }
}

// ============================================================================
// MARKDOWN COMPONENTS (Claude-style, spacious)
// ============================================================================

const mdComponents: Components = {
  h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2 text-[var(--text-primary)]">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-semibold mt-3 mb-2 text-[var(--text-primary)]">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-semibold mt-2 mb-1 text-[var(--text-primary)]">{children}</h3>,
  p: ({ children }) => <p className="mb-3 text-[var(--text-primary)]">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="text-[var(--text-secondary)]">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>,
  code: ({ children, className }) => {
    const isBlock = className?.includes('language-')
    return isBlock ? (
      <pre className="bg-[var(--bg-tertiary)] rounded-lg p-4 overflow-x-auto my-3">
        <code className="text-sm font-mono">{children}</code>
      </pre>
    ) : (
      <code className="bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
    )
  },
  table: ({ children }) => (
    <div className="overflow-x-auto my-3">
      <table className="w-full border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-[var(--border-default)] px-3 py-2 text-left bg-[var(--bg-secondary)] font-semibold text-sm">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border border-[var(--border-default)] px-3 py-2 text-sm">{children}</td>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-[var(--brand-blue)] pl-4 italic text-[var(--text-secondary)] my-3">{children}</blockquote>
  ),
}

// ============================================================================
// CONFIDENCE BADGE
// ============================================================================

function ConfidenceBadge({ score }: { score?: number }) {
  if (score == null) return null
  const pct = Math.round(score * 100)
  const color =
    pct >= 85
      ? 'text-[var(--success)]'
      : pct >= 60
        ? 'text-[var(--warning)]'
        : 'text-[var(--danger)]'
  return <span className={`font-medium ${color}`}>{pct}%</span>
}

// ============================================================================
// TIME FORMATTER
// ============================================================================

function formatTime(timestamp: Date): string {
  const d = new Date(timestamp)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ============================================================================
// CENTER MESSAGE
// ============================================================================

export function CenterMessage({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<ResponseTab>('answer')
  const selectItem = useVaultStore((s) => s.selectItem)
  const setInputValue = useChatStore((s) => s.setInputValue)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const messages = useChatStore((s) => s.messages)
  const privilegeMode = usePrivilegeStore((s) => s.isEnabled)

  // Error message with retry button
  if (message.isError) {
    // Find the last user message to retry
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
    const handleRetry = () => {
      if (lastUserMsg) {
        setInputValue(lastUserMsg.content)
        setTimeout(() => sendMessage(privilegeMode), 50)
      }
    }

    return (
      <div className="group mb-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-[var(--danger)]/20 flex items-center justify-center">
            <AlertTriangle className="w-3.5 h-3.5 text-[var(--danger)]" />
          </div>
          <span className="text-sm font-medium text-[var(--danger)]">Error</span>
        </div>
        <div className="pl-8">
          <p className="text-sm text-[var(--text-secondary)] mb-3">
            Connection lost. {message.content}
          </p>
          {lastUserMsg && (
            <button
              onClick={handleRetry}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--brand-blue)]/10 text-[var(--brand-blue)] hover:bg-[var(--brand-blue)]/20 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          )}
        </div>
      </div>
    )
  }

  // BUG-009: extract answer from raw JSON if the content is a JSON blob
  const parsed = isUser ? null : parseMessageContent(message.content)
  const displayContent = parsed?.content ?? message.content
  const displayCitations = message.citations ?? parsed?.citations
  const displayConfidence = message.confidence ?? parsed?.confidence

  // Hide Sources/Evidence tabs when message has no metadata to show
  const hasSources = displayCitations && displayCitations.length > 0
  const hasEvidence = displayConfidence != null || message.modelUsed || message.metadata
  const visibleTabs = hasSources || hasEvidence
    ? RESPONSE_TABS
    : RESPONSE_TABS.filter((t) => t.id === 'answer')

  const handleCopy = () => {
    navigator.clipboard.writeText(displayContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group mb-8">
      {/* Sender label */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
            isUser
              ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
              : 'bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-blue-hover)] text-white' /* THEME-EXEMPT: white on brand gradient */
          }`}
        >
          {isUser ? 'Y' : 'R'}
        </div>
        <span className="text-sm font-medium text-[var(--text-primary)]">
          {isUser ? 'You' : 'RAGböx'}
        </span>
      </div>

      {/* Message body */}
      <div className="pl-8">
        {/* ── Response tabs (AI only) ── */}
        {!isUser && visibleTabs.length > 1 && (
          <div className="flex items-center gap-4 mb-3 border-b border-[var(--border-subtle)]">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 pb-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    isActive
                      ? 'text-[var(--text-primary)] border-[var(--brand-blue)]'
                      : 'text-[var(--text-tertiary)] border-transparent hover:text-[var(--text-secondary)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        )}

        {/* ── Tab content ── */}
        <div className="text-base leading-relaxed max-w-none">
          {isUser ? (
            <p className="text-[var(--text-primary)]">{message.content}</p>
          ) : activeTab === 'answer' ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {displayContent}
            </ReactMarkdown>
          ) : activeTab === 'sources' ? (
            <SourcesPanel
              citations={displayCitations}
              onNavigate={(docId) => selectItem(docId)}
            />
          ) : (
            <EvidencePanel
              message={message}
              confidence={displayConfidence}
              citations={displayCitations}
            />
          )}
        </div>

        {/* Footer: timestamp + inline citation badges (Answer tab only) */}
        {!isUser && activeTab === 'answer' && (
          <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-[var(--text-tertiary)]">
            <span>{formatTime(message.timestamp)}</span>
            {displayConfidence != null && <ConfidenceBadge score={displayConfidence} />}
            {displayCitations && displayCitations.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {displayCitations.map((c, i) => (
                  <span
                    key={i}
                    className="px-1.5 py-0.5 rounded bg-[var(--brand-blue)]/10 text-[var(--brand-blue)] text-[10px] font-medium cursor-default"
                    title={`${c.documentName}: ${c.excerpt?.slice(0, 100) ?? ''}...`}
                  >
                    [{(c.citationIndex ?? i) + 1}]
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Hover actions */}
        {!isUser && (
          <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              title="Copy"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[var(--success)]" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button
              className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              title="Good response"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              title="Bad response"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// RESPONSE TABS CONFIG
// ============================================================================

const RESPONSE_TABS: { id: ResponseTab; label: string; icon: typeof MessageSquare }[] = [
  { id: 'answer', label: 'Answer', icon: MessageSquare },
  { id: 'sources', label: 'Sources', icon: FileText },
  { id: 'evidence', label: 'Evidence', icon: ShieldCheck },
]

// ============================================================================
// SOURCES PANEL — Card grid of cited document chunks
// ============================================================================

function SourcesPanel({
  citations,
  onNavigate,
}: {
  citations?: Citation[]
  onNavigate: (docId: string) => void
}) {
  if (!citations || citations.length === 0) {
    return (
      <div className="py-6 text-center">
        <FileText className="w-8 h-8 text-[var(--text-tertiary)] mx-auto mb-2" />
        <p className="text-sm text-[var(--text-tertiary)]">No sources cited for this response.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {citations.map((c, i) => {
        const pct = c.relevanceScore != null ? Math.round(c.relevanceScore * 100) : null
        // Extract page from chunkId if available (e.g. "chunk-p3-1" → 3)
        const pageMatch = c.chunkId?.match(/p(\d+)/)
        const page = pageMatch ? parseInt(pageMatch[1], 10) : null

        return (
          <button
            key={i}
            onClick={() => onNavigate(c.documentId)}
            className="text-left p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] hover:border-[var(--brand-blue)]/30 transition-all group/card"
          >
            {/* Header: icon + filename + page badge */}
            <div className="flex items-start gap-2 mb-2">
              <FileText className="w-4 h-4 text-[var(--brand-blue)] shrink-0 mt-0.5" />
              <span className="text-sm font-medium text-[var(--text-primary)] truncate flex-1 group-hover/card:text-[var(--brand-blue)] transition-colors">
                {c.documentName}
              </span>
              {page != null && (
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[10px] font-medium text-[var(--text-tertiary)]">
                  p.{page}
                </span>
              )}
              <span className="shrink-0 px-1.5 py-0.5 rounded bg-[var(--brand-blue)]/10 text-[10px] font-medium text-[var(--brand-blue)]">
                [{(c.citationIndex ?? i) + 1}]
              </span>
            </div>

            {/* Excerpt */}
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-3 mb-3">
              {c.excerpt}
            </p>

            {/* Relevance bar */}
            {pct != null && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--brand-blue)] transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-[var(--text-tertiary)] shrink-0">
                  {pct}%
                </span>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ============================================================================
// EVIDENCE PANEL — Metadata chain
// ============================================================================

function EvidencePanel({
  message,
  confidence,
  citations,
}: {
  message: ChatMessage
  confidence?: number
  citations?: Citation[]
}) {
  const meta = message.metadata as Record<string, unknown> | undefined
  const docsSearched = (meta?.docsSearched as number) ?? null
  const chunksEvaluated = (meta?.chunksEvaluated as number) ?? null
  const citationCount = citations?.length ?? 0

  return (
    <div className="space-y-5">
      {/* Confidence — large and prominent */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)]">
        <div className="text-center">
          <p className="text-3xl font-bold">
            <ConfidenceBadge score={confidence} />
            {confidence == null && <span className="text-[var(--text-tertiary)]">--</span>}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold mt-1">
            Confidence
          </p>
        </div>
        <div className="h-10 w-px bg-[var(--border-default)]" />
        <div className="flex-1 grid grid-cols-2 gap-y-2 gap-x-6">
          <EvidenceRow label="Citations" value={citationCount.toString()} />
          <EvidenceRow
            label="Model"
            value={
              message.modelUsed
                ? `${message.provider ? `${message.provider}/` : ''}${message.modelUsed}`
                : '--'
            }
          />
          <EvidenceRow
            label="Latency"
            value={message.latencyMs != null ? `${(message.latencyMs / 1000).toFixed(1)}s` : '--'}
          />
          <EvidenceRow label="Time" value={formatTime(message.timestamp)} />
        </div>
      </div>

      {/* Retrieval stats */}
      <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)]">
        <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold mb-3">
          Retrieval Pipeline
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-[var(--bg-primary)]">
            <p className="text-lg font-bold text-[var(--text-primary)]">
              {docsSearched ?? '--'}
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">Documents searched</p>
          </div>
          <div className="p-3 rounded-lg bg-[var(--bg-primary)]">
            <p className="text-lg font-bold text-[var(--text-primary)]">
              {chunksEvaluated ?? '--'}
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">Chunks evaluated</p>
          </div>
          <div className="p-3 rounded-lg bg-[var(--bg-primary)]">
            <p className="text-lg font-bold text-[var(--text-primary)]">{citationCount}</p>
            <p className="text-xs text-[var(--text-tertiary)]">Sources cited</p>
          </div>
          <div className="p-3 rounded-lg bg-[var(--bg-primary)]">
            <p className="text-lg font-bold text-[var(--text-primary)]">
              {confidence != null ? `${Math.round(confidence * 100)}%` : '--'}
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">Confidence score</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function EvidenceRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">{label}</p>
      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{value}</p>
    </div>
  )
}
