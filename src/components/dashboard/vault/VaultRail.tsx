'use client'

import React from 'react'
import {
  FolderOpen,
  Upload,
  Cloud,
} from 'lucide-react'
import { useVaultStore } from '@/stores/vaultStore'
import { toast } from 'sonner'

interface VaultRailProps {
  onExpand: () => void
  onUpload: () => void
}

export function VaultRail({ onExpand, onUpload }: VaultRailProps) {
  const storage = useVaultStore((s) => s.storage)
  const documents = useVaultStore((s) => s.documents)

  const handleStorage = () => {
    const usedMB = (storage.used / (1024 * 1024)).toFixed(1)
    const totalGB = (storage.total / (1024 * 1024 * 1024)).toFixed(1)
    const docCount = Object.keys(documents).length
    toast.info(`Storage: ${usedMB} MB / ${totalGB} GB used | ${docCount} documents`)
  }

  const buttons = [
    { icon: FolderOpen, label: 'Open Vault', onClick: onExpand },
    { icon: Upload, label: 'Upload Files', onClick: onUpload },
    { icon: Cloud, label: 'Cloud Storage', onClick: handleStorage },
  ]

  return (
    <div className="h-full flex flex-col items-center py-3 gap-1">
      {buttons.map((btn) => (
        <button
          key={btn.label}
          onClick={btn.onClick}
          className="group relative w-10 h-10 flex items-center justify-center rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          title={btn.label}
          aria-label={btn.label}
        >
          <btn.icon className="w-5 h-5" />
          {/* Tooltip */}
          <span className="absolute left-full ml-2 px-2 py-1 text-xs font-medium text-[var(--text-primary)] bg-[var(--bg-elevated)] rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg">
            {btn.label}
          </span>
        </button>
      ))}
    </div>
  )
}
