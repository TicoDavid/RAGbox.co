'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useVaultStore } from '@/stores/vaultStore'
import { VaultRail } from './VaultRail'
import { ColumnBrowser } from './ColumnBrowser'
import { PreviewPane } from './PreviewPane'
import { StorageFooter } from './StorageFooter'
import { X, Plus, Maximize2 } from 'lucide-react'
import IngestionModal from '@/app/dashboard/components/IngestionModal'

export function VaultPanel() {
  const [isIngestionOpen, setIsIngestionOpen] = useState(false)
  const isCollapsed = useVaultStore((s) => s.isCollapsed)
  const toggleCollapse = useVaultStore((s) => s.toggleCollapse)
  const toggleExplorerMode = useVaultStore((s) => s.toggleExplorerMode)
  const fetchDocuments = useVaultStore((s) => s.fetchDocuments)
  const fetchFolders = useVaultStore((s) => s.fetchFolders)
  const selectedItemId = useVaultStore((s) => s.selectedItemId)
  const uploadDocument = useVaultStore((s) => s.uploadDocument)
  const currentPath = useVaultStore((s) => s.currentPath)
  const hasFetched = useRef(false)

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true
      fetchDocuments().then(() => fetchFolders())
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

  const handleIngestionUpload = async (files: File[]) => {
    const folderId = currentPath[currentPath.length - 1]
    for (const file of files) {
      await uploadDocument(file, folderId)
    }
    setIsIngestionOpen(false)
  }

  if (isCollapsed) {
    return (
      <>
        <VaultRail onExpand={toggleCollapse} onUpload={() => setIsIngestionOpen(true)} />
        <IngestionModal
          isOpen={isIngestionOpen}
          onClose={() => setIsIngestionOpen(false)}
          onFileUpload={handleIngestionUpload}
        />
      </>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-secondary)]">
      {/* Header with rim lighting */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)] border-t border-t-white/10">
        <span className="text-base font-bold text-[var(--text-primary)] tracking-wide uppercase">Vault</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsIngestionOpen(true)}
            className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--brand-blue)] hover:bg-[var(--bg-tertiary)] transition-colors"
            title="Add to Vault"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            onClick={toggleExplorerMode}
            className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--brand-blue)] hover:bg-[var(--bg-tertiary)] transition-colors"
            title="Explorer Mode"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
          <button
            onClick={toggleCollapse}
            className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            title="Collapse"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Ingestion Modal */}
      <IngestionModal
        isOpen={isIngestionOpen}
        onClose={() => setIsIngestionOpen(false)}
        onFileUpload={handleIngestionUpload}
      />

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
