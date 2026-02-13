'use client'

import React, { useRef, useEffect } from 'react'
import { useMercuryStore } from '@/stores/mercuryStore'
import { Message } from './Message'
import { EmptyState } from './EmptyState'

export function ConversationThread() {
  const messages = useMercuryStore((s) => s.messages)
  const isStreaming = useMercuryStore((s) => s.isStreaming)
  const streamingContent = useMercuryStore((s) => s.streamingContent)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll on new messages / streaming content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  if (messages.length === 0 && !isStreaming) {
    return <EmptyState />
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 relative" role="log" aria-label="Conversation messages" aria-live="polite">
      {/* RAGböx Watermark */}
      <div
        className="sticky top-0 left-0 w-full h-0 flex items-center justify-center pointer-events-none z-0"
        aria-hidden="true"
      >
        <img
          src="https://storage.googleapis.com/connexusai-assets/RAGb%C3%B6x_ICON.png"
          alt=""
          className="w-[300px] h-[300px] opacity-[0.08] select-none mt-[40vh]"
          draggable={false}
        />
      </div>

      {/* Focus Column - Constrained width for readability */}
      <div className="max-w-3xl mx-auto relative z-10">
        {messages.map((msg) => (
          <Message key={msg.id} message={msg} />
        ))}

        {/* Streaming indicator */}
        {isStreaming && streamingContent && (
          <div className="flex justify-start mb-4">
            <div className="max-w-[85%] rounded-xl px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-default)]">
              <div className="text-sm whitespace-pre-wrap leading-relaxed text-[var(--text-primary)]">
                {streamingContent}
                <span className="inline-block w-2 h-4 bg-[var(--brand-blue)] ml-0.5 animate-pulse" />
              </div>
            </div>
          </div>
        )}

        {/* Loading dots (no content yet) */}
        {isStreaming && !streamingContent && (
          <div className="flex justify-start mb-4">
            <div className="rounded-xl px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-default)]">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-[var(--text-tertiary)] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-[var(--text-tertiary)] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-[var(--text-tertiary)] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
