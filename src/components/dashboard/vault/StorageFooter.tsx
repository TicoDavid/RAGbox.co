'use client'

import React from 'react'
import { useVaultStore } from '@/stores/vaultStore'

function formatStorage(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function StorageFooter() {
  const { used, total } = useVaultStore((s) => s.storage)
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0

  return (
    <div className="shrink-0 px-3 py-2.5 border-t border-[var(--border-default)]">
      <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)] mb-1.5">
        <span>{formatStorage(used)} used</span>
        <span>{formatStorage(total)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--brand-blue)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
