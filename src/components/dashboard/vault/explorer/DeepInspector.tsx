'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  FileText,
  Folder as FolderIcon,
  Brain,
  Trash2,
  Eye,
  ShieldAlert,
  Download,
  ScrollText,
  ShieldCheck,
  Star,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
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
  onDownload: (id: string) => void
  onAuditLog: (id: string) => void
  onVerifyIntegrity: (id: string) => void
  onToggleStar?: (id: string) => void
}

export function DeepInspector({
  item,
  vaultItem,
  userName,
  allItems: _allItems,
  onClose,
  onChat,
  onDelete,
  onSecurityChange,
  onIndexToggle,
  onSelectItem,
  onDownload,
  onAuditLog,
  onVerifyIntegrity,
  onToggleStar,
}: DeepInspectorProps) {
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('certificate')

  if (!item) {
    return (
      <div className="w-80 shrink-0 bg-[var(--bg-secondary)] border-l border-[var(--border-default)] flex flex-col h-full items-center justify-center text-center p-6">
        <Eye className="w-12 h-12 text-[var(--text-muted)] mb-4" />
        <p className="text-sm text-[var(--text-tertiary)]">Select a document to inspect</p>
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
      className="shrink-0 bg-[var(--bg-secondary)] border-l border-[var(--border-default)] overflow-hidden"
    >
      <div className="w-80 h-full flex flex-col">
        {/* Header */}
        <div className="shrink-0 p-4 border-b border-[var(--border-default)] bg-gradient-to-b from-[var(--bg-elevated)]/10 to-transparent">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${
                isFolder
                  ? 'bg-[var(--warning)]/20 text-[var(--warning)]'
                  : 'bg-gradient-to-br from-[var(--brand-blue)]/20 to-[var(--brand-blue)]/20 text-[var(--brand-blue)]'
              }`}>
                {isFolder ? <FolderIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)] truncate max-w-[180px]">{item.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-[var(--text-tertiary)] uppercase">{item.type}</span>
                  {item.isIndexed && (
                    <span className="flex items-center gap-1 text-[10px] text-[var(--success)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                      Indexed
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {!isFolder && onToggleStar && (
                <button
                  onClick={() => onToggleStar(item.id)}
                  className="p-1.5 hover:bg-[var(--bg-elevated)] rounded-lg transition-all"
                  aria-label={item.isStarred ? 'Unstar' : 'Star'}
                >
                  <Star className={`w-4 h-4 ${item.isStarred ? 'text-[var(--warning)] fill-[var(--warning)]' : 'text-[var(--text-tertiary)] hover:text-[var(--warning)]'}`} />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat with this file button */}
          {!isFolder && (
            <button
              onClick={onChat}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-[var(--text-primary)] text-xs font-semibold transition-all shadow-[0_0_20px_-5px_rgba(var(--brand-blue-rgb),0.4)]"
            >
              <Brain className="w-4 h-4" />
              Chat with this File
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="shrink-0 flex border-b border-[var(--border-default)]">
          {(['certificate', 'activity', 'related'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setInspectorTab(tab)}
              className={`flex-1 px-4 py-2.5 text-xs font-medium uppercase tracking-wider transition-all ${
                inspectorTab === tab
                  ? 'text-[var(--brand-blue)] border-b-2 border-[var(--brand-blue)] bg-[var(--brand-blue)]/5'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
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
              onDownload={onDownload}
              onAuditLog={onAuditLog}
              onVerifyIntegrity={onVerifyIntegrity}
            />
          )}

          {inspectorTab === 'activity' && <ActivityTab item={item} />}

          {inspectorTab === 'related' && <RelatedTab item={item} onSelectItem={onSelectItem} />}
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
  onDownload,
  onAuditLog,
  onVerifyIntegrity,
}: {
  item: ExplorerItem
  vaultItem: VaultItem | null
  userName: string
  onSecurityChange: (id: string, security: SecurityTier) => void
  onIndexToggle: (id: string, enabled: boolean) => void
  onDelete: (id: string) => void
  onDownload: (id: string) => void
  onAuditLog: (id: string) => void
  onVerifyIntegrity: (id: string) => void
}) {
  return (
    <div className="space-y-4">
      {/* Sovereign Certificate */}
      {vaultItem ? (
        <SovereignCertificate document={vaultItem} userName={userName} />
      ) : (
        <div className="p-4 rounded-xl border border-[var(--warning)]/20 bg-[var(--bg-primary)]">
          <div className="text-center py-6">
            <ShieldAlert className="w-8 h-8 text-[var(--text-muted)] mx-auto" />
            <p className="text-xs text-[var(--text-tertiary)] mt-2">Certificate pending index</p>
          </div>
        </div>
      )}

      {/* Citation History */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-[var(--brand-blue)]/5 to-[var(--brand-blue)]/5 border border-[var(--brand-blue)]/20">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-[var(--brand-blue)]" />
          <span className="text-xs font-bold text-[var(--brand-blue)] uppercase tracking-wider">Citation History</span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center py-2 border-b border-[var(--border-subtle)]">
            <span className="text-xs text-[var(--text-secondary)]">Times Cited by Mercury</span>
            <span className="text-sm font-bold text-[var(--text-primary)]">{item.citations}&times;</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-[var(--border-subtle)]">
            <span className="text-xs text-[var(--text-secondary)]">Relevance Score</span>
            <span className="text-sm font-medium text-[var(--brand-blue)]">{Math.round(item.relevanceScore * 100)}%</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-xs text-[var(--text-secondary)]">Last Queried</span>
            <span className="text-xs text-[var(--text-tertiary)]">2 hours ago</span>
          </div>
        </div>
      </div>

      {/* Quick Properties */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between py-2 border-b border-[var(--border-subtle)]">
          <span className="text-[var(--text-tertiary)]">Size</span>
          <span className="text-[var(--text-secondary)] font-mono">{formatFileSize(item.size)}</span>
        </div>
        <div className="flex justify-between py-2 border-b border-[var(--border-subtle)]">
          <span className="text-[var(--text-tertiary)]">Modified</span>
          <span className="text-[var(--text-secondary)]">{formatDate(item.updatedAt)}</span>
        </div>
        <div className="flex justify-between py-2">
          <span className="text-[var(--text-tertiary)]">Security</span>
          <SecurityBadge security={item.security} />
        </div>
      </div>

      {/* Security Classification Dropdown */}
      {item.type === 'document' && (
        <div>
          <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider font-semibold mb-2">
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
          <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider font-semibold mb-2">
            Intelligence Controls
          </p>
          <RagIndexToggle
            enabled={item.isIndexed}
            onChange={(enabled) => onIndexToggle(item.id, enabled)}
          />
        </div>
      )}

      {/* Document Actions */}
      {item.type === 'document' && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider font-semibold mb-2">
            Actions
          </p>
          <button
            onClick={() => onDownload(item.id)}
            className="w-full flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-elevated)]/30 hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] rounded-lg text-sm transition-colors border border-[var(--border-default)]"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
          <button
            onClick={() => onAuditLog(item.id)}
            className="w-full flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-elevated)]/30 hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] rounded-lg text-sm transition-colors border border-[var(--border-default)]"
          >
            <ScrollText className="w-4 h-4" />
            Audit Log
          </button>
          <button
            onClick={() => onVerifyIntegrity(item.id)}
            className="w-full flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-elevated)]/30 hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] rounded-lg text-sm transition-colors border border-[var(--border-default)]"
          >
            <ShieldCheck className="w-4 h-4" />
            Verify Integrity
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--danger)]/20 hover:bg-[var(--danger)]/40 text-[var(--danger)] rounded-lg text-sm transition-colors border border-[var(--danger)]/20"
          >
            <Trash2 className="w-4 h-4" />
            Delete Document
          </button>
        </div>
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
        action="Uploaded"
        time={formatDate(item.updatedAt)}
        detail={`${item.name} (${(item.size / 1024).toFixed(1)} KB)`}
      />
      <ActivityItem
        action="Security Classification"
        time={formatDate(item.updatedAt)}
        detail={`Set to ${item.security}`}
      />
      {item.isIndexed && (
        <ActivityItem
          action="Indexed"
          time={formatDate(item.updatedAt)}
          detail="Embeddings generated and stored"
        />
      )}
      {item.citations > 0 && (
        <ActivityItem
          action="Mercury Citations"
          time={formatDate(item.updatedAt)}
          detail={`Referenced ${item.citations} time${item.citations === 1 ? '' : 's'} in queries`}
        />
      )}
    </div>
  )
}

function ActivityItem({ action, time, detail }: { action: string; time: string; detail: string }) {
  return (
    <div className="p-3 rounded-lg bg-[var(--bg-elevated)]/30 border border-[var(--border-subtle)]">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium text-[var(--text-primary)]">{action}</p>
        <span className="text-[10px] text-[var(--text-tertiary)]">{time}</span>
      </div>
      <p className="text-xs text-[var(--text-secondary)]">{detail}</p>
    </div>
  )
}

interface RelatedDoc {
  document: {
    id: string
    originalName: string
    filename: string
    fileType: string
    chunkCount: number
    mimeType: string
  }
  similarity: number
}

function RelatedTab({ item, onSelectItem }: { item: ExplorerItem; onSelectItem: (id: string) => void }) {
  const [related, setRelated] = useState<RelatedDoc[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!item?.id || item.type === 'folder') return

    let cancelled = false
    setLoading(true)
    setError(null)

    apiFetch(`/api/documents/${item.id}/related?limit=5`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load related documents')
        const json = await res.json()
        if (!cancelled) {
          setRelated(json.data?.related ?? [])
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [item?.id, item?.type])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-[var(--brand-blue)] animate-spin mb-2" />
        <p className="text-xs text-[var(--text-tertiary)]">Finding related documents...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <AlertCircle className="w-6 h-6 text-[var(--danger)] mb-2" />
        <p className="text-xs text-[var(--text-tertiary)]">{error}</p>
      </div>
    )
  }

  if (related.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-[var(--brand-blue)]/10 flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-[var(--brand-blue)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
          </svg>
        </div>
        <p className="text-sm font-medium text-[var(--text-primary)] mb-1">No Related Documents</p>
        <p className="text-xs text-[var(--text-tertiary)] max-w-[200px] leading-relaxed">
          Upload more documents to see vector similarity matches.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {related.map((rel) => (
        <button
          key={rel.document.id}
          onClick={() => onSelectItem(rel.document.id)}
          className="w-full text-left p-3 rounded-lg bg-[var(--bg-elevated)]/30 border border-[var(--border-subtle)] hover:border-[var(--brand-blue)]/30 hover:bg-[var(--bg-elevated)] transition-all group cursor-pointer"
        >
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-[var(--brand-blue)]/10 shrink-0 mt-0.5 group-hover:bg-[var(--brand-blue)]/20 transition-colors">
              <FileText className="w-3.5 h-3.5 text-[var(--brand-blue)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--brand-blue)] transition-colors">
                {rel.document.originalName || rel.document.filename}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] uppercase text-[var(--text-tertiary)]">
                  {rel.document.fileType || 'doc'}
                </span>
                {rel.document.chunkCount > 0 && (
                  <span className="text-[10px] text-[var(--text-tertiary)]">
                    {rel.document.chunkCount} chunks
                  </span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-sm font-bold text-[var(--brand-blue)]">
                {Math.round(rel.similarity * 100)}%
              </span>
              <p className="text-[9px] text-[var(--text-tertiary)] uppercase">match</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
