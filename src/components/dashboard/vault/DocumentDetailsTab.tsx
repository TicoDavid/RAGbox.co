'use client'

import React, { useState } from 'react'
import {
  Pencil,
  Check,
  X,
  FolderOpen,
  Copy,
  Star,
  Shield,
  RefreshCw,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import type { VaultItem, FolderNode } from '@/types/ragbox'

interface DocumentDetailsTabProps {
  document: VaultItem
  folders: Record<string, FolderNode>
  onRename: (id: string, name: string) => void
  onToggleStar: (id: string) => void
  onTogglePrivilege: (id: string) => void
  onRetryIndex: (id: string) => void
}

function formatSize(bytes?: number): string {
  if (!bytes) return '\u2014'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date))
}

function getMimeLabel(mime?: string): string {
  if (!mime) return 'File'
  if (mime.includes('pdf')) return 'PDF Document'
  if (mime.includes('word') || mime.includes('doc')) return 'Word Document'
  if (mime.includes('text/plain')) return 'Text File'
  if (mime.includes('text/markdown') || mime.includes('text/md')) return 'Markdown'
  if (mime.includes('csv')) return 'CSV Spreadsheet'
  if (mime.includes('spreadsheet') || mime.includes('xlsx')) return 'Excel Spreadsheet'
  if (mime.includes('presentation') || mime.includes('pptx')) return 'PowerPoint'
  if (mime.startsWith('image/')) return `Image (${mime.split('/')[1]?.toUpperCase()})`
  if (mime.startsWith('audio/')) return `Audio (${mime.split('/')[1]?.toUpperCase()})`
  return mime.split('/')[1]?.toUpperCase() || 'File'
}

function getFolderPath(folderId: string | undefined, folders: Record<string, FolderNode>): string {
  if (!folderId) return 'Root'
  const parts: string[] = []
  let current = folderId
  while (current && folders[current]) {
    parts.unshift(folders[current].name)
    current = folders[current].parentId || ''
  }
  return parts.join(' / ') || 'Root'
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-[var(--border-subtle)] last:border-b-0">
      <span className="text-xs text-[var(--text-tertiary)] shrink-0 w-[80px]">{label}</span>
      <div className="flex-1 text-right">{children}</div>
    </div>
  )
}

export function DocumentDetailsTab({
  document: doc,
  folders,
  onRename,
  onToggleStar,
  onTogglePrivilege,
  onRetryIndex,
}: DocumentDetailsTabProps) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(doc.name)
  const [copied, setCopied] = useState(false)

  const handleSave = () => {
    if (editName.trim() && editName !== doc.name) {
      onRename(doc.id, editName.trim())
    }
    setEditing(false)
  }

  const handleCopyChecksum = () => {
    if (!doc.checksum) return
    navigator.clipboard.writeText(doc.checksum)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const statusNorm = doc.status?.toLowerCase()

  return (
    <div className="p-4 space-y-1" style={{ fontFamily: 'var(--font-jakarta)' }}>
      {/* Filename (editable) */}
      <DetailRow label="Filename">
        {editing ? (
          <div className="flex items-center gap-1 justify-end">
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
              onBlur={handleSave}
              className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded px-2 py-0.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--brand-blue)] w-full max-w-[180px]"
            />
            <button onClick={handleSave} className="p-0.5 text-[var(--success)]"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => setEditing(false)} className="p-0.5 text-[var(--text-tertiary)]"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-1 justify-end">
            <span className="text-xs text-[var(--text-primary)] font-medium truncate max-w-[160px]">{doc.name}</span>
            <button onClick={() => { setEditName(doc.name); setEditing(true) }} className="p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        )}
      </DetailRow>

      <DetailRow label="Type">
        <span className="text-xs text-[var(--text-primary)]">{getMimeLabel(doc.mimeType)}</span>
      </DetailRow>

      <DetailRow label="Size">
        <span className="text-xs text-[var(--text-primary)]">{formatSize(doc.size)}</span>
      </DetailRow>

      <DetailRow label="Uploaded">
        <span className="text-xs text-[var(--text-primary)]">{formatDate(doc.createdAt)}</span>
      </DetailRow>

      <DetailRow label="Modified">
        <span className="text-xs text-[var(--text-primary)]">{formatDate(doc.updatedAt)}</span>
      </DetailRow>

      {/* Divider */}
      <div className="h-2" />

      {/* RAG Status */}
      <DetailRow label="RAG Status">
        {(statusNorm === 'ready' || statusNorm === 'indexed') ? (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--success)]">
            <CheckCircle2 className="w-3 h-3" /> Indexed
          </span>
        ) : (statusNorm === 'processing') ? (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--warning)]">
            <Loader2 className="w-3 h-3 animate-spin" /> Processing
          </span>
        ) : (statusNorm === 'error' || statusNorm === 'failed') ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--danger)]">
            <AlertTriangle className="w-3 h-3" /> Failed
            <button onClick={() => onRetryIndex(doc.id)} className="ml-1 text-[10px] underline hover:no-underline">
              <RefreshCw className="w-3 h-3 inline" /> Retry
            </button>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
            <Loader2 className="w-3 h-3 animate-spin" /> Pending
          </span>
        )}
      </DetailRow>

      {/* Privilege */}
      <DetailRow label="Privilege">
        <button
          onClick={() => onTogglePrivilege(doc.id)}
          className={`inline-flex items-center gap-1 text-xs transition-colors ${
            doc.isPrivileged
              ? 'text-[var(--privilege-color)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Shield className="w-3 h-3" />
          {doc.isPrivileged ? 'Privileged' : 'Open'}
        </button>
      </DetailRow>

      {/* Starred */}
      <DetailRow label="Starred">
        <button
          onClick={() => onToggleStar(doc.id)}
          className="text-xs transition-colors"
        >
          <Star className={`w-3.5 h-3.5 inline ${doc.isStarred ? 'fill-[var(--warning)] text-[var(--warning)]' : 'text-[var(--text-tertiary)]'}`} />
        </button>
      </DetailRow>

      {/* Folder */}
      <DetailRow label="Folder">
        <span className="inline-flex items-center gap-1 text-xs text-[var(--text-primary)]">
          <FolderOpen className="w-3 h-3 text-[var(--text-tertiary)]" />
          {getFolderPath(doc.folderId, folders)}
        </span>
      </DetailRow>

      {/* Checksum */}
      {doc.checksum && (
        <DetailRow label="Checksum">
          <button
            onClick={handleCopyChecksum}
            className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors font-mono"
            title="Click to copy full checksum"
          >
            {doc.checksum.slice(0, 8)}...
            <Copy className={`w-3 h-3 ${copied ? 'text-[var(--success)]' : ''}`} />
          </button>
        </DetailRow>
      )}
    </div>
  )
}
