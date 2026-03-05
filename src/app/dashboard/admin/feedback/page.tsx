'use client'

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { Download, Filter, ArrowUpDown, ChevronDown, ChevronRight, Image as ImageIcon, ShieldAlert } from 'lucide-react'
import { useFeedbackStore } from '@/stores/feedbackStore'
import type { FeedbackTicket, FeedbackType, FeedbackSeverity, FeedbackModule, FeedbackStatus } from '@/stores/feedbackStore'
import { useUserRoleInfo } from '@/hooks/useUserRole'

// ============================================================================
// STORY-236: Admin Feedback Dashboard — /admin/feedback
// Protected route: isAdmin only
// ============================================================================

const STATUS_OPTIONS: FeedbackStatus[] = ['New', 'Reviewed', 'Filed', 'Closed']

const STATUS_COLORS: Record<FeedbackStatus, string> = {
  New: 'bg-[var(--brand-blue)]/15 text-[var(--brand-blue)]',
  Reviewed: 'bg-[var(--warning)]/15 text-[var(--warning)]',
  Filed: 'bg-[var(--success)]/15 text-[var(--success)]',
  Closed: 'bg-[var(--text-tertiary)]/15 text-[var(--text-tertiary)]',
}

const SEVERITY_COLORS: Record<FeedbackSeverity, string> = {
  Critical: 'text-[var(--danger)]',
  High: 'text-[var(--warning)]',
  Medium: 'text-[var(--brand-blue)]',
  Low: 'text-[var(--success)]',
}

type SortKey = 'timestamp' | 'type' | 'severity' | 'module' | 'status'
type SortDir = 'asc' | 'desc'

interface Filters {
  type: FeedbackType | 'All'
  module: FeedbackModule | 'All'
  severity: FeedbackSeverity | 'All'
  status: FeedbackStatus | 'All'
}

function exportToCsv(tickets: FeedbackTicket[]) {
  const headers = ['ID', 'Type', 'Severity', 'Module', 'Description', 'Status', 'CPO Notes', 'User', 'URL', 'Timestamp']
  const rows = tickets.map((t) => [
    t.id,
    t.type,
    t.severity,
    t.module,
    `"${t.description.replace(/"/g, '""')}"`,
    t.status,
    `"${t.cpoNotes.replace(/"/g, '""')}"`,
    t.userId,
    t.currentUrl,
    t.timestamp,
  ])
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ragbox-feedback-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const SEVERITY_ORDER: Record<FeedbackSeverity, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 }

