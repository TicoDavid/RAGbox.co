/**
 * Reasoning Trace Collector - RAGbox.co
 *
 * Collects timing and metadata for each step of the RAG pipeline.
 */

import type { ReasoningTrace, ReasoningStep, ConfidenceBreakdown } from '@/types/reasoning'

export class TraceCollector {
  private steps: ReasoningStep[] = []
  private startTime: number
  private stepIndex = 0

  constructor(private queryId: string) {
    this.startTime = Date.now()
  }

  startStep(label: string, description: string): string {
    const id = `step_${this.stepIndex++}`
    this.steps.push({
      id,
      label,
      description,
      status: 'running',
    })
    return id
  }

  completeStep(id: string, metadata?: Record<string, unknown>): void {
    const step = this.steps.find(s => s.id === id)
    if (step) {
      step.status = 'complete'
      step.durationMs = Date.now() - this.startTime
      if (metadata) step.metadata = metadata
    }
  }

  failStep(id: string, error: string): void {
    const step = this.steps.find(s => s.id === id)
    if (step) {
      step.status = 'error'
      step.durationMs = Date.now() - this.startTime
      step.metadata = { error }
    }
  }

  buildTrace(
    confidence: ConfidenceBreakdown,
    chunksRetrieved: number,
    documentsUsed: number,
    model: string
  ): ReasoningTrace {
    return {
      id: `trace_${this.queryId}`,
      queryId: this.queryId,
      steps: this.steps,
      confidence,
      totalDurationMs: Date.now() - this.startTime,
      chunksRetrieved,
      documentsUsed,
      model,
    }
  }
}

/**
 * Create a standard 5-step reasoning trace for a RAG query
 */
export function createStandardTrace(queryId: string): TraceCollector {
  return new TraceCollector(queryId)
}

/**
 * Standard step labels for the RAG pipeline
 */
export const STANDARD_STEPS = {
  EMBED_QUERY: { label: 'Embed Query', description: 'Converting query to vector representation' },
  RETRIEVE: { label: 'Retrieve', description: 'Searching document chunks by similarity' },
  RANK: { label: 'Rank', description: 'Ranking and filtering retrieved chunks' },
  GENERATE: { label: 'Generate', description: 'Generating answer with citations' },
  VALIDATE: { label: 'Validate', description: 'Scoring confidence and applying Silence Protocol' },
} as const
