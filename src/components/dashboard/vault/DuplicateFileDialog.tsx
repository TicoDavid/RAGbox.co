'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Copy, RefreshCw, X, SkipForward, RefreshCcw } from 'lucide-react'
import { useVaultStore } from '@/stores/vaultStore'
import type { DuplicateAction } from '@/stores/vaultStore'

/**
 * DuplicateFileDialog — STORY-200
 *
 * Shown when a user uploads a file whose name already exists in the vault.
 * Options: Replace (overwrite), Keep Both (append suffix), Skip (cancel).
 *
 * Renders via vaultStore.duplicateConflict state — set by uploadDocuments(),
 * resolved when the user picks an action.
 */

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DuplicateFileDialog() {
  const conflict = useVaultStore((s) => s.duplicateConflict)

  if (!conflict) return null

  const handleAction = (action: DuplicateAction) => {
    conflict.resolve(action)
  }

  return (
    <AnimatePresence>
      {conflict && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={() => handleAction('skip')}
          />

          {/* Dialog */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-md mx-4 rounded-2xl bg-[var(--bg-primary)]/95 backdrop-blur-xl border border-[var(--border-default)] shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border-default)]">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--warning)]/10 border border-[var(--warning)]/20">
                  <AlertTriangle className="w-5 h-5 text-[var(--warning)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    Duplicate File Detected
                  </h3>
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                    A file with this name already exists in the vault
                  </p>
                </div>
                <button
                  onClick={() => handleAction('skip')}
                  className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* File info */}
              <div className="px-5 py-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {conflict.fileName}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                      {formatSize(conflict.fileSize)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="px-5 pb-5 flex flex-col gap-2">
                <button
                  onClick={() => handleAction('replace')}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/20 text-[var(--text-primary)] hover:bg-[var(--danger)]/20 transition-colors text-left"
                >
                  <RefreshCw className="w-4 h-4 text-[var(--danger)] shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Replace</p>
                    <p className="text-xs text-[var(--text-tertiary)]">Delete the existing file and upload the new one</p>
                  </div>
                </button>

                <button
                  onClick={() => handleAction('keep-both')}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-[var(--brand-blue)]/10 border border-[var(--brand-blue)]/20 text-[var(--text-primary)] hover:bg-[var(--brand-blue)]/20 transition-colors text-left"
                >
                  <Copy className="w-4 h-4 text-[var(--brand-blue)] shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Keep Both</p>
                    <p className="text-xs text-[var(--text-tertiary)]">Upload with a numbered suffix (e.g. &quot;file (1).pdf&quot;)</p>
                  </div>
                </button>

                <button
                  onClick={() => handleAction('skip')}
                  className="flex items-center justify-center w-full px-4 py-2.5 rounded-xl text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  Skip This File
                </button>

                {/* STORY-230: Bulk actions — only show when more duplicates remain */}
                {conflict.remainingDuplicates > 0 && (
                  <>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-px bg-[var(--border-subtle)]" />
                      <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">
                        {conflict.remainingDuplicates} more duplicate{conflict.remainingDuplicates > 1 ? 's' : ''} remaining
                      </span>
                      <div className="flex-1 h-px bg-[var(--border-subtle)]" />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAction('skip-all')}
                        className="flex items-center justify-center gap-2 flex-1 px-4 py-2.5 rounded-xl text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] transition-colors"
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                        Skip All Duplicates
                      </button>
                      <button
                        onClick={() => handleAction('replace-all')}
                        className="flex items-center justify-center gap-2 flex-1 px-4 py-2.5 rounded-xl text-sm text-[var(--danger)] hover:text-white bg-[var(--danger)]/5 hover:bg-[var(--danger)]/20 border border-[var(--danger)]/20 transition-colors"
                      >
                        <RefreshCcw className="w-3.5 h-3.5" />
                        Replace All
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
