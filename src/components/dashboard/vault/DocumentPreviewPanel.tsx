'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { X, Eye, Info, History, FileText, Download, Loader2 } from 'lucide-react'
import { useVaultStore } from '@/stores/vaultStore'
import { DocumentDetailsTab } from './DocumentDetailsTab'
import { DocumentHistoryTab } from './DocumentHistoryTab'
import { apiFetch } from '@/lib/api'

type PreviewTab = 'preview' | 'details' | 'history'

interface DocumentPreviewPanelProps {
  documentId: string | null
  onClose: () => void
}

// ── MIME group helper ────────────────────────────────────────────────

function getMimeGroup(mimeType?: string): string {
  if (!mimeType) return 'unknown'
  if (mimeType.includes('pdf')) return 'pdf'
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.includes('text/plain') || mimeType.includes('text/markdown') || mimeType.includes('json') || mimeType.includes('csv')) return 'text'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'unknown'
}

// ── Preview Content ──────────────────────────────────────────────────

function PreviewContent({ documentId, mimeType }: { documentId: string; mimeType?: string }) {
  const [textContent, setTextContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const group = getMimeGroup(mimeType)
  const downloadUrl = `/api/documents/${documentId}/download`

  useEffect(() => {
    if (group !== 'text') return
    let cancelled = false
    setLoading(true)
    apiFetch(`/api/documents/${documentId}/preview`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Preview not available')
        const data = await res.json()
        if (!cancelled) setTextContent(data.content?.slice(0, 5000) ?? 'No content available')
      })
      .catch(() => {
        if (!cancelled) setTextContent('Preview not available yet. The preview endpoint is being built.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [documentId, group])

  switch (group) {
    case 'pdf':
      return (
        <iframe
          src={downloadUrl}
          className="w-full h-96 rounded border border-[var(--border-default)]"
          title="PDF preview"
        />
      )
    case 'image':
      return (
        <img
          src={downloadUrl}
          alt="Document preview"
          className="w-full rounded cursor-zoom-in border border-[var(--border-default)]"
        />
      )
    case 'text':
      if (loading) {
        return (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-[var(--text-tertiary)] animate-spin" />
          </div>
        )
      }
      return (
        <pre
          className="text-xs whitespace-pre-wrap text-[var(--text-secondary)] bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-[var(--radius-md)] p-3 max-h-96 overflow-y-auto"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {textContent}
        </pre>
      )
    case 'audio':
      return (
        <audio controls src={downloadUrl} className="w-full" />
      )
    default:
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <FileText className="w-10 h-10 text-[var(--text-tertiary)] opacity-40" />
          <p className="text-sm text-[var(--text-secondary)]">Preview not available</p>
          <a
            href={downloadUrl}
            download
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-md)] bg-[var(--brand-blue)] text-white text-sm font-medium hover:bg-[var(--brand-blue-hover)] transition-colors"
          >
            <Download className="w-4 h-4" />
            Download
          </a>
        </div>
      )
  }
}

// ── Tab Button ───────────────────────────────────────────────────────

function TabButton({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean
  label: string
  icon: React.FC<{ className?: string }>
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
        active ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
      {active && (
        <motion.div
          layoutId="preview-tab-indicator"
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--brand-blue)] rounded-full"
          transition={{ duration: 0.2 }}
        />
      )}
    </button>
  )
}

// ── Main Panel ───────────────────────────────────────────────────────

export function DocumentPreviewPanel({ documentId, onClose }: DocumentPreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<PreviewTab>('preview')
  const documents = useVaultStore((s) => s.documents)
  const folders = useVaultStore((s) => s.folders)
  const updateDocument = useVaultStore((s) => s.updateDocument)
  const toggleStar = useVaultStore((s) => s.toggleStar)
  const togglePrivilege = useVaultStore((s) => s.togglePrivilege)
  const fetchDocuments = useVaultStore((s) => s.fetchDocuments)

  const doc = documentId ? documents[documentId] : null

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!documentId || !doc) return null

  const handleRename = (id: string, name: string) => {
    updateDocument(id, { name } as Partial<typeof doc>)
  }

  const handleRetryIndex = (id: string) => {
    apiFetch(`/api/documents/${id}/ingest`, { method: 'POST' })
      .then(() => fetchDocuments())
      .catch(() => {})
  }

  return (
    <motion.div
      initial={{ x: 360 }}
      animate={{ x: 0 }}
      exit={{ x: 360 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="absolute right-0 top-0 bottom-0 w-[360px] bg-[var(--bg-secondary)] border-l border-[var(--border-default)] flex flex-col z-40 shadow-lg"
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)]">
        <span className="text-sm font-semibold text-[var(--text-primary)] truncate max-w-[280px]">
          {doc.name}
        </span>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
          aria-label="Close preview"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tab Bar */}
      <div className="shrink-0 flex border-b border-[var(--border-default)]">
        <TabButton active={activeTab === 'preview'} label="Preview" icon={Eye} onClick={() => setActiveTab('preview')} />
        <TabButton active={activeTab === 'details'} label="Details" icon={Info} onClick={() => setActiveTab('details')} />
        <TabButton active={activeTab === 'history'} label="History" icon={History} onClick={() => setActiveTab('history')} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'preview' && (
          <div className="p-4">
            <PreviewContent documentId={doc.id} mimeType={doc.mimeType} />
          </div>
        )}
        {activeTab === 'details' && (
          <DocumentDetailsTab
            document={doc}
            folders={folders}
            onRename={handleRename}
            onToggleStar={toggleStar}
            onTogglePrivilege={togglePrivilege}
            onRetryIndex={handleRetryIndex}
          />
        )}
        {activeTab === 'history' && (
          <DocumentHistoryTab documentId={doc.id} />
        )}
      </div>
    </motion.div>
  )
}
