'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Mic,
  Video,
  Network,
  Layers,
  PieChart,
  Table,
  FileText,
  Presentation,
  Plus,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useVaultStore } from '@/stores/vaultStore'
import { useBrandStore, templateToFile } from '@/stores/brandStore'
import { ArtifactPreviewPane } from './ArtifactPreviewPane'
import {
  BrandDNAAccordion,
  FileSelectorModal,
  GenerationProgress,
  GenerationError,
  ArtifactResult,
  type ToneOption,
} from './StudioSubComponents'

// ============================================================================
// TYPES
// ============================================================================

type ArtifactType =
  | 'audio'
  | 'video'
  | 'mindmap'
  | 'report'
  | 'compliance'
  | 'infographic'
  | 'deck'
  | 'evidence'

type GenerationPhase = 'idle' | 'selecting' | 'generating' | 'complete' | 'error'

interface GenerationState {
  phase: GenerationPhase
  artifact: ArtifactType | null
  selectedFiles: string[]
  progress: string
  result: { name: string; url: string; preview?: string } | null
}

// ============================================================================
// ARTIFACT DEFINITIONS
// ============================================================================

const ARTIFACTS: Array<{
  type: ArtifactType
  icon: React.ElementType
  label: string
  desc: string
  color: string
}> = [
  { type: 'audio', icon: Mic, label: 'Audio Overview', desc: 'Deep Dive Podcast', color: 'cyan' },
  { type: 'video', icon: Video, label: 'Video Briefing', desc: 'Visuals + Narration', color: 'purple' },
  { type: 'mindmap', icon: Network, label: 'Mind Map', desc: 'Connection Graph', color: 'emerald' },
  { type: 'report', icon: FileText, label: 'Forensic Report', desc: 'Full Dossier (Word)', color: 'amber' },
  { type: 'compliance', icon: Layers, label: 'Compliance Drill', desc: 'Flashcards & Quiz', color: 'rose' },
  { type: 'infographic', icon: PieChart, label: 'Infographic', desc: 'Visual Summary', color: 'blue' },
  { type: 'deck', icon: Presentation, label: 'Board Deck', desc: 'PowerPoint Slides', color: 'orange' },
  { type: 'evidence', icon: Table, label: 'Evidence Log', desc: 'Excel Extract', color: 'teal' },
]

// ============================================================================
// ARTIFACT CARD
// ============================================================================

