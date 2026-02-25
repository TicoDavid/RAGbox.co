'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useVaultStore } from '@/stores/vaultStore'
import { useChatStore } from '@/stores/chatStore'
import { VaultRail } from './VaultRail'
import { ColumnBrowser } from './ColumnBrowser'
import { StorageFooter } from './StorageFooter'
import { SovereignCertificate } from './SovereignCertificate'
import { AnimatePresence, motion } from 'framer-motion'
import {
  X,
  Plus,
  Maximize2,
  ArrowLeft,
  FileText,
  Shield,
  Star,
  Trash2,
  Clock,
  MessageSquare,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
} from 'lucide-react'
import IngestionModal from '@/app/dashboard/components/IngestionModal'
import { DuplicateFileDialog } from './DuplicateFileDialog'

// ============================================================================
// VAULT DETAIL VIEW — Drill-down when a file is selected
// ============================================================================

function VaultDetailView() {
  const selectedItemId = useVaultStore((s) => s.selectedItemId)
  const documents = useVaultStore((s) => s.documents)
  const deleteDocument = useVaultStore((s) => s.deleteDocument)
  const togglePrivilege = useVaultStore((s) => s.togglePrivilege)
  const toggleStar = useVaultStore((s) => s.toggleStar)
  const selectAndChat = useVaultStore((s) => s.selectAndChat)
  const selectItem = useVaultStore((s) => s.selectItem)
  const fetchDocuments = useVaultStore((s) => s.fetchDocuments)
  const startDocumentChat = useChatStore((s) => s.startDocumentChat)
  const selectedDoc = selectedItemId ? documents[selectedItemId] : null

  if (!selectedDoc) return null

  const formatSize = (bytes?: number): string => {
    if (!bytes) return '\u2014'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (date: Date): string =>
    new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date))

  return (
    <div className="flex flex-col h-full bg-[var(--bg-secondary)]">
      {/* Back button header */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-[var(--border-default)]">
        <button
          onClick={() => selectItem(null)}
          className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          aria-label="Back to file list"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Files</span>
        </button>
        <div className="flex-1" />
        <button
          onClick={() => toggleStar(selectedDoc.id)}
          className="p-1.5 rounded-lg hover:bg-[var(--bg-elevated)]/50 transition-colors"
          aria-label={selectedDoc.isStarred ? 'Unstar document' : 'Star document'}
        >
          <Star className={`w-4 h-4 ${selectedDoc.isStarred ? 'fill-[var(--warning)] text-[var(--warning)]' : 'text-[var(--text-tertiary)]'}`} />
        </button>
      </div>

      {/* Scrollable detail content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* File Header */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-[80px] h-[96px] rounded-lg bg-[var(--bg-primary)] border border-[var(--border-default)] flex items-center justify-center shadow-[0_0_30px_-10px_rgba(0,0,0,0.5)]">
            <FileText className="w-8 h-8 text-[var(--text-tertiary)]" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-[var(--text-primary)] break-all leading-tight">{selectedDoc.name}</p>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-1 font-mono">
              {formatSize(selectedDoc.size)} · {selectedDoc.mimeType?.split('/')[1]?.toUpperCase() || 'FILE'}
            </p>
          </div>
        </div>

        {/* Ingestion Status Indicator */}
        {selectedDoc.status === 'ready' ? (
          <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[var(--success)]/10 border border-[var(--success)]/20">
            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)]" />
            <span className="text-xs font-medium text-[var(--success)]">Indexed</span>
          </div>
        ) : selectedDoc.status === 'processing' ? (
          <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[var(--warning)]/10 border border-[var(--warning)]/20">
            <Loader2 className="w-3.5 h-3.5 text-[var(--warning)] animate-spin" />
            <span className="text-xs font-medium text-[var(--warning)]">Processing...</span>
          </div>
        ) : selectedDoc.status === 'pending' ? (
          <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)]">
            <Loader2 className="w-3.5 h-3.5 text-[var(--text-tertiary)] animate-spin" />
            <span className="text-xs font-medium text-[var(--text-tertiary)]">Indexing...</span>
          </div>
        ) : selectedDoc.status === 'error' ? (
          <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/20">
            <AlertTriangle className="w-3.5 h-3.5 text-[var(--danger)]" />
            <span className="text-xs font-medium text-[var(--danger)]">Indexing Failed</span>
            <button
              onClick={() => {
                fetch(`/api/documents/${selectedDoc.id}/ingest`, { method: 'POST', credentials: 'include' })
                  .then(() => fetchDocuments())
                  .catch(() => {})
              }}
              className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--danger)]/20 text-[var(--danger)] hover:bg-[var(--danger)]/30 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          </div>
        ) : null}

        {/* Sovereign Certificate — Chain of Custody */}
        <SovereignCertificate document={selectedDoc} />

        {/* Privilege Badge */}
        {selectedDoc.isPrivileged && (
          <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/20">
            <Shield className="w-3.5 h-3.5 text-[var(--danger)]" />
            <span className="text-xs font-semibold text-[var(--danger)] uppercase tracking-wider">
              Attorney-Client Privilege
            </span>
          </div>
        )}

        {/* Timestamp */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-[var(--text-muted)]">
          <Clock className="w-3 h-3" />
          <span>Deposited {formatDate(selectedDoc.createdAt)}</span>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 mt-auto pt-2">
          <button
            onClick={() => {
              selectAndChat(selectedDoc.id)
              startDocumentChat(selectedDoc.id, selectedDoc.name)
            }}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-[var(--brand-blue)] text-[var(--text-primary)] text-sm font-semibold hover:bg-[var(--brand-blue-hover)] transition-colors"
            aria-label={`Chat with ${selectedDoc.name}`}
          >
            <MessageSquare className="w-4 h-4" />
            Chat with this File
          </button>
          <button
            onClick={() => togglePrivilege(selectedDoc.id)}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-[var(--border-default)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50 hover:border-[var(--border-strong)] transition-all"
            aria-label={selectedDoc.isPrivileged ? `Remove privilege from ${selectedDoc.name}` : `Mark ${selectedDoc.name} as privileged`}
          >
            <Shield className="w-4 h-4" />
            {selectedDoc.isPrivileged ? 'Remove Privilege' : 'Mark Privileged'}
          </button>
          <button
            onClick={() => deleteDocument(selectedDoc.id)}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-[var(--danger)]/20 text-sm text-[var(--danger)]/70 hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 hover:border-[var(--danger)]/30 transition-all"
            aria-label={`Delete ${selectedDoc.name}`}
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// VAULT PANEL — Fortress Left
// ============================================================================

export function VaultPanel() {
  const [isIngestionOpen, setIsIngestionOpen] = useState(false)
  const isCollapsed = useVaultStore((s) => s.isCollapsed)
  const toggleCollapse = useVaultStore((s) => s.toggleCollapse)
  const toggleExplorerMode = useVaultStore((s) => s.toggleExplorerMode)
  const fetchDocuments = useVaultStore((s) => s.fetchDocuments)
  const fetchFolders = useVaultStore((s) => s.fetchFolders)
  const setSearchQuery = useVaultStore((s) => s.setSearchQuery)
  const isLoading = useVaultStore((s) => s.isLoading)
  const documents = useVaultStore((s) => s.documents)
  const uploadDocuments = useVaultStore((s) => s.uploadDocuments)
  const currentPath = useVaultStore((s) => s.currentPath)
  const selectedItemId = useVaultStore((s) => s.selectedItemId)
  const hasFetched = useRef(false)

  // STORY-208: Document search (moved from GlobalHeader)
  const [searchInput, setSearchInput] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        setSearchQuery(value)
        fetchDocuments()
      }, 300)
    },
    [setSearchQuery, fetchDocuments],
  )

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // Cmd/Ctrl+K keyboard shortcut focuses vault search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true
      fetchDocuments().then(() => fetchFolders())
    }
  }, [fetchDocuments, fetchFolders])

  const handleIngestionUpload = async (files: File[]) => {
    const folderId = currentPath[currentPath.length - 1]
    await uploadDocuments(files, folderId)
    setIsIngestionOpen(false)
  }

  if (isCollapsed) {
    return (
      <>
        <VaultRail onExpand={toggleCollapse} onUpload={() => setIsIngestionOpen(true)} />
        <IngestionModal
          isOpen={isIngestionOpen}
          onClose={() => setIsIngestionOpen(false)}
          onFileUpload={handleIngestionUpload}
        />
        <DuplicateFileDialog />
      </>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-secondary)]">
      {/* Header with rim lighting — always visible */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)] border-t border-t-[var(--border-default)]">
        <span className="text-base font-bold text-[var(--text-primary)] tracking-wide">Vault</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsIngestionOpen(true)}
            className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--brand-blue)] hover:bg-[var(--bg-tertiary)] transition-colors"
            title="Add to Vault"
            aria-label="Add document to vault"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            onClick={toggleExplorerMode}
            className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--brand-blue)] hover:bg-[var(--bg-tertiary)] transition-colors"
            title="Explorer Mode"
            aria-label="Open explorer mode"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
          <button
            onClick={toggleCollapse}
            className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            title="Collapse"
            aria-label="Collapse vault panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* STORY-208: Document search */}
      <div className="shrink-0 px-3 py-2 border-b border-[var(--border-default)]">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border-default)] focus-within:border-[var(--brand-blue)] focus-within:ring-1 focus-within:ring-[var(--brand-blue)]/30 transition-colors">
          <Search className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search documents..."
            aria-label="Search documents"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-tertiary)] text-[var(--text-primary)]"
          />
          {searchInput && (
            <button
              onClick={() => handleSearchChange('')}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="text-[9px] font-mono bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] px-1 py-0.5 rounded shrink-0">&#8984;K</kbd>
        </div>
      </div>

      {/* Ingestion Modal */}
      <IngestionModal
        isOpen={isIngestionOpen}
        onClose={() => setIsIngestionOpen(false)}
        onFileUpload={handleIngestionUpload}
      />

      {/* Duplicate file dialog — shown when uploading a file that already exists */}
      <DuplicateFileDialog />

      {/* Body: Drill-down between File List ↔ File Details */}
      <AnimatePresence mode="wait">
        {selectedItemId ? (
          <motion.div
            key="detail"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="flex-1 overflow-hidden min-h-0"
          >
            <VaultDetailView />
          </motion.div>
        ) : (
          <motion.div
            key="browser"
            initial={{ x: '-50%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-50%', opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="flex-1 flex overflow-hidden min-h-0"
          >
            {isLoading && Object.keys(documents).length === 0 ? (
              <div className="flex-1 p-4 space-y-3">
                {/* Vault loading skeleton */}
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="w-8 h-8 rounded-lg animate-pulse bg-[var(--bg-elevated)]/50" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 rounded animate-pulse bg-[var(--bg-elevated)]/50" style={{ width: `${60 + (i * 7) % 30}%` }} />
                      <div className="h-2.5 rounded animate-pulse bg-[var(--bg-elevated)]/50 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 overflow-hidden">
                <ColumnBrowser />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Storage Footer */}
      <StorageFooter />
    </div>
  )
}
