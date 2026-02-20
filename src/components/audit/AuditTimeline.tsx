'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Download,
  X,
  CheckCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import type { AuditEvent, AuditAction, AuditSeverity } from '@/lib/audit/audit-types'
import { AuditEntry, AuditEntryDetailModal } from './AuditEntry'

interface AuditTimelineProps {
  className?: string
}

interface AuditResponse {
  logs: AuditEvent[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
  }
}

const actionOptions: { value: AuditAction | ''; label: string }[] = [
  { value: '', label: 'All Actions' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'LOGOUT', label: 'Logout' },
  { value: 'DOCUMENT_UPLOAD', label: 'Document Upload' },
  { value: 'DOCUMENT_DELETE', label: 'Document Delete' },
  { value: 'DOCUMENT_PRIVILEGE_CHANGE', label: 'Privilege Change' },
  { value: 'QUERY_SUBMITTED', label: 'Query Submitted' },
  { value: 'QUERY_RESPONSE', label: 'Query Response' },
  { value: 'SILENCE_PROTOCOL_TRIGGERED', label: 'Silence Protocol' },
  { value: 'PRIVILEGE_MODE_CHANGE', label: 'Mode Change' },
  { value: 'DATA_EXPORT', label: 'Data Export' },
  { value: 'ERROR', label: 'Error' },
]

const severityOptions: { value: AuditSeverity | ''; label: string }[] = [
  { value: '', label: 'All Severities' },
  { value: 'INFO', label: 'Info' },
  { value: 'WARNING', label: 'Warning' },
  { value: 'ERROR', label: 'Error' },
  { value: 'CRITICAL', label: 'Critical' },
]

/**
 * AuditTimeline Component
 * Displays audit logs in a blockchain-inspired timeline view
 */
