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

function formatSize(bytes?: number): string {
  if (!bytes) return '—'
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
    <div className="flex flex-col h-full min-w-[220px] max-w-[260px] border-r border-[var(--border-default)] last:border-r-0">
      {/* Column Header - Brighter, larger */}
      <div className="shrink-0 px-4 py-3 text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border-subtle)]">
        {title}
      </div>

      {/* Items - Rich Rows */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Folders */}
        {folders.map((folder) => (
          <button
            key={folder.id}
            onClick={() => onSelectFolder(folder.id)}
            aria-label={`Open folder: ${folder.name}`}
            className={`w-[calc(100%-16px)] mx-2 mb-1 flex items-center gap-3 px-3 py-3 min-h-[56px] text-left rounded-lg transition-all duration-200 ${
              selectedId === folder.id
                ? 'bg-[var(--brand-blue)] text-white shadow-lg shadow-[var(--brand-blue)]/20'
                : 'text-[var(--text-primary)] hover:bg-white/5'
            }`}
          >
            {/* Large Folder Icon */}
            <div className={`shrink-0 p-2 rounded-lg ${
              selectedId === folder.id
                ? 'bg-white/20'
                : 'bg-amber-500/10'
            }`}>
              <Folder className={`w-5 h-5 ${
                selectedId === folder.id ? 'text-white' : 'text-amber-400'
              }`} />
            </div>

            {/* Folder Info */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium leading-tight ${
                selectedId === folder.id ? 'text-white' : 'text-[var(--text-primary)]'
              }`}>
                {folder.name}
              </p>
              <p className={`text-xs mt-0.5 ${
                selectedId === folder.id ? 'text-white/70' : 'text-[var(--text-tertiary)]'
              }`}>
                {folder.documents?.length || 0} items
              </p>
            </div>

            <ChevronRight className={`w-4 h-4 shrink-0 ${
              selectedId === folder.id ? 'text-white/70' : 'text-[var(--text-tertiary)]'
            }`} />
          </button>
        ))}

        {/* Documents */}
        {documents.map((doc) => (
          <button
            key={doc.id}
            onClick={() => onSelectDocument(doc.id)}
            aria-label={`Select document: ${doc.name}`}
            className={`w-[calc(100%-16px)] mx-2 mb-1 flex items-start gap-3 px-3 py-3 min-h-[56px] text-left rounded-lg transition-all duration-200 ${
              selectedId === doc.id
                ? 'bg-[var(--brand-blue)] text-white shadow-lg shadow-[var(--brand-blue)]/20'
                : 'text-[var(--text-primary)] hover:bg-white/5'
            }`}
          >
            {/* Large File Icon with Status */}
            <div className="shrink-0 relative">
              <div className={`p-2 rounded-lg ${
                selectedId === doc.id
                  ? 'bg-white/20'
                  : 'bg-[var(--brand-blue)]/10'
              }`}>
                <FileText className={`w-5 h-5 ${
                  selectedId === doc.id ? 'text-white' : 'text-[var(--brand-blue)]'
                }`} />
              </div>
              {/* Status Dot */}
              <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-secondary)] ${getStatusDot(doc.status)}`} />
            </div>

            {/* Document Info - Two Lines */}
            <div className="flex-1 min-w-0 pt-0.5">
              {/* Line 1: File Name - Allow 2 lines */}
              <p className={`text-sm font-medium leading-snug line-clamp-2 ${
                selectedId === doc.id ? 'text-white' : 'text-[var(--text-primary)]'
              }`}>
                {doc.name}
              </p>
              {/* Line 2: Meta - Date • Size */}
              <p className={`text-xs mt-1 ${
                selectedId === doc.id ? 'text-white/70' : 'text-[var(--text-tertiary)]'
              }`}>
                {formatDate(doc.updatedAt)} • {formatSize(doc.size)}
              </p>
            </div>
          </button>
        ))}

        {/* Empty State */}
        {folders.length === 0 && documents.length === 0 && (
          <div className="px-4 py-8 text-center">
            <FileText className="w-10 h-10 mx-auto mb-2 text-[var(--text-tertiary)] opacity-40" />
            <p className="text-sm text-[var(--text-tertiary)]">
              No files yet
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
