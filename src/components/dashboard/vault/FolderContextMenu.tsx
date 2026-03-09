'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Pencil, Trash2, FolderPlus, Palette } from 'lucide-react'

const COLOR_PRESETS = [
  { id: 'blue', color: 'bg-blue-400' },
  { id: 'green', color: 'bg-emerald-400' },
  { id: 'amber', color: 'bg-amber-400' },
  { id: 'red', color: 'bg-red-400' },
  { id: 'purple', color: 'bg-purple-400' },
  { id: 'grey', color: 'bg-slate-400' },
]

interface FolderContextMenuProps {
  x: number
  y: number
  folderId: string
  folderName: string
  documentCount?: number
  folderColor?: string | null
  onRename: () => void
  onDelete: () => void
  onNewSubfolder: () => void
  onSetColor: (color: string | null) => void
  onClose: () => void
}

export function FolderContextMenu({
  x,
  y,
  folderName,
  documentCount = 0,
  folderColor,
  onRename,
  onDelete,
  onNewSubfolder,
  onSetColor,
  onClose,
}: FolderContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [showColorMenu, setShowColorMenu] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] w-48 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg shadow-2xl py-1 overflow-visible"
      style={{ top: y, left: x }}
    >
      <button
        onClick={() => { onNewSubfolder(); onClose() }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50 transition-colors"
      >
        <FolderPlus className="w-3.5 h-3.5" />
        New subfolder
      </button>

      <button
        onClick={() => { onRename(); onClose() }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50 transition-colors"
      >
        <Pencil className="w-3.5 h-3.5" />
        Rename
      </button>

      {/* Color submenu */}
      <div className="relative">
        <button
          onClick={() => setShowColorMenu(!showColorMenu)}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50 transition-colors"
        >
          <Palette className="w-3.5 h-3.5" />
          Color
          <span className="ml-auto text-[var(--text-tertiary)]">›</span>
        </button>
        {showColorMenu && (
          <div className="absolute left-full top-0 ml-1 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg shadow-xl p-2 flex gap-1.5 z-[101]">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => { onSetColor(preset.id); onClose() }}
                className={`w-5 h-5 rounded-full ${preset.color} hover:scale-125 transition-transform ${
                  folderColor === preset.id ? 'ring-2 ring-[var(--text-primary)] ring-offset-1 ring-offset-[var(--bg-primary)]' : ''
                }`}
                aria-label={`Set color to ${preset.id}`}
              />
            ))}
            {folderColor && (
              <button
                onClick={() => { onSetColor(null); onClose() }}
                className="w-5 h-5 rounded-full border border-[var(--border-default)] hover:scale-125 transition-transform flex items-center justify-center text-[8px] text-[var(--text-tertiary)]"
                aria-label="Remove color"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      <div className="my-1 border-t border-[var(--border-subtle)]" />

      {/* Delete with confirmation */}
      {showDeleteConfirm ? (
        <div className="px-3 py-2">
          <p className="text-xs text-[var(--text-secondary)] mb-2">
            Delete &lsquo;{folderName}&rsquo;?{documentCount > 0 && ` ${documentCount} documents will move to root.`}
          </p>
          <div className="flex gap-1.5">
            <button
              onClick={() => { onDelete(); onClose() }}
              className="flex-1 px-2 py-1 text-xs font-medium bg-[var(--danger)] text-white rounded hover:opacity-90 transition-opacity"
            >
              Delete
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 px-2 py-1 text-xs font-medium border border-[var(--border-default)] text-[var(--text-secondary)] rounded hover:bg-[var(--bg-elevated)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      )}
    </div>
  )
}
