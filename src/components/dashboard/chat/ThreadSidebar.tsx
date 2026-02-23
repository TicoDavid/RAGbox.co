'use client'

import { useEffect } from 'react'
import { useChatStore, type ThreadSummary } from '@/stores/chatStore'
import { MessageSquarePlus, X, Loader2 } from 'lucide-react'

// ── Date grouping helpers ──

function getDateGroup(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays <= 7) return 'Previous 7 Days'
  if (diffDays <= 30) return 'Previous 30 Days'
  return 'Older'
}

function groupThreads(
  threads: ThreadSummary[],
): { label: string; items: ThreadSummary[] }[] {
  const groups = new Map<string, ThreadSummary[]>()
  const order = ['Today', 'Yesterday', 'Previous 7 Days', 'Previous 30 Days', 'Older']

  for (const t of threads) {
    const label = getDateGroup(t.updatedAt)
    const arr = groups.get(label) || []
    arr.push(t)
    groups.set(label, arr)
  }

  return order
    .filter((label) => groups.has(label))
    .map((label) => ({ label, items: groups.get(label)! }))
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Thread row ──

function ThreadRow({
  thread,
  isActive,
  onSelect,
}: {
  thread: ThreadSummary
  isActive: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors group ${
        isActive
          ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
      }`}
    >
      <p className="text-sm font-medium truncate leading-snug">
        {thread.title}
      </p>
      <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 flex items-center gap-2">
        <span>{formatDate(thread.updatedAt)}</span>
        {thread.messageCount > 0 && (
          <span>{thread.messageCount} msg{thread.messageCount !== 1 ? 's' : ''}</span>
        )}
      </p>
    </button>
  )
}

// ── Sidebar ──

export function ThreadSidebar() {
  const threads = useChatStore((s) => s.threads)
  const threadsLoading = useChatStore((s) => s.threadsLoading)
  const threadId = useChatStore((s) => s.threadId)
  const fetchThreads = useChatStore((s) => s.fetchThreads)
  const loadThread = useChatStore((s) => s.loadThread)
  const clearThread = useChatStore((s) => s.clearThread)
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen)

  useEffect(() => {
    fetchThreads()
  }, [fetchThreads])

  const grouped = groupThreads(threads)

  return (
    <div className="w-[280px] shrink-0 h-full flex flex-col bg-[var(--bg-secondary)] border-r border-[var(--border-default)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
        <button
          onClick={() => {
            clearThread()
            fetchThreads()
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--brand-blue)] text-white text-sm font-medium hover:opacity-90 transition-opacity" /* THEME-EXEMPT: white on brand */
        >
          <MessageSquarePlus className="w-3.5 h-3.5" />
          New Chat
        </button>
        <button
          onClick={() => setSidebarOpen(false)}
          className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
          aria-label="Close sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {threadsLoading && threads.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-[var(--text-tertiary)] animate-spin" />
          </div>
        ) : threads.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-sm text-[var(--text-tertiary)]">
              No conversations yet
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              Start a chat to see your history
            </p>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="px-3 py-1.5 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                {group.label}
              </p>
              {group.items.map((t) => (
                <ThreadRow
                  key={t.id}
                  thread={t}
                  isActive={t.id === threadId}
                  onSelect={() => loadThread(t.id)}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
