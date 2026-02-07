'use client'

import React, { useState, useMemo } from 'react'
import { useVaultStore } from '@/stores/vaultStore'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileText,
  Folder,
  FolderOpen,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  MessageSquare,
  Search,
  Plus,
  ArrowUpDown,
  Check,
  Download,
  History,
  Eye,
  Lock,
  X,
  Home,
} from 'lucide-react'
import IngestionModal from '@/app/dashboard/components/IngestionModal'

// ============================================================================
// UTILITIES
// ============================================================================

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getFileType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const types: Record<string, string> = {
    pdf: 'PDF Document',
    doc: 'Word Document',
    docx: 'Word Document',
    xls: 'Excel Spreadsheet',
    xlsx: 'Excel Spreadsheet',
    txt: 'Text File',
    md: 'Markdown',
    csv: 'CSV Data',
    json: 'JSON File',
  }
  return types[ext] || 'Document'
}

// Generate a fake SHA-256 hash for demo
function generateHash(id: string): string {
  const chars = '0123456789abcdef'
  let hash = ''
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * 16)]
  }
  return hash
}

// ============================================================================
// SECURITY BADGE COMPONENT
// ============================================================================

function SecurityBadge({ tier, size = 'normal' }: { tier: number; size?: 'normal' | 'large' }) {
  const configs = {
    1: { icon: Shield, label: 'Open', color: 'text-emerald-400', bg: 'bg-emerald-900/30', border: 'border-emerald-500/30' },
    2: { icon: Lock, label: 'Protected', color: 'text-blue-400', bg: 'bg-blue-900/30', border: 'border-blue-500/30' },
    3: { icon: ShieldCheck, label: 'Privileged', color: 'text-amber-400', bg: 'bg-amber-900/30', border: 'border-amber-500/30' },
    4: { icon: ShieldAlert, label: 'Restricted', color: 'text-red-400', bg: 'bg-red-900/30', border: 'border-red-500/30' },
  }
  const config = configs[tier as keyof typeof configs] || configs[1]
  const Icon = config.icon

  if (size === 'large') {
    return (
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg ${config.bg} border ${config.border}`}>
        <Icon className={`w-5 h-5 ${config.color}`} />
        <span className={`text-sm font-semibold ${config.color}`}>{config.label}</span>
      </div>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${config.color} ${config.bg}`}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  )
}

// ============================================================================
// NAVIGATION TREE (LEFT PANEL)
// ============================================================================

interface TreeNodeProps {
  folderId: string
  name: string
  depth: number
  isExpanded: boolean
  isSelected: boolean
  hasChildren: boolean
  onToggle: () => void
  onSelect: () => void
}

function TreeNode({ folderId, name, depth, isExpanded, isSelected, hasChildren, onToggle, onSelect }: TreeNodeProps) {
  return (
    <div
      className={`flex items-center gap-1 px-2 py-1.5 cursor-pointer rounded-md transition-all ${
        isSelected
          ? 'bg-[var(--brand-blue)]/20 border-l-2 border-[var(--brand-blue)]'
          : 'hover:bg-white/5'
      }`}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={onSelect}
    >
      {hasChildren ? (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle() }}
          className="p-0.5 hover:bg-white/10 rounded"
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          )}
        </button>
      ) : (
        <div className="w-4" />
      )}
      {isExpanded ? (
        <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
      ) : (
        <Folder className="w-4 h-4 text-amber-400 shrink-0" />
      )}
      <span className={`text-sm truncate ${isSelected ? 'text-white font-medium' : 'text-slate-300'}`}>
        {name}
      </span>
    </div>
  )
}

