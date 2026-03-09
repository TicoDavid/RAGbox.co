'use client'

import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight,
  Folder,
  FolderOpen,
  Home,
  Star,
  Clock,
  AlertTriangle,
  Cloud,
} from 'lucide-react'
import type { FolderNode } from '@/types/ragbox'
import { FolderContextMenu } from '../FolderContextMenu'

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
// TREE NODE
// ============================================================================

interface TreeNodeProps {
  folder: FolderNode
  depth: number
  isExpanded: boolean
  isSelected: boolean
  hasChildren: boolean
  isLast: boolean
  isDragOver: boolean
  onToggle: () => void
  onSelect: () => void
  onRename: () => void
  onDelete: () => void
  onNewSubfolder: () => void
  onSetColor: (color: string | null) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
}

function TreeNode({
  folder, depth, isExpanded, isSelected, hasChildren, isDragOver,
  onToggle, onSelect, onRename, onDelete, onNewSubfolder, onSetColor,
  onDragOver, onDrop, onDragLeave,
}: TreeNodeProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const colorClass = folder.color ? FOLDER_COLORS[folder.color] : 'text-[var(--warning)]'
  const docCount = folder.documentCount ?? folder.documents.length

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  return (
    <>
      <div
        className={`relative flex items-center gap-1 px-2 py-1.5 cursor-pointer rounded-md transition-all duration-150 ${
          isSelected
            ? 'bg-[var(--brand-blue)]/10 text-[var(--brand-blue)] border-l-2 border-[var(--brand-blue)]'
            : 'hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
        }${isDragOver ? ' bg-[var(--brand-blue)]/20 border border-dashed border-[var(--brand-blue)] scale-[1.02]' : ''}`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={onSelect}
        onContextMenu={handleContextMenu}
        onDoubleClick={() => setIsRenaming(true)}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragLeave={onDragLeave}
      >
        {/* Tree connector lines */}
        {depth > 0 && (
          <div
            className="absolute top-0 bottom-0 border-l border-[var(--border-default)]"
            style={{ left: `${(depth - 1) * 20 + 16}px` }}
          />
        )}

        {/* Chevron */}
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggle() }}
            className="p-0.5 hover:bg-[var(--bg-elevated)] rounded shrink-0"
          >
            <motion.span
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ duration: 0.15 }}
              className="block"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </motion.span>
          </button>
        ) : (
          <div className="w-4 shrink-0" />
        )}

        {/* Folder icon */}
        {isExpanded ? (
          <FolderOpen className={`w-4 h-4 shrink-0 ${colorClass}`} />
        ) : (
          <Folder className={`w-4 h-4 shrink-0 ${colorClass}`} />
        )}

        {/* Name or rename input */}
        {isRenaming ? (
          <input
            autoFocus
            defaultValue={folder.name}
            onBlur={(e) => {
              const val = e.target.value.trim()
              if (val && val !== folder.name) onRename()
              setIsRenaming(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') setIsRenaming(false)
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-transparent border-b border-[var(--brand-blue)] outline-none text-sm min-w-0"
          />
        ) : (
          <span className={`text-sm truncate flex-1 ${isSelected ? 'font-medium' : ''}`}>
            {folder.name}
          </span>
        )}

        {/* Doc count badge */}
        {docCount > 0 && (
          <span className="text-[10px] text-[var(--text-tertiary)] ml-auto shrink-0">
            {docCount}
          </span>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <FolderContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          folderId={folder.id}
          folderName={folder.name}
          documentCount={docCount}
          folderColor={folder.color}
          onRename={() => setIsRenaming(true)}
          onDelete={onDelete}
          onNewSubfolder={onNewSubfolder}
          onSetColor={onSetColor}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  )
}

// ============================================================================
// COLLAPSIBLE SECTION
// ============================================================================

function TreeSection({
  label, expanded, onToggle, children,
}: {
  label: string; expanded: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className="mb-2">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider hover:text-[var(--text-primary)] transition-colors"
      >
        <motion.span animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight className="w-3.5 h-3.5" />
        </motion.span>
        {label}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="pl-2 overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================================================
// QUICK ACCESS & DRIVES
// ============================================================================

function getQuickAccess(starredCount: number, recentCount: number) {
  return [
    { id: 'starred', label: 'Starred', Icon: Star, count: starredCount },
    { id: 'recent', label: 'Recent', Icon: Clock, count: recentCount },
    { id: 'whistleblower', label: 'Whistleblower Evidence', Icon: AlertTriangle, count: 0 },
  ]
}

const DRIVES = [
  { id: 'local', label: 'Local Vault', connected: true },
  { id: 'sharepoint', label: 'SharePoint', connected: false },
  { id: 'onedrive', label: 'OneDrive', connected: false },
]

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface NavigationTreeProps {
  folders: Record<string, FolderNode>
  selectedFolderId: string | null
  activeFilter: string | null
  starredCount: number
  recentCount: number
  onSelectFolder: (id: string | null) => void
  onQuickAccessFilter: (filterId: string | null) => void
  onRenameFolder?: (id: string) => void
  onDeleteFolder?: (id: string) => void
  onNewSubfolder?: (parentId: string) => void
  onSetFolderColor?: (id: string, color: string | null) => void
  onDropOnFolder?: (folderId: string, docId: string) => void
}

export function NavigationTree({
  folders, selectedFolderId, activeFilter, starredCount, recentCount,
  onSelectFolder, onQuickAccessFilter,
  onRenameFolder, onDeleteFolder, onNewSubfolder, onSetFolderColor, onDropOnFolder,
}: NavigationTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSection = useCallback((id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const rootFolders = Object.values(folders).filter((f) => !f.parentId)

  const handleDragOver = useCallback((e: React.DragEvent, folderId: string) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setDragOverId(folderId)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, folderId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const docId = e.dataTransfer.getData('text/plain')
    if (docId && onDropOnFolder) onDropOnFolder(folderId, docId)
    setDragOverId(null)
  }, [onDropOnFolder])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOverId(null)
  }, [])

  const renderFolder = (folder: FolderNode, depth: number, isLast: boolean): React.ReactNode => {
    const childFolders = folder.children.map((id) => folders[id]).filter(Boolean)
    const isExpanded = expandedIds.has(folder.id)

    return (
      <div key={folder.id}>
        <TreeNode
          folder={folder}
          depth={depth}
          isExpanded={isExpanded}
          isSelected={selectedFolderId === folder.id}
          hasChildren={childFolders.length > 0}
          isLast={isLast}
          isDragOver={dragOverId === folder.id}
          onToggle={() => toggleExpand(folder.id)}
          onSelect={() => onSelectFolder(folder.id)}
          onRename={() => onRenameFolder?.(folder.id)}
          onDelete={() => onDeleteFolder?.(folder.id)}
          onNewSubfolder={() => onNewSubfolder?.(folder.id)}
          onSetColor={(color) => onSetFolderColor?.(folder.id, color)}
          onDragOver={(e) => handleDragOver(e, folder.id)}
          onDrop={(e) => handleDrop(e, folder.id)}
          onDragLeave={handleDragLeave}
        />
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              {childFolders.map((child, i) => renderFolder(child, depth + 1, i === childFolders.length - 1))}
              {folder.documentCount === 0 && childFolders.length === 0 && (
                <span
                  className="block text-xs text-[var(--text-tertiary)] italic"
                  style={{ paddingLeft: `${(depth + 1) * 20 + 28}px` }}
                >
                  Empty folder
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <nav className="w-60 shrink-0 bg-[var(--bg-secondary)] border-r border-[var(--border-default)] overflow-y-auto py-3 flex flex-col h-full">
      {/* Quick Access */}
      <TreeSection label="Quick Access" expanded={expandedSections.has('quick-access')} onToggle={() => toggleSection('quick-access')}>
        {getQuickAccess(starredCount, recentCount).map(({ id, label, Icon, count }) => (
          <button
            key={id}
            onClick={() => onQuickAccessFilter(activeFilter === id ? null : id)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all ${
              activeFilter === id
                ? 'bg-[var(--brand-blue)]/20 text-[var(--text-primary)] font-medium'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50 hover:text-[var(--text-primary)]'
            }`}
          >
            <Icon className={`w-4 h-4 ${id === 'starred' && activeFilter === 'starred' ? 'text-[var(--warning)] fill-[var(--warning)]' : ''}`} />
            <span className="flex-1 text-left">{label}</span>
            <span className="text-xs text-[var(--text-tertiary)]">{count}</span>
          </button>
        ))}
      </TreeSection>

      {/* Drives */}
      <TreeSection label="Drives" expanded={expandedSections.has('drives')} onToggle={() => toggleSection('drives')}>
        {DRIVES.map((drive) => (
          <button
            key={drive.id}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50 hover:text-[var(--text-primary)] rounded-lg transition-all"
          >
            <Cloud className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">{drive.label}</span>
            {drive.connected ? (
              <span className="w-2 h-2 rounded-full bg-[var(--success)]" />
            ) : (
              <span className="text-[10px] text-[var(--text-tertiary)]">Connect</span>
            )}
          </button>
        ))}
      </TreeSection>

      {/* Folders */}
      <TreeSection label="Folders" expanded={expandedSections.has('folders')} onToggle={() => toggleSection('folders')}>
        <div
          className={`flex items-center gap-2 px-3 py-2 cursor-pointer rounded-lg mx-1 transition-all ${
            selectedFolderId === null
              ? 'bg-[var(--brand-blue)]/20 text-[var(--text-primary)] font-medium'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50'
          }`}
          onClick={() => onSelectFolder(null)}
        >
          <Home className="w-4 h-4 text-[var(--text-secondary)]" />
          <span className="text-sm">All Files</span>
        </div>
        <div className="mt-1 px-1">
          {rootFolders.map((folder, i) => renderFolder(folder, 0, i === rootFolders.length - 1))}
        </div>
      </TreeSection>
    </nav>
  )
}
