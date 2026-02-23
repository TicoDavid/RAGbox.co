'use client'

import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '@/stores/chatStore'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CenterHeader } from './CenterHeader'
import { CenterMessage } from './CenterMessage'
import { CenterInputBar } from './CenterInputBar'
import { ThreadSidebar } from './ThreadSidebar'
// ============================================================================
// DASHBOARD HOME — empty state shown when no chat is active
// Rendered inline in CenterChat so the input bar can be part of the
// vertically centered group (logo → caption → input).
// ============================================================================

// ============================================================================
// CHAT SKELETON — pulsing message bubbles during thread loading
// ============================================================================

function ChatSkeleton() {
  return (
    <div className="max-w-[800px] mx-auto px-4 sm:px-8 py-6 space-y-6">
      {/* Skeleton: user message (right-aligned short) */}
      <div className="flex justify-end">
        <div className="w-[55%] space-y-2">
          <div className="h-4 rounded-full bg-[var(--bg-tertiary)] animate-pulse" />
          <div className="h-4 w-3/4 rounded-full bg-[var(--bg-tertiary)] animate-pulse ml-auto" />
        </div>
      </div>

      {/* Skeleton: assistant message (left-aligned, longer) */}
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded-full bg-[var(--bg-tertiary)] animate-pulse shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2 max-w-[70%]">
          <div className="h-4 rounded-full bg-[var(--bg-tertiary)] animate-pulse" />
          <div className="h-4 rounded-full bg-[var(--bg-tertiary)] animate-pulse" />
          <div className="h-4 w-2/3 rounded-full bg-[var(--bg-tertiary)] animate-pulse" />
        </div>
      </div>

      {/* Skeleton: user message */}
      <div className="flex justify-end">
        <div className="w-[40%] space-y-2">
          <div className="h-4 rounded-full bg-[var(--bg-tertiary)] animate-pulse [animation-delay:0.15s]" />
        </div>
      </div>

      {/* Skeleton: assistant message */}
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded-full bg-[var(--bg-tertiary)] animate-pulse shrink-0 mt-0.5 [animation-delay:0.2s]" />
        <div className="flex-1 space-y-2 max-w-[70%]">
          <div className="h-4 rounded-full bg-[var(--bg-tertiary)] animate-pulse [animation-delay:0.2s]" />
          <div className="h-4 rounded-full bg-[var(--bg-tertiary)] animate-pulse [animation-delay:0.25s]" />
          <div className="h-4 w-4/5 rounded-full bg-[var(--bg-tertiary)] animate-pulse [animation-delay:0.3s]" />
          <div className="h-4 w-1/2 rounded-full bg-[var(--bg-tertiary)] animate-pulse [animation-delay:0.35s]" />
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// STREAMING INDICATOR
// ============================================================================

function StreamingIndicator({ content }: { content: string }) {
  const [slow, setSlow] = useState(false)
  const stopStreaming = useChatStore((s) => s.stopStreaming)

  useEffect(() => {
    setSlow(false)
    const timer = setTimeout(() => setSlow(true), 30000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-blue-hover)] flex items-center justify-center text-xs font-semibold text-white"> {/* THEME-EXEMPT: white on brand gradient */}
          R
        </div>
        <span className="text-sm font-medium text-[var(--text-primary)]">RAGböx</span>
      </div>
      <div className="pl-8 text-base leading-relaxed text-[var(--text-primary)]">
        {content ? (
          <div className="prose prose-sm prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
            <span className="inline-block w-2 h-4 bg-[var(--brand-blue)] ml-0.5 animate-pulse" />
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <span className="inline-flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-blue)] animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-blue)] animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-blue)] animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
            <span className="animate-pulse">Analyzing your documents...</span>
          </div>
        )}
        {slow && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-[var(--warning)]">Taking longer than expected...</span>
            <button
              onClick={stopStreaming}
              className="text-xs px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
          </div>
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
  const incognitoMode = useChatStore((s) => s.incognitoMode)
  const clearThread = useChatStore((s) => s.clearThread)
  const sidebarOpen = useChatStore((s) => s.sidebarOpen)
  const isThreadLoading = useChatStore((s) => s.isThreadLoading)

  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, streamingContent])

  // Auto-clear messages on unmount when incognito
  useEffect(() => {
    if (!incognitoMode) return
    return () => { clearThread() }
  }, [incognitoMode, clearThread])

  const isEmpty = messages.length === 0 && !isStreaming && !isThreadLoading

  return (
    <div className="flex h-full">
      {/* Thread history sidebar */}
      {sidebarOpen && <ThreadSidebar />}

      {/* Main chat area */}
      <div className={`flex flex-col flex-1 min-w-0 bg-[var(--bg-primary)]${incognitoMode ? ' border-t-2 border-[var(--warning)]' : ''}`}>
        {/* Header */}
        <CenterHeader />

        {isEmpty ? (
          /* Empty state: logo, caption, and input centered as one group */
          <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 min-h-0">
            <img
              src="https://storage.googleapis.com/connexusai-assets/RAGb%C3%B6x_ICON.png"
              alt=""
              className="w-48 sm:w-56 h-auto opacity-20 select-none mb-6"
              draggable={false}
            />
            <p className="text-sm text-[var(--text-tertiary)] mb-8">
              Ask anything about your documents
            </p>
            <div className="w-full max-w-[800px]">
              <CenterInputBar />
            </div>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              {isThreadLoading ? (
                <ChatSkeleton />
              ) : (
                <div className="max-w-[800px] mx-auto px-4 sm:px-8 py-6">
                  {messages.map((msg) => (
                    <CenterMessage key={msg.id} message={msg} />
                  ))}
                  {isStreaming && <StreamingIndicator content={streamingContent} />}
                </div>
              )}
            </div>

            {/* Input bar — pinned to bottom when messages exist */}
            <div className="shrink-0">
              <div className="max-w-[800px] mx-auto px-4 sm:px-8 py-4">
                <CenterInputBar />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
