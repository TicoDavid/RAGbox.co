'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Upload,
  FolderPlus,
  ArrowUpDown,
  List,
  LayoutGrid,
  Maximize2,
  X,
  Trash2,
  FolderInput,
  Check,
  ChevronDown,
} from 'lucide-react'

interface VaultToolbarProps {
  viewMode: 'list' | 'grid'
  sortField: 'name' | 'date' | 'size' | 'type'
  sortDirection: 'asc' | 'desc'
  selectedCount: number
  onUpload: () => void
  onNewFolder: () => void
  onSetViewMode: (mode: 'list' | 'grid') => void
  onSetSort: (field: 'name' | 'date' | 'size' | 'type', direction: 'asc' | 'desc') => void
  onOpenExplorer: () => void
  onDeleteSelected?: () => void
  onMoveSelected?: () => void
  onClearSelection: () => void
}

const SORT_OPTIONS: { field: 'name' | 'date' | 'size' | 'type'; labelAsc: string; labelDesc: string }[] = [
  { field: 'name', labelAsc: 'Name (A→Z)', labelDesc: 'Name (Z→A)' },
  { field: 'date', labelAsc: 'Date (Oldest)', labelDesc: 'Date (Newest)' },
  { field: 'size', labelAsc: 'Size (Smallest)', labelDesc: 'Size (Largest)' },
  { field: 'type', labelAsc: 'Type (A→Z)', labelDesc: 'Type (Z→A)' },
]

function getSortLabel(field: string, dir: string): string {
  const opt = SORT_OPTIONS.find((o) => o.field === field)
  if (!opt) return 'Sort'
  return dir === 'asc' ? opt.labelAsc : opt.labelDesc
}

export function VaultToolbar({
  viewMode,
  sortField,
  sortDirection,
  selectedCount,
  onUpload,
  onNewFolder,
  onSetViewMode,
  onSetSort,
  onOpenExplorer,
  onDeleteSelected,
  onMoveSelected,
  onClearSelection,
}: VaultToolbarProps) {
  const [sortOpen, setSortOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)

  // Close sort dropdown on outside click
  useEffect(() => {
    if (!sortOpen) return
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [sortOpen])

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.target instanceof HTMLElement && e.target.isContentEditable) return
      if (e.target instanceof HTMLSelectElement) return
      if (e.metaKey || e.ctrlKey) return
      if (e.key === 'u') onUpload()
      if (e.key === 'n') onNewFolder()
      if (e.key === 'g') onSetViewMode(viewMode === 'list' ? 'grid' : 'list')
    },
    [onUpload, onNewFolder, onSetViewMode, viewMode],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const hasSelection = selectedCount > 0

  return (
    <div className="flex items-center justify-between px-4 py-2 gap-2 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
      {/* Left side */}
      <div className="flex items-center gap-1.5">
        {hasSelection ? (
          <>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--brand-blue)] text-white">
              {selectedCount} selected
            </span>
            <button
              onClick={onClearSelection}
              className="p-1.5 rounded-[var(--radius-md)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
              aria-label="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            {/* Upload button */}
            <button
              onClick={onUpload}
              className="flex items-center gap-1.5 bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium transition-colors"
              aria-label="Upload files"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload
            </button>

            {/* New Folder */}
            <button
              onClick={onNewFolder}
              className="flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] rounded-[var(--radius-md)] px-3 py-1.5 text-sm transition-colors"
              aria-label="Create new folder"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Folder</span>
            </button>
          </>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1.5">
        {hasSelection ? (
          <>
            {onMoveSelected && (
              <button
                onClick={onMoveSelected}
                className="flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] rounded-[var(--radius-md)] px-3 py-1.5 text-sm transition-colors"
                aria-label="Move selected documents"
              >
                <FolderInput className="w-3.5 h-3.5" />
                Move
              </button>
            )}
            {onDeleteSelected && (
              <div className="relative">
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 text-[var(--danger)] hover:bg-[var(--danger)]/10 rounded-[var(--radius-md)] px-3 py-1.5 text-sm transition-colors"
                  aria-label="Delete selected documents"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
                {showDeleteConfirm && (
                  <div className="absolute right-0 top-full mt-1 z-50 w-[260px] p-3 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[var(--radius-md)] shadow-lg">
                    <p className="text-sm text-[var(--text-primary)] mb-2">
                      Delete {selectedCount} document{selectedCount !== 1 ? 's' : ''}? This cannot be undone.
                    </p>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-3 py-1 text-xs rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          setShowDeleteConfirm(false)
                          onDeleteSelected()
                        }}
                        className="px-3 py-1 text-xs rounded-[var(--radius-sm)] bg-[var(--danger)] text-white hover:opacity-90 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Sort dropdown */}
            <div className="relative" ref={sortRef}>
              <button
                onClick={() => setSortOpen((v) => !v)}
                className="flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] rounded-[var(--radius-md)] px-3 py-1.5 text-sm transition-colors"
                aria-label="Sort documents"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline truncate max-w-[100px]">{getSortLabel(sortField, sortDirection)}</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {sortOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 w-[180px] bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[var(--radius-md)] shadow-lg py-1">
                  {SORT_OPTIONS.map((opt) => (
                    <React.Fragment key={opt.field}>
                      <button
                        onClick={() => { onSetSort(opt.field, 'asc'); setSortOpen(false) }}
                        className="w-full flex items-center justify-between px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                      >
                        {opt.labelAsc}
                        {sortField === opt.field && sortDirection === 'asc' && <Check className="w-3.5 h-3.5 text-[var(--brand-blue)]" />}
                      </button>
                      <button
                        onClick={() => { onSetSort(opt.field, 'desc'); setSortOpen(false) }}
                        className="w-full flex items-center justify-between px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                      >
                        {opt.labelDesc}
                        {sortField === opt.field && sortDirection === 'desc' && <Check className="w-3.5 h-3.5 text-[var(--brand-blue)]" />}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>

            {/* View toggle (segmented control) */}
            <div className="flex bg-[var(--bg-tertiary)] rounded-[var(--radius-md)] p-0.5">
              <button
                onClick={() => onSetViewMode('list')}
                className={`relative p-1.5 rounded-[var(--radius-sm)] transition-colors ${
                  viewMode === 'list' ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                }`}
                aria-label="List view"
                aria-pressed={viewMode === 'list'}
              >
                {viewMode === 'list' && (
                  <motion.div
                    layoutId="view-toggle"
                    className="absolute inset-0 bg-[var(--bg-elevated)] shadow-sm rounded-[var(--radius-sm)]"
                    transition={{ duration: 0.2 }}
                  />
                )}
                <List className="w-4 h-4 relative z-10" />
              </button>
              <button
                onClick={() => onSetViewMode('grid')}
                className={`relative p-1.5 rounded-[var(--radius-sm)] transition-colors ${
                  viewMode === 'grid' ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                }`}
                aria-label="Grid view"
                aria-pressed={viewMode === 'grid'}
              >
                {viewMode === 'grid' && (
                  <motion.div
                    layoutId="view-toggle"
                    className="absolute inset-0 bg-[var(--bg-elevated)] shadow-sm rounded-[var(--radius-sm)]"
                    transition={{ duration: 0.2 }}
                  />
                )}
                <LayoutGrid className="w-4 h-4 relative z-10" />
              </button>
            </div>

            {/* Explorer button */}
            <button
              onClick={onOpenExplorer}
              className="flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] rounded-[var(--radius-md)] px-3 py-1.5 text-sm transition-colors"
              aria-label="Open explorer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Explorer</span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
