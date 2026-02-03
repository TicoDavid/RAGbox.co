'use client'

import { Check, Loader2, AlertCircle, Clock } from 'lucide-react'
import type { ReasoningStep } from '@/types/reasoning'

interface ReasoningStepProps {
  step: ReasoningStep
}

export default function ReasoningStepItem({ step }: ReasoningStepProps) {
  const statusIcon = {
    pending: <Clock size={12} className="text-[#666]" />,
    running: <Loader2 size={12} className="text-[#2463EB] animate-spin" />,
    complete: <Check size={12} className="text-green-500" />,
    error: <AlertCircle size={12} className="text-red-500" />,
  }

  return (
    <div className="flex items-center gap-2 text-xs py-1">
      {statusIcon[step.status]}
      <span className="font-medium text-[#ccc] min-w-[80px]">{step.label}</span>
      <span className="text-[#666] flex-1">{step.description}</span>
      {step.durationMs !== undefined && (
        <span className="text-[#555] text-[10px] tabular-nums">{step.durationMs}ms</span>
      )}
    </div>
  )
}
