'use client'

import React, { useMemo, useCallback } from 'react'
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { FileText } from 'lucide-react'
import { useVaultStore } from '@/stores/vaultStore'
import { BrowserColumn } from './BrowserColumn'
import type { VaultItem, FolderNode } from '@/types/ragbox'

export function ColumnBrowser() {
  const documents = useVaultStore((s) => s.documents)
  const folders = useVaultStore((s) => s.folders)
  const currentPath = useVaultStore((s) => s.currentPath)
  const selectedItemId = useVaultStore((s) => s.selectedItemId)
  const navigate = useVaultStore((s) => s.navigate)
  const selectItem = useVaultStore((s) => s.selectItem)
  const moveDocument = useVaultStore((s) => s.moveDocument)

  const [activeDoc, setActiveDoc] = React.useState<VaultItem | null>(null)

  // DnD sensors — require 5px movement to start drag (prevents accidental drags)
  const mouseSensor = useSensor(MouseSensor, { activationConstraint: { distance: 5 } })
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  const sensors = useSensors(mouseSensor, touchSensor)

  // Build columns from path
  const columns = useMemo(() => {
    const cols: Array<{
      title: string
      parentId: string | undefined
      folders: FolderNode[]
      documents: VaultItem[]
      selectedId: string | null
    }> = []

    // Root column: items with no parent
    const rootFolders = Object.values(folders).filter(f => !f.parentId)
    const rootDocs = Object.values(documents).filter(d => !d.folderId && d.deletionStatus === 'Active')

    const rootSelectedId = currentPath.length > 0 ? currentPath[0] : selectedItemId
    cols.push({
      title: 'Vault',
      parentId: undefined,
      folders: rootFolders,
      documents: rootDocs,
      selectedId: rootSelectedId,
    })

    // Subsequent columns from path
    for (let i = 0; i < currentPath.length; i++) {
      const folderId = currentPath[i]
      const folder = folders[folderId]
      if (!folder) break

      const childFolders = Object.values(folders).filter(f => f.parentId === folderId)
      const childDocs = Object.values(documents).filter(
        d => d.folderId === folderId && d.deletionStatus === 'Active'
      )

      const nextSelectedId = i < currentPath.length - 1
        ? currentPath[i + 1]
        : selectedItemId
      cols.push({
        title: folder.name,
        parentId: folderId,
        folders: childFolders,
        documents: childDocs,
        selectedId: nextSelectedId,
      })
    }

    return cols
  }, [documents, folders, currentPath, selectedItemId])

  const handleSelectFolder = (colIndex: number, folderId: string) => {
    const newPath = [...currentPath.slice(0, colIndex), folderId]
    navigate(newPath)
  }

  const handleSelectDocument = (docId: string) => {
    selectItem(docId)
  }

  // ── DnD handlers ──
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current
    if (data?.type === 'document' && data.docId) {
      setActiveDoc(documents[data.docId as string] ?? null)
    }
  }, [documents])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDoc(null)

    const { active, over } = event
    if (!over) return

    const activeData = active.data.current
    const overData = over.data.current
    if (!activeData || !overData) return

    // Only handle document → folder moves
    if (activeData.type !== 'document' || overData.type !== 'folder') return

    const docId = activeData.docId as string
    const targetFolderId = overData.folderId as string | null
    const doc = documents[docId]

    // Skip if already in this folder
    if (doc && (doc.folderId ?? null) === targetFolderId) return

    moveDocument(docId, targetFolderId)
  }, [documents, moveDocument])

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 flex overflow-x-auto overflow-y-hidden">
        {columns.map((col, i) => (
          <BrowserColumn
            key={`${col.parentId ?? 'root'}-${i}`}
            title={col.title}
            parentId={col.parentId}
            folders={col.folders}
            documents={col.documents}
            selectedId={col.selectedId}
            onSelectFolder={(fid) => handleSelectFolder(i, fid)}
            onSelectDocument={handleSelectDocument}
          />
        ))}
      </div>

      {/* Drag overlay — ghost showing the dragged file */}
      <DragOverlay>
        {activeDoc && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--brand-blue)]/40 shadow-xl">
            <FileText className="w-4 h-4 text-[var(--brand-blue)]" />
            <span className="text-sm text-[var(--text-primary)] max-w-[160px] truncate">
              {activeDoc.name}
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
