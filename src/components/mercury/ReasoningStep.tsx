'use client'

import { Check, Loader2, AlertCircle, Clock } from 'lucide-react'
import type { ReasoningStep } from '@/types/reasoning'

interface ReasoningStepProps {
  step: ReasoningStep
}

export default function ReasoningStepItem({ step }: ReasoningStepProps) {
  const statusIcon = {
    pending: <Clock size={12} className="text-[var(--text-tertiary)]" />,
    running: <Loader2 size={12} className="text-[var(--brand-blue)] animate-spin" />,
    complete: <Check size={12} className="text-[var(--success)]" />,
    error: <AlertCircle size={12} className="text-[var(--danger)]" />,
  }

  return (
    <div className="flex items-center gap-2 text-xs py-1">
      {statusIcon[step.status]}
      <span className="font-medium text-[var(--text-secondary)] min-w-[80px]">{step.label}</span>
      <span className="text-[var(--text-tertiary)] flex-1">{step.description}</span>
      {step.durationMs !== undefined && (
        <span className="text-[var(--text-tertiary)] text-[10px] tabular-nums">{step.durationMs}ms</span>
      )}
    </div>
  )
}
