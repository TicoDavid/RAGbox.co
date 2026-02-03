'use client'

import { useState } from 'react'
import FolderNode from './FolderNode'

export interface FolderItem {
  id: string
  name: string
  parentId: string | null
  children: FolderItem[]
  documentCount: number
}

interface FolderTreeProps {
  folders: FolderItem[]
  selectedFolderId: string | null
  onSelectFolder: (folderId: string | null) => void
  onCreateFolder: (name: string, parentId: string | null) => void
  onRenameFolder: (id: string, name: string) => void
  onDeleteFolder: (id: string) => void
}

export default function FolderTree({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: FolderTreeProps) {
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)

  const rootFolders = folders.filter(f => f.parentId === null)

  const handleCreate = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim(), selectedFolderId)
      setNewFolderName('')
      setShowNewFolder(false)
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between px-2 py-1.5 mb-1">
        <span className="text-[10px] font-semibold text-[#888] uppercase tracking-wider">Folders</span>
        <button
          onClick={() => setShowNewFolder(!showNewFolder)}
          className="text-[10px] text-[#2463EB] hover:text-[#1D4ED8]"
        >
          + New
        </button>
      </div>

      {showNewFolder && (
        <div className="px-2 mb-2 flex gap-1">
          <input
            type="text"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Folder name"
            className="flex-1 text-xs px-2 py-1 rounded bg-[#111] border border-[#333] text-white placeholder:text-[#555] focus:border-[#2463EB] focus:outline-none"
            autoFocus
          />
          <button
            onClick={handleCreate}
            className="text-xs px-2 py-1 rounded bg-[#2463EB]/20 text-[#2463EB] hover:bg-[#2463EB]/30"
          >
            Add
          </button>
        </div>
      )}

      <button
        onClick={() => onSelectFolder(null)}
        className={`w-full text-left px-3 py-1.5 text-xs rounded transition-colors ${
          selectedFolderId === null ? 'bg-[#2463EB]/10 text-[#2463EB]' : 'text-[#888] hover:text-white hover:bg-[#111]'
        }`}
      >
        All Documents
      </button>

      <div className="mt-1 space-y-0.5">
        {rootFolders.map(folder => (
          <FolderNode
            key={folder.id}
            folder={folder}
            depth={0}
            selectedId={selectedFolderId}
            onSelect={onSelectFolder}
            onRename={onRenameFolder}
            onDelete={onDeleteFolder}
          />
        ))}
      </div>
    </div>
  )
}
