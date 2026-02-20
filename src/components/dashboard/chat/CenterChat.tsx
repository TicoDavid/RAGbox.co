'use client'

import { useEffect, useRef } from 'react'
import { useChatStore } from '@/stores/chatStore'
import { CenterHeader } from './CenterHeader'
import { CenterMessage } from './CenterMessage'
import { CenterInputBar } from './CenterInputBar'

// ============================================================================
// EMPTY STATE — RAGböx watermark (Perplexity-style)
// ============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <img
        src="https://storage.googleapis.com/connexusai-assets/RAGb%C3%B6x_ICON.png"
        alt=""
        className="w-48 h-auto opacity-40 select-none mb-6"
        draggable={false}
      />
      <p className="text-sm text-[var(--text-tertiary)] max-w-md">
        Ask anything about your documents
      </p>
    </div>
  )
}

// ============================================================================
// STREAMING INDICATOR
// ============================================================================

function StreamingIndicator({ content }: { content: string }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-blue-hover)] flex items-center justify-center text-xs font-semibold text-white"> {/* THEME-EXEMPT: white on brand gradient */}
          R
        </div>
        <span className="text-sm font-medium text-[var(--text-primary)]">RAGböx</span>
      </div>
      <div className="pl-8 text-base leading-relaxed text-[var(--text-primary)]">
        {content || (
          <span className="inline-flex gap-1">
            <span className="w-2 h-2 rounded-full bg-[var(--brand-blue)] animate-pulse" />
            <span className="w-2 h-2 rounded-full bg-[var(--brand-blue)] animate-pulse [animation-delay:0.2s]" />
            <span className="w-2 h-2 rounded-full bg-[var(--brand-blue)] animate-pulse [animation-delay:0.4s]" />
          </span>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// CENTER CHAT
// ============================================================================

export function CenterChat() {
  const messages = useChatStore((s) => s.messages)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const streamingContent = useChatStore((s) => s.streamingContent)

  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, streamingContent])

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* Header */}
      <CenterHeader />

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 && !isStreaming ? (
          <EmptyState />
        ) : (
          <div className="max-w-[800px] mx-auto px-8 py-6">
            {messages.map((msg) => (
              <CenterMessage key={msg.id} message={msg} />
            ))}
            {isStreaming && <StreamingIndicator content={streamingContent} />}
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-[var(--border-default)]">
        <div className="max-w-[800px] mx-auto px-8 py-4">
          <CenterInputBar />
        </div>
      </div>
    </div>
  )
}
