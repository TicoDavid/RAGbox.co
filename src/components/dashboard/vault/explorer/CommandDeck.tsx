'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  ChevronRight,
  Plus,
  Upload,
  Brain,
  ArrowRight,
  Shield,
  LayoutGrid,
  LayoutList,
  Search,
  X,
  FolderPlus,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import type { FolderNode } from '@/types/ragbox'
import type { ViewMode } from './explorer-types'

interface CommandDeckProps {
  currentPath: string[]
  folders: Record<string, FolderNode>
  searchQuery: string
  viewMode: ViewMode
  isVectorizing?: boolean
  onNavigate: (folderId: string | null) => void
  onSearchChange: (query: string) => void
  onViewModeChange: (mode: ViewMode) => void
  onNewFolder: () => void
  onUpload: () => void
  onVectorize: () => void
  onMoveTo: () => void
  onSecurity: () => void
  filteredCount?: number
  totalCount?: number
  onClose?: () => void
}

export function CommandDeck({
  currentPath,
  folders,
  searchQuery,
  viewMode,
  isVectorizing,
  onNavigate,
  onSearchChange,
  onViewModeChange,
  onNewFolder,
  onUpload,
  onVectorize,
  onMoveTo,
  onSecurity,
  filteredCount,
  totalCount,
  onClose,
}: CommandDeckProps) {
  const [showNewMenu, setShowNewMenu] = useState(false)
  const [inputValue, setInputValue] = useState(searchQuery)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync external searchQuery → inputValue (e.g. when cleared from parent)
  useEffect(() => {
    setInputValue(searchQuery)
  }, [searchQuery])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onSearchChange(value), 300)
  }, [onSearchChange])

  const handleClear = useCallback(() => {
    setInputValue('')
    if (timerRef.current) clearTimeout(timerRef.current)
    onSearchChange('')
  }, [onSearchChange])

  return (
    <div className="shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border-default)]">
      {/* Breadcrumbs Row */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-1 text-sm">
          <button
            onClick={() => onNavigate(null)}
            className="px-2 py-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] rounded transition-colors"
          >
            Vault
          </button>
          {currentPath.map((folderId, index) => {
            const folder = folders[folderId]
            if (!folder) return null
            return (
              <React.Fragment key={folderId}>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                <button
                  onClick={() => onNavigate(folderId)}
                  className={`px-2 py-1 rounded transition-colors ${
                    index === currentPath.length - 1
                      ? 'text-[var(--text-primary)] font-medium'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                  }`}
                >
                  {folder.name}
                </button>
              </React.Fragment>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
            <input
              id="vault-search"
              name="vault-search"
              type="text"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Search vault..."
              className="w-64 h-8 pl-9 pr-8 bg-[var(--bg-elevated)]/20 border border-[var(--border-default)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-blue)] focus:ring-1 focus:ring-[var(--brand-blue)]/30 transition-colors"
            />
            {inputValue && (
              <button
                onClick={handleClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Document count */}
          {filteredCount !== undefined && totalCount !== undefined && (
            <span className="text-xs text-[var(--text-tertiary)] whitespace-nowrap">
              {filteredCount} of {totalCount}
            </span>
          )}

          {onClose && (
            <button
              onClick={onClose}
              title="Close vault"
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] rounded-lg transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Toolbar Row */}
      <div className="flex items-center gap-2 px-4 py-2">
        {/* New Button with dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNewMenu(!showNewMenu)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-[var(--text-primary)] text-sm font-medium rounded-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            New
          </button>
          <AnimatePresence>
            {showNewMenu && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute top-full mt-1 left-0 z-50 w-44 bg-[var(--bg-primary)]/95 backdrop-blur-xl border border-[var(--border-default)] rounded-xl overflow-hidden shadow-xl"
              >
                <button
                  onClick={() => { onNewFolder(); setShowNewMenu(false) }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50 hover:text-[var(--text-primary)] transition-all"
                >
                  <FolderPlus className="w-4 h-4" />
                  New Folder
                </button>
                <button
                  onClick={() => { onUpload(); setShowNewMenu(false) }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50 hover:text-[var(--text-primary)] transition-all"
                >
                  <Upload className="w-4 h-4" />
                  Upload Files
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="w-px h-6 bg-[var(--bg-elevated)]" />

        {/* Action Buttons */}
        <ToolbarButton icon={<Upload className="w-4 h-4" />} label="Upload" onClick={onUpload} />
        <ToolbarButton icon={<Brain className="w-4 h-4" />} label={isVectorizing ? 'Indexing...' : 'Index Document'} onClick={onVectorize} disabled={isVectorizing} />
        <ToolbarButton icon={<ArrowRight className="w-4 h-4" />} label="Move To" onClick={onMoveTo} />
        <ToolbarButton icon={<Shield className="w-4 h-4" />} label="Security" onClick={onSecurity} />

        <div className="flex-1" />

        {/* View Toggle */}
        <div className="flex items-center bg-[var(--bg-elevated)]/50 rounded-lg p-0.5">
          <button
            onClick={() => onViewModeChange('list')}
            title="List view"
            className={`p-1.5 rounded transition-all ${viewMode === 'list' ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
          >
            <LayoutList className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange('grid')}
            title="Grid view"
            className={`p-1.5 rounded transition-all ${viewMode === 'grid' ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function ToolbarButton({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-all ${
        disabled
          ? 'text-[var(--text-muted)] cursor-not-allowed'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
      }`}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  )
}
