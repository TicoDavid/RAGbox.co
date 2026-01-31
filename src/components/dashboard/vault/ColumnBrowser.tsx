'use client'

import React, { useMemo } from 'react'
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
    // Truncate path to this column and add the new folder
    const newPath = [...currentPath.slice(0, colIndex), folderId]
    navigate(newPath)
  }

  const handleSelectDocument = (docId: string) => {
    selectItem(docId)
  }

  return (
    <div className="flex-1 flex overflow-x-auto overflow-y-hidden">
      {columns.map((col, i) => (
        <BrowserColumn
          key={`${col.parentId ?? 'root'}-${i}`}
          title={col.title}
          folders={col.folders}
          documents={col.documents}
          selectedId={col.selectedId}
          onSelectFolder={(fid) => handleSelectFolder(i, fid)}
          onSelectDocument={handleSelectDocument}
        />
      ))}
    </div>
  )
}
