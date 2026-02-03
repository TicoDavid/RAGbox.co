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
    <div className="mt-2 rounded-lg border border-[#333] bg-black/30 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#888] hover:text-[#aaa] transition-colors"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Brain size={14} className="text-[#2463EB]" />
        <span className="font-medium">Reasoning Trace</span>
        <span className="text-[#666]">({trace.steps.length} steps, {trace.totalDurationMs}ms)</span>
        <div className="ml-auto">
          <ConfidenceBadge confidence={trace.confidence.overall} />
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-1.5 border-t border-[#222]">
          <div className="pt-2 flex items-center gap-4 text-[10px] text-[#666]">
            <span>{trace.chunksRetrieved} chunks retrieved</span>
            <span>{trace.documentsUsed} documents used</span>
            <span>{trace.model}</span>
          </div>

          <div className="space-y-1">
            {trace.steps.map((step) => (
              <ReasoningStepItem key={step.id} step={step} />
            ))}
          </div>

          <div className="pt-2 border-t border-[#222] grid grid-cols-3 gap-2 text-[10px]">
            <div>
              <span className="text-[#666]">Retrieval: </span>
              <span className="text-[#2463EB]">{(trace.confidence.retrievalCoverage * 100).toFixed(0)}%</span>
            </div>
            <div>
              <span className="text-[#666]">Agreement: </span>
              <span className="text-[#2463EB]">{(trace.confidence.sourceAgreement * 100).toFixed(0)}%</span>
            </div>
            <div>
              <span className="text-[#666]">Certainty: </span>
              <span className="text-[#2463EB]">{(trace.confidence.modelCertainty * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
