'use client'

import React, { useState } from 'react'
import {
  ChevronRight,
  Plus,
  Upload,
  Brain,
  ArrowRight,
  Shield,
  LayoutGrid,
  LayoutList,
  Search,
  X,
  FolderPlus,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import type { FolderNode } from '@/types/ragbox'
import type { ViewMode } from './explorer-types'

interface CommandDeckProps {
  currentPath: string[]
  folders: Record<string, FolderNode>
  searchQuery: string
  viewMode: ViewMode
  onNavigate: (folderId: string | null) => void
  onSearchChange: (query: string) => void
  onViewModeChange: (mode: ViewMode) => void
  onNewFolder: () => void
  onUpload: () => void
  onSecurity: () => void
  onClose?: () => void
}

export function CommandDeck({
  currentPath,
  folders,
  searchQuery,
  viewMode,
  onNavigate,
  onSearchChange,
  onViewModeChange,
  onNewFolder,
  onUpload,
  onSecurity,
  onClose,
}: CommandDeckProps) {
  const [showNewMenu, setShowNewMenu] = useState(false)

  return (
    <div className="shrink-0 bg-[#0A192F] border-b border-white/10">
      {/* Breadcrumbs Row */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
        <div className="flex items-center gap-1 text-sm">
          <button
            onClick={() => onNavigate(null)}
            className="px-2 py-1 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors"
          >
            Vault
          </button>
          {currentPath.map((folderId, index) => {
            const folder = folders[folderId]
            if (!folder) return null
            return (
              <React.Fragment key={folderId}>
                <ChevronRight className="w-4 h-4 text-slate-600" />
                <button
                  onClick={() => onNavigate(folderId)}
                  className={`px-2 py-1 rounded transition-colors ${
                    index === currentPath.length - 1
                      ? 'text-white font-medium'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {folder.name}
                </button>
              </React.Fragment>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search vault..."
              className="w-64 h-8 pl-9 pr-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Toolbar Row */}
      <div className="flex items-center gap-2 px-4 py-2">
        {/* New Button with dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNewMenu(!showNewMenu)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#2463EB] hover:bg-[#3b7aff] text-white text-sm font-medium rounded-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            New
          </button>
          <AnimatePresence>
            {showNewMenu && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute top-full mt-1 left-0 z-50 w-44 bg-[#0A192F]/95 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-xl"
              >
                <button
                  onClick={() => { onNewFolder(); setShowNewMenu(false) }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-all"
                >
                  <FolderPlus className="w-4 h-4" />
                  New Folder
                </button>
                <button
                  onClick={() => { onUpload(); setShowNewMenu(false) }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-all"
                >
                  <Upload className="w-4 h-4" />
                  Upload Files
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="w-px h-6 bg-white/10" />

        {/* Action Buttons */}
        <ToolbarButton icon={<Upload className="w-4 h-4" />} label="Upload" onClick={onUpload} />
        <ToolbarButton icon={<Brain className="w-4 h-4" />} label="Vectorize" />
        <ToolbarButton icon={<ArrowRight className="w-4 h-4" />} label="Move To" />
        <ToolbarButton icon={<Shield className="w-4 h-4" />} label="Security" onClick={onSecurity} />

        <div className="flex-1" />

        {/* View Toggle */}
        <div className="flex items-center bg-white/5 rounded-lg p-0.5">
          <button
            onClick={() => onViewModeChange('list')}
            className={`p-1.5 rounded transition-all ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}
          >
            <LayoutList className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange('grid')}
            className={`p-1.5 rounded transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function ToolbarButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 text-slate-400 hover:text-white hover:bg-white/10 text-sm rounded-lg transition-all"
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  )
}
