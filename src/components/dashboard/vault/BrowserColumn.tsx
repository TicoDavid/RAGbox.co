'use client'

import React, { useState, useRef, useCallback } from 'react'
import { Folder, FileText, ChevronRight, FolderPlus } from 'lucide-react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { VaultItem, FolderNode } from '@/types/ragbox'
import { FolderContextMenu } from './FolderContextMenu'
import { useVaultStore } from '@/stores/vaultStore'

interface BrowserColumnProps {
  title: string
  parentId: string | undefined
  folders: FolderNode[]
  documents: VaultItem[]
  selectedId: string | null
  onSelectFolder: (folderId: string) => void
  onSelectDocument: (docId: string) => void
}

function formatSize(bytes?: number): string {
  if (!bytes) return '\u2014'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(date?: Date | string): string {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getStatusDot(status: string): string {
  switch (status) {
    case 'ready': return 'bg-[var(--success)]'
    case 'processing': return 'bg-[var(--warning)] animate-pulse'
    case 'pending': return 'bg-[var(--text-tertiary)] animate-pulse'
    case 'error': return 'bg-[var(--danger)]'
    default: return 'bg-[var(--text-tertiary)]'
  }
}

function getStatusLabel(status: string): { text: string; className: string } | null {
  switch (status) {
    case 'pending': return { text: 'Indexing...', className: 'text-[var(--text-tertiary)]' }
    case 'processing': return { text: 'Processing...', className: 'text-[var(--warning)]' }
    case 'error': return { text: 'Failed', className: 'text-[var(--danger)]' }
    default: return null
  }
}

// ─── Draggable Document Row ────────────────────────────────────────
function DraggableDocument({
  doc,
  isSelected,
  onSelect,
}: {
  doc: VaultItem
  isSelected: boolean
  onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `doc-${doc.id}`,
    data: { type: 'document', docId: doc.id, docName: doc.name },
  })

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onSelect}
      aria-label={`Select document: ${doc.name}`}
      style={style}
      className={`w-[calc(100%-16px)] mx-2 mb-1 flex items-start gap-3 px-3 py-3 min-h-[56px] text-left rounded-lg transition-all duration-200 ${
        isDragging ? 'opacity-50 z-50 shadow-xl' : ''
      } ${
        isSelected
          ? 'bg-[var(--brand-blue)] text-[var(--text-primary)] shadow-lg shadow-[var(--brand-blue)]/20'
          : 'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50'
      }`}
    >
      <div className="shrink-0 relative">
        <div className={`p-2 rounded-lg ${
          isSelected ? 'bg-[var(--bg-elevated)]' : 'bg-[var(--brand-blue)]/10'
        }`}>
          <FileText className={`w-5 h-5 ${
            isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--brand-blue)]'
          }`} />
        </div>
        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-secondary)] ${getStatusDot(doc.status)}`} />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-sm font-medium leading-snug line-clamp-2">{doc.name}</p>
        <p className={`text-xs mt-1 ${isSelected ? 'text-[var(--text-primary)]/70' : 'text-[var(--text-tertiary)]'}`}>
          {formatDate(doc.updatedAt)} &bull; {formatSize(doc.size)}
        </p>
        {(() => {
          const label = getStatusLabel(doc.status)
          return label ? (
            <p className={`text-[10px] mt-0.5 font-medium ${label.className}`}>{label.text}</p>
          ) : null
        })()}
      </div>
    </button>
  )
}

// ─── Droppable Folder Row ──────────────────────────────────────────
function DroppableFolder({
  folder,
  isSelected,
  onSelect,
  onContextMenu,
  onDoubleClick,
}: {
  folder: FolderNode
  isSelected: boolean
  onSelect: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onDoubleClick: () => void
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `folder-${folder.id}`,
    data: { type: 'folder', folderId: folder.id, folderName: folder.name },
  })

  return (
    <button
      ref={setNodeRef}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onDoubleClick()
      }}
      aria-label={`Open folder: ${folder.name}`}
      className={`w-[calc(100%-16px)] mx-2 mb-1 flex items-center gap-3 px-3 py-3 min-h-[56px] text-left rounded-lg transition-all duration-200 ${
        isOver ? 'ring-2 ring-[var(--brand-blue)] bg-[var(--brand-blue)]/10' : ''
      } ${
        isSelected
          ? 'bg-[var(--brand-blue)] text-[var(--text-primary)] shadow-lg shadow-[var(--brand-blue)]/20'
          : 'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50'
      }`}
    >
      <div className={`shrink-0 p-2 rounded-lg ${
        isSelected ? 'bg-[var(--bg-elevated)]' : 'bg-[var(--warning)]/10'
      }`}>
        <Folder className={`w-5 h-5 ${
          isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--warning)]'
        }`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{folder.name}</p>
        <p className={`text-xs mt-0.5 ${isSelected ? 'text-[var(--text-primary)]/70' : 'text-[var(--text-tertiary)]'}`}>
          {folder.documents?.length || 0} items
        </p>
      </div>
      <ChevronRight className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[var(--text-primary)]/70' : 'text-[var(--text-tertiary)]'}`} />
    </button>
  )
}