function NavigationTree({
  folders,
  selectedFolderId,
  onSelectFolder,
}: {
  folders: Record<string, { id: string; name: string; parentId?: string; children: string[] }>
  selectedFolderId: string | null
  onSelectFolder: (id: string | null) => void
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setExpandedIds(newSet)
  }

  // Get root folders (no parent)
  const rootFolders = Object.values(folders).filter((f) => !f.parentId)

  const renderFolder = (folder: typeof rootFolders[0], depth: number): React.ReactNode => {
    const childFolders = folder.children
      .map((id) => folders[id])
      .filter(Boolean)

    return (
      <div key={folder.id}>
        <TreeNode
          folderId={folder.id}
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
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Folders</h3>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {/* Root / All Files */}
        <div
          className={`flex items-center gap-2 px-4 py-2 cursor-pointer rounded-md mx-2 transition-all ${
            selectedFolderId === null
              ? 'bg-[var(--brand-blue)]/20 border-l-2 border-[var(--brand-blue)]'
              : 'hover:bg-white/5'
          }`}
          onClick={() => onSelectFolder(null)}
        >
          <Home className="w-4 h-4 text-slate-400" />
          <span className={`text-sm ${selectedFolderId === null ? 'text-white font-medium' : 'text-slate-300'}`}>
            All Files
          </span>
        </div>

        {/* Folder Tree */}
        <div className="mt-2 px-2">
          {rootFolders.map((folder) => renderFolder(folder, 0))}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// BREADCRUMB ADDRESS BAR
// ============================================================================

function Breadcrumbs({
  path,
  folders,
  onNavigate,
}: {
  path: string[]
  folders: Record<string, { id: string; name: string }>
  onNavigate: (folderId: string | null) => void
}) {
  return (
    <div className="flex items-center gap-1 text-sm">
      <button
        onClick={() => onNavigate(null)}
        className="px-2 py-1 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors"
      >
        Vault
      </button>
      {path.map((folderId, index) => {
        const folder = folders[folderId]
        if (!folder) return null
        return (
          <React.Fragment key={folderId}>
            <ChevronRight className="w-4 h-4 text-slate-600" />
            <button
              onClick={() => onNavigate(folderId)}
              className={`px-2 py-1 rounded transition-colors ${
                index === path.length - 1
                  ? 'text-white font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {folder.name}
            </button>
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ============================================================================
// SOVEREIGN INSPECTOR (RIGHT PANEL)
// ============================================================================

function SovereignInspector({
  item,
  onClose,
  onChat,
  onDelete,
}: {
  item: {
    id: string
    name: string
    type: 'folder' | 'document'
    updatedAt: Date
    size: number
    tier: number
  } | null
  onClose: () => void
  onChat: (id: string) => void
  onDelete: (id: string) => void
}) {
  if (!item || item.type === 'folder') {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center p-6">
        <Eye className="w-12 h-12 text-slate-700 mb-4" />
        <p className="text-sm text-slate-500">Select a document to inspect</p>
      </div>
    )
  }

  const hash = useMemo(() => generateHash(item.id), [item.id])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Inspector</h3>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded">
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* File Thumbnail */}
        <div className="flex flex-col items-center py-6 bg-slate-900/50 rounded-xl border border-white/5">
          <div className="w-20 h-20 rounded-xl bg-[var(--brand-blue)]/20 flex items-center justify-center mb-3">
            <FileText className="w-10 h-10 text-[var(--brand-blue)]" />
          </div>
          <p className="text-sm font-medium text-white text-center px-4 truncate max-w-full">
            {item.name}
          </p>
          <p className="text-xs text-slate-500 mt-1">{getFileType(item.name)}</p>
        </div>

        {/* Metadata */}
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-white/5">
            <span className="text-xs text-slate-500">Size</span>
            <span className="text-sm text-slate-300">{formatSize(item.size)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-white/5">
            <span className="text-xs text-slate-500">Modified</span>
            <span className="text-sm text-slate-300">{formatDate(item.updatedAt)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-white/5">
            <span className="text-xs text-slate-500">Type</span>
            <span className="text-sm text-slate-300">{getFileType(item.name)}</span>
          </div>
        </div>

        {/* Validity Hash */}
        <div className="p-3 bg-emerald-900/20 border border-emerald-500/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Integrity Verified</span>
          </div>
          <p className="text-[10px] font-mono text-slate-400 break-all">
            SHA-256: {hash.slice(0, 8)}...{hash.slice(-8)}
          </p>
        </div>

        {/* Security Level */}
        <div>
          <p className="text-xs text-slate-500 mb-2">Security Level</p>
          <SecurityBadge tier={item.tier} size="large" />
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0 p-4 border-t border-white/5 space-y-2">
        <button
          onClick={() => onChat(item.id)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white rounded-lg font-medium text-sm transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          Analyze in Mercury
        </button>
        <div className="flex gap-2">
          <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors">
            <Download className="w-4 h-4" />
            Download
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors">
            <History className="w-4 h-4" />
            Audit Log
          </button>
        </div>
        <button
          onClick={() => onDelete(item.id)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-lg text-sm transition-colors border border-red-500/20"
        >
          <Trash2 className="w-4 h-4" />
          Delete Document
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// MAIN VAULT EXPLORER COMPONENT
// ============================================================================

export function VaultExplorer() {
  const documents = useVaultStore((s) => s.documents)
  const folders = useVaultStore((s) => s.folders)
  const exitExplorerMode = useVaultStore((s) => s.exitExplorerMode)
  const selectAndChat = useVaultStore((s) => s.selectAndChat)
  const uploadDocument = useVaultStore((s) => s.uploadDocument)
  const deleteDocument = useVaultStore((s) => s.deleteDocument)
  const currentPath = useVaultStore((s) => s.currentPath)
  const navigate = useVaultStore((s) => s.navigate)

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [sortField, setSortField] = useState<'name' | 'updatedAt' | 'size'>('updatedAt')
  const [sortAsc, setSortAsc] = useState(false)
  const [isIngestionOpen, setIsIngestionOpen] = useState(false)
  const [showInspector, setShowInspector] = useState(true)

  // Build path from selected folder
  const buildPath = (folderId: string | null): string[] => {
    if (!folderId) return []
    const path: string[] = []
    let currentId: string | null = folderId
    while (currentId) {
      path.unshift(currentId)
      currentId = folders[currentId]?.parentId || null
    }
    return path
  }

  const handleSelectFolder = (folderId: string | null) => {
    setSelectedFolderId(folderId)
    setSelectedId(null)
    navigate(buildPath(folderId))
  }

  // Get items for current folder
  type ExplorerItem = {
    id: string
    name: string
    type: 'folder' | 'document'
    updatedAt: Date
    size: number
    tier: number
  }

  const currentFolderItems: ExplorerItem[] = useMemo(() => {
    const items: ExplorerItem[] = []

    // Add subfolders
    Object.values(folders).forEach((f) => {
      if ((selectedFolderId === null && !f.parentId) || f.parentId === selectedFolderId) {
        items.push({
          id: f.id,
          name: f.name,
          type: 'folder',
          updatedAt: new Date(),
          size: 0,
          tier: 1,
        })
      }
    })

    // Add documents in current folder
    Object.values(documents).forEach((d) => {
      const inCurrentFolder = selectedFolderId === null
        ? !d.folderId
        : d.folderId === selectedFolderId
      if (inCurrentFolder) {
        items.push({
          id: d.id,
          name: d.name,
          type: 'document',
          updatedAt: new Date(d.updatedAt),
          size: d.size ?? 0,
          tier: d.securityTier ?? 1,
        })
      }
    })

    return items
  }, [documents, folders, selectedFolderId])

  // Filter by search
  const filtered = currentFolderItems.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Sort items
  const sorted = [...filtered].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    let cmp = 0
    if (sortField === 'name') cmp = a.name.localeCompare(b.name)
    else if (sortField === 'updatedAt') cmp = b.updatedAt.getTime() - a.updatedAt.getTime()
    else if (sortField === 'size') cmp = b.size - a.size
    return sortAsc ? -cmp : cmp
  })

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(!sortAsc)
    else { setSortField(field); setSortAsc(false) }
  }

  const selectedItem = sorted.find((i) => i.id === selectedId) || null

  const handleRowClick = (item: ExplorerItem) => {
    if (item.type === 'folder') {
      handleSelectFolder(item.id)
    } else {
      setSelectedId(item.id)
      setShowInspector(true)
    }
  }

  const handleIngestionUpload = async (files: File[]) => {
    for (const file of files) {
      await uploadDocument(file, selectedFolderId || undefined)
    }
    setIsIngestionOpen(false)
  }

  return (
    <div className="flex h-full bg-[var(--bg-secondary)]">
      {/* LEFT PANEL: Navigation Tree */}
      <div className="w-[250px] shrink-0 border-r border-white/5 bg-[var(--bg-tertiary)]">
        <NavigationTree
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={handleSelectFolder}
        />
      </div>

      {/* CENTER PANEL: File Grid */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[var(--bg-secondary)]">
          <div className="flex items-center gap-4">
            <button
              onClick={exitExplorerMode}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <Breadcrumbs
              path={buildPath(selectedFolderId)}
              folders={folders}
              onNavigate={handleSelectFolder}
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-48 h-9 pl-10 pr-4 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[var(--brand-blue)] transition-colors"
              />
            </div>
            <button
              onClick={() => setIsIngestionOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white rounded-lg font-medium text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Files
            </button>
          </div>
        </div>

        {/* File Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-[var(--bg-tertiary)] border-b border-white/5 z-10">
              <tr>
                <th className="text-left px-4 py-3 w-[45%]">
                  <button onClick={() => toggleSort('name')} className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-white">
                    Name <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 w-[20%]">
                  <button onClick={() => toggleSort('updatedAt')} className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-white">
                    Modified <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 w-[15%]">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</span>
                </th>
                <th className="text-left px-4 py-3 w-[10%]">
                  <button onClick={() => toggleSort('size')} className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-white">
                    Size <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 w-[10%]">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Security</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => handleRowClick(item)}
                  onDoubleClick={() => item.type === 'document' && selectAndChat(item.id)}
                  className={`border-b border-white/5 cursor-pointer transition-all ${
                    selectedId === item.id
                      ? 'bg-[var(--brand-blue)]/15 border-l-4 border-l-[var(--brand-blue)]'
                      : 'hover:bg-white/5'
                  }`}
                >
                  {/* Name */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {item.type === 'folder' ? (
                        <div className="p-2 rounded-lg bg-amber-500/10">
                          <Folder className="w-5 h-5 text-amber-400" />
                        </div>
                      ) : (
                        <div className="p-2 rounded-lg bg-[var(--brand-blue)]/10">
                          <FileText className="w-5 h-5 text-[var(--brand-blue)]" />
                        </div>
                      )}
                      <span className="text-sm font-medium text-white truncate">{item.name}</span>
                    </div>
                  </td>

                  {/* Modified */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-400">{formatDate(item.updatedAt)}</span>
                  </td>

                  {/* Type */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-400">
                      {item.type === 'folder' ? 'Folder' : getFileType(item.name)}
                    </span>
                  </td>

                  {/* Size */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-400">
                      {item.type === 'document' ? formatSize(item.size) : '—'}
                    </span>
                  </td>

                  {/* Security */}
                  <td className="px-4 py-3">
                    {item.type === 'document' && <SecurityBadge tier={item.tier} />}
                  </td>
                </tr>
              ))}

              {sorted.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <Folder className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                    <p className="text-base text-slate-400 mb-2">
                      {searchTerm ? 'No files match your search' : 'This folder is empty'}
                    </p>
                    <button
                      onClick={() => setIsIngestionOpen(true)}
                      className="mt-4 px-6 py-2.5 bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white rounded-lg font-medium text-sm transition-colors"
                    >
                      Add Files
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RIGHT PANEL: Sovereign Inspector */}
      {showInspector && (
        <div className="w-[300px] shrink-0 border-l border-white/5 bg-[var(--bg-tertiary)]">
          <SovereignInspector
            item={selectedItem}
            onClose={() => setShowInspector(false)}
            onChat={selectAndChat}
            onDelete={(id) => { deleteDocument(id); setSelectedId(null) }}
          />
        </div>
      )}

      {/* Ingestion Modal */}
      <IngestionModal
        isOpen={isIngestionOpen}
        onClose={() => setIsIngestionOpen(false)}
        onFileUpload={handleIngestionUpload}
      />
    </div>
  )
}
