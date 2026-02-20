'use client'

import { motion } from 'framer-motion'
import { Brain, FileText, Folder as FolderIcon } from 'lucide-react'
import type { ExplorerItem } from './explorer-types'

interface IntelligenceFeedProps {
  items: ExplorerItem[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function IntelligenceFeed({ items, selectedId, onSelect }: IntelligenceFeedProps) {
  return (
    <div className="shrink-0 px-4 py-3 border-b border-[var(--border-subtle)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider">
          Intelligence Feed
        </h3>
        <span className="text-xs text-[var(--text-tertiary)]">Most Cited Evidence</span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {items.length > 0 ? items.map((file) => (
          <motion.button
            key={file.id}
            onClick={() => onSelect(file.id)}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className={`shrink-0 w-48 p-3 rounded-xl border transition-all duration-150 text-left ${
              selectedId === file.id
                ? 'bg-[var(--brand-blue)]/10 border-[var(--brand-blue)]/40 shadow-[0_0_25px_-5px_rgba(var(--brand-blue-rgb),0.4)]'
                : 'bg-[var(--bg-elevated)]/[0.03] border-[var(--border-default)] hover:border-[var(--brand-blue)]/30 hover:bg-[var(--brand-blue)]/5'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={file.type === 'folder' ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'}>
                {file.type === 'folder' ? (
                  <FolderIcon className="w-4 h-4" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
              </div>
              <span className="text-xs font-medium text-[var(--text-primary)] truncate flex-1">{file.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--brand-blue)] font-bold">Cited {file.citations}&times;</span>
              <div className="w-12 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${file.relevanceScore * 100}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-blue-dim)] rounded-full"
                />
              </div>
            </div>
          </motion.button>
        )) : (
          <div className="flex items-center gap-3 px-4 py-6 text-[var(--text-tertiary)]">
            <Brain className="w-4 h-4" />
            <span className="text-sm">Upload documents to see Intelligence Feed</span>
          </div>
        )}
      </div>
    </div>
  )
}
