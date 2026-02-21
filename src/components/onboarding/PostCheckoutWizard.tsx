'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ArrowLeft,
  Upload,
  FileText,
  Mic,
  X,
  CheckCircle2,
  Monitor,
  Headphones,
} from 'lucide-react'
import { useVaultStore } from '@/stores/vaultStore'

// ============================================================================
// TYPES
// ============================================================================

interface WizardState {
  mercuryName: string
  voiceId: string
  documentUploaded: boolean
}

const VOICES = [
  { id: 'Ashley', label: 'Ashley', desc: 'Warm, professional', default: true },
  { id: 'Dennis', label: 'Dennis', desc: 'Authoritative, deep' },
  { id: 'Luna', label: 'Luna', desc: 'Friendly, approachable' },
  { id: 'Mark', label: 'Mark', desc: 'Calm, measured' },
]

// ============================================================================
// STEP 1: Name Your Mercury + Voice Selection
// ============================================================================

function NameStep({
  state,
  onChange,
  onNext,
}: {
  state: WizardState
  onChange: (s: WizardState) => void
  onNext: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8">
      <Headphones className="w-10 h-10 text-amber-400 mb-4" />
      <h2 className="text-2xl font-bold text-white mb-2">
        Welcome to RAGböx Sovereign
      </h2>
      <p className="text-sm text-white/50 mb-8 max-w-md text-center">
        Your AI is ready. Give it a name.
      </p>

      {/* Name input */}
      <div className="w-full max-w-sm mb-8">
        <label className="block text-xs text-white/40 uppercase tracking-wider mb-2 font-medium">
          Name your Mercury
        </label>
        <input
          type="text"
          value={state.mercuryName}
          onChange={(e) => onChange({ ...state, mercuryName: e.target.value })}
          placeholder="e.g., Evelyn, Atlas, Quinn..."
          className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-white/25 text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all"
        />
      </div>

      {/* Voice selection */}
      <div className="w-full max-w-sm">
        <label className="block text-xs text-white/40 uppercase tracking-wider mb-2 font-medium">
          Voice
        </label>
        <div className="space-y-2">
          {VOICES.map((v) => (
            <button
              key={v.id}
              onClick={() => onChange({ ...state, voiceId: v.id })}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                state.voiceId === v.id
                  ? 'border-amber-500/40 bg-amber-500/[0.06]'
                  : 'border-white/[0.06] hover:border-white/10 bg-white/[0.02]'
              }`}
            >
              <div
                className={`w-3 h-3 rounded-full border-2 shrink-0 ${
                  state.voiceId === v.id
                    ? 'border-amber-400 bg-amber-400'
                    : 'border-white/20'
                }`}
              />
              <div>
                <span className="text-sm font-medium text-white">{v.label}</span>
                <span className="text-xs text-white/30 ml-2">{v.desc}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={!state.mercuryName.trim()}
        className="flex items-center gap-2 mt-8 px-8 py-3.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Next
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}

// ============================================================================
// STEP 2: Upload Your First Document
// ============================================================================

function UploadStep({
  mercuryName,
  onNext,
  onSkip,
  onBack,
}: {
  mercuryName: string
  onNext: () => void
  onSkip: () => void
  onBack: () => void
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<
    { name: string; done: boolean }[]
  >([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadDocument = useVaultStore((s) => s.uploadDocument)

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return
      setIsUploading(true)
      const pending = files.map((f) => ({ name: f.name, done: false }))
      setUploadedFiles((prev) => [...prev, ...pending])

      try {
        for (let i = 0; i < files.length; i++) {
          setUploadProgress(`Uploading ${i + 1} of ${files.length}...`)
          await uploadDocument(files[i])
          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.name === files[i].name ? { ...f, done: true } : f,
            ),
          )
          if (i < files.length - 1) {
            await new Promise((r) => setTimeout(r, 200))
          }
        }
        setUploadProgress('')
      } catch {
        setUploadProgress('')
      } finally {
        setIsUploading(false)
      }
    },
    [uploadDocument],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      handleFiles(Array.from(e.dataTransfer.files))
    },
    [handleFiles],
  )

  const hasUploaded = uploadedFiles.some((f) => f.done)

  return (
    <div className="flex flex-col items-center justify-center h-full px-8">
      <Upload className="w-10 h-10 text-amber-400 mb-4" />
      <h2 className="text-2xl font-bold text-white mb-2">
        Feed your {mercuryName}.
      </h2>
      <p className="text-sm text-white/50 mb-8 max-w-md text-center">
        Upload a document to give {mercuryName} knowledge to work with. It
        learns from your vault and uses it to answer questions with citations.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setIsDragOver(false)
        }}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`w-full max-w-lg h-40 rounded-2xl border-2 border-dashed cursor-pointer flex flex-col items-center justify-center gap-3 transition-all ${
          isDragOver
            ? 'border-amber-500 bg-amber-500/10 scale-[1.02]'
            : 'border-white/10 hover:border-amber-500/30 hover:bg-white/[0.02]'
        }`}
      >
        <FileText className="w-8 h-8 text-white/20" />
        <p className="text-sm text-white/40">
          {isDragOver ? 'Drop files here' : 'Click or drag files to upload'}
        </p>
        <p className="text-xs text-white/20">PDF, DOCX, TXT, MD (max 50MB)</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.doc,.md,.txt"
        onChange={(e) => handleFiles(Array.from(e.target.files || []))}
        className="hidden"
      />

      {/* Uploaded files */}
      {uploadedFiles.length > 0 && (
        <div className="w-full max-w-lg mt-4 space-y-2">
          {uploadedFiles.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]"
            >
              <FileText className="w-4 h-4 text-white/20 shrink-0" />
              <span className="text-sm text-white/70 truncate flex-1">
                {f.name}
              </span>
              {f.done ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
              )}
            </div>
          ))}
          {hasUploaded && (
            <p className="text-xs text-amber-400/70 text-center mt-2">
              {mercuryName} is learning...
            </p>
          )}
          {uploadProgress && (
            <p className="text-xs text-amber-400 mt-1 text-center font-medium">
              {uploadProgress}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 mt-8">
        <button
          onClick={onBack}
          className="flex items-center gap-1 px-4 py-2.5 text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
        <button
          onClick={onSkip}
          className="px-6 py-2.5 text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          Skip for now
        </button>
        <button
          onClick={onNext}
          disabled={isUploading}
          className={`flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-sm transition-all ${
            hasUploaded
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-lg shadow-amber-500/20'
              : 'bg-white/[0.06] text-white/40 hover:bg-white/[0.08]'
          }`}
        >
          Continue
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// STEP 3: Meet Your Mercury
// ============================================================================

function MeetStep({
  mercuryName,
  onFinish,
  onBack,
}: {
  mercuryName: string
  onFinish: () => void
  onBack: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mb-6 shadow-lg shadow-amber-500/30">
        <Mic className="w-10 h-10 text-black" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">
        Say hello to {mercuryName}.
      </h2>
      <p className="text-sm text-white/50 max-w-md mb-3 leading-relaxed">
        {mercuryName} is ready to work. Open the Mercury panel in your dashboard
        to start a conversation.
      </p>

      {/* Channel badges */}
      <div className="flex items-center gap-3 mb-8">
        {[
          { icon: Mic, label: 'Voice' },
          { icon: Monitor, label: 'Chat' },
        ].map((ch) => (
          <div
            key={ch.label}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 text-xs"
          >
            <ch.icon className="w-3.5 h-3.5" />
            {ch.label}
          </div>
        ))}
      </div>

      {/* Simulated greeting */}
      <div className="w-full max-w-sm p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-8 text-left">
        <p className="text-xs text-amber-400/60 font-medium mb-1">
          {mercuryName}
        </p>
        <p className="text-sm text-white/60 leading-relaxed">
          &ldquo;Hi, I&apos;m {mercuryName}. I&apos;ll be your AI assistant.
          Upload documents and ask me anything — I always cite my sources.&rdquo;
        </p>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 px-4 py-2.5 text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
        <button
          onClick={onFinish}
          className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/20"
        >
          Start Working
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// PROGRESS DOTS
// ============================================================================

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i === current
              ? 'w-8 h-2.5 bg-amber-400'
              : i < current
                ? 'w-2.5 h-2.5 bg-amber-400/40'
                : 'w-2.5 h-2.5 bg-white/10'
          }`}
        />
      ))}
    </div>
  )
}

