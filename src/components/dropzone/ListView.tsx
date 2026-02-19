'use client'

import { FileText, Lock, Trash2 } from 'lucide-react'
import TierBadge from '@/components/ui/TierBadge'

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

interface ListViewProps {
  documents: DocumentItem[]
  sortField: 'name' | 'date' | 'size'
  sortOrder: 'asc' | 'desc'
  onSort: (field: 'name' | 'date' | 'size') => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  selectedId?: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ListView({
  documents,
  sortField,
  sortOrder,
  onSort,
  onSelect,
  onDelete,
  selectedId,
}: ListViewProps) {
  const SortIndicator = ({ field }: { field: string }) => {
    if (sortField !== field) return null
    return <span className="ml-1 text-[var(--brand-blue)]">{sortOrder === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border-default)] text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">
        <button onClick={() => onSort('name')} aria-label="Sort by name" className="flex-1 text-left hover:text-[var(--text-secondary)]">
          Name <SortIndicator field="name" />
        </button>
        <span className="w-12 text-center">Tier</span>
        <button onClick={() => onSort('size')} aria-label="Sort by size" className="w-16 text-right hover:text-[var(--text-secondary)]">
          Size <SortIndicator field="size" />
        </button>
        <button onClick={() => onSort('date')} aria-label="Sort by date" className="w-24 text-right hover:text-[var(--text-secondary)]">
          Date <SortIndicator field="date" />
        </button>
        <span className="w-8" />
      </div>

      <div className="divide-y divide-[var(--bg-primary)]">
        {documents.map(doc => (
          <div
            key={doc.id}
            onClick={() => onSelect(doc.id)}
            className={`flex items-center gap-2 px-3 py-2 cursor-pointer group transition-colors ${
              selectedId === doc.id ? 'bg-[var(--brand-blue)]/5' : 'hover:bg-[var(--bg-primary)]'
            }`}
          >
            <FileText size={14} className="text-[var(--text-tertiary)] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[var(--text-primary)] truncate">{doc.name}</span>
                {doc.isPrivileged && <Lock size={10} className="text-[var(--danger)] flex-shrink-0" />}
              </div>
            </div>
            <div className="w-12 flex justify-center">
              <TierBadge tier={doc.securityTier} size="sm" showLabel={false} />
            </div>
            <span className="w-16 text-right text-[10px] text-[var(--text-tertiary)] tabular-nums">
              {formatBytes(doc.size)}
            </span>
            <span className="w-24 text-right text-[10px] text-[var(--text-tertiary)]">
              {formatDate(doc.uploadedAt)}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(doc.id) }}
              aria-label={`Delete ${doc.name}`}
              className="w-8 flex justify-center opacity-0 group-hover:opacity-100 text-[var(--text-tertiary)] hover:text-[var(--danger)] transition-all"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {documents.length === 0 && (
        <div className="py-8 text-center text-xs text-[var(--text-tertiary)]">No documents found</div>
      )}
    </div>
  )
}
