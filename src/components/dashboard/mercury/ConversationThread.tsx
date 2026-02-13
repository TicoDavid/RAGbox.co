'use client'

import React, { useRef, useEffect, useCallback } from 'react'
import { useMercuryStore } from '@/stores/mercuryStore'
import { Message } from './Message'
import { EmptyState } from './EmptyState'

export function ConversationThread() {
  const messages = useMercuryStore((s) => s.messages)
  const isStreaming = useMercuryStore((s) => s.isStreaming)
  const streamingContent = useMercuryStore((s) => s.streamingContent)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const userScrolledUp = useRef(false)
  const prevMessageCount = useRef(0)

  // Check if user is near the bottom (within 150px)
  const isNearBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 150
  }, [])

  // Track manual scrolling — if user scrolls up, stop auto-scroll
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const handleScroll = () => {
      userScrolledUp.current = !isNearBottom()
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [isNearBottom])

  // Default to TOP on initial load (no messages yet → empty state handles it)
  // When user sends a new message, scroll to bottom
  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      // New message added — scroll to bottom
      userScrolledUp.current = false
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevMessageCount.current = messages.length
  }, [messages.length])

  // Auto-scroll during streaming only if user hasn't scrolled up
  useEffect(() => {
    if (isStreaming && streamingContent && !userScrolledUp.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [isStreaming, streamingContent])

  if (messages.length === 0 && !isStreaming) {
    return <EmptyState />
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-4 py-6 relative"
      role="log"
      aria-label="Conversation messages"
      aria-live="polite"
    >
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
