'use client'

import React from 'react'
import { useVaultStore } from '@/stores/vaultStore'
import { FileText, Download, Trash2, Shield } from 'lucide-react'
import { SECURITY_TIER_LABELS } from '@/types/ragbox'
import type { SecurityTier } from '@/types/ragbox'

function formatSize(bytes?: number): string {
  if (!bytes) return '—'
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
  }).format(date)
}

export function PreviewPane() {
  const selectedItemId = useVaultStore((s) => s.selectedItemId)
  const documents = useVaultStore((s) => s.documents)
  const deleteDocument = useVaultStore((s) => s.deleteDocument)
  const togglePrivilege = useVaultStore((s) => s.togglePrivilege)

  const item = selectedItemId ? documents[selectedItemId] : null

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--text-tertiary)] gap-2 px-4">
        <FileText className="w-10 h-10 opacity-30" />
        <span className="text-sm">Select a file to preview</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-y-auto">
      {/* Thumbnail */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-[100px] h-[120px] rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] flex items-center justify-center">
          <FileText className="w-10 h-10 text-[var(--text-tertiary)]" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-[var(--text-primary)] break-all">{item.name}</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
            {item.mimeType ?? 'Unknown type'} · {formatSize(item.size)}
          </p>
        </div>
      </div>

      {/* Info */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-[var(--text-tertiary)]">Created</span>
          <span className="text-[var(--text-secondary)]">{formatDate(item.createdAt)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-[var(--text-tertiary)]">Modified</span>
          <span className="text-[var(--text-secondary)]">{formatDate(item.updatedAt)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-[var(--text-tertiary)]">Status</span>
          <span className="text-[var(--text-secondary)] capitalize">{item.status}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-[var(--text-tertiary)]">Security</span>
          <span className="text-[var(--text-secondary)]">
            {SECURITY_TIER_LABELS[item.securityTier as SecurityTier] ?? `Tier ${item.securityTier}`}
          </span>
        </div>
        {item.isPrivileged && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--privilege-color)]">
            <Shield className="w-3 h-3" />
            <span className="font-medium">Attorney-Client Privilege</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-auto flex flex-col gap-2">
        <button className="flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-[var(--brand-blue)] text-white text-sm font-medium hover:bg-[var(--brand-blue-hover)] transition-colors">
          <Download className="w-4 h-4" />
          Download
        </button>
        <button
          onClick={() => togglePrivilege(item.id)}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-[var(--border-default)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          <Shield className="w-4 h-4" />
          {item.isPrivileged ? 'Remove Privilege' : 'Mark Privileged'}
        </button>
        <button
          onClick={() => deleteDocument(item.id)}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-[var(--danger)]/30 text-sm text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      </div>
    </div>
  )
}
