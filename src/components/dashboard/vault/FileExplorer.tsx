'use client'

/**
 * FileExplorer — CPO Bug Report 2026-03-04: Vault file explorer upgrade
 *
 * Tree-view file explorer with:
 * - Expand/collapse folders
 * - File type icons (PDF, DOCX, XLSX, etc.)
 * - Sort options (name, date, size, type)
 * - File size, upload date, indexed status indicator
 * - DnD support (drag files into folders)
 */

import React, { useMemo, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileCode,
  File,
  FileType,
  ArrowUpDown,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  FolderPlus,
  Mic,
} from 'lucide-react'
import { useVaultStore } from '@/stores/vaultStore'
import type { VaultItem, FolderNode } from '@/types/ragbox'
import { FolderContextMenu } from './FolderContextMenu'
import { InlineFolderInput } from './InlineFolderInput'

// ============================================================================
// FOLDER COLORS
// ============================================================================

const FOLDER_COLORS: Record<string, string> = {
  blue: 'text-blue-400',
  green: 'text-emerald-400',
  amber: 'text-amber-400',
  red: 'text-red-400',
  purple: 'text-purple-400',
  grey: 'text-slate-400',
}

// ============================================================================
// SORT CONFIG
// ============================================================================

type SortField = 'name' | 'date' | 'size' | 'type'
type SortDirection = 'asc' | 'desc'

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'name', label: 'Name' },
  { field: 'date', label: 'Date' },
  { field: 'size', label: 'Size' },
  { field: 'type', label: 'Type' },
]

// ============================================================================
// FILE TYPE ICONS
// ============================================================================

function getFileIcon(mimeType?: string, name?: string) {
  const ext = name?.split('.').pop()?.toLowerCase()

  // PDF
  if (mimeType?.includes('pdf') || ext === 'pdf') {
    return <FileText className="w-4 h-4 text-red-400" />
  }
  // Word docs
  if (mimeType?.includes('word') || mimeType?.includes('document') || ext === 'docx' || ext === 'doc') {
    return <FileType className="w-4 h-4 text-blue-400" />
  }
  // Spreadsheets
  if (mimeType?.includes('sheet') || mimeType?.includes('excel') || ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
    return <FileSpreadsheet className="w-4 h-4 text-green-400" />
  }
  // Images
  if (mimeType?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext ?? '')) {
    return <FileImage className="w-4 h-4 text-purple-400" />
  }
  // Code/text
  if (mimeType?.includes('json') || mimeType?.includes('xml') || mimeType?.includes('html') ||
      ['js', 'ts', 'py', 'go', 'rs', 'json', 'xml', 'yaml', 'yml', 'md'].includes(ext ?? '')) {
    return <FileCode className="w-4 h-4 text-cyan-400" />
  }
  // Presentations
  if (mimeType?.includes('presentation') || ext === 'pptx' || ext === 'ppt') {
    return <FileText className="w-4 h-4 text-orange-400" />
  }
  // Meeting transcripts / audio
  if (mimeType?.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'webm'].includes(ext ?? '') ||
      name?.toLowerCase().includes('transcript')) {
    return <Mic className="w-4 h-4 text-amber-400" />
  }
  // Generic
  return <File className="w-4 h-4 text-[var(--text-tertiary)]" />
}

