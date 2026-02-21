'use client'

import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Upload,
  FileText,
  MessageSquare,
  Mic,
  X,
  CheckCircle2,
  Sparkles,
} from 'lucide-react'
import { useVaultStore } from '@/stores/vaultStore'
import { useChatStore } from '@/stores/chatStore'
import { isMercuryEnabled } from '@/lib/features'
import { apiFetch } from '@/lib/api'

interface OnboardingWizardProps {
  onComplete: () => void
}

const TOTAL_STEPS_WITH_MERCURY = 4
const TOTAL_STEPS_WITHOUT_MERCURY = 3

// ============================================================================
// STEP 1: Welcome
// ============================================================================

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <motion.img
        src="https://storage.googleapis.com/connexusai-assets/RAGb%C3%B6x_ICON.png"
        alt="RAGböx"
        className="w-32 h-auto mb-8 select-none"
        draggable={false}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', damping: 20 }}
      />
      <motion.h1
        className="text-3xl font-bold text-[var(--text-primary)] mb-3"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        Welcome to RAGböx
      </motion.h1>
      <motion.p
        className="text-base text-[var(--text-secondary)] max-w-md mb-10 leading-relaxed"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        Your documents are about to get a lot smarter.
      </motion.p>
      <motion.button
        onClick={onNext}
        className="flex items-center gap-2 px-8 py-3.5 bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white rounded-xl font-semibold text-base transition-colors shadow-lg shadow-[var(--brand-blue)]/25"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        Get Started
        <ArrowRight className="w-5 h-5" />
      </motion.button>
    </div>
  )
}

// ============================================================================
// STEP 2: Upload Your First Document
// ============================================================================

function UploadStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; done: boolean }[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadProgress, setUploadProgress] = useState('')
  const uploadDocument = useVaultStore((s) => s.uploadDocument)

  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return
    setIsUploading(true)
    const pending = files.map((f) => ({ name: f.name, done: false }))
    setUploadedFiles((prev) => [...prev, ...pending])

    try {
      for (let i = 0; i < files.length; i++) {
        setUploadProgress(`Uploading ${i + 1} of ${files.length}...`)
        await uploadDocument(files[i])
        setUploadedFiles((prev) =>
          prev.map((f) => f.name === files[i].name ? { ...f, done: true } : f),
        )
        // 200ms stagger between files to avoid rate-limit spikes
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
  }, [uploadDocument])

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
      <Upload className="w-10 h-10 text-[var(--brand-blue)] mb-4" />
      <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
        Upload Your First Document
      </h2>
      <p className="text-sm text-[var(--text-secondary)] mb-8 max-w-md text-center">
        Drag and drop a file, or click to browse. Supported: .pdf, .docx, .md, .txt
      </p>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false) }}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          w-full max-w-lg h-48 rounded-2xl border-2 border-dashed cursor-pointer
          flex flex-col items-center justify-center gap-3 transition-all
          ${isDragOver
            ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/10 scale-[1.02]'
            : 'border-[var(--border-default)] hover:border-[var(--brand-blue)]/50 hover:bg-[var(--bg-secondary)]'
          }
        `}
      >
        <FileText className="w-8 h-8 text-[var(--text-tertiary)]" />
        <p className="text-sm text-[var(--text-secondary)]">
          {isDragOver ? 'Drop files here' : 'Click or drag files to upload'}
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.doc,.md,.txt,.csv,.json,.xlsx,.xls"
        onChange={(e) => handleFiles(Array.from(e.target.files || []))}
        className="hidden"
      />

      {/* Uploaded file list */}
      {uploadedFiles.length > 0 && (
        <div className="w-full max-w-lg mt-4 space-y-2">
          {uploadedFiles.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]"
            >
              <FileText className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />
              <span className="text-sm text-[var(--text-primary)] truncate flex-1">{f.name}</span>
              {f.done ? (
                <CheckCircle2 className="w-4 h-4 text-[var(--success)] shrink-0" />
              ) : (
                <div className="w-4 h-4 border-2 border-[var(--brand-blue)] border-t-transparent rounded-full animate-spin shrink-0" />
              )}
            </div>
          ))}
          {uploadProgress && (
            <p className="text-xs text-[var(--brand-blue)] mt-2 text-center font-medium">{uploadProgress}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 mt-8">
        <button
          onClick={onSkip}
          className="px-6 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          Skip
        </button>
        <button
          onClick={onNext}
          disabled={isUploading}
          className={`flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-sm transition-colors ${
            hasUploaded
              ? 'bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white shadow-lg shadow-[var(--brand-blue)]/25'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
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
// STEP 3: Ask Your First Question
// ============================================================================

const SUGGESTED_QUESTIONS = [
  'Summarize this document',
  'What are the key risks?',
  'Create an executive brief',
]

function AskStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const setInputValue = useChatStore((s) => s.setInputValue)

  const handleSuggestion = (question: string) => {
    setInputValue(question)
    onNext()
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-8">
      <MessageSquare className="w-10 h-10 text-[var(--brand-blue)] mb-4" />
      <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
        Ask Your First Question
      </h2>
      <p className="text-sm text-[var(--text-secondary)] mb-8 max-w-md text-center">
        RAGböx answers from your documents with exact citations. Try one of these:
      </p>

      {/* Suggestion cards */}
      <div className="w-full max-w-lg space-y-3">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => handleSuggestion(q)}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] hover:border-[var(--brand-blue)]/50 hover:bg-[var(--brand-blue)]/5 transition-all text-left group"
          >
            <Sparkles className="w-5 h-5 text-[var(--brand-blue)] shrink-0 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium text-[var(--text-primary)]">{q}</span>
            <ArrowRight className="w-4 h-4 text-[var(--text-tertiary)] ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 mt-8">
        <button
          onClick={onSkip}
          className="px-6 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          Skip
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-sm bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors"
        >
          Continue
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// STEP 4: Meet Mercury (only if enabled)
// ============================================================================

