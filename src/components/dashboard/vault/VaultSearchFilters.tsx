'use client'

import React, { type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Inbox } from 'lucide-react'
import type { VaultFilters } from '@/stores/vaultStore'
import type { VaultItem } from '@/types/ragbox'

interface VaultSearchFiltersProps {
  filters: VaultFilters
  onSetFilter: <K extends keyof VaultFilters>(category: K, value: VaultFilters[K]) => void
  onClearFilters: () => void
  resultCount: number
  searchQuery: string
}

// ── Helpers ──────────────────────────────────────────────────────────

export function getDocType(mimeType?: string): string {
  if (!mimeType) return 'other'
  if (mimeType.includes('pdf')) return 'pdf'
  if (mimeType.includes('word') || mimeType.includes('doc') || mimeType.includes('text/plain') || mimeType.includes('text/markdown') || mimeType.includes('csv') || mimeType.includes('spreadsheet') || mimeType.includes('presentation')) return 'doc'
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'other'
}

function getDateCutoff(range: string): Date {
  const now = new Date()
  switch (range) {
    case 'today': return new Date(now.getFullYear(), now.getMonth(), now.getDate())
    case 'week': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case 'month': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    default: return new Date(0)
  }
}

function matchesSizeRange(size: number | undefined, range: string): boolean {
  if (!size) return range === 'small'
  const mb = size / (1024 * 1024)
  switch (range) {
    case 'small': return mb < 1
    case 'medium': return mb >= 1 && mb < 10
    case 'large': return mb >= 10 && mb < 50
    case 'xlarge': return mb >= 50
    default: return true
  }
}

function normalizeStatus(status: string): string {
  const s = status?.toLowerCase()
  if (s === 'ready' || s === 'indexed') return 'Indexed'
  if (s === 'processing') return 'Processing'
  if (s === 'error' || s === 'failed') return 'Failed'
  if (s === 'pending') return 'Pending'
  return status
}

export function filterDocuments(
  docs: Record<string, VaultItem>,
  filters: VaultFilters,
  search: string,
): VaultItem[] {
  return Object.values(docs).filter((doc) => {
    if (filters.types.length > 0) {
      const docType = getDocType(doc.mimeType)
      if (!filters.types.includes(docType)) return false
    }
    if (filters.dateRange && filters.dateRange !== 'all') {
      const cutoff = getDateCutoff(filters.dateRange)
      if (new Date(doc.createdAt) < cutoff) return false
    }
    if (filters.sizeRange) {
      if (!matchesSizeRange(doc.size, filters.sizeRange)) return false
    }
    if (filters.status.length > 0) {
      if (!filters.status.includes(normalizeStatus(doc.status))) return false
    }
    if (search) {
      return doc.name.toLowerCase().includes(search.toLowerCase())
    }
    return true
  })
}

export function highlightMatch(filename: string, query: string): ReactNode {
  if (!query) return filename
  const idx = filename.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return filename
  return (
    <>
      {filename.slice(0, idx)}
      <mark className="bg-yellow-500/30 rounded px-0.5">{filename.slice(idx, idx + query.length)}</mark>
      {filename.slice(idx + query.length)}
    </>
  )
}

// ── Filter Chip ──────────────────────────────────────────────────────

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
        active
          ? 'bg-[var(--brand-blue)] text-white'
          : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
      }`}
    >
      {label}
    </button>
  )
}

function ChipSeparator() {
  return <div className="h-4 border-l border-[var(--border-default)] mx-1" />
}

// ── Main Component ───────────────────────────────────────────────────

const hasActiveFilters = (f: VaultFilters) =>
  f.types.length > 0 || f.dateRange !== null || f.sizeRange !== null || f.status.length > 0

export function VaultSearchFilters({
  filters,
  onSetFilter,
  onClearFilters,
  resultCount,
  searchQuery,
}: VaultSearchFiltersProps) {
  const active = hasActiveFilters(filters) || !!searchQuery

  const toggleArrayFilter = (category: 'types' | 'status', value: string) => {
    const current = filters[category] as string[]
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    onSetFilter(category, next)
  }

  const toggleSingleFilter = <K extends 'dateRange' | 'sizeRange'>(category: K, value: NonNullable<VaultFilters[K]>) => {
    onSetFilter(category, (filters[category] === value ? null : value) as VaultFilters[K])
  }

  return (
    <div className="px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
      {/* Filter chips row */}
      <div className="flex items-center gap-1 flex-wrap">
        {/* Type filters */}
        <FilterChip label="PDF" active={filters.types.includes('pdf')} onClick={() => toggleArrayFilter('types', 'pdf')} />
        <FilterChip label="Doc" active={filters.types.includes('doc')} onClick={() => toggleArrayFilter('types', 'doc')} />
        <FilterChip label="Image" active={filters.types.includes('image')} onClick={() => toggleArrayFilter('types', 'image')} />
        <FilterChip label="Audio" active={filters.types.includes('audio')} onClick={() => toggleArrayFilter('types', 'audio')} />

        <ChipSeparator />

        {/* Date filters */}
        <FilterChip label="Today" active={filters.dateRange === 'today'} onClick={() => toggleSingleFilter('dateRange', 'today')} />
        <FilterChip label="Week" active={filters.dateRange === 'week'} onClick={() => toggleSingleFilter('dateRange', 'week')} />
        <FilterChip label="Month" active={filters.dateRange === 'month'} onClick={() => toggleSingleFilter('dateRange', 'month')} />

        <ChipSeparator />

        {/* Size filters */}
        <FilterChip label="<1MB" active={filters.sizeRange === 'small'} onClick={() => toggleSingleFilter('sizeRange', 'small')} />
        <FilterChip label="1-10MB" active={filters.sizeRange === 'medium'} onClick={() => toggleSingleFilter('sizeRange', 'medium')} />
        <FilterChip label="10-50MB" active={filters.sizeRange === 'large'} onClick={() => toggleSingleFilter('sizeRange', 'large')} />

        <ChipSeparator />

        {/* Status filters */}
        <FilterChip label="Indexed" active={filters.status.includes('Indexed')} onClick={() => toggleArrayFilter('status', 'Indexed')} />
        <FilterChip label="Failed" active={filters.status.includes('Failed')} onClick={() => toggleArrayFilter('status', 'Failed')} />
      </div>

      {/* Result count + clear */}
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center justify-between mt-1.5"
          >
            <span className="text-xs text-[var(--text-tertiary)]">
              {resultCount} document{resultCount !== 1 ? 's' : ''} found
            </span>
            {hasActiveFilters(filters) && (
              <button
                onClick={onClearFilters}
                className="text-xs text-[var(--brand-blue)] underline hover:no-underline transition-colors"
              >
                Clear all filters
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Empty State ──────────────────────────────────────────────────────

export function FilterEmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <Inbox className="w-10 h-10 text-[var(--text-tertiary)] opacity-40 mb-3" />
      <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">No documents match your filters</p>
      <p className="text-xs text-[var(--text-tertiary)]">
        Try adjusting your search or{' '}
        <button onClick={onClear} className="text-[var(--brand-blue)] underline hover:no-underline">
          clear all filters
        </button>
      </p>
    </div>
  )
}
