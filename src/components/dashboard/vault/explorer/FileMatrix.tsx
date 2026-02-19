'use client'

import { motion } from 'framer-motion'
import {
  FileText,
  Folder as FolderIcon,
  Brain,
  Cloud,
  ArrowUpDown,
  MoreHorizontal,
  Star,
} from 'lucide-react'
import { SecurityBadge } from '../security'
import type { ExplorerItem, ViewMode, SortField } from './explorer-types'
import { formatFileSize, formatDate } from './explorer-utils'

interface FileMatrixProps {
  items: ExplorerItem[]
  viewMode: ViewMode
  selectedId: string | null
  sortField: SortField
  sortAsc: boolean
  onSelect: (id: string) => void
  onDoubleClick: (item: ExplorerItem) => void
  onToggleSort: (field: SortField) => void
  onToggleStar?: (id: string) => void
}

export function FileMatrix({
  items,
  viewMode,
  selectedId,
  sortField,
  sortAsc,
  onSelect,
  onDoubleClick,
  onToggleSort,
  onToggleStar,
}: FileMatrixProps) {
  if (viewMode === 'grid') {
    return <GridView items={items} selectedId={selectedId} onSelect={onSelect} onDoubleClick={onDoubleClick} onToggleStar={onToggleStar} />
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full">
        <thead className="sticky top-0 bg-[var(--bg-primary)] z-10">
          <tr className="text-left text-xs text-[var(--text-tertiary)] uppercase tracking-wider border-b border-[var(--border-default)]">
            <SortHeader label="Name" field="name" current={sortField} asc={sortAsc} onSort={onToggleSort} />
            <th className="px-4 py-3 font-medium w-24">Status</th>
            <SortHeader label="Security" field="security" current={sortField} asc={sortAsc} onSort={onToggleSort} className="w-28" />
            <SortHeader label="Modified" field="updatedAt" current={sortField} asc={sortAsc} onSort={onToggleSort} className="w-32" />
            <SortHeader label="Size" field="size" current={sortField} asc={sortAsc} onSort={onToggleSort} className="w-24" />
            <SortHeader label="Relevance" field="relevanceScore" current={sortField} asc={sortAsc} onSort={onToggleSort} className="w-32" />
            <th className="px-4 py-3 font-medium w-12" />
          </tr>
        </thead>
        <tbody>
          {items.map((file) => (
            <motion.tr
              key={file.id}
              onClick={() => onSelect(file.id)}
              onDoubleClick={() => onDoubleClick(file)}
              initial={false}
              animate={{
                backgroundColor: selectedId === file.id ? 'rgba(6, 182, 212, 0.08)' : 'transparent',
              }}
              className={`
                border-b border-[var(--border-subtle)] cursor-pointer transition-all duration-150
                hover:bg-[var(--bg-elevated)]/[0.03]
                ${selectedId === file.id
                  ? 'rounded-lg shadow-[inset_0_0_0_1px_rgba(6,182,212,0.3),0_0_20px_-10px_rgba(6,182,212,0.4)]'
                  : ''
                }
              `}
            >
              {/* Name */}
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {file.type === 'document' && onToggleStar && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleStar(file.id) }}
                      className="p-0.5 hover:scale-110 transition-transform shrink-0"
                      aria-label={file.isStarred ? 'Unstar' : 'Star'}
                    >
                      <Star className={`w-3.5 h-3.5 ${file.isStarred ? 'text-[var(--warning)] fill-[var(--warning)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`} />
                    </button>
                  )}
                  <div className={`shrink-0 ${file.type === 'folder' ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'}`}>
                    {file.type === 'folder' ? (
                      <FolderIcon className="w-5 h-5" />
                    ) : (
                      <FileText className="w-5 h-5" />
                    )}
                  </div>
                  <span className="text-sm text-[var(--text-primary)] font-medium truncate max-w-[300px]">
                    {file.name}
                  </span>
                </div>
              </td>

              {/* Status */}
              <td className="px-4 py-3">
                {file.type === 'document' && (
                  <div className="flex items-center gap-1.5">
                    {file.isIndexed ? (
                      <>
                        <Brain className="w-3.5 h-3.5 text-[var(--success)]" />
                        <span className="text-xs text-[var(--success)]">Indexed</span>
                      </>
                    ) : (
                      <>
                        <Cloud className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                        <span className="text-xs text-[var(--text-tertiary)]">Pending</span>
                      </>
                    )}
                  </div>
                )}
              </td>

              {/* Security */}
              <td className="px-4 py-3">
                {file.type === 'document' && <SecurityBadge security={file.security} />}
              </td>

              {/* Modified */}
              <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{formatDate(file.updatedAt)}</td>

              {/* Size */}
              <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                {file.type === 'document' ? formatFileSize(file.size) : '\u2014'}
              </td>

              {/* Relevance */}
              <td className="px-4 py-3">
                {file.type === 'document' && file.relevanceScore > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-blue-dim)] rounded-full transition-all"
                        style={{ width: `${file.relevanceScore * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-[var(--text-tertiary)]">{Math.round(file.relevanceScore * 100)}%</span>
                  </div>
                )}
              </td>

              {/* Actions */}
              <td className="px-4 py-3">
                <button className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] rounded transition-all">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </td>
            </motion.tr>
          ))}

          {items.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-16 text-center">
                <FolderIcon className="w-16 h-16 text-[var(--text-muted)] mx-auto mb-4" />
                <p className="text-base text-[var(--text-secondary)]">No files found</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ============================================================================
// GRID VIEW
// ============================================================================

function GridView({
  items,
  selectedId,
  onSelect,
  onDoubleClick,
  onToggleStar,
}: {
  items: ExplorerItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  onDoubleClick: (item: ExplorerItem) => void
  onToggleStar?: (id: string) => void
}) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="grid grid-cols-4 gap-4 p-4">
        {items.map((file) => (
          <motion.button
            key={file.id}
            onClick={() => onSelect(file.id)}
            onDoubleClick={() => onDoubleClick(file)}
            whileHover={{ scale: 1.01, y: -2 }}
            whileTap={{ scale: 0.99 }}
            className={`
              p-4 rounded-xl border text-left transition-all duration-150
              ${selectedId === file.id
                ? 'bg-[var(--brand-blue)]/10 border-[var(--brand-blue)]/40 shadow-[0_0_30px_-10px_rgba(36,99,235,0.5),inset_0_0_0_1px_rgba(36,99,235,0.2)]'
                : 'bg-[var(--bg-elevated)]/[0.03] border-[var(--border-default)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]/[0.05]'
              }
            `}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={file.type === 'folder' ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'}>
                {file.type === 'folder' ? (
                  <FolderIcon className="w-5 h-5" />
                ) : (
                  <FileText className="w-5 h-5" />
                )}
              </div>
              {file.type === 'document' && onToggleStar && (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleStar(file.id) }}
                  className="p-0.5 hover:scale-110 transition-transform"
                  aria-label={file.isStarred ? 'Unstar' : 'Star'}
                >
                  <Star className={`w-3.5 h-3.5 ${file.isStarred ? 'text-[var(--warning)] fill-[var(--warning)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`} />
                </button>
              )}
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)] truncate mb-1">{file.name}</p>
            <p className="text-xs text-[var(--text-tertiary)]">{formatDate(file.updatedAt)}</p>
            <div className="flex items-center justify-between mt-2">
              {file.type === 'document' && <SecurityBadge security={file.security} />}
              {file.citations > 0 && (
                <span className="text-[10px] text-[var(--brand-blue)]">{file.citations}&times;</span>
              )}
            </div>
          </motion.button>
        ))}

        {items.length === 0 && (
          <div className="col-span-4 flex flex-col items-center py-16">
            <FolderIcon className="w-16 h-16 text-[var(--text-muted)] mb-4" />
            <p className="text-base text-[var(--text-secondary)]">No files found</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// SORT HEADER
// ============================================================================

function SortHeader({
  label,
  field,
  current,
  asc,
  onSort,
  className = '',
}: {
  label: string
  field: SortField
  current: SortField
  asc: boolean
  onSort: (field: SortField) => void
  className?: string
}) {
  const isActive = current === field
  return (
    <th className={`px-4 py-3 font-medium ${className}`}>
      <button
        onClick={() => onSort(field)}
        className={`flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors ${isActive ? 'text-[var(--text-primary)]' : ''}`}
      >
        {label}
        <ArrowUpDown className={`w-3 h-3 ${isActive ? (asc ? 'rotate-180' : '') : 'opacity-50'}`} />
      </button>
    </th>
  )
}