function ArtifactCard({
  artifact,
  onClick,
  disabled,
}: {
  artifact: typeof ARTIFACTS[0]
  onClick: () => void
  disabled?: boolean
}) {
  const colorClasses: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    cyan: { bg: 'bg-[var(--brand-blue)]/10', border: 'border-[var(--brand-blue)]/30', text: 'text-[var(--brand-blue)]', glow: 'shadow-[var(--brand-blue)]/20' },
    purple: { bg: 'bg-[var(--text-accent)]/10', border: 'border-[var(--text-accent)]/30', text: 'text-[var(--text-accent)]', glow: 'shadow-[var(--text-accent)]/20' },
    emerald: { bg: 'bg-[var(--success)]/10', border: 'border-[var(--success)]/30', text: 'text-[var(--success)]', glow: 'shadow-[var(--success)]/20' },
    amber: { bg: 'bg-[var(--warning)]/10', border: 'border-[var(--warning)]/30', text: 'text-[var(--warning)]', glow: 'shadow-[var(--warning)]/20' },
    rose: { bg: 'bg-[var(--danger)]/10', border: 'border-[var(--danger)]/30', text: 'text-[var(--danger)]', glow: 'shadow-[var(--danger)]/20' },
    blue: { bg: 'bg-[var(--brand-blue)]/10', border: 'border-[var(--brand-blue)]/30', text: 'text-[var(--brand-blue)]', glow: 'shadow-[var(--brand-blue)]/20' },
    orange: { bg: 'bg-[var(--warning)]/10', border: 'border-[var(--warning)]/30', text: 'text-[var(--warning)]', glow: 'shadow-[var(--warning)]/20' },
    teal: { bg: 'bg-[var(--success)]/10', border: 'border-[var(--success)]/30', text: 'text-[var(--success)]', glow: 'shadow-[var(--success)]/20' },
  }

  const colors = colorClasses[artifact.color]

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      aria-label={`Generate ${artifact.label}: ${artifact.desc}`}
      className={`
        w-full p-3 rounded-xl text-left transition-all duration-200
        bg-[var(--bg-secondary)] hover:bg-[var(--bg-elevated)]
        border border-[var(--border-default)] hover:${colors.border}
        hover:shadow-lg hover:${colors.glow}
        disabled:opacity-50 disabled:cursor-not-allowed
        group
      `}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
          <artifact.icon className={`w-5 h-5 ${colors.text}`} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">{artifact.label}</p>
          <p className="text-[10px] text-[var(--text-secondary)] truncate">{artifact.desc}</p>
        </div>
      </div>
    </motion.button>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SovereignStudio() {
  // Brand config lives in persisted brandStore (STORY-240)
  const brandTone = useBrandStore((s) => s.tone)
  const brandWordTemplate = useBrandStore((s) => s.wordTemplate)
  const brandSlideTemplate = useBrandStore((s) => s.slideTemplate)
  const [brandExpanded, setBrandExpanded] = useState(false)

  // Generation state
  const [generation, setGeneration] = useState<GenerationState>({
    phase: 'idle',
    artifact: null,
    selectedFiles: [],
    progress: '',
    result: null,
  })

  // STORY-242: Preview pane state
  const [showPreview, setShowPreview] = useState(false)

  // Upload modal state
  const [showIngestion, setShowIngestion] = useState(false)
  const uploadDocuments = useVaultStore((s) => s.uploadDocuments)

  // Handlers
  const handleArtifactClick = (type: ArtifactType) => {
    setGeneration({
      ...generation,
      phase: 'selecting',
      artifact: type,
    })
  }

  const handleFilesSelected = async (fileIds: string[]) => {
    setGeneration({
      ...generation,
      phase: 'generating',
      selectedFiles: fileIds,
    })

    try {
      // STORY-240: Include persisted letterhead templates in generation request
      const formData = new FormData()
      formData.append('artifactType', generation.artifact || '')
      formData.append('sourceDocumentIds', JSON.stringify(fileIds))
      formData.append('tone', brandTone)
      if (brandWordTemplate) {
        formData.append('wordTemplate', templateToFile(brandWordTemplate))
      }
      if (brandSlideTemplate) {
        formData.append('slideTemplate', templateToFile(brandSlideTemplate))
      }

      const response = await apiFetch('/api/studio/generate', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Generation failed')
      }

      setGeneration({
        ...generation,
        phase: 'complete',
        selectedFiles: fileIds,
        result: {
          name: data.data.fileName,
          url: data.data.downloadUrl,
          preview: data.data.previewContent || undefined,
        },
      })
    } catch (error) {
      setGeneration({
        ...generation,
        phase: 'error',
        progress: error instanceof Error ? error.message : 'Generation failed',
      })
    }
  }

  const handleDownload = () => {
    if (generation.result?.url) {
      window.open(generation.result.url, '_blank')
    }
  }

  const handleDismiss = () => {
    setGeneration({
      phase: 'idle',
      artifact: null,
      selectedFiles: [],
      progress: '',
      result: null,
    })
  }

  const currentArtifact = ARTIFACTS.find((a) => a.type === generation.artifact)

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-[var(--border-subtle)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--warning)]" />
          Sovereign Studio
        </h3>
        <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">Document Factory</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Brand DNA Configuration */}
        <BrandDNAAccordion
          isExpanded={brandExpanded}
          onToggle={() => setBrandExpanded(!brandExpanded)}
        />

        {/* Generation In Progress */}
        {generation.phase === 'generating' && currentArtifact && (
          <GenerationProgress artifactLabel={currentArtifact.label} />
        )}

        {/* Generation Error */}
        {generation.phase === 'error' && (
          <GenerationError
            message={generation.progress}
            onDismiss={handleDismiss}
          />
        )}

        {/* Artifact Result */}
        {generation.phase === 'complete' && generation.result && (
          <ArtifactResult
            name={generation.result.name}
            preview={generation.result.preview}
            artifactType={generation.artifact ?? undefined}
            onDownload={handleDownload}
            onDismiss={handleDismiss}
            onPreview={() => setShowPreview(true)}
          />
        )}

        {/* Artifact Grid */}
        {generation.phase !== 'generating' && generation.phase !== 'complete' && generation.phase !== 'error' && (
          <>
            <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">
              Select Weapon Type
            </p>
            <div className="grid grid-cols-1 gap-2">
              {ARTIFACTS.map((artifact) => (
                <ArtifactCard
                  key={artifact.type}
                  artifact={artifact}
                  onClick={() => handleArtifactClick(artifact.type)}
                  disabled={generation.phase === 'generating'}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* File Selector Modal */}
      <AnimatePresence>
        {generation.phase === 'selecting' && currentArtifact && (
          <FileSelectorModal
            isOpen={true}
            onClose={handleDismiss}
            onConfirm={handleFilesSelected}
            artifactLabel={currentArtifact.label}
            onUploadClick={() => setShowIngestion(true)}
          />
        )}
      </AnimatePresence>

      {/* Inline Ingestion Modal for Studio */}
      <AnimatePresence>
        {showIngestion && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-xl"
              onClick={() => setShowIngestion(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg bg-[var(--bg-primary)]/95 backdrop-blur-xl border border-[var(--border-default)] rounded-2xl p-6 shadow-[0_0_60px_rgba(0,0,0,0.5)]"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-[var(--warning)]/20 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-[var(--warning)]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">Upload Evidence</h3>
                  <p className="text-xs text-[var(--text-secondary)]">Add files to your vault</p>
                </div>
              </div>

              {/* Drop Zone */}
              <label className="block p-8 border-2 border-dashed border-[var(--warning)]/30 rounded-xl bg-[var(--warning)]/5 hover:bg-[var(--warning)]/10 transition-colors cursor-pointer text-center">
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || [])
                    await uploadDocuments(files)
                    setShowIngestion(false)
                  }}
                />
                <FileText className="w-12 h-12 text-[var(--warning)]/60 mx-auto mb-3" />
                <p className="text-sm text-[var(--text-primary)] font-medium mb-1">Drop files here or click to upload</p>
                <p className="text-xs text-[var(--text-tertiary)]">PDF, DOCX, TXT, XLSX supported</p>
              </label>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowIngestion(false)}
                  className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/30 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* STORY-242: Full artifact preview pane */}
      <ArtifactPreviewPane
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        onDownload={handleDownload}
        name={generation.result?.name ?? ''}
        preview={generation.result?.preview}
        artifactType={generation.artifact ?? undefined}
      />
    </div>
  )
}
