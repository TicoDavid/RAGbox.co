'use client'

/**
 * ArtifactPreviewPane — STORY-242: Preview Before Export
 *
 * Full-screen modal overlay that shows artifact preview at larger scale.
 * Supports: mind maps (Mermaid SVG), text content (scrollable), and
 * generic file downloads.
 */

import React from 'react'
import { motion } from 'framer-motion'
import { X, Download, Maximize2 } from 'lucide-react'
import { MindMapPreview } from './MindMapPreview'

interface ArtifactPreviewPaneProps {
  isOpen: boolean
  onClose: () => void
  onDownload: () => void
  name: string
  preview?: string
  artifactType?: string
}

export function ArtifactPreviewPane({
  isOpen,
  onClose,
  onDownload,
  name,
  preview,
  artifactType,
}: ArtifactPreviewPaneProps) {
  if (!isOpen) return null

  const isMindMap = artifactType === 'mindmap' && preview

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-xl"
        onClick={onClose}
      />

      {/* Preview container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-4xl max-h-[85vh] bg-[var(--bg-primary)]/95 backdrop-blur-xl border border-[var(--border-default)] rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.6)] flex flex-col"
      >
        {/* Header */}
        <div className="shrink-0 px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[var(--warning)]/20 flex items-center justify-center shrink-0">
              <Maximize2 className="w-5 h-5 text-[var(--warning)]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] truncate">{name}</h3>
              <p className="text-xs text-[var(--text-secondary)]">Artifact Preview</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onDownload}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--warning)] text-black font-medium text-sm hover:bg-[var(--warning)]/90 transition-colors"
              aria-label={`Download ${name}`}
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[var(--bg-elevated)]/30 transition-colors"
              aria-label="Close preview"
            >
              <X className="w-5 h-5 text-[var(--text-secondary)]" />
            </button>
          </div>
        </div>

        {/* Preview body */}
        <div className="flex-1 overflow-y-auto p-6">
          {isMindMap ? (
            <div className="w-full">
              <MindMapPreview mermaidCode={preview} title={name.replace(/\.[^.]+$/, '')} />
            </div>
          ) : preview ? (
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-6">
              <pre className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed font-[var(--font-inter)]">
                {preview}
              </pre>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-default)] flex items-center justify-center mb-4">
                <Download className="w-8 h-8 text-[var(--text-tertiary)]" />
              </div>
              <p className="text-sm text-[var(--text-secondary)] mb-1">Preview not available</p>
              <p className="text-xs text-[var(--text-tertiary)]">Download the file to view its contents</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
