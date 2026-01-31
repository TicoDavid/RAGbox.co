'use client'

import React from 'react'
import { useForgeStore } from '@/stores/forgeStore'
import { Download, FileText } from 'lucide-react'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  return `${Math.floor(hours / 24)} day${Math.floor(hours / 24) > 1 ? 's' : ''} ago`
}

export function AssetsPopover() {
  const assets = useForgeStore((s) => s.assets)
  const downloadAsset = useForgeStore((s) => s.downloadAsset)

  return (
    <div className="w-64 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-xl overflow-hidden">
      <div className="px-3 py-2 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider border-b border-[var(--border-subtle)]">
        Recent Assets
      </div>

      {assets.length === 0 ? (
        <div className="px-3 py-6 text-center text-xs text-[var(--text-tertiary)]">
          No generated assets yet
        </div>
      ) : (
        <div className="max-h-[300px] overflow-y-auto">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="flex items-center gap-2.5 px-3 py-2 border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-hover)] transition-colors"
            >
              <FileText className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--text-primary)] truncate">{asset.filename}</p>
                <p className="text-[10px] text-[var(--text-tertiary)]">
                  {formatTimeAgo(asset.createdAt)} · {formatSize(asset.size)}
                </p>
              </div>
              <button
                onClick={() => downloadAsset(asset.id)}
                className="shrink-0 p-1 rounded-md text-[var(--text-tertiary)] hover:text-[var(--brand-blue)] transition-colors"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
