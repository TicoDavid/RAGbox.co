'use client'

import React, { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'
import { useMercuryStore } from '@/stores/mercuryStore'

interface ThreadSummary {
  id: string
  title: string | null
  updatedAt: string
  createdAt: string
}

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export function RecentThreadsDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [loading, setLoading] = useState(false)

  const activeThreadId = useMercuryStore((s) => s.threadId)
  const switchThread = useMercuryStore((s) => s.switchThread)

  useEffect(() => {
    if (!isOpen) return

    let cancelled = false
    setLoading(true)

    fetch('/api/mercury/thread/list?limit=20')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setThreads(data.data?.threads || [])
        }
      })
      .catch(() => {
        if (!cancelled) setThreads([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [isOpen])

  const handleSelect = async (threadId: string) => {
    setIsOpen(false)
    await switchThread(threadId)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
        title="Recent Chats"
        aria-label="Recent chats"
        aria-expanded={isOpen}
      >
        <Clock className="w-4 h-4" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop — click-away layer */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 w-64 bg-[var(--bg-primary)]/98 backdrop-blur-xl border border-[var(--border-default)] rounded-xl shadow-2xl z-50 py-1 overflow-hidden">
            <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Recent Chats</span>
            </div>

            <div className="max-h-72 overflow-y-auto">
              {loading && (
                <div className="px-3 py-4 text-center text-xs text-[var(--text-tertiary)]">
                  Loading...
                </div>
              )}

              {!loading && threads.length === 0 && (
                <div className="px-3 py-4 text-center text-xs text-[var(--text-tertiary)]">
                  No recent chats
                </div>
              )}

              {!loading && threads.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => handleSelect(thread.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--bg-elevated)] transition-colors"
                >
                  {/* Active indicator dot */}
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      thread.id === activeThreadId
                        ? 'bg-[var(--brand-blue)]'
                        : 'bg-transparent'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[var(--text-primary)] truncate">
                      {thread.title || 'Untitled Chat'}
                    </div>
                    <div className="text-[10px] text-[var(--text-tertiary)]">
                      {relativeTime(thread.updatedAt)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
