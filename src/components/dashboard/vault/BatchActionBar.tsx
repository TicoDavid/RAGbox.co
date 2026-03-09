'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckSquare, FolderInput, Trash2, Shield, X } from 'lucide-react'
import { useVaultStore } from '@/stores/vaultStore'
import type { FolderNode } from '@/types/ragbox'

const TIER_OPTIONS = [
  { value: 1, label: 'Standard' },
  { value: 3, label: 'Confidential' },
  { value: 4, label: 'Restricted' },
]

export function BatchActionBar() {
  const selectedDocumentIds = useVaultStore((s) => s.selectedDocumentIds)
  const clearSelection = useVaultStore((s) => s.clearSelection)
  const selectAll = useVaultStore((s) => s.selectAll)
  const folders = useVaultStore((s) => s.folders)
  const batchDelete = useVaultStore((s) => s.batchDelete)
  const batchMove = useVaultStore((s) => s.batchMove)
  const batchUpdateTier = useVaultStore((s) => s.batchUpdateTier)

  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const [showTierMenu, setShowTierMenu] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const count = selectedDocumentIds.length
  const rootFolders = Object.values(folders).filter((f: FolderNode) => !f.parentId)

  const handleDelete = useCallback(async () => {
    await batchDelete(selectedDocumentIds)
    setShowDeleteConfirm(false)
  }, [batchDelete, selectedDocumentIds])

  const handleMove = useCallback(async (folderId: string) => {
    await batchMove(selectedDocumentIds, folderId)
    setShowMoveMenu(false)
  }, [batchMove, selectedDocumentIds])

  const handleTier = useCallback(async (tier: number) => {
    await batchUpdateTier(selectedDocumentIds, tier)
    setShowTierMenu(false)
  }, [batchUpdateTier, selectedDocumentIds])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault()
        selectAll()
      }
      if (e.key === 'Escape' && count > 0) clearSelection()
      if ((e.key === 'Delete' || e.key === 'Backspace') && count > 0) {
        e.preventDefault()
        setShowDeleteConfirm(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [count, selectAll, clearSelection])

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="absolute bottom-4 left-4 right-4 bg-[var(--bg-tertiary)] border border-[var(--border-strong)] rounded-[var(--radius-lg)] shadow-lg px-4 py-3 flex items-center gap-3 z-30"
        >
          <CheckSquare className="w-4 h-4 text-[var(--brand-blue)]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {count} selected
          </span>

          <div className="h-4 w-px bg-[var(--border-default)]" />

          {/* Move to... */}
          <div className="relative">
            <button
              onClick={() => { setShowMoveMenu(!showMoveMenu); setShowTierMenu(false) }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] rounded-md transition-colors"
            >
              <FolderInput className="w-3.5 h-3.5" />
              Move to...
            </button>
            {showMoveMenu && (
              <div className="absolute bottom-full mb-1 left-0 w-48 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg shadow-xl py-1 z-40">
                {rootFolders.map((f: FolderNode) => (
                  <button
                    key={f.id}
                    onClick={() => handleMove(f.id)}
                    className="w-full text-left px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {f.name}
                  </button>
                ))}
                {rootFolders.length === 0 && (
                  <p className="px-3 py-2 text-xs text-[var(--text-tertiary)] italic">No folders</p>
                )}
              </div>
            )}
          </div>

          {/* Delete */}
          <div className="relative">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[var(--danger)] hover:bg-[var(--danger)]/10 rounded-md transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
            {showDeleteConfirm && (
              <div className="absolute bottom-full mb-1 left-0 w-56 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg shadow-xl p-3 z-40">
                <p className="text-sm text-[var(--text-primary)] mb-2">
                  Delete {count} item{count > 1 ? 's' : ''}?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    className="flex-1 px-3 py-1.5 text-xs font-medium bg-[var(--danger)] text-white rounded-md hover:opacity-90 transition-opacity"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 px-3 py-1.5 text-xs font-medium border border-[var(--border-default)] text-[var(--text-secondary)] rounded-md hover:bg-[var(--bg-elevated)] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tier */}
          <div className="relative">
            <button
              onClick={() => { setShowTierMenu(!showTierMenu); setShowMoveMenu(false) }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] rounded-md transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              Tier
            </button>
            {showTierMenu && (
              <div className="absolute bottom-full mb-1 left-0 w-40 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg shadow-xl py-1 z-40">
                {TIER_OPTIONS.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => handleTier(t.value)}
                    className="w-full text-left px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1" />

          <button
            onClick={clearSelection}
            className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] rounded-md transition-colors"
            aria-label="Clear selection"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