// ─── Root Drop Zone ────────────────────────────────────────────────
function RootDropZone() {
  const { isOver, setNodeRef } = useDroppable({
    id: 'folder-root',
    data: { type: 'folder', folderId: null, folderName: 'Root' },
  })

  if (!isOver) return null

  return (
    <div
      ref={setNodeRef}
      className="mx-2 mb-1 px-3 py-2 rounded-lg border-2 border-dashed border-[var(--brand-blue)]/40 bg-[var(--brand-blue)]/5 text-center"
    >
      <p className="text-xs text-[var(--brand-blue)]">Drop here to move to root</p>
    </div>
  )
}

// ─── Main Column ───────────────────────────────────────────────────
export function BrowserColumn({
  title,
  parentId,
  folders,
  documents,
  selectedId,
  onSelectFolder,
  onSelectDocument,
}: BrowserColumnProps) {
  const createFolder = useVaultStore((s) => s.createFolder)
  const renameFolder = useVaultStore((s) => s.renameFolder)
  const deleteFolder = useVaultStore((s) => s.deleteFolder)

  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; folderId: string; folderName: string
  } | null>(null)

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)
  const createInputRef = useRef<HTMLInputElement>(null)

  // ── Context menu handlers ──
  const handleContextMenu = useCallback((e: React.MouseEvent, folder: FolderNode) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, folderId: folder.id, folderName: folder.name })
  }, [])

  const handleStartRename = useCallback((folderId: string, currentName: string) => {
    setRenamingId(folderId)
    setRenameValue(currentName)
    setContextMenu(null)
    setTimeout(() => renameInputRef.current?.select(), 50)
  }, [])

  const handleCommitRename = useCallback(async () => {
    if (!renamingId || !renameValue.trim()) {
      setRenamingId(null)
      return
    }
    try {
      await renameFolder(renamingId, renameValue.trim())
    } catch { /* toast already shown */ }
    setRenamingId(null)
  }, [renamingId, renameValue, renameFolder])

  const handleDelete = useCallback(async (folderId: string, folderName: string) => {
    const confirmed = window.confirm(
      `Delete folder "${folderName}"? Files inside will be moved to root.`
    )
    if (!confirmed) return
    try {
      await deleteFolder(folderId)
    } catch { /* toast already shown */ }
  }, [deleteFolder])

  const handleNewSubfolder = useCallback(async (parentFolderId: string) => {
    const name = window.prompt('Subfolder name:')
    if (!name?.trim()) return
    try {
      await createFolder(name.trim(), parentFolderId)
    } catch { /* toast already shown */ }
  }, [createFolder])

  // ── New folder creation ──
  const handleStartCreate = useCallback(() => {
    setIsCreating(true)
    setNewFolderName('New Folder')
    setTimeout(() => createInputRef.current?.select(), 50)
  }, [])

  const handleCommitCreate = useCallback(async () => {
    if (!newFolderName.trim()) {
      setIsCreating(false)
      return
    }
    try {
      await createFolder(newFolderName.trim(), parentId)
    } catch { /* toast already shown */ }
    setIsCreating(false)
    setNewFolderName('')
  }, [newFolderName, parentId, createFolder])

  // Root column is a drop zone itself
  const { isOver: isRootOver, setNodeRef: setRootRef } = useDroppable({
    id: parentId ? `folder-${parentId}` : 'folder-root',
    data: { type: 'folder', folderId: parentId ?? null, folderName: title },
  })

  return (
    <div
      ref={setRootRef}
      className={`flex flex-col h-full min-w-[220px] max-w-[260px] border-r border-[var(--border-default)] last:border-r-0 ${
        isRootOver ? 'bg-[var(--brand-blue)]/5' : ''
      }`}
    >
      {/* Column Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
        <span className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          {title}
        </span>
        <button
          onClick={handleStartCreate}
          className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--brand-blue)] hover:bg-[var(--bg-tertiary)] transition-colors"
          title="New Folder"
          aria-label="Create new folder"
        >
          <FolderPlus className="w-4 h-4" />
        </button>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* New folder inline create */}
        {isCreating && (
          <div className="mx-2 mb-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-elevated)]/50 border border-[var(--brand-blue)]/30">
            <Folder className="w-4 h-4 text-[var(--warning)] shrink-0" />
            <input
              ref={createInputRef}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onBlur={handleCommitCreate}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCommitCreate()
                if (e.key === 'Escape') { setIsCreating(false); setNewFolderName('') }
              }}
              className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none"
              autoFocus
            />
          </div>
        )}

        {/* Folders */}
        {folders.map((folder) =>
          renamingId === folder.id ? (
            <div
              key={folder.id}
              className="mx-2 mb-1 flex items-center gap-2 px-3 py-3 rounded-lg bg-[var(--bg-elevated)]/50 border border-[var(--brand-blue)]/30"
            >
              <Folder className="w-5 h-5 text-[var(--warning)] shrink-0" />
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleCommitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCommitRename()
                  if (e.key === 'Escape') setRenamingId(null)
                }}
                className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none"
                autoFocus
              />
            </div>
          ) : (
            <DroppableFolder
              key={folder.id}
              folder={folder}
              isSelected={selectedId === folder.id}
              onSelect={() => onSelectFolder(folder.id)}
              onContextMenu={(e) => handleContextMenu(e, folder)}
              onDoubleClick={() => handleStartRename(folder.id, folder.name)}
            />
          )
        )}

        {/* Documents (draggable) */}
        {documents.map((doc) => (
          <DraggableDocument
            key={doc.id}
            doc={doc}
            isSelected={selectedId === doc.id}
            onSelect={() => onSelectDocument(doc.id)}
          />
        ))}

        {/* Root drop indicator */}
        {!parentId && <RootDropZone />}

        {/* Empty State */}
        {folders.length === 0 && documents.length === 0 && !isCreating && (
          <div className="px-4 py-8 text-center">
            <FileText className="w-10 h-10 mx-auto mb-2 text-[var(--text-tertiary)] opacity-40" />
            <p className="text-sm text-[var(--text-tertiary)]">No files yet</p>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <FolderContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          folderId={contextMenu.folderId}
          folderName={contextMenu.folderName}
          onRename={() => handleStartRename(contextMenu.folderId, contextMenu.folderName)}
          onDelete={() => handleDelete(contextMenu.folderId, contextMenu.folderName)}
          onNewSubfolder={() => handleNewSubfolder(contextMenu.folderId)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
