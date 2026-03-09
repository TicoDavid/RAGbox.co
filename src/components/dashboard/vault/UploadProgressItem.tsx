'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { FileText, Loader2, CheckCircle2, AlertTriangle, Clock, RefreshCw } from 'lucide-react'

interface UploadProgressItemProps {
  filename: string
  size: number
  status: 'queued' | 'uploading' | 'processing' | 'done' | 'error'
  progress: number
  error?: string
  onRetry?: () => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  queued: <Clock className="w-4 h-4 text-[var(--text-tertiary)]" />,
  uploading: <Loader2 className="w-4 h-4 text-[var(--brand-blue)] animate-spin" />,
  processing: <Loader2 className="w-4 h-4 text-[var(--warning)] animate-spin" />,
  done: <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />,
  error: <AlertTriangle className="w-4 h-4 text-[var(--danger)]" />,
}

export function UploadProgressItem({
  filename,
  size,
  status,
  progress,
  error,
  onRetry,
}: UploadProgressItemProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border-subtle)] last:border-b-0">
      {/* File icon */}
      <FileText className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />

      {/* File info + progress */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-xs text-[var(--text-primary)] truncate font-medium">{filename}</span>
          <span className="text-[10px] text-[var(--text-tertiary)] shrink-0">{formatSize(size)}</span>
        </div>

        {/* Progress bar */}
        {(status === 'uploading' || status === 'processing') && (
          <div className="h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-[var(--brand-blue)]"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
        )}

        {/* Error message */}
        {status === 'error' && error && (
          <p className="text-[10px] text-[var(--danger)] mt-0.5 truncate">{error}</p>
        )}
      </div>

      {/* Status icon + action */}
      <div className="flex items-center gap-1.5 shrink-0">
        {STATUS_ICONS[status]}

        {status === 'uploading' && (
          <span className="text-[10px] text-[var(--text-tertiary)] w-8 text-right">{progress}%</span>
        )}

        {status === 'error' && onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--danger)]/10 text-[var(--danger)] hover:bg-[var(--danger)]/20 transition-colors"
            aria-label={`Retry uploading ${filename}`}
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        )}
      </div>
    </div>
  )
}
