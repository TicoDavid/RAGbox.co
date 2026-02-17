'use client'

import React, { useRef, useEffect, useCallback, useState } from 'react'
import { useMercuryStore } from '@/stores/mercuryStore'
import type { MercuryChannel } from '@/types/ragbox'
import { Message } from './Message'
import { EmptyState } from './EmptyState'
import { ChevronDown } from 'lucide-react'

const CHANNEL_FILTERS: { value: MercuryChannel | 'all'; label: string; color: string }[] = [
  { value: 'all', label: 'All', color: 'text-white bg-white/10' },
  { value: 'dashboard', label: 'Dashboard', color: 'text-blue-400 bg-blue-500/10' },
  { value: 'whatsapp', label: 'WhatsApp', color: 'text-emerald-400 bg-emerald-500/10' },
  { value: 'voice', label: 'Voice', color: 'text-purple-400 bg-purple-500/10' },
  { value: 'roam', label: 'ROAM', color: 'text-orange-400 bg-orange-500/10' },
]

export function ConversationThread() {
  const messages = useMercuryStore((s) => s.messages)
  const isStreaming = useMercuryStore((s) => s.isStreaming)
  const streamingContent = useMercuryStore((s) => s.streamingContent)
  const channelFilter = useMercuryStore((s) => s.channelFilter)
  const setChannelFilter = useMercuryStore((s) => s.setChannelFilter)
  const filteredMessages = useMercuryStore((s) => s.filteredMessages)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const userScrolledUp = useRef(false)
  const prevMessageCount = useRef(0)
  const [showNewMsgIndicator, setShowNewMsgIndicator] = useState(false)

  // Check if user is near the bottom (within 150px)
  const isNearBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 150
  }, [])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior, block: 'end' })
  }, [])

  // Track manual scrolling — if user scrolls up, stop auto-scroll
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const handleScroll = () => {
      const nearBottom = isNearBottom()
      userScrolledUp.current = !nearBottom
      // Clear new message indicator when user scrolls to bottom
      if (nearBottom) setShowNewMsgIndicator(false)
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [isNearBottom])

  // When new message arrives: auto-scroll if at bottom, show indicator if scrolled up
  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      if (userScrolledUp.current) {
        // User is reading history — show indicator instead of forcing scroll
        setShowNewMsgIndicator(true)
      } else {
        // User at bottom — scroll to new message
        scrollToBottom()
      }
    }
    prevMessageCount.current = messages.length
  }, [messages.length, scrollToBottom])

  // Auto-scroll during streaming only if user hasn't scrolled up
  useEffect(() => {
    if (isStreaming && streamingContent && !userScrolledUp.current) {
      scrollToBottom()
    }
  }, [isStreaming, streamingContent, scrollToBottom])

  // Scroll to bottom when channel filter changes
  useEffect(() => {
    userScrolledUp.current = false
    setShowNewMsgIndicator(false)
    scrollToBottom('instant')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelFilter])

  // ResizeObserver for dynamic content height changes (long responses, images)
  useEffect(() => {
    const el = scrollRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => {
      if (!userScrolledUp.current) {
        scrollToBottom('instant')
      }
    })

    // Observe the inner content container
    const inner = el.firstElementChild
    if (inner) observer.observe(inner)

    return () => observer.disconnect()
  }, [scrollToBottom])

  const visibleMessages = filteredMessages()

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
      {/* Channel Filter Bar */}
      {messages.length > 0 && (
        <div className="max-w-3xl mx-auto mb-4 flex items-center gap-1.5 relative z-10">
          {CHANNEL_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setChannelFilter(f.value)}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all duration-200 border ${
                channelFilter === f.value
                  ? `${f.color} border-current`
                  : 'text-[var(--text-tertiary)] bg-transparent border-transparent hover:bg-white/5'
              }`}
              aria-pressed={channelFilter === f.value}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Focus Column - Constrained width for readability */}
      <div className="max-w-3xl mx-auto relative z-10">
        {visibleMessages.map((msg) => (
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

      {/* New message indicator when user is scrolled up */}
      {showNewMsgIndicator && (
        <button
          onClick={() => {
            setShowNewMsgIndicator(false)
            userScrolledUp.current = false
            scrollToBottom()
          }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20
                     flex items-center gap-1.5 px-4 py-2 rounded-full
                     bg-[var(--brand-blue)] text-white text-xs font-medium
                     shadow-lg hover:bg-[var(--brand-blue-hover)] transition-colors"
        >
          <ChevronDown className="w-3.5 h-3.5" />
          New message
        </button>
      )}
    </div>
  )
}