// ============================================================================
// MAIN WIZARD
// ============================================================================

export function PostCheckoutWizard() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(0)
  const [state, setState] = useState<WizardState>({
    mercuryName: 'Mercury',
    voiceId: 'Ashley',
    documentUploaded: false,
  })

  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      setShow(true)
    }
  }, [searchParams])

  const handleComplete = useCallback(async () => {
    // Save Mercury config
    try {
      await fetch('/api/mercury/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: state.mercuryName,
          voiceId: state.voiceId,
          greeting: `Hello, I'm ${state.mercuryName}. How can I help you today?`,
        }),
      })
    } catch {
      // Backend endpoint may not exist yet — config will use defaults
    }

    // Clean URL and close wizard
    router.replace('/dashboard')
    setShow(false)
  }, [state, router])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && show) {
        handleComplete()
      }
    },
    [show, handleComplete],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!show) return null

  const slideVariants = {
    enter: { x: 80, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -80, opacity: 0 },
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-[#020408]/90 backdrop-blur-xl"
      />

      {/* Modal */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-2xl h-[90vh] sm:h-[580px] bg-[#0a0e1a] border border-amber-500/20 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden flex flex-col"
      >
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />

        {/* Close button */}
        <button
          onClick={handleComplete}
          className="absolute top-4 right-4 z-10 p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-colors"
          title="Skip setup"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Step content */}
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="h-full"
            >
              {step === 0 && (
                <NameStep
                  state={state}
                  onChange={setState}
                  onNext={() => setStep(1)}
                />
              )}
              {step === 1 && (
                <UploadStep
                  mercuryName={state.mercuryName}
                  onNext={() => setStep(2)}
                  onSkip={() => setStep(2)}
                  onBack={() => setStep(0)}
                />
              )}
              {step === 2 && (
                <MeetStep
                  mercuryName={state.mercuryName}
                  onFinish={handleComplete}
                  onBack={() => setStep(1)}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Progress dots */}
        <div className="shrink-0 flex justify-center py-5 border-t border-white/[0.04]">
          <ProgressDots current={step} total={3} />
        </div>
      </motion.div>
    </div>
  )
}
