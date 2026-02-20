'use client'

import { useMemo } from 'react'
import { useVaultStore } from '@/stores/vaultStore'
import {
  FileText,
  Upload,
  Database,
  Brain,
  Clock,
} from 'lucide-react'

// ============================================================================
// STAT CARD
// ============================================================================

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: number | string
}) {
  return (
    <div className="p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/50">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-[var(--brand-blue)]" />
        <span className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
    </div>
  )
}

// ============================================================================
// FORMAT HELPERS
// ============================================================================

function formatRelativeTime(date: Date | string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '--'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ============================================================================
// DOCUMENT WORKSPACE
// ============================================================================

export function DocumentWorkspace() {
  const documents = useVaultStore((s) => s.documents)

  const recentDocs = useMemo(
    () =>
      Object.values(documents)
        .filter((d) => d.type === 'document')
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 8),
    [documents]
  )

  const totalDocs = useMemo(
    () => Object.values(documents).filter((d) => d.type === 'document').length,
    [documents]
  )

  const indexedDocs = useMemo(
    () =>
      Object.values(documents).filter(
        (d) => d.type === 'document' && (d.status === 'ready' || d.status === 'Indexed')
      ).length,
    [documents]
  )

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)] overflow-y-auto">
      {/* Welcome Header */}
      <div className="shrink-0 px-8 pt-8 pb-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Document Workspace</h1>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">Your sovereign knowledge base</p>
      </div>

      {/* Quick Stats */}
      <div className="shrink-0 px-8 pb-6">
        <div className="grid grid-cols-3 gap-4">
          <StatCard icon={Database} label="Documents" value={totalDocs} />
          <StatCard icon={Brain} label="Indexed" value={indexedDocs} />
          <StatCard icon={Clock} label="Recent" value={recentDocs.length} />
        </div>
      </div>

      {/* Recent Documents */}
      <div className="px-8 pb-6">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
          Recent Documents
        </h2>
        {recentDocs.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-[var(--border-default)] rounded-xl">
            <Upload className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
            <p className="text-sm text-[var(--text-tertiary)]">No documents yet</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Upload files to your vault to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {recentDocs.map((doc) => (
              <button
                key={doc.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-default)]
                           bg-[var(--bg-secondary)]/30 hover:bg-[var(--bg-elevated)]/50
                           text-left transition-colors group"
              >
                <FileText className="w-4 h-4 text-[var(--brand-blue)] shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--brand-blue)] transition-colors">
                    {doc.name}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {formatFileSize(doc.size)} &middot; {formatRelativeTime(doc.updatedAt)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Upload Dropzone */}
      <div className="px-8 pb-8">
        <div className="p-6 border-2 border-dashed border-[var(--border-default)] rounded-xl text-center
                        hover:border-[var(--brand-blue)]/40 transition-colors cursor-pointer">
          <Upload className="w-8 h-8 text-[var(--brand-blue)]/40 mx-auto mb-2" />
          <p className="text-sm font-medium text-[var(--text-secondary)]">Drop files here</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">or click to browse</p>
        </div>
      </div>
    </div>
  )
}
