'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import { Copy, ThumbsUp, ThumbsDown, Check } from 'lucide-react'
import type { ChatMessage } from '@/types/ragbox'

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

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
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
        <div className="text-base leading-relaxed max-w-none">
          {isUser ? (
            <p className="text-[var(--text-primary)]">{message.content}</p>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {message.content}
            </ReactMarkdown>
          )}
        </div>

        {/* Footer: metadata + citations */}
        {!isUser && (
          <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-[var(--text-tertiary)]">
            <span>{formatTime(message.timestamp)}</span>
            {message.confidence != null && <ConfidenceBadge score={message.confidence} />}
            {message.modelUsed && (
              <span>{message.provider ? `${message.provider}/` : ''}{message.modelUsed}</span>
            )}
            {message.latencyMs != null && (
              <span>{(message.latencyMs / 1000).toFixed(1)}s</span>
            )}
            {message.citations && message.citations.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {message.citations.map((c, i) => (
                  <span
                    key={i}
                    className="px-1.5 py-0.5 rounded bg-[var(--brand-blue)]/10 text-[var(--brand-blue)] text-[10px] font-medium cursor-default"
                    title={`${c.documentName}: ${c.excerpt.slice(0, 100)}...`}
                  >
                    [{c.citationIndex + 1}]
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