export default function AdminFeedbackPage() {
  const { isAdmin } = useUserRoleInfo()
  const tickets = useFeedbackStore((s) => s.tickets)
  const updateTicketStatus = useFeedbackStore((s) => s.updateTicketStatus)
  const updateTicketNotes = useFeedbackStore((s) => s.updateTicketNotes)
  const loadTickets = useFeedbackStore((s) => s.loadTickets)

  const [sortKey, setSortKey] = useState<SortKey>('timestamp')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [filters, setFilters] = useState<Filters>({
    type: 'All',
    module: 'All',
    severity: 'All',
    status: 'All',
  })
  const [showFilters, setShowFilters] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const statusCounts = useMemo(() => {
    const counts: Record<FeedbackStatus, number> = { New: 0, Reviewed: 0, Filed: 0, Closed: 0 }
    for (const t of tickets) counts[t.status]++
    return counts
  }, [tickets])

  const handleSort = useCallback((key: SortKey) => {
    setSortDir((prev) => (sortKey === key ? (prev === 'asc' ? 'desc' : 'asc') : 'desc'))
    setSortKey(key)
  }, [sortKey])

  const filtered = useMemo(() => {
    let result = [...tickets]

    if (filters.type !== 'All') result = result.filter((t) => t.type === filters.type)
    if (filters.module !== 'All') result = result.filter((t) => t.module === filters.module)
    if (filters.severity !== 'All') result = result.filter((t) => t.severity === filters.severity)
    if (filters.status !== 'All') result = result.filter((t) => t.status === filters.status)

    result.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'timestamp') return dir * (new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      if (sortKey === 'severity') return dir * (SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
      return dir * a[sortKey].localeCompare(b[sortKey])
    })

    return result
  }, [tickets, filters, sortKey, sortDir])

  useEffect(() => {
    if (isAdmin) loadTickets()
  }, [loadTickets, isAdmin])

  if (!isAdmin) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center">
          <ShieldAlert className="w-10 h-10 text-[var(--danger)] mx-auto mb-3 opacity-60" />
          <p className="text-sm text-[var(--text-secondary)]">Admin access required</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg-primary)] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Beta Feedback</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-[var(--text-tertiary)]">
              {tickets.length} ticket{tickets.length !== 1 ? 's' : ''} total
              {filtered.length !== tickets.length && ` · ${filtered.length} shown`}
            </p>
            {statusCounts.New > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--brand-blue)]/15 text-[var(--brand-blue)]">
                {statusCounts.New} New
              </span>
            )}
            {statusCounts.Reviewed > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--warning)]/15 text-[var(--warning)]">
                {statusCounts.Reviewed} Reviewed
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              showFilters
                ? 'bg-[var(--brand-blue)]/15 text-[var(--brand-blue)] border border-[var(--brand-blue)]/30'
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--brand-blue)]/30'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
          </button>
          <button
            onClick={() => exportToCsv(filtered)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--brand-blue)]/30 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 mb-4 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)]">
          <FilterSelect label="Type" value={filters.type} options={['All', 'Bug', 'Feature', 'Question', 'Observation']} onChange={(v) => setFilters({ ...filters, type: v as Filters['type'] })} />
          <FilterSelect label="Module" value={filters.module} options={['All', 'Vault', 'Mercury', 'Studio', 'Airlock', 'Audit', 'Settings', 'Other']} onChange={(v) => setFilters({ ...filters, module: v as Filters['module'] })} />
          <FilterSelect label="Severity" value={filters.severity} options={['All', 'Critical', 'High', 'Medium', 'Low']} onChange={(v) => setFilters({ ...filters, severity: v as Filters['severity'] })} />
          <FilterSelect label="Status" value={filters.status} options={['All', 'New', 'Reviewed', 'Filed', 'Closed']} onChange={(v) => setFilters({ ...filters, status: v as Filters['status'] })} />
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-[var(--border-default)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
              <SortHeader label="Date" sortKey="timestamp" current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortHeader label="Type" sortKey="type" current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortHeader label="Severity" sortKey="severity" current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortHeader label="Module" sortKey="module" current={sortKey} dir={sortDir} onSort={handleSort} />
              <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">Description</th>
              <SortHeader label="Status" sortKey="status" current={sortKey} dir={sortDir} onSort={handleSort} />
              <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">CPO Notes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-[var(--text-tertiary)]">
                  No feedback tickets yet
                </td>
              </tr>
            ) : (
              filtered.map((ticket) => {
                const isExpanded = expandedId === ticket.id
                return (
                  <React.Fragment key={ticket.id}>
                    <tr
                      onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                      className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-secondary)]/50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 text-xs text-[var(--text-tertiary)] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {isExpanded
                            ? <ChevronDown className="w-3 h-3 shrink-0" />
                            : <ChevronRight className="w-3 h-3 shrink-0" />
                          }
                          {new Date(ticket.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{ticket.type}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${SEVERITY_COLORS[ticket.severity]}`}>
                          {ticket.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{ticket.module}</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-primary)] max-w-[300px] truncate">
                        {ticket.description}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={ticket.status}
                          onChange={(e) => updateTicketStatus(ticket.id, e.target.value as FeedbackStatus)}
                          className={`text-xs font-medium px-2 py-1 rounded-lg border-0 cursor-pointer ${STATUS_COLORS[ticket.status]}`}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-tertiary)]">
                        {ticket.cpoNotes ? ticket.cpoNotes.slice(0, 40) + (ticket.cpoNotes.length > 40 ? '...' : '') : '--'}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-[var(--bg-secondary)]/30">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="grid grid-cols-2 gap-4">
                            {/* Full description */}
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold mb-2">
                                Full Description
                              </p>
                              <p className="text-xs text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                                {ticket.description}
                              </p>
                              {ticket.screenshotUrl && (
                                <div className="mt-3">
                                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold mb-2 flex items-center gap-1">
                                    <ImageIcon className="w-3 h-3" /> Screenshot
                                  </p>
                                  <img
                                    src={ticket.screenshotUrl}
                                    alt="Feedback screenshot"
                                    className="max-w-full max-h-[200px] rounded-lg border border-[var(--border-default)]"
                                  />
                                </div>
                              )}
                              <div className="mt-3 flex items-center gap-4 text-[10px] text-[var(--text-tertiary)]">
                                <span>User: {ticket.userId}</span>
                                <span>URL: {ticket.currentUrl}</span>
                                <span>Session: {ticket.sessionId}</span>
                              </div>
                            </div>
                            {/* Admin response */}
                            <div onClick={(e) => e.stopPropagation()}>
                              <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold mb-2">
                                Admin Response
                              </p>
                              <textarea
                                value={ticket.cpoNotes}
                                onChange={(e) => updateTicketNotes(ticket.id, e.target.value)}
                                placeholder="Write admin response..."
                                rows={4}
                                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-blue)] resize-y"
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg px-2 py-1.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-blue)]"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  )
}

function SortHeader({ label, sortKey: key, current, dir, onSort }: { label: string; sortKey: SortKey; current: SortKey; dir: SortDir; onSort: (k: SortKey) => void }) {
  const isActive = current === key
  return (
    <th className="text-left px-4 py-3">
      <button
        onClick={() => onSort(key)}
        className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold transition-colors hover:text-[var(--text-primary)]"
        style={{ color: isActive ? 'var(--brand-blue)' : 'var(--text-tertiary)' }}
      >
        {label}
        <ArrowUpDown className="w-3 h-3" style={{ opacity: isActive ? 1 : 0.3 }} />
      </button>
    </th>
  )
}
