'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Upload,
  FileText,
  Presentation,
  Mic,
  Video,
  Network,
  Layers,
  PieChart,
  Table,
  Check,
  X,
  Download,
  Loader2,
  Shield,
  Crosshair,
  AlertCircle,
  Plus,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useVaultStore } from '@/stores/vaultStore'

// ============================================================================
// TYPES
// ============================================================================

type ToneOption = 'standard' | 'executive' | 'forensic'

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

interface BrandConfig {
  wordTemplate: File | null
  slideTemplate: File | null
  tone: ToneOption
}

interface GenerationState {
  phase: GenerationPhase
  artifact: ArtifactType | null
  selectedFiles: string[]
  progress: string
  result: { name: string; url: string } | null
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

const TONES: Array<{ value: ToneOption; label: string }> = [
  { value: 'standard', label: 'Standard Professional' },
  { value: 'executive', label: 'Executive Brief (Terse)' },
  { value: 'forensic', label: 'Forensic Audit (Critical)' },
]

// ============================================================================
// BRAND DNA ACCORDION
// ============================================================================

function BrandDNAAccordion({
  config,
  onChange,
  isExpanded,
  onToggle,
}: {
  config: BrandConfig
  onChange: (config: BrandConfig) => void
  isExpanded: boolean
  onToggle: () => void
}) {
  const handleFileUpload = (type: 'word' | 'slide') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onChange({
        ...config,
        [type === 'word' ? 'wordTemplate' : 'slideTemplate']: file,
      })
    }
  }

  return (
    <div className="border border-white/10 rounded-xl bg-[#0a1628]/80 overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label="Toggle brand DNA configuration"
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">Brand DNA</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Template Configuration</p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
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
            <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
              {/* Word Template */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">
                  Report Letterhead (.docx)
                </label>
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-600 hover:border-amber-500/50 cursor-pointer transition-colors bg-slate-900/50">
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-400 truncate flex-1">
                    {config.wordTemplate?.name || 'Upload Word Template'}
                  </span>
                  {config.wordTemplate && (
                    <Check className="w-4 h-4 text-emerald-400" />
                  )}
                  <input
                    type="file"
                    accept=".docx"
                    onChange={handleFileUpload('word')}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Slide Template */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">
                  Presentation Deck (.pptx)
                </label>
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-600 hover:border-amber-500/50 cursor-pointer transition-colors bg-slate-900/50">
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-400 truncate flex-1">
                    {config.slideTemplate?.name || 'Upload Slide Master'}
                  </span>
                  {config.slideTemplate && (
                    <Check className="w-4 h-4 text-emerald-400" />
                  )}
                  <input
                    type="file"
                    accept=".pptx"
                    onChange={handleFileUpload('slide')}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Tone Selector */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">
                  Voice & Tone
                </label>
                <select
                  value={config.tone}
                  onChange={(e) => onChange({ ...config, tone: e.target.value as ToneOption })}
                  aria-label="Voice and tone"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-600 text-sm text-white focus:border-amber-500/50 focus:outline-none transition-colors"
                >
                  {TONES.map((tone) => (
                    <option key={tone.value} value={tone.value}>
                      {tone.label}
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
    cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400', glow: 'shadow-cyan-500/20' },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', glow: 'shadow-purple-500/20' },
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', glow: 'shadow-emerald-500/20' },
    amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', glow: 'shadow-amber-500/20' },
    rose: { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-400', glow: 'shadow-rose-500/20' },
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', glow: 'shadow-blue-500/20' },
    orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', glow: 'shadow-orange-500/20' },
    teal: { bg: 'bg-teal-500/10', border: 'border-teal-500/30', text: 'text-teal-400', glow: 'shadow-teal-500/20' },
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
        bg-[#112240] hover:bg-[#1e3a8a]/80
        border border-white/10 hover:${colors.border}
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
          <p className="text-sm font-medium text-white truncate">{artifact.label}</p>
          <p className="text-[10px] text-slate-400 truncate">{artifact.desc}</p>
        </div>
      </div>
    </motion.button>
  )
}

// ============================================================================
// FILE SELECTOR MODAL
// ============================================================================

function FileSelectorModal({
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
      {/* Backdrop - Glass aesthetic */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-xl"
        onClick={onClose}
      />

      {/* Modal - Glass aesthetic */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-md bg-[#0a1628]/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Crosshair className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Select Sources</h3>
              <p className="text-xs text-slate-400">for {artifactLabel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Close source selector"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* File List */}
        <div className="p-4 max-h-80 overflow-y-auto">
          {docs.length === 0 ? (
            <div className="text-center py-6">
              {/* Empty Vault - CTA to upload */}
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-amber-400/60" />
              </div>
              <p className="text-base font-medium text-white mb-1">Vault Empty</p>
              <p className="text-xs text-slate-500 mb-5">Upload files to begin artifact generation</p>

              {/* Upload Evidence Button */}
              <button
                onClick={() => {
                  onClose()
                  onUploadClick?.()
                }}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold text-sm hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20"
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
                      ? 'bg-amber-500/20 border border-amber-500/30'
                      : 'bg-slate-900/50 border border-white/5 hover:border-white/10'
                    }
                  `}
                >
                  <div className={`
                    w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors
                    ${selected.includes(doc.id)
                      ? 'border-amber-400 bg-amber-400'
                      : 'border-slate-600'
                    }
                  `}>
                    {selected.includes(doc.id) && (
                      <Check className="w-3 h-3 text-black" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{doc.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {((doc.size ?? 0) / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {selected.length} file{selected.length !== 1 ? 's' : ''} selected
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selected.length === 0}
              className={`
                px-5 py-2 rounded-lg text-sm font-bold transition-all
                ${selected.length > 0
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400 shadow-lg shadow-amber-500/25'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
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
// GENERATION PROGRESS
// ============================================================================

const GENERATION_PHASES = [
  'Analyzing Vault...',
  'Extracting Key Insights...',
  'Applying Brand Template...',
  'Rendering Artifact...',
  'Finalizing Output...',
]

function GenerationProgress({
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
    <div className="p-6 text-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        className="w-16 h-16 mx-auto mb-4"
      >
        <Loader2 className="w-16 h-16 text-amber-400" />
      </motion.div>

      <h4 className="text-lg font-semibold text-white mb-2">
        Manufacturing {artifactLabel}
      </h4>

      <motion.p
        key={phaseIndex}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-sm text-amber-400"
      >
        {GENERATION_PHASES[phaseIndex]}
      </motion.p>

      {/* Indeterminate progress bar */}
      <div className="mt-6 h-1 bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full w-1/3 bg-gradient-to-r from-amber-500 to-orange-500"
          animate={{ x: ['-100%', '400%'] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
    </div>
  )
}

function GenerationError({
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
      className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
          <AlertCircle className="w-5 h-5 text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">Generation Failed</p>
          <p className="text-xs text-red-400 truncate">{message}</p>
        </div>
      </div>

      <button
        onClick={onDismiss}
        className="w-full px-4 py-2 rounded-lg text-sm text-slate-300 bg-slate-700/50 hover:bg-slate-700 transition-colors"
        aria-label="Try generating again"
      >
        Try Again
      </button>
    </motion.div>
  )
}

// ============================================================================
// ARTIFACT RESULT
// ============================================================================

function ArtifactResult({
  name,
  onDownload,
  onDismiss,
}: {
  name: string
  onDownload: () => void
  onDismiss: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
          <Check className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">Artifact Ready</p>
          <p className="text-xs text-emerald-400 truncate">{name}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onDownload}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-black font-medium text-sm hover:bg-amber-400 transition-colors"
          aria-label={`Download ${name}`}
        >
          <Download className="w-4 h-4" />
          Download
        </button>
        <button
          onClick={onDismiss}
          className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:bg-white/5 transition-colors"
          aria-label="Dismiss artifact result"
        >
          Dismiss
        </button>
      </div>
    </motion.div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SovereignStudio() {
  // Brand configuration state
  const [brandConfig, setBrandConfig] = useState<BrandConfig>({
    wordTemplate: null,
    slideTemplate: null,
    tone: 'standard',
  })
  const [brandExpanded, setBrandExpanded] = useState(false)

  // Generation state
  const [generation, setGeneration] = useState<GenerationState>({
    phase: 'idle',
    artifact: null,
    selectedFiles: [],
    progress: '',
    result: null,
  })

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
      const response = await apiFetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artifactType: generation.artifact,
          sourceDocumentIds: fileIds,
          brandConfig: {
            tone: brandConfig.tone,
            companyName: undefined,
          },
        }),
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
      <div className="shrink-0 px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          Sovereign Studio
        </h3>
        <p className="text-[10px] text-slate-500 mt-0.5">Document Factory</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Brand DNA Configuration */}
        <BrandDNAAccordion
          config={brandConfig}
          onChange={setBrandConfig}
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
            onDownload={handleDownload}
            onDismiss={handleDismiss}
          />
        )}

        {/* Artifact Grid */}
        {generation.phase !== 'generating' && generation.phase !== 'complete' && generation.phase !== 'error' && (
          <>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">
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
              className="relative w-full max-w-lg bg-[#0a1628]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-[0_0_60px_rgba(0,0,0,0.5)]"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Upload Evidence</h3>
                  <p className="text-xs text-slate-400">Add files to your vault</p>
                </div>
              </div>

              {/* Drop Zone */}
              <label className="block p-8 border-2 border-dashed border-amber-500/30 rounded-xl bg-amber-500/5 hover:bg-amber-500/10 transition-colors cursor-pointer text-center">
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
                <FileText className="w-12 h-12 text-amber-400/60 mx-auto mb-3" />
                <p className="text-sm text-white font-medium mb-1">Drop files here or click to upload</p>
                <p className="text-xs text-slate-500">PDF, DOCX, TXT, XLSX supported</p>
              </label>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowIngestion(false)}
                  className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
