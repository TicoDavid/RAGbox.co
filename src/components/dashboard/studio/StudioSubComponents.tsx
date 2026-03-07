'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  ChevronUp,
  Upload,
  FileText,
  Check,
  X,
  Download,
  Loader2,
  Shield,
  Crosshair,
  AlertCircle,
  Plus,
  Eye,
} from 'lucide-react'
import { useVaultStore } from '@/stores/vaultStore'
import { useBrandStore } from '@/stores/brandStore'
import { MindMapPreview } from './MindMapPreview'
import { MatrixRain } from '@/components/sovereignStudio/MatrixRain'

// ============================================================================
// SHARED TYPES
// ============================================================================

export type ToneOption = 'standard' | 'executive' | 'forensic'

export const TONES: Array<{ value: ToneOption; label: string }> = [
  { value: 'standard', label: 'Standard Professional' },
  { value: 'executive', label: 'Executive Brief (Terse)' },
  { value: 'forensic', label: 'Forensic Audit (Critical)' },
]

// ============================================================================
// BRAND DNA ACCORDION
// ============================================================================

export function BrandDNAAccordion({
  isExpanded,
  onToggle,
}: {
  isExpanded: boolean
  onToggle: () => void
}) {
  const wordTemplate = useBrandStore((s) => s.wordTemplate)
  const slideTemplate = useBrandStore((s) => s.slideTemplate)
  const tone = useBrandStore((s) => s.tone)
  const setWordTemplate = useBrandStore((s) => s.setWordTemplate)
  const setSlideTemplate = useBrandStore((s) => s.setSlideTemplate)
  const setTone = useBrandStore((s) => s.setTone)

  const handleFileUpload = (type: 'word' | 'slide') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (type === 'word') {
        setWordTemplate(file)
      } else {
        setSlideTemplate(file)
      }
    }
  }

  return (
    <div className="border border-[var(--border-default)] rounded-xl bg-[var(--bg-primary)]/80 overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label="Toggle brand DNA configuration"
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-elevated)]/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--warning)]/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-[var(--warning)]" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Brand DNA</p>
            <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">
              Template Configuration
              {(wordTemplate || slideTemplate) && (
                <span className="ml-1.5 text-[var(--success)]">
                  ({[wordTemplate && 'Word', slideTemplate && 'Slides'].filter(Boolean).join(' + ')} loaded)
                </span>
              )}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-[var(--text-secondary)]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
        )}
      </button>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-[var(--border-subtle)] pt-3">
              {/* Word Template */}
              <div>
                <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider block mb-2">
                  Report Letterhead (.docx)
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[var(--border-strong)] hover:border-[var(--warning)]/50 cursor-pointer transition-colors bg-[var(--bg-primary)]/50 flex-1">
                    <Upload className="w-4 h-4 text-[var(--text-secondary)]" />
                    <span className="text-xs text-[var(--text-secondary)] truncate flex-1">
                      {wordTemplate?.name || 'Upload Word Template'}
                    </span>
                    {wordTemplate && (
                      <Check className="w-4 h-4 text-[var(--success)]" />
                    )}
                    <input
                      type="file"
                      accept=".docx"
                      onChange={handleFileUpload('word')}
                      className="hidden"
                    />
                  </label>
                  {wordTemplate && (
                    <button
                      onClick={() => setWordTemplate(null)}
                      className="p-2 rounded-lg hover:bg-[var(--bg-elevated)]/30 transition-colors"
                      aria-label="Remove word template"
                    >
                      <X className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                    </button>
                  )}
                </div>
              </div>

              {/* Slide Template */}
              <div>
                <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider block mb-2">
                  Presentation Deck (.pptx)
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[var(--border-strong)] hover:border-[var(--warning)]/50 cursor-pointer transition-colors bg-[var(--bg-primary)]/50 flex-1">
                    <Upload className="w-4 h-4 text-[var(--text-secondary)]" />
                    <span className="text-xs text-[var(--text-secondary)] truncate flex-1">
                      {slideTemplate?.name || 'Upload Slide Master'}
                    </span>
                    {slideTemplate && (
                      <Check className="w-4 h-4 text-[var(--success)]" />
                    )}
                    <input
                      type="file"
                      accept=".pptx"
                      onChange={handleFileUpload('slide')}
                      className="hidden"
                    />
                  </label>
                  {slideTemplate && (
                    <button
                      onClick={() => setSlideTemplate(null)}
                      className="p-2 rounded-lg hover:bg-[var(--bg-elevated)]/30 transition-colors"
                      aria-label="Remove slide template"
                    >
                      <X className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                    </button>
                  )}
                </div>
              </div>

              {/* Tone Selector */}
              <div>
                <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider block mb-2">
                  Voice & Tone
                </label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value as ToneOption)}
                  aria-label="Voice and tone"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)]/50 border border-[var(--border-strong)] text-sm text-[var(--text-primary)] focus:border-[var(--warning)]/50 focus:outline-none transition-colors"
                >
                  {TONES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================================================
// FILE SELECTOR MODAL
// ============================================================================

export function FileSelectorModal({
  isOpen,
  onClose,
  onConfirm,
  artifactLabel,
  onUploadClick,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: (fileIds: string[]) => void
  artifactLabel: string
  onUploadClick?: () => void
}) {
  const documents = useVaultStore((s) => s.documents)
  const [selected, setSelected] = useState<string[]>([])

  const toggleFile = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    )
  }

  const handleConfirm = () => {
    onConfirm(selected)
    setSelected([])
  }

  if (!isOpen) return null

  const docs = Object.values(documents)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-xl"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-md bg-[var(--bg-primary)]/95 backdrop-blur-xl border border-[var(--border-default)] rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--warning)]/20 flex items-center justify-center">
              <Crosshair className="w-5 h-5 text-[var(--warning)]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Select Sources</h3>
              <p className="text-xs text-[var(--text-secondary)]">for {artifactLabel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--bg-elevated)]/30 transition-colors"
            aria-label="Close source selector"
          >
            <X className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* File List */}
        <div className="p-4 max-h-80 overflow-y-auto">
          {docs.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-2xl bg-[var(--warning)]/10 border border-[var(--warning)]/20 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-[var(--warning)]/60" />
              </div>
              <p className="text-base font-medium text-[var(--text-primary)] mb-1">Vault Empty</p>
              <p className="text-xs text-[var(--text-tertiary)] mb-5">Upload files to begin artifact generation</p>

              <button
                onClick={() => {
                  onClose()
                  onUploadClick?.()
                }}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[var(--warning)] to-orange-500 text-black font-semibold text-sm hover:from-[var(--warning)] hover:to-orange-400 transition-all shadow-lg shadow-[var(--warning)]/20"
                aria-label="Upload evidence files"
              >
                <Plus className="w-5 h-5" />
                Upload Evidence
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => toggleFile(doc.id)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all
                    ${selected.includes(doc.id)
                      ? 'bg-[var(--warning)]/20 border border-[var(--warning)]/30'
                      : 'bg-[var(--bg-primary)]/50 border border-[var(--border-subtle)] hover:border-[var(--border-default)]'
                    }
                  `}
                >
                  <div className={`
                    w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors
                    ${selected.includes(doc.id)
                      ? 'border-[var(--warning)] bg-[var(--warning)]'
                      : 'border-[var(--border-strong)]'
                    }
                  `}>
                    {selected.includes(doc.id) && (
                      <Check className="w-3 h-3 text-black" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--text-primary)] truncate">{doc.name}</p>
                    <p className="text-[10px] text-[var(--text-tertiary)]">
                      {((doc.size ?? 0) / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border-subtle)] flex items-center justify-between">
          <p className="text-xs text-[var(--text-tertiary)]">
            {selected.length} file{selected.length !== 1 ? 's' : ''} selected
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/30 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selected.length === 0}
              className={`
                px-5 py-2 rounded-lg text-sm font-bold transition-all
                ${selected.length > 0
                  ? 'bg-gradient-to-r from-[var(--warning)] to-orange-500 text-black hover:from-[var(--warning)] hover:to-orange-400 shadow-lg shadow-[var(--warning)]/25'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] cursor-not-allowed'
                }
              `}
            >
              Generate
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ============================================================================
// GENERATION VIEWS
// ============================================================================

const GENERATION_PHASES = [
  'Analyzing Vault...',
  'Extracting Key Insights...',
  'Applying Brand Template...',
  'Rendering Artifact...',
  'Finalizing Output...',
]

export function GenerationProgress({
  artifactLabel,
}: {
  artifactLabel: string
}) {
  const [phaseIndex, setPhaseIndex] = useState(0)

  React.useEffect(() => {
    const timer = setInterval(() => {
      setPhaseIndex((prev) => (prev + 1) % GENERATION_PHASES.length)
    }, 2000)

    return () => clearInterval(timer)
  }, [])

  return (
    <div className="relative rounded-xl overflow-hidden" style={{ minHeight: 220 }}>
      <div className="absolute inset-0">
        <MatrixRain />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center p-6 text-center" style={{ minHeight: 220 }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 mb-4"
        >
          <Loader2 className="w-12 h-12 text-[#D4A853] drop-shadow-[0_0_10px_rgba(212,168,83,0.5)]" />
        </motion.div>

        <h4 className="text-lg font-semibold text-[#D4A853] mb-2 drop-shadow-[0_0_8px_rgba(212,168,83,0.4)]">
          Manufacturing {artifactLabel}
        </h4>

        <motion.p
          key={phaseIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-[#D4A853]/80"
        >
          {GENERATION_PHASES[phaseIndex]}
        </motion.p>

        <div className="mt-5 w-48 h-1 bg-black/40 rounded-full overflow-hidden">
          <motion.div
            className="h-full w-1/3 bg-gradient-to-r from-[#D4A853] to-[#F0C674]"
            animate={{ x: ['-100%', '400%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </div>
    </div>
  )
}

export function GenerationError({
  message,
  onDismiss,
}: {
  message: string
  onDismiss: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-4 bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-xl"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-[var(--danger)]/20 flex items-center justify-center">
          <AlertCircle className="w-5 h-5 text-[var(--danger)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)]">Generation Failed</p>
          <p className="text-xs text-[var(--danger)] truncate">{message}</p>
        </div>
      </div>

      <button
        onClick={onDismiss}
        className="w-full px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] bg-[var(--bg-elevated)]/50 hover:bg-[var(--bg-elevated)] transition-colors"
        aria-label="Try generating again"
      >
        Try Again
      </button>
    </motion.div>
  )
}

export function ArtifactResult({
  name,
  preview,
  artifactType,
  onDownload,
  onDismiss,
  onPreview,
}: {
  name: string
  preview?: string
  artifactType?: string
  onDownload: () => void
  onDismiss: () => void
  onPreview: () => void
}) {
  const isMindMap = artifactType === 'mindmap' && preview

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-4 bg-[var(--success)]/10 border border-[var(--success)]/30 rounded-xl"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-[var(--success)]/20 flex items-center justify-center">
          <Check className="w-5 h-5 text-[var(--success)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)]">Artifact Ready</p>
          <p className="text-xs text-[var(--success)] truncate">{name}</p>
        </div>
      </div>

      {preview && (
        <div
          className="mb-3 p-2.5 rounded-lg bg-[var(--bg-primary)]/50 border border-[var(--border-subtle)] cursor-pointer hover:border-[var(--brand-blue)]/30 transition-colors"
          onClick={onPreview}
        >
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Preview</p>
          {isMindMap ? (
            <MindMapPreview mermaidCode={preview} title={name.replace(/\.[^.]+$/, '')} />
          ) : (
            <p className="text-xs text-[var(--text-secondary)] line-clamp-4 whitespace-pre-wrap">{preview}</p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onPreview}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--bg-elevated)] text-[var(--text-primary)] text-sm hover:bg-[var(--bg-elevated)]/80 transition-colors border border-[var(--border-default)]"
          aria-label={`Preview ${name}`}
        >
          <Eye className="w-4 h-4" />
          Preview
        </button>
        <button
          onClick={onDownload}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--warning)] text-black font-medium text-sm hover:bg-[var(--warning)] transition-colors"
          aria-label={`Download ${name}`}
        >
          <Download className="w-4 h-4" />
          {isMindMap ? 'Download HTML' : 'Download'}
        </button>
        <button
          onClick={onDismiss}
          className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/30 transition-colors"
          aria-label="Dismiss artifact result"
        >
          Dismiss
        </button>
      </div>
    </motion.div>
  )
}