export function AuditTimeline({ className }: AuditTimelineProps) {
  const [logs, setLogs] = useState<AuditEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [actionFilter, setActionFilter] = useState<AuditAction | ''>('')
  const [severityFilter, setSeverityFilter] = useState<AuditSeverity | ''>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Detail modal
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null)

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      })

      if (actionFilter) params.set('action', actionFilter)
      if (severityFilter) params.set('severity', severityFilter)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (searchTerm) params.set('search', searchTerm)

      const response = await apiFetch(`/api/audit?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch audit logs')
      }

      const data: AuditResponse = await response.json()
      setLogs(data.logs)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [page, actionFilter, severityFilter, startDate, endDate, searchTerm])

  // Fetch on mount and filter changes
  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [actionFilter, severityFilter, startDate, endDate, searchTerm])

  // Clear filters
  const clearFilters = () => {
    setSearchTerm('')
    setActionFilter('')
    setSeverityFilter('')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  const hasActiveFilters = actionFilter || severityFilter || startDate || endDate || searchTerm

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header with filters */}
      <div className="flex-shrink-0 space-y-4 mb-6">
        {/* Search and filter toggle */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
            <input
              type="text"
              placeholder="Search audit logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search audit logs"
              className={cn(
                'w-full pl-11 pr-4 py-3 rounded-xl',
                'bg-[var(--bg-secondary)]',
                'text-[var(--text-primary)]',
                'border border-[var(--border-default)]',
                'placeholder:text-[var(--text-tertiary)]',
                'focus:outline-none focus:ring-2 focus:ring-electric-500/50'
              )}
            />
          </div>

          {/* Filter toggle */}
          <motion.button
            onClick={() => setShowFilters(!showFilters)}
            aria-label="Toggle filters"
            aria-expanded={showFilters}
            className={cn(
              'flex items-center gap-2 px-4 py-3 rounded-xl',
              'border transition-all duration-200',
              showFilters || hasActiveFilters
                ? 'bg-electric-600/20 text-electric-400 border-electric-500/30'
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-default)] hover:bg-[var(--bg-elevated)]'
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">Filters</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-electric-500" />
            )}
          </motion.button>

          {/* Refresh */}
          <motion.button
            onClick={fetchLogs}
            disabled={isLoading}
            aria-label="Refresh audit logs"
            className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center',
              'bg-[var(--bg-secondary)]',
              'text-[var(--text-secondary)]',
              'border border-[var(--border-default)]',
              'hover:bg-[var(--bg-elevated)]',
              'transition-all duration-200',
              isLoading && 'opacity-50 cursor-not-allowed'
            )}
            whileHover={{ scale: isLoading ? 1 : 1.05 }}
            whileTap={{ scale: isLoading ? 1 : 0.95 }}
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </motion.button>
        </div>

        {/* Filter panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div
                className={cn(
                  'p-4 rounded-xl space-y-4',
                  'bg-[var(--bg-secondary)]',
                  'border border-[var(--border-default)]'
                )}
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Action filter */}
                  <div>
                    <label className="text-xs text-[var(--text-tertiary)] mb-1 block">
                      Action Type
                    </label>
                    <select
                      value={actionFilter}
                      onChange={(e) => setActionFilter(e.target.value as AuditAction | '')}
                      aria-label="Filter by action type"
                      className={cn(
                        'w-full px-3 py-2 rounded-lg text-sm',
                        'bg-[var(--bg-primary)]',
                        'text-[var(--text-primary)]',
                        'border border-[var(--border-default)]',
                        'focus:outline-none focus:ring-2 focus:ring-electric-500/50'
                      )}
                    >
                      {actionOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Severity filter */}
                  <div>
                    <label className="text-xs text-[var(--text-tertiary)] mb-1 block">
                      Severity
                    </label>
                    <select
                      value={severityFilter}
                      onChange={(e) => setSeverityFilter(e.target.value as AuditSeverity | '')}
                      aria-label="Filter by severity"
                      className={cn(
                        'w-full px-3 py-2 rounded-lg text-sm',
                        'bg-[var(--bg-primary)]',
                        'text-[var(--text-primary)]',
                        'border border-[var(--border-default)]',
                        'focus:outline-none focus:ring-2 focus:ring-electric-500/50'
                      )}
                    >
                      {severityOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Start date */}
                  <div>
                    <label className="text-xs text-[var(--text-tertiary)] mb-1 block">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      aria-label="Filter start date"
                      className={cn(
                        'w-full px-3 py-2 rounded-lg text-sm',
                        'bg-[var(--bg-primary)]',
                        'text-[var(--text-primary)]',
                        'border border-[var(--border-default)]',
                        'focus:outline-none focus:ring-2 focus:ring-electric-500/50'
                      )}
                    />
                  </div>

                  {/* End date */}
                  <div>
                    <label className="text-xs text-[var(--text-tertiary)] mb-1 block">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      aria-label="Filter end date"
                      className={cn(
                        'w-full px-3 py-2 rounded-lg text-sm',
                        'bg-[var(--bg-primary)]',
                        'text-[var(--text-primary)]',
                        'border border-[var(--border-default)]',
                        'focus:outline-none focus:ring-2 focus:ring-electric-500/50'
                      )}
                    />
                  </div>
                </div>

                {/* Clear filters */}
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-2 text-sm text-electric-400 hover:underline"
                  >
                    <X className="w-3 h-3" />
                    Clear all filters
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results summary */}
        <div className="flex items-center justify-between text-sm text-[var(--text-tertiary)]">
          <span>
            Showing {logs.length} of {total} entries
          </span>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-[var(--success)]" />
            <span>All entries verified</span>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto pr-2 -mr-2">
        {isLoading && logs.length === 0 ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchLogs} />
        ) : logs.length === 0 ? (
          <EmptyState hasFilters={!!hasActiveFilters} onClearFilters={clearFilters} />
        ) : (
          <div className="space-y-4 pb-4">
            {logs.map((event, index) => (
              <AuditEntry
                key={event.eventId}
                event={event}
                index={index}
                onViewDetails={setSelectedEvent}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 pt-4 border-t border-[var(--border-default)]">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || isLoading}
              aria-label="Previous page"
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium',
                'transition-all duration-200',
                page === 1 || isLoading
                  ? 'text-[var(--text-tertiary)] opacity-50 cursor-not-allowed'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
              )}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (page <= 3) {
                  pageNum = i + 1
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = page - 2 + i
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    disabled={isLoading}
                    aria-label={`Go to page ${pageNum}`}
                    aria-current={pageNum === page ? 'page' : undefined}
                    className={cn(
                      'w-8 h-8 rounded-lg text-sm font-medium',
                      'transition-all duration-200',
                      pageNum === page
                        ? 'bg-electric-600/20 text-electric-400'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                    )}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || isLoading}
              aria-label="Next page"
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium',
                'transition-all duration-200',
                page === totalPages || isLoading
                  ? 'text-[var(--text-tertiary)] opacity-50 cursor-not-allowed'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
              )}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Detail modal */}
      <AuditEntryDetailModal
        event={selectedEvent}
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <RefreshCw className="w-8 h-8 text-electric-400 animate-spin mb-4" />
      <p className="text-sm text-[var(--text-tertiary)]">Loading audit logs...</p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-12 h-12 rounded-xl bg-[var(--danger)]/20 flex items-center justify-center mb-4">
        <X className="w-6 h-6 text-[var(--danger)]" />
      </div>
      <p className="text-sm text-[var(--text-secondary)] mb-4">{message}</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[var(--bg-elevated)] text-[var(--text-primary)]"
      >
        <RefreshCw className="w-4 h-4" />
        Try again
      </button>
    </div>
  )
}

function EmptyState({
  hasFilters,
  onClearFilters,
}: {
  hasFilters: boolean
  onClearFilters: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-12 h-12 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center mb-4">
        <Calendar className="w-6 h-6 text-[var(--text-tertiary)]" />
      </div>
      <p className="text-sm text-[var(--text-secondary)] mb-2">
        {hasFilters ? 'No entries match your filters' : 'No audit entries yet'}
      </p>
      {hasFilters && (
        <button
          onClick={onClearFilters}
          className="text-sm text-electric-400 hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
