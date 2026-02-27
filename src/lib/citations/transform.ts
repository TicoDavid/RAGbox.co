/**
 * Citation → CitationBlock transform layer.
 *
 * Converts the base Citation[] from the Go backend SSE response
 * into enriched CitationBlock[] with confidence tiers, audit hashes,
 * and provenance metadata.
 */

import { createHash } from 'crypto'
import type { Citation } from '@/types/ragbox'
import type { CitationBlock, SourceType } from './types'
import { getConfidenceLevel, getConfidenceColor } from './types'

export interface TransformOptions {
  /** Override source type for all citations (default: derived from metadata) */
  sourceType?: SourceType
  /** Base URL for document links (default: /dashboard/vault) */
  baseUrl?: string
}

/**
 * Transform an array of Citation objects into CitationBlock objects.
 *
 * @param citations - Raw citations from the Go backend
 * @param query - The user's query text (hashed for audit trail)
 * @param fullResponse - The complete response text (hashed for audit trail)
 * @param options - Optional overrides
 */
export function toCitationBlocks(
  citations: Citation[],
  query: string,
  fullResponse: string,
  options: TransformOptions = {}
): CitationBlock[] {
  const { baseUrl = '/dashboard/vault' } = options
  const now = new Date().toISOString()
  const queryHash = sha256(query)
  const responseHash = sha256(fullResponse)

  return citations.map((c) => ({
    documentId: c.documentId,
    chunkId: c.chunkId,
    sourceName: c.documentName,
    sourceType: options.sourceType ?? deriveSourceType(c),
    confidenceScore: c.relevanceScore,
    confidenceLevel: getConfidenceLevel(c.relevanceScore),
    confidenceColor: getConfidenceColor(c.relevanceScore),
    excerpt: c.excerpt,
    retrievalTimestamp: now,
    queryHash,
    responseHash,
    documentUrl: `${baseUrl}/${c.documentId}`,
  }))
}

/**
 * Derive the source type from citation metadata.
 * Falls back to 'upload' if no metadata hints are available.
 */
function deriveSourceType(citation: Citation): SourceType {
  const meta = (citation as unknown as Record<string, unknown>).metadata as Record<string, unknown> | undefined
  if (!meta) return 'upload'

  const source = meta.sourceType as string | undefined
  if (source === 'webhook_ingest' || source === 'roam_compliance' || source === 'studio') {
    return source
  }
  return 'upload'
}

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}
