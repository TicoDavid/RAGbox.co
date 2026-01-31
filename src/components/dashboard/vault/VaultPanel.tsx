'use client'

import React, { useEffect, useRef } from 'react'
import { useVaultStore } from '@/stores/vaultStore'
import { VaultRail } from './VaultRail'
import { ColumnBrowser } from './ColumnBrowser'
import { PreviewPane } from './PreviewPane'
import { StorageFooter } from './StorageFooter'
import { X } from 'lucide-react'

export function VaultPanel() {
  const isCollapsed = useVaultStore((s) => s.isCollapsed)
  const toggleCollapse = useVaultStore((s) => s.toggleCollapse)
  const fetchDocuments = useVaultStore((s) => s.fetchDocuments)
  const fetchFolders = useVaultStore((s) => s.fetchFolders)
  const selectedItemId = useVaultStore((s) => s.selectedItemId)
  const uploadDocument = useVaultStore((s) => s.uploadDocument)
  const currentPath = useVaultStore((s) => s.currentPath)
  const hasFetched = useRef(false)

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true
      fetchDocuments()
      fetchFolders()
    }
  }, [fetchDocuments, fetchFolders])

  const handleUpload = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files
      if (!files) return
      const folderId = currentPath[currentPath.length - 1]
      for (const file of Array.from(files)) {
        await uploadDocument(file, folderId)
      }
    }
    input.click()
  }

  if (isCollapsed) {
    return <VaultRail onExpand={toggleCollapse} onUpload={handleUpload} />
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-secondary)]">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-[var(--border-default)]">
        <span className="text-sm font-semibold text-[var(--text-primary)]">Vault</span>
        <button
          onClick={toggleCollapse}
          className="p-1 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body: Column Browser + optional Preview */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <div className={`flex-1 overflow-hidden ${selectedItemId ? 'border-r border-[var(--border-default)]' : ''}`}>
          <ColumnBrowser />
        </div>
        {selectedItemId && (
          <div className="w-[180px] shrink-0 overflow-hidden">
            <PreviewPane />
          </div>
        )}
      </div>

      {/* Storage Footer */}
      <StorageFooter />
    </div>
  )
}
