/**
 * Reasoning Types - RAGbox.co
 *
 * Types for Mercury's reasoning trace and confidence breakdown.
 */

export interface ReasoningStep {
  id: string
  label: string
  description: string
  status: 'pending' | 'running' | 'complete' | 'error'
  durationMs?: number
  metadata?: Record<string, unknown>
}

export interface ConfidenceBreakdown {
  retrievalCoverage: number   // 0-1, weight: 0.4
  sourceAgreement: number     // 0-1, weight: 0.4
  modelCertainty: number      // 0-1, weight: 0.2
  overall: number             // weighted sum
}

export interface ReasoningTrace {
  id: string
  queryId: string
  steps: ReasoningStep[]
  confidence: ConfidenceBreakdown
  totalDurationMs: number
  chunksRetrieved: number
  documentsUsed: number
  model: string
}
