/**
 * Citation Parser - RAGbox.co
 *
 * Extracts [1][2] citation references from AI responses and maps them to documents.
 */

import type { RetrievedChunk, StructuredCitation } from '@/types/rag'

/**
 * Parse citation references from answer text and map to retrieved chunks
 */
export function parseCitations(
  answerText: string,
  retrievedChunks: RetrievedChunk[]
): StructuredCitation[] {
  // Extract citation numbers [1], [2], etc.
  const citationPattern = /\[(\d+)\]/g
  const matches = Array.from(answerText.matchAll(citationPattern))
  const citedIndices = new Set<number>()

  for (const match of matches) {
    const index = parseInt(match[1], 10) - 1 // Convert to 0-based
    if (index >= 0 && index < retrievedChunks.length) {
      citedIndices.add(index)
    }
  }

  // Build structured citations
  const citations: StructuredCitation[] = []
  for (const index of Array.from(citedIndices)) {
    const chunk = retrievedChunks[index]
    citations.push({
      citationIndex: index + 1,
      documentId: chunk.documentId,
      chunkId: chunk.chunkId,
      documentName: chunk.documentName || 'Unknown',
      excerpt: chunk.content.substring(0, 300),
      relevanceScore: chunk.similarity,
      securityTier: chunk.securityTier ?? 0,
    })
  }

  return citations.sort((a, b) => a.citationIndex - b.citationIndex)
}

/**
 * Calculate confidence score based on retrieval results
 */
export function calculateRAGConfidence(
  retrievedChunks: RetrievedChunk[],
  citations: StructuredCitation[],
  hasHistory: boolean
): number {
  if (retrievedChunks.length === 0) return 0.5

  // Retrieval coverage: how relevant are the top chunks
  const avgSimilarity = retrievedChunks.reduce((sum, c) => sum + c.similarity, 0) / retrievedChunks.length
  const retrievalCoverage = Math.min(avgSimilarity / 0.8, 1.0) // Normalize to 0-1

  // Source agreement: how many unique documents are cited
  const uniqueDocIds = new Set(citations.map(c => c.documentId))
  const sourceAgreement = Math.min(uniqueDocIds.size / 3, 1.0) // 3+ docs = full agreement

  // Model certainty: based on citation density
  const citationDensity = citations.length > 0 ? Math.min(citations.length / 3, 1.0) : 0.3
  const modelCertainty = citationDensity

  // Weighted confidence (PRD weights: retrieval 0.4, agreement 0.4, certainty 0.2)
  const confidence = (
    retrievalCoverage * 0.4 +
    sourceAgreement * 0.4 +
    modelCertainty * 0.2
  )

  // Boost slightly for follow-up questions
  const boost = hasHistory ? 0.05 : 0
  return Math.min(confidence + boost, 0.98)
}
