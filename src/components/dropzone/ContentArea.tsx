'use client'

import { useState } from 'react'
import { List, Grid } from 'lucide-react'
import ListView from './ListView'
import GridView from './GridView'

interface DocumentItem {
  id: string
  name: string
  size: number
  type: string
  uploadedAt: string
  status: string
  securityTier: number
  isPrivileged: boolean
}

interface ContentAreaProps {
  documents: DocumentItem[]
  onSelectDocument: (id: string) => void
  onDeleteDocument: (id: string) => void
  selectedDocumentId?: string
}

export default function ContentArea({
  documents,
  onSelectDocument,
  onDeleteDocument,
  selectedDocumentId,
}: ContentAreaProps) {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [sortField, setSortField] = useState<'name' | 'date' | 'size'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const handleSort = (field: 'name' | 'date' | 'size') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder(field === 'name' ? 'asc' : 'desc')
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#222]">
        <span className="text-xs text-[#888]">{documents.length} documents</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('list')}
            className={`p-1 rounded ${viewMode === 'list' ? 'bg-[#00F0FF]/10 text-[#00F0FF]' : 'text-[#666] hover:text-white'}`}
          >
            <List size={14} />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1 rounded ${viewMode === 'grid' ? 'bg-[#00F0FF]/10 text-[#00F0FF]' : 'text-[#666] hover:text-white'}`}
          >
            <Grid size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {viewMode === 'list' ? (
          <ListView
            documents={documents}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            onSelect={onSelectDocument}
            onDelete={onDeleteDocument}
            selectedId={selectedDocumentId}
          />
        ) : (
          <GridView
            documents={documents}
            onSelect={onSelectDocument}
            selectedId={selectedDocumentId}
          />
        )}
      </div>
    </div>
  )
}
