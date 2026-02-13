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
        <thead className="sticky top-0 bg-[#0A192F] z-10">
          <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-white/10">
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
                border-b border-white/5 cursor-pointer transition-all duration-150
                hover:bg-white/[0.03]
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
                      <Star className={`w-3.5 h-3.5 ${file.isStarred ? 'text-amber-400 fill-amber-400' : 'text-slate-600 hover:text-slate-400'}`} />
                    </button>
                  )}
                  <div className={`shrink-0 ${file.type === 'folder' ? 'text-amber-400' : 'text-slate-400'}`}>
                    {file.type === 'folder' ? (
                      <FolderIcon className="w-5 h-5" />
                    ) : (
                      <FileText className="w-5 h-5" />
                    )}
                  </div>
                  <span className="text-sm text-white font-medium truncate max-w-[300px]">
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
                        <Brain className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-xs text-emerald-400">Indexed</span>
                      </>
                    ) : (
                      <>
                        <Cloud className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-xs text-slate-500">Pending</span>
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
              <td className="px-4 py-3 text-sm text-slate-400">{formatDate(file.updatedAt)}</td>

              {/* Size */}
              <td className="px-4 py-3 text-sm text-slate-400">
                {file.type === 'document' ? formatFileSize(file.size) : '\u2014'}
              </td>

              {/* Relevance */}
              <td className="px-4 py-3">
                {file.type === 'document' && file.relevanceScore > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all"
                        style={{ width: `${file.relevanceScore * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500">{Math.round(file.relevanceScore * 100)}%</span>
                  </div>
                )}
              </td>

              {/* Actions */}
              <td className="px-4 py-3">
                <button className="p-1 text-slate-500 hover:text-white hover:bg-white/10 rounded transition-all">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </td>
            </motion.tr>
          ))}

          {items.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-16 text-center">
                <FolderIcon className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                <p className="text-base text-slate-400">No files found</p>
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
                ? 'bg-cyan-500/10 border-cyan-500/40 shadow-[0_0_30px_-10px_rgba(6,182,212,0.5),inset_0_0_0_1px_rgba(6,182,212,0.2)]'
                : 'bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.05]'
              }
            `}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={file.type === 'folder' ? 'text-amber-400' : 'text-slate-400'}>
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
                  <Star className={`w-3.5 h-3.5 ${file.isStarred ? 'text-amber-400 fill-amber-400' : 'text-slate-600 hover:text-slate-400'}`} />
                </button>
              )}
            </div>
            <p className="text-sm font-medium text-white truncate mb-1">{file.name}</p>
            <p className="text-xs text-slate-500">{formatDate(file.updatedAt)}</p>
            <div className="flex items-center justify-between mt-2">
              {file.type === 'document' && <SecurityBadge security={file.security} />}
              {file.citations > 0 && (
                <span className="text-[10px] text-cyan-400">{file.citations}&times;</span>
              )}
            </div>
          </motion.button>
        ))}

        {items.length === 0 && (
          <div className="col-span-4 flex flex-col items-center py-16">
            <FolderIcon className="w-16 h-16 text-slate-700 mb-4" />
            <p className="text-base text-slate-400">No files found</p>
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
        className={`flex items-center gap-1 hover:text-white transition-colors ${isActive ? 'text-white' : ''}`}
      >
        {label}
        <ArrowUpDown className={`w-3 h-3 ${isActive ? (asc ? 'rotate-180' : '') : 'opacity-50'}`} />
      </button>
    </th>
  )
}
