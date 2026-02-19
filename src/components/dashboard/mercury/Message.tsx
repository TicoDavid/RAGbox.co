'use client'

import React, { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import type { ChatMessage, MercuryChannel } from '@/types/ragbox'
import { CitationTag } from './CitationTag'
import { ConfidenceBadge } from './ConfidenceBadge'
import { Copy, Check, ThumbsUp, ThumbsDown, Share2 } from 'lucide-react'

// Markdown components for styled rendering in the dark theme
const mdComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }) => <h1 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-bold mb-1.5 mt-2.5 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h3>,
  code: ({ children, className }) => {
    const isBlock = className?.includes('language-')
    if (isBlock) {
      return (
        <pre className="bg-black/30 rounded-lg p-3 my-2 overflow-x-auto">
          <code className="text-xs font-mono text-emerald-400">{children}</code>
        </pre>
      )
    }
    return <code className="bg-black/20 px-1.5 py-0.5 rounded text-xs font-mono text-cyan-400">{children}</code>
  },
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-[var(--brand-blue)]/50 pl-3 my-2 text-[var(--text-secondary)] italic">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-2 py-1 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-[var(--border-default)] px-2 py-1">{children}</td>,
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
  dashboard: { label: 'Dashboard', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  whatsapp: { label: 'WhatsApp', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  voice: { label: 'Voice', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  roam: { label: 'ROAM', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
}

function ChannelBadge({ channel, isUser }: { channel?: MercuryChannel; isUser?: boolean }) {
  if (!channel) return null
  const badge = CHANNEL_BADGE[channel]
  // On user messages (blue bg), use white/translucent styling for contrast
  const colorClass = isUser
    ? 'bg-white/20 text-white/90 border-white/30'
    : badge.color
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border ${colorClass}`}>
      {badge.label}
    </span>
  )
}

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

  const btnClass = 'p-1 rounded hover:bg-white/10 transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content)
    } catch { /* clipboard may not be available */ }
  }, [content])

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

export function Message({ message }: MessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 group`}>
      <div
        className={`max-w-[75%] rounded-xl px-4 py-3 ${
          isUser
            ? 'bg-[var(--brand-blue)] text-white'
            : message.isError
              ? 'bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--text-primary)]'
              : 'bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-primary)]'
        }`}
      >
        {/* Content */}
        {isUser ? (
          <div className="text-sm whitespace-pre-wrap leading-relaxed">
            {message.content}
          </div>
        ) : (
          <div className="text-sm leading-relaxed prose-sm prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Citations */}
        {message.citations && message.citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2.5 border-t border-[var(--border-subtle)]">
            {message.citations.map((citation) => (
              <CitationTag key={citation.citationIndex} citation={citation} />
            ))}
          </div>
        )}

        {/* Footer: time + channel badge + confidence */}
        <div className="flex items-center gap-2 mt-2">
          <span className={`text-[10px] ${isUser ? 'text-white/60' : 'text-[var(--text-tertiary)]'}`}>
            {formatTime(message.timestamp)}
          </span>
          <ChannelBadge channel={message.channel} isUser={isUser} />
          {message.confidence !== undefined && !isUser && (
            <ConfidenceBadge confidence={message.confidence} />
          )}
        </div>

        {/* Action buttons (assistant messages only, visible on hover) */}
        {!isUser && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <ActionButtons content={message.content} />
          </div>
        )}
      </div>
    </div>
  )
}