function getStatusIndicator(status: string) {
  switch (status) {
    case 'ready':
      return <CheckCircle2 className="w-3 h-3 text-[var(--success)]" />
    case 'processing':
    case 'pending':
      return <Loader2 className="w-3 h-3 text-[var(--warning)] animate-spin" />
    case 'error':
      return <AlertTriangle className="w-3 h-3 text-[var(--danger)]" />
    default:
      return null
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function formatSize(bytes?: number): string {
  if (!bytes) return '\u2014'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(date?: Date | string): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getExtension(name: string): string {
  return name.split('.').pop()?.toUpperCase() ?? ''
}

function sortDocuments(docs: VaultItem[], field: SortField, dir: SortDirection): VaultItem[] {
  const sorted = [...docs].sort((a, b) => {
    switch (field) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'date':
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      case 'size':
        return (b.size ?? 0) - (a.size ?? 0)
      case 'type':
        return getExtension(a.name).localeCompare(getExtension(b.name))
    }
  })
  return dir === 'desc' ? sorted.reverse() : sorted
}

// ============================================================================
// FOLDER NODE — expandable tree item
// ============================================================================

function FolderTreeItem({
  folder,
  depth,
  allFolders,
  allDocuments,
  selectedId,
  expandedFolders,
  toggleExpand,
  onSelectDocument,
  onNavigateFolder,
  sortField,
  sortDir,
  isDragOver,
  onDragStart,
  onFolderDragOver,
  onFolderDrop,
  onFolderDragLeave,
  dragOverFolderId,
  selectedDocumentIds,
  toggleDocumentSelection,
}: {
  folder: FolderNode
  depth: number
  allFolders: Record<string, FolderNode>
  allDocuments: Record<string, VaultItem>
  selectedId: string | null
  expandedFolders: Set<string>
  toggleExpand: (id: string) => void
  onSelectDocument: (id: string) => void
  onNavigateFolder: (path: string[]) => void
  sortField: SortField
  sortDir: SortDirection
  isDragOver: boolean
  onDragStart: (e: React.DragEvent, docId: string) => void
  onFolderDragOver: (e: React.DragEvent, folderId: string) => void
  onFolderDrop: (e: React.DragEvent, folderId: string) => void
  onFolderDragLeave: (e: React.DragEvent) => void
  dragOverFolderId: string | null
  selectedDocumentIds?: string[]
  toggleDocumentSelection?: (id: string) => void
}) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)

  // Store actions for context menu
  const deleteFolderAction = useVaultStore((s) => s.deleteFolder)
  const createFolderAction = useVaultStore((s) => s.createFolder)
  const renameFolderAction = useVaultStore((s) => s.renameFolder)
  const setFolderColorAction = useVaultStore((s) => s.setFolderColor)

  const isExpanded = expandedFolders.has(folder.id)
  const childFolders = Object.values(allFolders).filter(f => f.parentId === folder.id)
  const childDocs = sortDocuments(
    Object.values(allDocuments).filter(d => d.folderId === folder.id && d.deletionStatus === 'Active'),
    sortField,
    sortDir,
  )
  const itemCount = childFolders.length + childDocs.length

  return (
    <div>
      <button
        onClick={() => toggleExpand(folder.id)}
        onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY }) }}
        onDragOver={(e) => onFolderDragOver(e, folder.id)}
        onDrop={(e) => onFolderDrop(e, folder.id)}
        onDragLeave={onFolderDragLeave}
        className={`w-full flex items-center gap-2 py-1.5 px-2 rounded-md text-left transition-colors hover:bg-[var(--bg-elevated)]/50 group ${
          selectedId === folder.id ? 'bg-[var(--brand-blue)]/10' : ''
        }${isDragOver ? ' ring-2 ring-[var(--brand-blue)] bg-[var(--brand-blue)]/10' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} folder: ${folder.name}`}
      >
        <motion.span
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.15 }}
          className="shrink-0"
        >
          <ChevronRight className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
        </motion.span>
        {isExpanded
          ? <FolderOpen className={`w-4 h-4 shrink-0 ${folder.color ? FOLDER_COLORS[folder.color] || 'text-[var(--warning)]' : 'text-[var(--warning)]'}`} />
          : <Folder className={`w-4 h-4 shrink-0 ${folder.color ? FOLDER_COLORS[folder.color] || 'text-[var(--warning)]' : 'text-[var(--warning)]'}`} />
        }
        <span className="text-sm font-medium text-[var(--text-primary)] truncate flex-1">{folder.name}</span>
        <span className="text-[10px] text-[var(--text-tertiary)] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {itemCount}
        </span>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            {childFolders.map(child => (
              <FolderTreeItem
                key={child.id}
                folder={child}
                depth={depth + 1}
                allFolders={allFolders}
                allDocuments={allDocuments}
                selectedId={selectedId}
                expandedFolders={expandedFolders}
                toggleExpand={toggleExpand}
                onSelectDocument={onSelectDocument}
                onNavigateFolder={onNavigateFolder}
                sortField={sortField}
                sortDir={sortDir}
                isDragOver={dragOverFolderId === child.id}
                onDragStart={onDragStart}
                onFolderDragOver={onFolderDragOver}
                onFolderDrop={onFolderDrop}
                onFolderDragLeave={onFolderDragLeave}
                dragOverFolderId={dragOverFolderId}
                selectedDocumentIds={selectedDocumentIds}
                toggleDocumentSelection={toggleDocumentSelection}
              />
            ))}
            {childDocs.map(doc => (
              <DocumentTreeItem
                key={doc.id}
                doc={doc}
                depth={depth + 1}
                isSelected={selectedId === doc.id}
                onSelect={() => onSelectDocument(doc.id)}
                onDragStart={onDragStart}
                isChecked={selectedDocumentIds?.includes(doc.id)}
                onToggleSelect={() => toggleDocumentSelection?.(doc.id)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* G2: Inline rename triggered from context menu */}
      {isRenaming && (
        <div style={{ paddingLeft: `${depth * 16 + 8}px` }}>
          <InlineFolderInput
            defaultName={folder.name}
            existingNames={Object.values(allFolders)
              .filter(f => f.parentId === folder.parentId && f.id !== folder.id)
              .map(f => f.name)}
            onSubmit={(newName) => {
              renameFolderAction(folder.id, newName)
              setIsRenaming(false)
            }}
            onCancel={() => setIsRenaming(false)}
          />
        </div>
      )}

      {contextMenu && (
        <FolderContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          folderId={folder.id}
          folderName={folder.name}
          documentCount={childDocs.length}
          folderColor={folder.color ?? undefined}
          onRename={() => { setContextMenu(null); setIsRenaming(true) }}
          onDelete={() => { setContextMenu(null); deleteFolderAction(folder.id) }}
          onNewSubfolder={() => { setContextMenu(null); createFolderAction('New Folder', folder.id) }}
          onSetColor={(color) => { setContextMenu(null); setFolderColorAction(folder.id, color) }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}

// ============================================================================
// DOCUMENT NODE — leaf tree item
// ============================================================================

function DocumentTreeItem({
  doc,
  depth,
  isSelected,
  onSelect,
  onDragStart,
  isChecked,
  onToggleSelect,
}: {
  doc: VaultItem
  depth: number
  isSelected: boolean
  onSelect: () => void
  onDragStart?: (e: React.DragEvent, docId: string) => void
  isChecked?: boolean
  onToggleSelect?: (e: React.MouseEvent) => void
}) {
  return (
    <button
      onClick={onSelect}
      draggable
      onDragStart={(e) => onDragStart?.(e, doc.id)}
      className={`w-full flex items-center gap-2 py-1.5 px-2 rounded-md text-left transition-colors group cursor-grab active:cursor-grabbing ${
        isSelected
          ? 'bg-[var(--brand-blue)] text-[var(--text-primary)]'
          : 'hover:bg-[var(--bg-elevated)]/50'
      }`}
      style={{ paddingLeft: `${depth * 16 + 28}px` }}
      aria-label={`Select: ${doc.name}`}
    >
      {onToggleSelect && (
        <input
          type="checkbox"
          checked={isChecked || false}
          onClick={(e) => { e.stopPropagation(); onToggleSelect(e as unknown as React.MouseEvent) }}
          onChange={() => {}}
          className="w-3.5 h-3.5 rounded border-[var(--border-default)] text-[var(--brand-blue)] shrink-0"
          aria-label={`Select ${doc.name}`}
        />
      )}
      <div className="shrink-0">{getFileIcon(doc.mimeType, doc.name)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate leading-tight">{doc.name}</p>
      </div>
      <div className="shrink-0 flex items-center gap-1.5">
        {getStatusIndicator(doc.status)}
        <span className={`text-[10px] ${isSelected ? 'text-[var(--text-primary)]/60' : 'text-[var(--text-tertiary)]'}`}>
          {formatSize(doc.size)}
        </span>
        <span className={`text-[10px] hidden sm:inline ${isSelected ? 'text-[var(--text-primary)]/60' : 'text-[var(--text-tertiary)]'}`}>
          {formatDate(doc.updatedAt)}
        </span>
      </div>
    </button>
  )
}

// ============================================================================
// FILE EXPLORER — main component
// ============================================================================

export function FileExplorer() {
  const documents = useVaultStore((s) => s.documents)
  const folders = useVaultStore((s) => s.folders)
  const selectedItemId = useVaultStore((s) => s.selectedItemId)
  const selectItem = useVaultStore((s) => s.selectItem)
  const navigate = useVaultStore((s) => s.navigate)
  const createFolder = useVaultStore((s) => s.createFolder)
  const moveDocument = useVaultStore((s) => s.moveDocument)

  const selectedDocumentIds = useVaultStore((s) => s.selectedDocumentIds)
  const toggleDocumentSelection = useVaultStore((s) => s.toggleDocumentSelection)

  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDirection>('asc')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const [dragOverRoot, setDragOverRoot] = useState(false)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)

  const toggleExpand = useCallback((folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }, [])

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }, [sortField])

  // Root items (no parent folder)
  const rootFolders = useMemo(
    () => Object.values(folders).filter(f => !f.parentId),
    [folders],
  )

  const rootDocs = useMemo(
    () => sortDocuments(
      Object.values(documents).filter(d => !d.folderId && d.deletionStatus === 'Active'),
      sortField,
      sortDir,
    ),
    [documents, sortField, sortDir],
  )

  const handleDragStart = useCallback((e: React.DragEvent, docId: string) => {
    e.dataTransfer.setData('text/plain', docId)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleFolderDragOver = useCallback((e: React.DragEvent, folderId: string) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setDragOverFolderId(folderId)
  }, [])

  const handleFolderDrop = useCallback((e: React.DragEvent, folderId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const docId = e.dataTransfer.getData('text/plain')
    if (docId) moveDocument(docId, folderId)
    setDragOverFolderId(null)
  }, [moveDocument])

  const handleFolderDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOverFolderId(null)
  }, [])

  const handleRootDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverRoot(true)
  }, [])

  const handleRootDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const docId = e.dataTransfer.getData('text/plain')
    if (docId) moveDocument(docId, null)
    setDragOverRoot(false)
  }, [moveDocument])

  const handleRootDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOverRoot(false)
  }, [])

  const totalFiles = Object.values(documents).filter(d => d.deletionStatus === 'Active').length

  return (
    <div className="flex flex-col h-full">
      {/* Sort toolbar */}
      <div className="shrink-0 flex items-center gap-1 px-3 py-1.5 border-b border-[var(--border-subtle)]">
        <ArrowUpDown className="w-3 h-3 text-[var(--text-tertiary)] shrink-0" />
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.field}
            onClick={() => handleSort(opt.field)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              sortField === opt.field
                ? 'bg-[var(--brand-blue)]/15 text-[var(--brand-blue)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50'
            }`}
          >
            {opt.label}
            {sortField === opt.field && (
              <span className="ml-0.5">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
            )}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setIsCreatingFolder(true)}
          className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--brand-blue)] hover:bg-[var(--bg-tertiary)] transition-colors"
          title="New Folder"
          aria-label="Create new folder"
        >
          <FolderPlus className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] text-[var(--text-tertiary)] ml-1">{totalFiles} files</span>
      </div>

      {/* Tree */}
      <div
        className={`flex-1 overflow-y-auto py-1${dragOverRoot ? ' bg-[var(--brand-blue)]/5' : ''}`}
        onDragOver={handleRootDragOver}
        onDrop={handleRootDrop}
        onDragLeave={handleRootDragLeave}
      >
        {/* G1: Inline folder creation */}
        {isCreatingFolder && (
          <InlineFolderInput
            existingNames={Object.values(folders).filter(f => !f.parentId).map(f => f.name)}
            onSubmit={(name) => {
              createFolder(name, undefined)
              setIsCreatingFolder(false)
            }}
            onCancel={() => setIsCreatingFolder(false)}
          />
        )}

        {rootFolders.map(folder => (
          <FolderTreeItem
            key={folder.id}
            folder={folder}
            depth={0}
            allFolders={folders}
            allDocuments={documents}
            selectedId={selectedItemId}
            expandedFolders={expandedFolders}
            toggleExpand={toggleExpand}
            onSelectDocument={(id) => selectItem(id)}
            onNavigateFolder={navigate}
            sortField={sortField}
            sortDir={sortDir}
            isDragOver={dragOverFolderId === folder.id}
            onDragStart={handleDragStart}
            onFolderDragOver={handleFolderDragOver}
            onFolderDrop={handleFolderDrop}
            onFolderDragLeave={handleFolderDragLeave}
            dragOverFolderId={dragOverFolderId}
            selectedDocumentIds={selectedDocumentIds}
            toggleDocumentSelection={toggleDocumentSelection}
          />
        ))}
        {rootDocs.map(doc => (
          <DocumentTreeItem
            key={doc.id}
            doc={doc}
            depth={0}
            isSelected={selectedItemId === doc.id}
            onSelect={() => selectItem(doc.id)}
            onDragStart={handleDragStart}
            isChecked={selectedDocumentIds.includes(doc.id)}
            onToggleSelect={() => toggleDocumentSelection(doc.id)}
          />
        ))}

        {/* Empty state */}
        {rootFolders.length === 0 && rootDocs.length === 0 && (
          <div className="px-4 py-8 text-center">
            <FileText className="w-10 h-10 mx-auto mb-2 text-[var(--text-tertiary)] opacity-40" />
            <p className="text-sm text-[var(--text-tertiary)]">Upload your first document</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">Drag and drop files or use the upload button to get started.</p>
          </div>
        )}
      </div>
    </div>
  )
}
