'use client'

import React, { useState } from 'react'
import { useVaultStore } from '@/stores/vaultStore'
import {
  ChevronLeft,
  FileText,
  Folder,
  Shield,
  ShieldCheck,
  ShieldOff,
  Trash2,
  MessageSquare,
  Search,
  Plus,
  ArrowUpDown,
  Check,
} from 'lucide-react'
import IngestionModal from '@/app/dashboard/components/IngestionModal'

// Format file size
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Format date
function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Security status badge
function SecurityBadge({ tier }: { tier: number }) {
  const configs = {
    1: { icon: ShieldOff, label: 'Open', color: 'text-slate-400', bg: 'bg-slate-800/50' },
    2: { icon: Shield, label: 'Protected', color: 'text-blue-400', bg: 'bg-blue-900/30' },
    3: { icon: ShieldCheck, label: 'Privileged', color: 'text-amber-400', bg: 'bg-amber-900/30' },
  }
  const config = configs[tier as keyof typeof configs] || configs[1]
  const Icon = config.icon

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${config.color} ${config.bg}`}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  )
}

export function VaultExplorer() {
  const documents = useVaultStore((s) => s.documents)
  const folders = useVaultStore((s) => s.folders)
  const exitExplorerMode = useVaultStore((s) => s.exitExplorerMode)
  const selectAndChat = useVaultStore((s) => s.selectAndChat)
  const uploadDocument = useVaultStore((s) => s.uploadDocument)
  const deleteDocument = useVaultStore((s) => s.deleteDocument)
  const currentPath = useVaultStore((s) => s.currentPath)

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<'name' | 'updatedAt' | 'size'>('updatedAt')
  const [sortAsc, setSortAsc] = useState(false)
  const [isIngestionOpen, setIsIngestionOpen] = useState(false)

  // Get all items (folders + documents) with normalized shape
  type ExplorerItem = {
    id: string
    name: string
    type: 'folder' | 'document'
    updatedAt: Date
    size: number
    tier: number
  }

  const allItems: ExplorerItem[] = [
    ...Object.values(folders).map((f) => ({
      id: f.id,
      name: f.name,
      type: 'folder' as const,
      updatedAt: new Date(), // Folders don't have updatedAt, use current time
      size: 0,
      tier: 1,
    })),
    ...Object.values(documents).map((d) => ({
      id: d.id,
      name: d.name,
      type: 'document' as const,
      updatedAt: new Date(d.updatedAt),
      size: d.size ?? 0,
      tier: d.securityTier ?? 1,
    })),
  ]

  // Filter by search
  const filtered = allItems.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Sort items
  const sorted = [...filtered].sort((a, b) => {
    // Folders first
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1

    let cmp = 0
    if (sortField === 'name') {
      cmp = a.name.localeCompare(b.name)
    } else if (sortField === 'updatedAt') {
      cmp = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    } else if (sortField === 'size') {
      cmp = b.size - a.size
    }
    return sortAsc ? -cmp : cmp
  })

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(false)
    }
  }

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  const selectAll = () => {
    if (selectedIds.size === sorted.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(sorted.map((i) => i.id)))
    }
  }

  const handleChatWithFile = (id: string) => {
    selectAndChat(id)
  }

  const handleIngestionUpload = async (files: File[]) => {
    const folderId = currentPath[currentPath.length - 1]
    for (const file of files) {
      await uploadDocument(file, folderId)
    }
    setIsIngestionOpen(false)
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-secondary)]">
      {/* Header with rim lighting */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)] border-t border-t-white/10 bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-4">
          <button
            onClick={exitExplorerMode}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-[var(--text-secondary)] hover:text-white hover:bg-white/10 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Collapse</span>
          </button>
          <h2 className="text-lg font-semibold text-white">Vault Explorer</h2>
          <span className="text-sm text-[var(--text-tertiary)]">
            {sorted.length} items
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search files..."
              className="w-64 h-10 pl-10 pr-4 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[var(--brand-blue)] transition-colors"
            />
          </div>

          {/* Add Files */}
          <button
            onClick={() => setIsIngestionOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white rounded-lg font-medium text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Files
          </button>
        </div>
      </div>

      {/* Data Grid Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-[var(--bg-tertiary)] border-b border-[var(--border-default)]">
            <tr>
              {/* Checkbox */}
              <th className="w-12 px-4 py-3">
                <button
                  onClick={selectAll}
                  className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                    selectedIds.size === sorted.length && sorted.length > 0
                      ? 'bg-[var(--brand-blue)] border-[var(--brand-blue)]'
                      : 'border-slate-600 hover:border-slate-400'
                  }`}
                >
                  {selectedIds.size === sorted.length && sorted.length > 0 && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </button>
              </th>

              {/* File Name */}
              <th className="text-left px-4 py-3">
                <button
                  onClick={() => toggleSort('name')}
                  className="flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)] hover:text-white transition-colors"
                >
                  File Name
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              </th>

              {/* Date Modified */}
              <th className="text-left px-4 py-3 w-40">
                <button
                  onClick={() => toggleSort('updatedAt')}
                  className="flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)] hover:text-white transition-colors"
                >
                  Modified
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              </th>

              {/* Size */}
              <th className="text-left px-4 py-3 w-28">
                <button
                  onClick={() => toggleSort('size')}
                  className="flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)] hover:text-white transition-colors"
                >
                  Size
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              </th>

              {/* Security */}
              <th className="text-left px-4 py-3 w-32">
                <span className="text-sm font-semibold text-[var(--text-secondary)]">Security</span>
              </th>

              {/* Actions */}
              <th className="text-right px-4 py-3 w-32">
                <span className="text-sm font-semibold text-[var(--text-secondary)]">Actions</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {sorted.map((item) => (
              <tr
                key={item.id}
                className={`border-b border-[var(--border-subtle)] hover:bg-white/5 transition-colors ${
                  selectedIds.has(item.id) ? 'bg-[var(--brand-blue)]/10' : ''
                }`}
              >
                {/* Checkbox */}
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleSelect(item.id)}
                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                      selectedIds.has(item.id)
                        ? 'bg-[var(--brand-blue)] border-[var(--brand-blue)]'
                        : 'border-slate-600 hover:border-slate-400'
                    }`}
                  >
                    {selectedIds.has(item.id) && <Check className="w-3 h-3 text-white" />}
                  </button>
                </td>

                {/* File Name - Large, readable text */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {item.type === 'folder' ? (
                      <Folder className="w-5 h-5 text-amber-400 shrink-0" />
                    ) : (
                      <FileText className="w-5 h-5 text-[var(--brand-blue)] shrink-0" />
                    )}
                    <span className="text-base font-medium text-[#E5E7EB] truncate">
                      {item.name}
                    </span>
                  </div>
                </td>

                {/* Date */}
                <td className="px-4 py-3">
                  <span className="text-sm text-[var(--text-secondary)]">
                    {formatDate(item.updatedAt)}
                  </span>
                </td>

                {/* Size */}
                <td className="px-4 py-3">
                  <span className="text-sm text-[var(--text-secondary)]">
                    {item.type === 'document' ? formatSize(item.size) : '—'}
                  </span>
                </td>

                {/* Security */}
                <td className="px-4 py-3">
                  {item.type === 'document' && <SecurityBadge tier={item.tier} />}
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {item.type === 'document' && (
                      <>
                        <button
                          onClick={() => handleChatWithFile(item.id)}
                          className="p-2 rounded-md text-[var(--brand-blue)] hover:bg-[var(--brand-blue)]/20 transition-colors"
                          title="Chat with this file"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteDocument(item.id)}
                          className="p-2 rounded-md text-red-400 hover:bg-red-500/20 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-base text-[var(--text-secondary)]">
                    {searchTerm ? 'No files match your search' : 'No files in vault'}
                  </p>
                  <button
                    onClick={() => setIsIngestionOpen(true)}
                    className="mt-4 px-4 py-2 bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white rounded-lg font-medium text-sm transition-colors"
                  >
                    Add Files
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Ingestion Modal */}
      <IngestionModal
        isOpen={isIngestionOpen}
        onClose={() => setIsIngestionOpen(false)}
        onFileUpload={handleIngestionUpload}
      />
    </div>
  )
}
