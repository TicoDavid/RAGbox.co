/**
 * Document Indexer - RAGbox.co
 *
 * Chunks documents, generates embeddings, stores in DocumentChunk with pgvector.
 */

import prisma from '@/lib/prisma'
import { deletion_status, index_status } from '@prisma/client'
import { chunkText, hashContent } from './chunker'
import { embedBatch } from '@/lib/vertex/embeddings-client'
import { promoteToTier1 } from '@/lib/security/autoPromotion'

export interface IndexResult {
  documentId: string
  chunkCount: number
  status: 'Indexed' | 'Failed'
  error?: string
}

/**
 * Index a document: chunk text, generate embeddings, store in DB
 */
export async function indexDocument(
  documentId: string,
  text: string
): Promise<IndexResult> {
  try {
    // Mark document as processing
    await prisma.document.update({
      where: { id: documentId },
      data: { indexStatus: index_status.Processing },
    })

    // Chunk the text
    const chunks = chunkText(text)
    if (chunks.length === 0) {
      await prisma.document.update({
        where: { id: documentId },
        data: { indexStatus: index_status.Failed, chunkCount: 0 },
      })
      return { documentId, chunkCount: 0, status: 'Failed', error: 'No text to index' }
    }

    // Generate embeddings in batch
    const embeddings = await embedBatch(chunks.map(c => c.content))

    // Delete existing chunks for this document (re-indexing)
    await prisma.documentChunk.deleteMany({
      where: { documentId },
    })

    // Store chunks with embeddings using raw SQL for pgvector
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const embedding = embeddings[i]

      if (embedding.embedding.length > 0) {
        // Use raw SQL to insert with vector type
        const vectorStr = `[${embedding.embedding.join(',')}]`
        await prisma.$executeRawUnsafe(
          `INSERT INTO document_chunks (id, document_id, chunk_index, content, content_hash, token_count, embedding, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7::vector, NOW())`,
          `chunk_${documentId}_${i}`,
          documentId,
          chunk.chunkIndex,
          chunk.content,
          hashContent(chunk.content),
          embedding.tokenCount || chunk.tokenCount,
          vectorStr
        )
      } else {
        // Store without embedding (fallback)
        await prisma.documentChunk.create({
          data: {
            id: `chunk_${documentId}_${i}`,
            documentId,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            contentHash: hashContent(chunk.content),
            tokenCount: chunk.tokenCount,
          },
        })
      }
    }

    // Update document status
    await prisma.document.update({
      where: { id: documentId },
      data: {
        indexStatus: index_status.Indexed,
        chunkCount: chunks.length,
        extractedText: text,
      },
    })

    // Auto-promote from Tier 0 to Tier 1 after successful indexing
    await promoteToTier1(documentId)

    return {
      documentId,
      chunkCount: chunks.length,
      status: 'Indexed',
    }
  } catch (error) {
    try {
      await prisma.document.update({
        where: { id: documentId },
        data: { indexStatus: index_status.Failed },
      })
    } catch {
      // Ignore update failure
    }

    return {
      documentId,
      chunkCount: 0,
      status: 'Failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Re-index all documents for a user
 */
export async function reindexUserDocuments(userId: string): Promise<IndexResult[]> {
  const documents = await prisma.document.findMany({
    where: {
      userId,
      deletionStatus: deletion_status.Active,
      extractedText: { not: null },
    },
  })

  const results: IndexResult[] = []
  for (const doc of documents) {
    if (doc.extractedText) {
      const result = await indexDocument(doc.id, doc.extractedText)
      results.push(result)
    }
  }

  return results
}
