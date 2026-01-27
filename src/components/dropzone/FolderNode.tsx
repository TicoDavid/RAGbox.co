'use client'

import { useState } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, Trash2 } from 'lucide-react'
import type { FolderItem } from './FolderTree'

interface FolderNodeProps {
  folder: FolderItem
  depth: number
  selectedId: string | null
  onSelect: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}

export default function FolderNode({
  folder,
  depth,
  selectedId,
  onSelect,
  onRename,
  onDelete,
}: FolderNodeProps) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(folder.name)

  const isSelected = selectedId === folder.id
  const hasChildren = folder.children.length > 0

  const handleRename = () => {
    if (editName.trim() && editName !== folder.name) {
      onRename(folder.id, editName.trim())
    }
    setEditing(false)
  }

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer group transition-colors ${
          isSelected ? 'bg-[#00F0FF]/10 text-[#00F0FF]' : 'text-[#888] hover:text-white hover:bg-[#111]'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(folder.id)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
            className="p-0.5"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {isSelected || expanded ? (
          <FolderOpen size={14} className="text-[#00F0FF] flex-shrink-0" />
        ) : (
          <Folder size={14} className="flex-shrink-0" />
        )}

        {editing ? (
          <input
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={e => e.key === 'Enter' && handleRename()}
            className="flex-1 text-xs bg-transparent border-b border-[#00F0FF] text-white focus:outline-none"
            autoFocus
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span
            className="flex-1 text-xs truncate"
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true) }}
          >
            {folder.name}
          </span>
        )}

        <span className="text-[10px] text-[#555]">{folder.documentCount}</span>

        <button
          onClick={(e) => { e.stopPropagation(); onDelete(folder.id) }}
          className="opacity-0 group-hover:opacity-100 p-0.5 text-[#666] hover:text-red-500 transition-all"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {expanded && hasChildren && (
        <div>
          {folder.children.map(child => (
            <FolderNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
