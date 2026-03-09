'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react'
import { apiFetch } from '@/lib/api'

export type PipelineStage =
  | 'queued'
  | 'extracting'
  | 'chunking'
  | 'enriching'
  | 'embedding'
  | 'graphing'
  | 'finalizing'
  | 'complete'
  | 'failed'

interface PipelineStatusIndicatorProps {
  documentId: string
  stage: PipelineStage
  progress: number // 0-100
  error?: string
  onStatusUpdate?: (status: { stage: PipelineStage; progress: number; error?: string }) => void
}

const STAGES: { key: PipelineStage; label: string }[] = [
  { key: 'extracting', label: 'Extract' },
  { key: 'chunking', label: 'Chunk' },
  { key: 'enriching', label: 'Enrich' },
  { key: 'embedding', label: 'Embed' },
  { key: 'graphing', label: 'Graph' },
  { key: 'finalizing', label: 'Done' },
]

function getStageIndex(stage: PipelineStage): number {
  const idx = STAGES.findIndex((s) => s.key === stage)
  if (stage === 'complete') return STAGES.length
  if (stage === 'queued') return -1
  return idx
}

function StageIcon({ status, isFailed }: { status: 'complete' | 'active' | 'pending'; isFailed: boolean }) {
  if (isFailed) return <XCircle className="w-4 h-4 text-[var(--danger)]" />
  if (status === 'complete') return <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
  if (status === 'active') return <Loader2 className="w-4 h-4 text-[var(--brand-blue)] animate-spin" />
  return <Circle className="w-4 h-4 text-[var(--text-tertiary)]" />
}

export function PipelineStatusIndicator({
  documentId,
  stage,
  progress,
  error,
  onStatusUpdate,
}: PipelineStatusIndicatorProps) {
  const [localStage, setLocalStage] = useState(stage)
  const [localProgress, setLocalProgress] = useState(progress)
  const [localError, setLocalError] = useState(error)

  // Sync props
  useEffect(() => {
    setLocalStage(stage)
    setLocalProgress(progress)
    setLocalError(error)
  }, [stage, progress, error])

  // Poll pipeline status every 3s while not terminal
  useEffect(() => {
    if (localStage === 'complete' || localStage === 'failed') return
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/documents/${documentId}/pipeline-status`)
        if (res.ok) {
          const data = await res.json()
          setLocalStage(data.stage)
          setLocalProgress(data.progress ?? 0)
          setLocalError(data.error)
          onStatusUpdate?.(data)
        }
      } catch {
        // Silently retry on next interval
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [documentId, localStage, onStatusUpdate])

  const activeIndex = getStageIndex(localStage)
  const isFailed = localStage === 'failed'

  return (
    <div className="px-3 py-3">
      {/* Stage dots */}
      <div className="flex items-center justify-between">
        {STAGES.map((s, i) => {
          const isComplete = activeIndex > i
          const isActive = activeIndex === i && !isFailed
          const isFailedStage = isFailed && activeIndex === i
          const status = isComplete ? 'complete' : isActive ? 'active' : 'pending'

          return (
            <React.Fragment key={s.key}>
              {i > 0 && (
                <div className={`flex-1 h-px mx-1 ${isComplete ? 'bg-[var(--success)]' : 'bg-[var(--border-default)]'}`} />
              )}
              <motion.div
                layoutId={`pipeline-stage-${s.key}`}
                className="flex flex-col items-center gap-1"
              >
                <StageIcon status={status} isFailed={isFailedStage} />
                <span className={`text-[9px] font-medium ${
                  isActive ? 'text-[var(--brand-blue)]'
                    : isComplete ? 'text-[var(--success)]'
                      : isFailedStage ? 'text-[var(--danger)]'
                        : 'text-[var(--text-tertiary)]'
                }`}>
                  {s.label}
                </span>
              </motion.div>
            </React.Fragment>
          )
        })}
      </div>

      {/* Progress bar for active stage */}
      <AnimatePresence>
        {localStage !== 'complete' && localStage !== 'failed' && localStage !== 'queued' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2"
          >
            <div className="h-1 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-[var(--brand-blue)]"
                initial={{ width: 0 }}
                animate={{ width: `${localProgress}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </div>
            <p className="text-[10px] text-[var(--text-tertiary)] mt-1 text-center">
              {localProgress}%
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error message */}
      {isFailed && localError && (
        <p className="mt-2 text-xs text-[var(--danger)] bg-[var(--danger)]/10 rounded-md px-2 py-1">
          {localError}
        </p>
      )}
    </div>
  )
}
