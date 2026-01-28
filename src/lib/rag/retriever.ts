/**
 * Vector Retriever - RAGbox.co
 *
 * Performs pgvector cosine similarity search to find relevant document chunks.
 */

import prisma from '@/lib/prisma'
import { embedQuery } from '@/lib/vertex/embeddings-client'
import type { RetrievedChunk } from '@/types/rag'

const DEFAULT_TOP_K = 10

/**
 * Retrieve the most relevant chunks for a query using vector similarity
 */
export async function retrieveChunks(
  query: string,
  accessibleDocumentIds: string[],
  topK: number = DEFAULT_TOP_K
): Promise<RetrievedChunk[]> {
  if (accessibleDocumentIds.length === 0) {
    return []
  }

  try {
    // Generate query embedding
    const queryEmbedding = await embedQuery(query)
    const vectorStr = `[${queryEmbedding.join(',')}]`

    // Build parameterized document ID list
    const placeholders = accessibleDocumentIds.map((_, i) => `$${i + 3}`).join(', ')

    // Cosine similarity search via pgvector
    const results: Array<{
      id: string
      document_id: string
      content: string
      chunk_index: number
      similarity: number
    }> = await prisma.$queryRawUnsafe(
      `SELECT
        dc.id,
        dc.document_id,
        dc.content,
        dc.chunk_index,
        1 - (dc.embedding <=> $1::vector) as similarity
      FROM document_chunks dc
      WHERE dc.document_id IN (${placeholders})
        AND dc.embedding IS NOT NULL
      ORDER BY dc.embedding <=> $1::vector
      LIMIT $2`,
      vectorStr,
      topK,
      ...accessibleDocumentIds
    )

    // Fetch document names for results
    const docIds = Array.from(new Set(results.map(r => r.document_id)))
    const documents = await prisma.document.findMany({
      where: { id: { in: docIds } },
      select: { id: true, filename: true, securityTier: true },
    })
    const docMap = new Map(documents.map((d): [string, typeof d] => [d.id, d]))

    return results.map(r => ({
      chunkId: r.id,
      documentId: r.document_id,
      content: r.content,
      chunkIndex: r.chunk_index,
      similarity: r.similarity,
      documentName: docMap.get(r.document_id)?.filename,
      securityTier: docMap.get(r.document_id)?.securityTier ?? 0,
    }))
  } catch (error) {
    console.error('[Retriever] Vector search failed:', error)
    return []
  }
}
