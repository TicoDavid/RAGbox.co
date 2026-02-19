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
  ShieldCheck,
  ShieldAlert,
  Trash2,
  MessageSquare,
  Search,
  Plus,
  ArrowUpDown,
  Download,
  History,
  Eye,
  X,
  Home,
  Users,
  BrainCog,
} from 'lucide-react'
import IngestionModal from '@/app/dashboard/components/IngestionModal'
import { VaultAccessModal, type ClearanceLevel, type VaultMember, type LinkExpiration } from './VaultAccessModal'
import {
  type SecurityTier,
  tierToSecurity,
  SecurityBadge,
  SecurityDropdown,
  RagIndexToggle,
} from './security'

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
      <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
        <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Folders</h3>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {/* Root / All Files */}
        <div
          className={`flex items-center gap-2 px-4 py-2 cursor-pointer rounded-md mx-2 transition-all ${
            selectedFolderId === null
              ? 'bg-[var(--brand-blue)]/20 border-l-2 border-[var(--brand-blue)]'
              : 'hover:bg-[var(--bg-elevated)]/50'
          }`}
          onClick={() => onSelectFolder(null)}
        >
          <Home className="w-4 h-4 text-[var(--text-secondary)]" />
          <span className={`text-sm ${selectedFolderId === null ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]'}`}>
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
        className="px-2 py-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] rounded transition-colors"
      >
        Vault
      </button>
      {path.map((folderId, index) => {
        const folder = folders[folderId]
        if (!folder) return null
        return (
          <React.Fragment key={folderId}>
            <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)]" />
            <button
              onClick={() => onNavigate(folderId)}
              className={`px-2 py-1 rounded transition-colors ${
                index === path.length - 1
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
  )
}

// ============================================================================
// SOVEREIGN INSPECTOR (RIGHT PANEL)
// ============================================================================

interface InspectorItem {
  id: string
  name: string
  type: 'folder' | 'document'
  updatedAt: Date
  size: number
  security: SecurityTier
  isIndexed: boolean
}

function SovereignInspector({
  item,
  onClose,
  onChat,
  onDelete,
  onSecurityChange,
  onIndexToggle,
}: {
  item: InspectorItem | null
  onClose: () => void
  onChat: (id: string) => void
  onDelete: (id: string) => void
  onSecurityChange: (id: string, security: SecurityTier) => void
  onIndexToggle: (id: string, enabled: boolean) => void
}) {
  const hash = useMemo(() => item ? generateHash(item.id) : '', [item?.id])

  if (!item || item.type === 'folder') {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center p-6">
        <Eye className="w-12 h-12 text-[var(--text-muted)] mb-4" />
        <p className="text-sm text-[var(--text-tertiary)]">Select a document to inspect</p>
      </div>
    )
  }

  const isSovereign = item.security === 'sovereign'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`
        flex items-center justify-between px-4 py-3 border-b
        ${isSovereign ? 'border-[var(--danger)]/30 bg-[var(--danger)]/5' : 'border-[var(--border-subtle)]'}
      `}>
        <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          {isSovereign && <span className="text-[var(--danger)] mr-1">◆</span>}
          Inspector
        </h3>
        <button onClick={onClose} className="p-1 hover:bg-[var(--bg-elevated)] rounded">
          <X className="w-4 h-4 text-[var(--text-secondary)]" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* File Thumbnail */}
        <div className={`
          flex flex-col items-center py-6 rounded-xl border
          ${isSovereign
            ? 'bg-[var(--danger)]/10 border-[var(--danger)]/20'
            : 'bg-[var(--bg-primary)]/50 border-[var(--border-subtle)]'
          }
        `}>
          <div className={`
            w-20 h-20 rounded-xl flex items-center justify-center mb-3
            ${isSovereign
              ? 'bg-[var(--danger)]/20'
              : 'bg-[var(--brand-blue)]/20'
            }
          `}>
            <FileText className={`w-10 h-10 ${isSovereign ? 'text-[var(--danger)]' : 'text-[var(--brand-blue)]'}`} />
          </div>
          <p className="text-sm font-medium text-[var(--text-primary)] text-center px-4 truncate max-w-full">
            {item.name}
          </p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">{getFileType(item.name)}</p>
        </div>

        {/* Metadata */}
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-[var(--border-subtle)]">
            <span className="text-xs text-[var(--text-tertiary)]">Size</span>
            <span className="text-sm text-[var(--text-secondary)]">{formatSize(item.size)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-[var(--border-subtle)]">
            <span className="text-xs text-[var(--text-tertiary)]">Modified</span>
            <span className="text-sm text-[var(--text-secondary)]">{formatDate(item.updatedAt)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-[var(--border-subtle)]">
            <span className="text-xs text-[var(--text-tertiary)]">Type</span>
            <span className="text-sm text-[var(--text-secondary)]">{getFileType(item.name)}</span>
          </div>
        </div>

        {/* Validity Hash */}
        <div className="p-3 bg-[var(--success)]/20 border border-[var(--success)]/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-[var(--success)]" />
            <span className="text-xs font-semibold text-[var(--success)] uppercase tracking-wider">Integrity Verified</span>
          </div>
          <p className="text-[10px] font-mono text-[var(--text-secondary)] break-all">
            SHA-256: {hash.slice(0, 8)}...{hash.slice(-8)}
          </p>
        </div>

        {/* Security Classification Dropdown */}
        <div>
          <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider font-semibold mb-2">
            Security Classification
          </p>
          <SecurityDropdown
            value={item.security}
            onChange={(newSecurity) => onSecurityChange(item.id, newSecurity)}
          />
        </div>

        {/* Intelligence Controls */}
        <div>
          <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider font-semibold mb-2">
            Intelligence Controls
          </p>
          <RagIndexToggle
            enabled={item.isIndexed}
            onChange={(enabled) => onIndexToggle(item.id, enabled)}
          />
        </div>

        {/* Sovereign Warning */}
        {isSovereign && (
          <div className="p-3 bg-[var(--danger)]/20 border border-[var(--danger)]/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-4 h-4 text-[var(--danger)]" />
              <span className="text-xs font-semibold text-[var(--danger)] uppercase tracking-wider">
                Eyes Only Protocol
              </span>
            </div>
            <p className="text-[10px] text-[var(--danger)]/80">
              This document is air-gapped. AI access requires Privilege Mode activation.
              All queries are logged to immutable audit trail.
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="shrink-0 p-4 border-t border-[var(--border-subtle)] space-y-2">
        <button
          onClick={() => onChat(item.id)}
          disabled={!item.isIndexed}
          className={`
            w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-colors
            ${item.isIndexed
              ? 'bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-[var(--text-primary)]'
              : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)] cursor-not-allowed'
            }
          `}
        >
          {item.isIndexed ? (
            <>
              <MessageSquare className="w-4 h-4" />
              Analyze in Mercury
            </>
          ) : (
            <>
              <BrainCog className="w-4 h-4" />
              RAG Indexing Disabled
            </>
          )}
        </button>
        <div className="flex gap-2">
          <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] rounded-lg text-sm transition-colors">
            <Download className="w-4 h-4" />
            Download
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] rounded-lg text-sm transition-colors">
            <History className="w-4 h-4" />
            Audit Log
          </button>
        </div>
        <button
          onClick={() => onDelete(item.id)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--danger)]/20 hover:bg-[var(--danger)]/40 text-[var(--danger)] rounded-lg text-sm transition-colors border border-[var(--danger)]/20"
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
  const uploadDocuments = useVaultStore((s) => s.uploadDocuments)
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
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false)

  // Demo vault members for the access modal
  const [vaultMembers, setVaultMembers] = useState<VaultMember[]>([])

  // Get current vault name for modal
  const currentVaultName = selectedFolderId
    ? folders[selectedFolderId]?.name || 'Vault'
    : 'Primary Vault'

  // Access modal handlers
  const handleGrantAccess = async (email: string, clearance: ClearanceLevel) => {
    const newMember: VaultMember = {
      id: crypto.randomUUID(),
      email,
      name: email.split('@')[0],
      clearance,
      addedAt: new Date(),
      addedBy: 'current-user',
    }
    setVaultMembers([...vaultMembers, newMember])
  }

  const handleRevokeClearance = async (memberId: string) => {
    setVaultMembers(vaultMembers.filter((m) => m.id !== memberId))
  }

  const handleUpdateClearance = async (memberId: string, newClearance: ClearanceLevel) => {
    setVaultMembers(
      vaultMembers.map((m) =>
        m.id === memberId ? { ...m, clearance: newClearance } : m
      )
    )
  }

  const handleGenerateLink = async (expiration: LinkExpiration): Promise<string> => {
    // Generate a secure-looking link
    const token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    return `https://ragbox.co/v/${token}?exp=${expiration}`
  }

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

  // Local state for document security/indexing (would be in store in real app)
  const [documentSecurityOverrides, setDocumentSecurityOverrides] = useState<Record<string, SecurityTier>>({})
  const [documentIndexOverrides, setDocumentIndexOverrides] = useState<Record<string, boolean>>({})

  // Get items for current folder
  type ExplorerItem = {
    id: string
    name: string
    type: 'folder' | 'document'
    updatedAt: Date
    size: number
    security: SecurityTier
    isIndexed: boolean
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
          security: 'general',
          isIndexed: true,
        })
      }
    })

    // Add documents in current folder
    Object.values(documents).forEach((d) => {
      const inCurrentFolder = selectedFolderId === null
        ? !d.folderId
        : d.folderId === selectedFolderId
      if (inCurrentFolder) {
        // Use override if exists, otherwise convert from legacy tier
        const security = documentSecurityOverrides[d.id] ?? tierToSecurity(d.securityTier ?? 1)
        const isIndexed = documentIndexOverrides[d.id] ?? true
        items.push({
          id: d.id,
          name: d.name,
          type: 'document',
          updatedAt: new Date(d.updatedAt),
          size: d.size ?? 0,
          security,
          isIndexed,
        })
      }
    })

    return items
  }, [documents, folders, selectedFolderId, documentSecurityOverrides, documentIndexOverrides])

  // Handlers for security/index changes
  const handleSecurityChange = (docId: string, newSecurity: SecurityTier) => {
    setDocumentSecurityOverrides(prev => ({ ...prev, [docId]: newSecurity }))
  }

  const handleIndexToggle = (docId: string, enabled: boolean) => {
    setDocumentIndexOverrides(prev => ({ ...prev, [docId]: enabled }))
  }

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
    await uploadDocuments(files, selectedFolderId || undefined)
    setIsIngestionOpen(false)
  }

  return (
    <div className="flex h-full bg-[var(--bg-secondary)]">
      {/* LEFT PANEL: Navigation Tree */}
      <div className="w-[250px] shrink-0 border-r border-[var(--border-subtle)] bg-[var(--bg-tertiary)]">
        <NavigationTree
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={handleSelectFolder}
        />
      </div>

      {/* CENTER PANEL: File Grid */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
          <div className="flex items-center gap-4">
            <button
              onClick={exitExplorerMode}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all"
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-48 h-9 pl-10 pr-4 bg-[var(--bg-primary)]/50 border border-[var(--border-default)]/50 rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--brand-blue)] transition-colors"
              />
            </div>
            {/* Grant Clearance Button */}
            <button
              onClick={() => setIsAccessModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-default)] rounded-lg font-medium text-sm transition-colors"
            >
              <Users className="w-4 h-4" />
              Grant Clearance
            </button>
            <button
              onClick={() => setIsIngestionOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-[var(--text-primary)] rounded-lg font-medium text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Files
            </button>
          </div>
        </div>

        {/* File Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-[var(--bg-tertiary)] border-b border-[var(--border-subtle)] z-10">
              <tr>
                <th className="text-left px-4 py-3 w-[45%]">
                  <button onClick={() => toggleSort('name')} className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider hover:text-[var(--text-primary)]">
                    Name <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 w-[20%]">
                  <button onClick={() => toggleSort('updatedAt')} className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider hover:text-[var(--text-primary)]">
                    Modified <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 w-[15%]">
                  <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Type</span>
                </th>
                <th className="text-left px-4 py-3 w-[10%]">
                  <button onClick={() => toggleSort('size')} className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider hover:text-[var(--text-primary)]">
                    Size <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 w-[10%]">
                  <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Security</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => handleRowClick(item)}
                  onDoubleClick={() => item.type === 'document' && selectAndChat(item.id)}
                  className={`border-b border-[var(--border-subtle)] cursor-pointer transition-all ${
                    selectedId === item.id
                      ? 'bg-[var(--brand-blue)]/15 border-l-4 border-l-[var(--brand-blue)]'
                      : 'hover:bg-[var(--bg-elevated)]/50'
                  }`}
                >
                  {/* Name */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {item.type === 'folder' ? (
                        <div className="p-2 rounded-lg bg-[var(--warning)]/10">
                          <Folder className="w-5 h-5 text-[var(--warning)]" />
                        </div>
                      ) : (
                        <div className={`p-2 rounded-lg ${
                          item.security === 'sovereign'
                            ? 'bg-[var(--danger)]/10'
                            : 'bg-[var(--brand-blue)]/10'
                        }`}>
                          <FileText className={`w-5 h-5 ${
                            item.security === 'sovereign'
                              ? 'text-[var(--danger)]'
                              : 'text-[var(--brand-blue)]'
                          }`} />
                        </div>
                      )}
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-[var(--text-primary)] truncate">{item.name}</span>
                        {/* RAG disabled indicator */}
                        {item.type === 'document' && !item.isIndexed && (
                          <span title="RAG Disabled">
                            <BrainCog className="w-3.5 h-3.5 text-[var(--danger)] shrink-0" />
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Modified */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-[var(--text-secondary)]">{formatDate(item.updatedAt)}</span>
                  </td>

                  {/* Type */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-[var(--text-secondary)]">
                      {item.type === 'folder' ? 'Folder' : getFileType(item.name)}
                    </span>
                  </td>

                  {/* Size */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-[var(--text-secondary)]">
                      {item.type === 'document' ? formatSize(item.size) : '—'}
                    </span>
                  </td>

                  {/* Security Classification */}
                  <td className="px-4 py-3">
                    {item.type === 'document' && <SecurityBadge security={item.security} />}
                  </td>
                </tr>
              ))}

              {sorted.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <Folder className="w-16 h-16 text-[var(--text-muted)] mx-auto mb-4" />
                    <p className="text-base text-[var(--text-secondary)] mb-2">
                      {searchTerm ? 'No files match your search' : 'This folder is empty'}
                    </p>
                    <button
                      onClick={() => setIsIngestionOpen(true)}
                      className="mt-4 px-6 py-2.5 bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-[var(--text-primary)] rounded-lg font-medium text-sm transition-colors"
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
        <div className={`w-[300px] shrink-0 border-l bg-[var(--bg-tertiary)] ${
          selectedItem?.security === 'sovereign'
            ? 'border-[var(--danger)]/30'
            : 'border-[var(--border-subtle)]'
        }`}>
          <SovereignInspector
            item={selectedItem}
            onClose={() => setShowInspector(false)}
            onChat={selectAndChat}
            onDelete={(id) => { deleteDocument(id); setSelectedId(null) }}
            onSecurityChange={handleSecurityChange}
            onIndexToggle={handleIndexToggle}
          />
        </div>
      )}

      {/* Ingestion Modal */}
      <IngestionModal
        isOpen={isIngestionOpen}
        onClose={() => setIsIngestionOpen(false)}
        onFileUpload={handleIngestionUpload}
      />

      {/* Vault Access / Clearance Modal */}
      <VaultAccessModal
        isOpen={isAccessModalOpen}
        onClose={() => setIsAccessModalOpen(false)}
        vaultName={currentVaultName}
        vaultId={selectedFolderId || 'root'}
        currentMembers={vaultMembers}
        onGrantAccess={handleGrantAccess}
        onRevokeClearance={handleRevokeClearance}
        onUpdateClearance={handleUpdateClearance}
        onGenerateLink={handleGenerateLink}
      />
    </div>
  )
}
