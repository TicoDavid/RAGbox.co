'use client'

import React, { useEffect, useRef } from 'react'
import { Pencil, Trash2, FolderPlus } from 'lucide-react'

interface FolderContextMenuProps {
  x: number
  y: number
  folderId: string
  folderName: string
  onRename: () => void
  onDelete: () => void
  onNewSubfolder: () => void
  onClose: () => void
}

export function FolderContextMenu({
  x,
  y,
  onRename,
  onDelete,
  onNewSubfolder,
  onClose,
}: FolderContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

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

  const items = [
    { label: 'Rename', icon: Pencil, action: onRename },
    { label: 'New subfolder', icon: FolderPlus, action: onNewSubfolder },
    { label: 'Delete', icon: Trash2, action: onDelete, danger: true },
  ]

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] w-44 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg shadow-2xl py-1 overflow-hidden"
      style={{ top: y, left: x }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => {
            item.action()
            onClose()
          }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
            item.danger
              ? 'text-[var(--danger)] hover:bg-[var(--danger)]/10'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50'
          }`}
        >
          <item.icon className="w-3.5 h-3.5" />
          {item.label}
        </button>
      ))}
    </div>
  )
}
