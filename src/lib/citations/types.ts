/**
 * CitationBlock — Structured citation with provenance fields.
 *
 * Extends the base Citation with confidence visualization,
 * audit-ready hashes, and channel-aware rendering metadata.
 */

export type ConfidenceLevel = 'high' | 'medium' | 'low'
export type ConfidenceColor = 'green' | 'amber' | 'red'
export type SourceType = 'upload' | 'roam_compliance' | 'webhook_ingest' | 'studio'

export interface CitationBlock {
  documentId: string
  chunkId?: string
  sourceName: string
  sourceType: SourceType
  confidenceScore: number
  confidenceLevel: ConfidenceLevel
  confidenceColor: ConfidenceColor
  excerpt: string
  retrievalTimestamp: string  // ISO 8601
  queryHash: string           // SHA-256 of query
  responseHash: string        // SHA-256 of full response
  documentUrl: string         // Internal RAGbox link
}

/**
 * Derive confidence level from a numeric score.
 */
export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.85) return 'high'
  if (score >= 0.70) return 'medium'
  return 'low'
}

/**
 * Derive confidence color from a numeric score.
 */
export function getConfidenceColor(score: number): ConfidenceColor {
  if (score >= 0.85) return 'green'
  if (score >= 0.70) return 'amber'
  return 'red'
}

/**
 * Check if citation blocks indicate low confidence (Silence Protocol territory).
 * Returns true if the highest citation confidence is below 0.70.
 */
export function isLowConfidence(blocks: CitationBlock[]): boolean {
  if (blocks.length === 0) return true
  const maxScore = Math.max(...blocks.map(b => b.confidenceScore))
  return maxScore < 0.70
}
