'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  FileText,
  Folder as FolderIcon,
  Brain,
  Trash2,
  Eye,
  ShieldAlert,
} from 'lucide-react'
import { SovereignCertificate } from '../SovereignCertificate'
import { SecurityBadge, SecurityDropdown, RagIndexToggle } from '../security'
import type { SecurityTier } from '../security'
import type { VaultItem } from '@/types/ragbox'
import type { ExplorerItem, InspectorTab } from './explorer-types'
import { formatFileSize, formatDate } from './explorer-utils'

interface DeepInspectorProps {
  item: ExplorerItem | null
  vaultItem: VaultItem | null
  userName: string
  allItems: ExplorerItem[]
  onClose: () => void
  onChat: () => void
  onDelete: (id: string) => void
  onSecurityChange: (id: string, security: SecurityTier) => void
  onIndexToggle: (id: string, enabled: boolean) => void
  onSelectItem: (id: string) => void
}

export function DeepInspector({
  item,
  vaultItem,
  userName,
  allItems,
  onClose,
  onChat,
  onDelete,
  onSecurityChange,
  onIndexToggle,
  onSelectItem,
}: DeepInspectorProps) {
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('certificate')

  if (!item) {
    return (
      <div className="w-80 shrink-0 bg-[#0D1F3C] border-l border-white/10 flex flex-col h-full items-center justify-center text-center p-6">
        <Eye className="w-12 h-12 text-slate-700 mb-4" />
        <p className="text-sm text-slate-500">Select a document to inspect</p>
      </div>
    )
  }

  const isFolder = item.type === 'folder'

  return (
    <motion.aside
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 320, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="shrink-0 bg-[#0D1F3C] border-l border-white/10 overflow-hidden"
    >
      <div className="w-80 h-full flex flex-col">
        {/* Header */}
        <div className="shrink-0 p-4 border-b border-white/10 bg-gradient-to-b from-white/[0.02] to-transparent">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${
                isFolder
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-cyan-400'
              }`}>
                {isFolder ? <FolderIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate max-w-[180px]">{item.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-500 uppercase">{item.type}</span>
                  {item.isIndexed && (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Indexed
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Chat with this file button */}
          {!isFolder && (
            <button
              onClick={onChat}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[#00F0FF] hover:bg-[#00d4e0] text-black text-xs font-semibold transition-all shadow-[0_0_20px_-5px_rgba(0,240,255,0.4)]"
            >
              <Brain className="w-4 h-4" />
              Chat with this File
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="shrink-0 flex border-b border-white/10">
          {(['certificate', 'activity', 'related'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setInspectorTab(tab)}
              className={`flex-1 px-4 py-2.5 text-xs font-medium uppercase tracking-wider transition-all ${
                inspectorTab === tab
                  ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5'
                  : 'text-slate-500 hover:text-white'
              }`}
            >
              {tab === 'certificate' ? 'Custody' : tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {inspectorTab === 'certificate' && (
            <CertificateTab
              item={item}
              vaultItem={vaultItem}
              userName={userName}
              onSecurityChange={onSecurityChange}
              onIndexToggle={onIndexToggle}
              onDelete={onDelete}
            />
          )}

          {inspectorTab === 'activity' && <ActivityTab item={item} />}

          {inspectorTab === 'related' && (
            <RelatedTab
              item={item}
              allItems={allItems}
              onSelectItem={onSelectItem}
            />
          )}
        </div>
      </div>
    </motion.aside>
  )
}

// ============================================================================
// CERTIFICATE TAB
// ============================================================================

function CertificateTab({
  item,
  vaultItem,
  userName,
  onSecurityChange,
  onIndexToggle,
  onDelete,
}: {
  item: ExplorerItem
  vaultItem: VaultItem | null
  userName: string
  onSecurityChange: (id: string, security: SecurityTier) => void
  onIndexToggle: (id: string, enabled: boolean) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="space-y-4">
      {/* Sovereign Certificate */}
      {vaultItem ? (
        <SovereignCertificate document={vaultItem} userName={userName} />
      ) : (
        <div className="p-4 rounded-xl border border-amber-500/20 bg-[#020408]">
          <div className="text-center py-6">
            <ShieldAlert className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-500 mt-2">Certificate pending index</p>
          </div>
        </div>
      )}

      {/* Citation History */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/5 to-blue-500/5 border border-cyan-500/20">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Citation History</span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center py-2 border-b border-white/5">
            <span className="text-xs text-slate-400">Times Cited by Mercury</span>
            <span className="text-sm font-bold text-white">{item.citations}&times;</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-white/5">
            <span className="text-xs text-slate-400">Relevance Score</span>
            <span className="text-sm font-medium text-cyan-400">{Math.round(item.relevanceScore * 100)}%</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-xs text-slate-400">Last Queried</span>
            <span className="text-xs text-slate-500">2 hours ago</span>
          </div>
        </div>
      </div>

      {/* Quick Properties */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between py-2 border-b border-white/5">
          <span className="text-slate-500">Size</span>
          <span className="text-slate-300 font-mono">{formatFileSize(item.size)}</span>
        </div>
        <div className="flex justify-between py-2 border-b border-white/5">
          <span className="text-slate-500">Modified</span>
          <span className="text-slate-300">{formatDate(item.updatedAt)}</span>
        </div>
        <div className="flex justify-between py-2">
          <span className="text-slate-500">Security</span>
          <SecurityBadge security={item.security} />
        </div>
      </div>

      {/* Security Classification Dropdown */}
      {item.type === 'document' && (
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">
            Security Classification
          </p>
          <SecurityDropdown
            value={item.security}
            onChange={(newSecurity) => onSecurityChange(item.id, newSecurity)}
          />
        </div>
      )}

      {/* RAG Index Toggle */}
      {item.type === 'document' && (
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">
            Intelligence Controls
          </p>
          <RagIndexToggle
            enabled={item.isIndexed}
            onChange={(enabled) => onIndexToggle(item.id, enabled)}
          />
        </div>
      )}

      {/* Delete */}
      {item.type === 'document' && (
        <button
          onClick={() => onDelete(item.id)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-lg text-sm transition-colors border border-red-500/20"
        >
          <Trash2 className="w-4 h-4" />
          Delete Document
        </button>
      )}
    </div>
  )
}

// ============================================================================
// ACTIVITY TAB
// ============================================================================

function ActivityTab({ item }: { item: ExplorerItem }) {
  return (
    <div className="space-y-3">
      <ActivityItem
        action="Analyzed by Mercury"
        time="5 minutes ago"
        detail="Generated 12 new embeddings"
      />
      <ActivityItem
        action="Cited in Query"
        time="23 minutes ago"
        detail="'What are the Q4 projections?'"
      />
      <ActivityItem
        action="Uploaded by User"
        time={formatDate(item.updatedAt)}
        detail="Initial upload via drag-and-drop"
      />
      <ActivityItem
        action="Security Updated"
        time={formatDate(item.updatedAt)}
        detail={`Classification set to ${item.security}`}
      />
    </div>
  )
}

function ActivityItem({ action, time, detail }: { action: string; time: string; detail: string }) {
  return (
    <div className="p-3 rounded-lg bg-white/5 border border-white/5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium text-white">{action}</p>
        <span className="text-[10px] text-slate-500">{time}</span>
      </div>
      <p className="text-xs text-slate-400">{detail}</p>
    </div>
  )
}

// ============================================================================
// RELATED TAB
// ============================================================================

function RelatedTab({
  item,
  allItems,
  onSelectItem,
}: {
  item: ExplorerItem
  allItems: ExplorerItem[]
  onSelectItem: (id: string) => void
}) {
  const related = allItems
    .filter((f) => f.id !== item.id && f.type !== 'folder')
    .slice(0, 4)

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 mb-3">Documents with similar content</p>
      {related.map((file) => (
        <button
          key={file.id}
          onClick={() => onSelectItem(file.id)}
          className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-cyan-500/20 transition-all text-left"
        >
          <FileText className="w-4 h-4 text-slate-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-300 truncate">{file.name}</p>
            <p className="text-[10px] text-slate-600">Relevance: {Math.round(file.relevanceScore * 100)}%</p>
          </div>
        </button>
      ))}
      {related.length === 0 && (
        <p className="text-xs text-slate-600 text-center py-4">No related documents found</p>
      )}
    </div>
  )
}