function MercuryStep({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-blue-hover)] flex items-center justify-center mb-6 shadow-lg shadow-[var(--brand-blue)]/30">
        <Mic className="w-10 h-10 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
        Meet Mercury
      </h2>
      <p className="text-sm text-[var(--text-secondary)] max-w-md mb-3 leading-relaxed">
        Mercury is your AI assistant across every channel.
      </p>
      <p className="text-sm text-[var(--text-tertiary)] max-w-md mb-10 leading-relaxed">
        Talk, type, or email — she&apos;s always listening.
      </p>
      <button
        onClick={onFinish}
        className="flex items-center gap-2 px-8 py-3.5 bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white rounded-xl font-semibold text-base transition-colors shadow-lg shadow-[var(--brand-blue)]/25"
      >
        Finish Setup
        <CheckCircle2 className="w-5 h-5" />
      </button>
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
              ? 'w-8 h-2.5 bg-[var(--brand-blue)]'
              : i < current
                ? 'w-2.5 h-2.5 bg-[var(--brand-blue)]/40'
                : 'w-2.5 h-2.5 bg-[var(--border-default)]'
          }`}
        />
      ))}
    </div>
  )
}

// ============================================================================
// MAIN WIZARD
// ============================================================================

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0)
  const mercuryEnabled = isMercuryEnabled()
  const totalSteps = mercuryEnabled ? TOTAL_STEPS_WITH_MERCURY : TOTAL_STEPS_WITHOUT_MERCURY

  const handleComplete = useCallback(async () => {
    try {
      await apiFetch('/api/user/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true }),
      })
    } catch {
      // Continue even if API fails — don't block the user
    }
    onComplete()
  }, [onComplete])

  const next = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1)
    } else {
      handleComplete()
    }
  }

  const skip = () => next()

  // Slide animation variants
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
        className="absolute inset-0 bg-[var(--bg-primary)]/80 backdrop-blur-xl"
      />

      {/* Modal */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-2xl h-[90vh] sm:h-[540px] bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden flex flex-col"
      >
        {/* Skip / Close button (top right) */}
        {step > 0 && (
          <button
            onClick={handleComplete}
            className="absolute top-4 right-4 z-10 p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            title="Skip onboarding"
          >
            <X className="w-5 h-5" />
          </button>
        )}

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
              {step === 0 && <WelcomeStep onNext={next} />}
              {step === 1 && <UploadStep onNext={next} onSkip={skip} />}
              {step === 2 && <AskStep onNext={next} onSkip={skip} />}
              {step === 3 && mercuryEnabled && <MercuryStep onFinish={handleComplete} />}
              {step === 3 && !mercuryEnabled && (() => { handleComplete(); return null })()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Progress dots */}
        <div className="shrink-0 flex justify-center py-5 border-t border-[var(--border-subtle)]">
          <ProgressDots current={step} total={totalSteps} />
        </div>
      </motion.div>
    </div>
  )
}
