'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Brain } from 'lucide-react'
import type { ReasoningTrace } from '@/types/reasoning'
import ReasoningStepItem from './ReasoningStep'
import ConfidenceBadge from './ConfidenceBadge'

interface ReasoningPanelProps {
  trace: ReasoningTrace
  defaultExpanded?: boolean
}

export default function ReasoningPanel({ trace, defaultExpanded = false }: ReasoningPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className="mt-2 rounded-lg border border-[var(--border-default)] bg-black/30 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Brain size={14} className="text-[var(--brand-blue)]" />
        <span className="font-medium">Reasoning Trace</span>
        <span className="text-[var(--text-tertiary)]">({trace.steps.length} steps, {trace.totalDurationMs}ms)</span>
        <div className="ml-auto">
          <ConfidenceBadge confidence={trace.confidence.overall} />
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-1.5 border-t border-[var(--bg-tertiary)]">
          <div className="pt-2 flex items-center gap-4 text-[10px] text-[var(--text-tertiary)]">
            <span>{trace.chunksRetrieved} chunks retrieved</span>
            <span>{trace.documentsUsed} documents used</span>
            <span>{trace.model}</span>
          </div>

          <div className="space-y-1">
            {trace.steps.map((step) => (
              <ReasoningStepItem key={step.id} step={step} />
            ))}
          </div>

          <div className="pt-2 border-t border-[var(--bg-tertiary)] grid grid-cols-3 gap-2 text-[10px]">
            <div>
              <span className="text-[var(--text-tertiary)]">Retrieval: </span>
              <span className="text-[var(--brand-blue)]">{(trace.confidence.retrievalCoverage * 100).toFixed(0)}%</span>
            </div>
            <div>
              <span className="text-[var(--text-tertiary)]">Agreement: </span>
              <span className="text-[var(--brand-blue)]">{(trace.confidence.sourceAgreement * 100).toFixed(0)}%</span>
            </div>
            <div>
              <span className="text-[var(--text-tertiary)]">Certainty: </span>
              <span className="text-[var(--brand-blue)]">{(trace.confidence.modelCertainty * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
