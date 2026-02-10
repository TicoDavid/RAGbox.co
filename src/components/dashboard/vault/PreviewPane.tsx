'use client'

import React from 'react'
import { useSession } from 'next-auth/react'
import { useVaultStore } from '@/stores/vaultStore'
import { FileText, Download, Trash2, Shield, Clock } from 'lucide-react'
import { SovereignCertificate } from './SovereignCertificate'

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
  }).format(date)
}

export function PreviewPane() {
  const { data: session } = useSession()
  const selectedItemId = useVaultStore((s) => s.selectedItemId)
  const documents = useVaultStore((s) => s.documents)
  const deleteDocument = useVaultStore((s) => s.deleteDocument)
  const togglePrivilege = useVaultStore((s) => s.togglePrivilege)

  const item = selectedItemId ? documents[selectedItemId] : null
  const userName = session?.user?.name || 'Sovereign User'

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
      {/* Asset Header - Clean, Premium */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-[100px] h-[120px] rounded-lg bg-[#0a0f18] border border-white/10 flex items-center justify-center shadow-[0_0_30px_-10px_rgba(0,0,0,0.5)]">
          <FileText className="w-10 h-10 text-slate-500" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-white break-all leading-tight">{item.name}</p>
          <p className="text-[11px] text-slate-500 mt-1 font-mono">
            {formatSize(item.size)} · {item.mimeType?.split('/')[1]?.toUpperCase() || 'FILE'}
          </p>
        </div>
      </div>

      {/* Sovereign Certificate - The Official Record */}
      <SovereignCertificate document={item} userName={userName} />

      {/* Privilege Badge (if applicable) */}
      {item.isPrivileged && (
        <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-red-950/30 border border-red-500/20">
          <Shield className="w-3.5 h-3.5 text-red-400" />
          <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">
            Attorney-Client Privilege
          </span>
        </div>
      )}

      {/* Timestamp - Subtle Footer Info */}
      <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-600">
        <Clock className="w-3 h-3" />
        <span>Deposited {formatDate(item.createdAt)}</span>
      </div>

      {/* Actions - Premium Buttons */}
      <div className="mt-auto flex flex-col gap-2">
        <button className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-[#00F0FF] text-black text-sm font-semibold hover:bg-[#00d4e0] transition-colors shadow-[0_0_20px_-5px_rgba(0,240,255,0.4)]">
          <Download className="w-4 h-4" />
          Download Asset
        </button>
        <button
          onClick={() => togglePrivilege(item.id)}
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-white/10 text-sm text-slate-400 hover:text-white hover:bg-white/5 hover:border-white/20 transition-all"
        >
          <Shield className="w-4 h-4" />
          {item.isPrivileged ? 'Remove Privilege' : 'Mark Privileged'}
        </button>
        <button
          onClick={() => deleteDocument(item.id)}
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-red-500/20 text-sm text-red-400/70 hover:text-red-400 hover:bg-red-950/30 hover:border-red-500/30 transition-all"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      </div>
    </div>
  )
}
