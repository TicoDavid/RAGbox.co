'use client'

import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '@/stores/chatStore'
import { CenterHeader } from './CenterHeader'
import { CenterMessage } from './CenterMessage'
import { CenterInputBar } from './CenterInputBar'
import { ThreadSidebar } from './ThreadSidebar'
import { FileText, MessageSquare, Quote, Activity, Upload } from 'lucide-react'

// ============================================================================
// DASHBOARD HOME — Stats cards shown when no chat is active
// ============================================================================

interface StatCardProps {
  icon: React.ElementType
  value: string
  label: string
  color: string
}

function StatCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
      <div className="w-8 h-8 rounded-lg bg-[var(--bg-tertiary)] animate-pulse" />
      <div>
        <div className="h-7 w-12 rounded bg-[var(--bg-tertiary)] animate-pulse mb-1" />
        <div className="h-3 w-24 rounded bg-[var(--bg-tertiary)] animate-pulse" />
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, value, label, color }: StatCardProps) {
  if (value === '...') return <StatCardSkeleton />

  return (
    <div className="flex flex-col gap-3 p-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-default)] transition-colors">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight">{value}</p>
        <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function DashboardHome() {
  const [docCount, setDocCount] = useState<string>('...')
  const [queryCount, setQueryCount] = useState<string>('...')

  useEffect(() => {
    fetch('/api/documents')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const docs = data?.data?.documents ?? data?.documents ?? []
        setDocCount(String(docs.length))
      })
      .catch(() => setDocCount('0'))

    fetch('/api/mercury/thread/list?limit=200')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const threads = data?.data?.threads ?? data?.threads ?? []
        setQueryCount(String(threads.length))
      })
      .catch(() => setQueryCount('0'))
  }, [])

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 sm:px-8">
      <img
        src="https://storage.googleapis.com/connexusai-assets/RAGb%C3%B6x_ICON.png"
        alt=""
        className="w-32 h-auto opacity-30 select-none mb-8"
        draggable={false}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-[720px] mb-8">
        <StatCard
          icon={FileText}
          value={docCount}
          label="Documents in Vault"
          color="bg-[var(--brand-blue)]/15 text-[var(--brand-blue)]"
        />
        <StatCard
          icon={MessageSquare}
          value={queryCount}
          label="Questions Asked"
          color="bg-[var(--warning)]/15 text-[var(--warning)]"
        />
        <StatCard
          icon={Quote}
          value={'\u2014'}
          label="Citations Generated"
          color="bg-[var(--success)]/15 text-[var(--success)]"
        />
        <StatCard
          icon={Activity}
          value="Healthy"
          label="Vault Health"
          color="bg-[var(--success)]/15 text-[var(--success)]"
        />
      </div>

      {docCount === '0' ? (
        <div className="flex flex-col items-center gap-2">
          <Upload className="w-5 h-5 text-[var(--brand-blue)]" />
          <p className="text-sm text-[var(--text-tertiary)]">
            Your vault is empty. Drop your first document to get started.
          </p>
        </div>
      ) : (
        <p className="text-sm text-[var(--text-tertiary)]">
          Ask anything about your documents
        </p>
      )}
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
        {content || (
          <span className="inline-flex gap-1">
            <span className="w-2 h-2 rounded-full bg-[var(--brand-blue)] animate-pulse" />
            <span className="w-2 h-2 rounded-full bg-[var(--brand-blue)] animate-pulse [animation-delay:0.2s]" />
            <span className="w-2 h-2 rounded-full bg-[var(--brand-blue)] animate-pulse [animation-delay:0.4s]" />
          </span>
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

  return (
    <div className="flex h-full">
      {/* Thread history sidebar */}
      {sidebarOpen && <ThreadSidebar />}

      {/* Main chat area */}
      <div className={`flex flex-col flex-1 min-w-0 bg-[var(--bg-primary)]${incognitoMode ? ' border-t-2 border-[var(--warning)]' : ''}`}>
        {/* Header */}
        <CenterHeader />

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {messages.length === 0 && !isStreaming ? (
            <DashboardHome />
          ) : (
            <div className="max-w-[800px] mx-auto px-4 sm:px-8 py-6">
              {messages.map((msg) => (
                <CenterMessage key={msg.id} message={msg} />
              ))}
              {isStreaming && <StreamingIndicator content={streamingContent} />}
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="shrink-0">
          <div className="max-w-[800px] mx-auto px-4 sm:px-8 py-4">
            <CenterInputBar />
          </div>
        </div>
      </div>
    </div>
  )
}
