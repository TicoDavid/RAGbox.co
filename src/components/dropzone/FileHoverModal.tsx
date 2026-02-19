'use client'

import { FileText, Calendar, HardDrive, Shield, Hash } from 'lucide-react'
import TierBadge from '@/components/ui/TierBadge'

interface FileHoverModalProps {
  document: {
    id: string
    name: string
    size: number
    type: string
    uploadedAt: string
    status: string
    securityTier: number
    isPrivileged: boolean
    chunkCount: number
  }
  position: { x: number; y: number }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export default function FileHoverModal({ document, position }: FileHoverModalProps) {
  return (
    <div
      role="tooltip"
      className="fixed z-50 w-64 p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--bg-elevated)] shadow-2xl pointer-events-none"
      style={{
        left: `${position.x + 16}px`,
        top: `${position.y - 8}px`,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <FileText size={16} className="text-[var(--brand-blue)]" />
        <span className="text-xs font-medium text-[var(--text-primary)] truncate">{document.name}</span>
      </div>

      <div className="space-y-1.5 text-[10px]">
        <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
          <HardDrive size={10} />
          <span>{formatBytes(document.size)}</span>
          <span className="text-[var(--text-tertiary)]">({document.type.toUpperCase()})</span>
        </div>

        <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
          <Calendar size={10} />
          <span>{new Date(document.uploadedAt).toLocaleString()}</span>
        </div>

        <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
          <Shield size={10} />
          <TierBadge tier={document.securityTier} size="sm" />
        </div>

        <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
          <Hash size={10} />
          <span>{document.chunkCount} chunks indexed</span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              document.status === 'ready' ? 'bg-[var(--success)]' :
              document.status === 'processing' ? 'bg-[var(--warning)]' :
              document.status === 'error' ? 'bg-[var(--danger)]' : 'bg-[var(--text-tertiary)]'
            }`}
          />
          <span className="text-[var(--text-tertiary)] capitalize">{document.status}</span>
        </div>
      </div>
    </div>
  )
}
