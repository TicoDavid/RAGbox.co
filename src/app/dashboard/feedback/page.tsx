'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, RefreshCw, Filter, Clock, User, Tag, MessageSquare } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface FeedbackEntry {
  id: string
  userId: string
  userEmail: string | null
  category: string
  message: string
  screenshotUrl: string | null
  status: string
  adminResponse: string | null
  createdAt: string
  updatedAt: string
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-[var(--brand-blue)]/20 text-[var(--brand-blue)] border-[var(--brand-blue)]/30',
  reviewed: 'bg-[var(--warning)]/20 text-[var(--warning)] border-[var(--warning)]/30',
  resolved: 'bg-[var(--success)]/20 text-[var(--success)] border-[var(--success)]/30',
}

const CATEGORY_ICONS: Record<string, string> = {
  bug: '\u{1F41B}',
  feature: '\u{2728}',
  general: '\u{1F4AC}',
}

export default function FeedbackPage() {
  const router = useRouter()
  const [entries, setEntries] = useState<FeedbackEntry[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [page, setPage] = useState(1)

  const loadFeedback = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '50')
      if (statusFilter) params.set('status', statusFilter)
      if (categoryFilter) params.set('category', categoryFilter)

      const res = await apiFetch(`/api/feedback?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setEntries(data.data.entries || [])
          setPagination(data.data.pagination || null)
        }
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, categoryFilter])

  useEffect(() => {
    loadFeedback()
  }, [loadFeedback])

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Header */}
      <div className="border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)]">
                Beta Feedback
              </h1>
              <p className="text-xs text-[var(--text-tertiary)]">
                {pagination ? `${pagination.total} entries` : 'Loading...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Filters */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[var(--text-tertiary)]" />
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                className="text-xs bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg px-2 py-1.5 text-[var(--text-secondary)]"
              >
                <option value="">All status</option>
                <option value="new">New</option>
                <option value="reviewed">Reviewed</option>
                <option value="resolved">Resolved</option>
              </select>
              <select
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
                className="text-xs bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg px-2 py-1.5 text-[var(--text-secondary)]"
              >
                <option value="">All categories</option>
                <option value="bug">Bug</option>
                <option value="feature">Feature</option>
                <option value="general">General</option>
              </select>
            </div>

            <button
              onClick={loadFeedback}
              disabled={loading}
              className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {loading && entries.length === 0 ? (
          <div className="text-center py-20">
            <RefreshCw className="w-8 h-8 text-[var(--text-tertiary)] animate-spin mx-auto mb-4" />
            <p className="text-sm text-[var(--text-tertiary)]">Loading feedback entries...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-20">
            <MessageSquare className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4 opacity-40" />
            <h3 className="text-base font-semibold text-[var(--text-secondary)] mb-1">No feedback yet</h3>
            <p className="text-sm text-[var(--text-tertiary)]">Beta tester feedback will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/50 p-5 hover:border-[var(--border-strong)] transition-colors"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg">{CATEGORY_ICONS[entry.category] || '\u{1F4AC}'}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${STATUS_COLORS[entry.status] || STATUS_COLORS.new}`}>
                          {entry.status}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">
                          {entry.category}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-[var(--text-tertiary)]">
                    <Clock className="w-3 h-3" />
                    <span className="text-[10px]">
                      {new Date(entry.createdAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-[var(--text-primary)] leading-relaxed mb-3 whitespace-pre-wrap">
                  {entry.message}
                </p>

                <div className="flex items-center gap-4 text-[10px] text-[var(--text-tertiary)]">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {entry.userEmail || entry.userId.slice(0, 12) + '...'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    {entry.id.slice(0, 12)}
                  </span>
                </div>

                {entry.adminResponse && (
                  <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--warning)] font-semibold mb-1">Admin Response</p>
                    <p className="text-sm text-[var(--text-secondary)]">{entry.adminResponse}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg text-xs border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-30 transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-[var(--text-tertiary)]">
              Page {page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
              disabled={page >= pagination.totalPages}
              className="px-3 py-1.5 rounded-lg text-xs border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-30 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
