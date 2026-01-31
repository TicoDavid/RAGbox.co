'use client'

import React from 'react'
import { Folder, FileText, ChevronRight } from 'lucide-react'
import type { VaultItem, FolderNode } from '@/types/ragbox'

interface BrowserColumnProps {
  title: string
  folders: FolderNode[]
  documents: VaultItem[]
  selectedId: string | null
  onSelectFolder: (folderId: string) => void
  onSelectDocument: (docId: string) => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getStatusDot(status: string): string {
  switch (status) {
    case 'ready': return 'bg-[var(--success)]'
    case 'processing': return 'bg-[var(--warning)] animate-pulse'
    case 'pending': return 'bg-[var(--text-tertiary)]'
    case 'error': return 'bg-[var(--danger)]'
    default: return 'bg-[var(--text-tertiary)]'
  }
}

export function BrowserColumn({
  title,
  folders,
  documents,
  selectedId,
  onSelectFolder,
  onSelectDocument,
}: BrowserColumnProps) {
  return (
    <div className="flex flex-col h-full min-w-[180px] max-w-[200px] border-r border-[var(--border-default)] last:border-r-0">
      {/* Column Header */}
      <div className="shrink-0 px-3 py-2 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider border-b border-[var(--border-subtle)]">
        {title}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {/* Folders */}
        {folders.map((folder) => (
          <button
            key={folder.id}
            onClick={() => onSelectFolder(folder.id)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
              selectedId === folder.id
                ? 'bg-[var(--brand-blue)] text-white'
                : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            <Folder className="w-4 h-4 shrink-0 opacity-60" />
            <span className="truncate flex-1">{folder.name}</span>
            <ChevronRight className="w-3 h-3 shrink-0 opacity-40" />
          </button>
        ))}

        {/* Documents */}
        {documents.map((doc) => (
          <button
            key={doc.id}
            onClick={() => onSelectDocument(doc.id)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
              selectedId === doc.id
                ? 'bg-[var(--brand-blue)] text-white'
                : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            <FileText className="w-4 h-4 shrink-0 opacity-60" />
            <span className="truncate flex-1">{doc.name}</span>
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDot(doc.status)}`} />
          </button>
        ))}

        {/* Empty */}
        {folders.length === 0 && documents.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-[var(--text-tertiary)]">
            Empty folder
          </div>
        )}
      </div>
    </div>
  )
}
