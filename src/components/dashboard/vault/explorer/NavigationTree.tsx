'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Home,
  Star,
  Clock,
  AlertTriangle,
  Cloud,
} from 'lucide-react'
import type { FolderNode } from '@/types/ragbox'

// ============================================================================
// TREE NODE
// ============================================================================

interface TreeNodeProps {
  name: string
  depth: number
  isExpanded: boolean
  isSelected: boolean
  hasChildren: boolean
  onToggle: () => void
  onSelect: () => void
}

function TreeNode({ name, depth, isExpanded, isSelected, hasChildren, onToggle, onSelect }: TreeNodeProps) {
  return (
    <div
      className={`flex items-center gap-1 px-2 py-1.5 cursor-pointer rounded-md transition-all ${
        isSelected
          ? 'bg-[var(--brand-blue)]/20 border-l-2 border-[var(--brand-blue)]'
          : 'hover:bg-[var(--bg-elevated)]/50'
      }`}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={onSelect}
    >
      {hasChildren ? (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle() }}
          className="p-0.5 hover:bg-[var(--bg-elevated)] rounded"
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          )}
        </button>
      ) : (
        <div className="w-4" />
      )}
      {isExpanded ? (
        <FolderOpen className="w-4 h-4 text-[var(--warning)] shrink-0" />
      ) : (
        <Folder className="w-4 h-4 text-[var(--warning)] shrink-0" />
      )}
      <span className={`text-sm truncate ${isSelected ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]'}`}>
        {name}
      </span>
    </div>
  )
}

// ============================================================================
// COLLAPSIBLE SECTION
// ============================================================================

function TreeSection({
  label,
  expanded,
  onToggle,
  children,
}: {
  label: string
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
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
            transition={{ duration: 0.2 }}
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
// QUICK ACCESS & DRIVES DATA
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
}

export function NavigationTree({ folders, selectedFolderId, activeFilter, starredCount, recentCount, onSelectFolder, onQuickAccessFilter }: NavigationTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  )

  const toggleExpand = (id: string) => {
    const next = new Set(expandedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpandedIds(next)
  }

  const toggleSection = (id: string) => {
    const next = new Set(expandedSections)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpandedSections(next)
  }

  const rootFolders = Object.values(folders).filter((f) => !f.parentId)

  const renderFolder = (folder: FolderNode, depth: number): React.ReactNode => {
    const childFolders = folder.children
      .map((id) => folders[id])
      .filter(Boolean)

    return (
      <div key={folder.id}>
        <TreeNode
          name={folder.name}
          depth={depth}
          isExpanded={expandedIds.has(folder.id)}
          isSelected={selectedFolderId === folder.id}
          hasChildren={childFolders.length > 0}
          onToggle={() => toggleExpand(folder.id)}
          onSelect={() => onSelectFolder(folder.id)}
        />
        {expandedIds.has(folder.id) && childFolders.map((child) => renderFolder(child, depth + 1))}
      </div>
    )
  }

  return (
    <nav className="w-60 shrink-0 bg-[var(--bg-secondary)] border-r border-[var(--border-default)] overflow-y-auto py-3 flex flex-col h-full">
      {/* Quick Access */}
      <TreeSection
        label="Quick Access"
        expanded={expandedSections.has('quick-access')}
        onToggle={() => toggleSection('quick-access')}
      >
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
      <TreeSection
        label="Drives"
        expanded={expandedSections.has('drives')}
        onToggle={() => toggleSection('drives')}
      >
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
      <TreeSection
        label="Folders"
        expanded={expandedSections.has('folders')}
        onToggle={() => toggleSection('folders')}
      >
        {/* All Files root */}
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
          {rootFolders.map((folder) => renderFolder(folder, 0))}
        </div>
      </TreeSection>
    </nav>
  )
}
