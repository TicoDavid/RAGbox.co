/**
 * CyGraph Extraction Trigger
 *
 * Fetches chunks for a document from the database and triggers
 * entity/claim/relationship extraction. Designed to be called
 * fire-and-forget after document ingestion completes.
 */

import prisma from '@/lib/prisma'
import { extractFromChunks } from './extractionService'
import { logger } from '@/lib/logger'

/**
 * Trigger CyGraph extraction for a document.
 * Fetches chunks from the database, then runs async extraction.
 * Non-blocking — logs errors but never throws.
 */
export async function triggerDocumentExtraction(
  documentId: string,
  tenantId: string
): Promise<void> {
  try {
    // Fetch chunks from the database (created by Go backend ingestion)
    const chunks = await prisma.$queryRawUnsafe<Array<{
      id: string
      content: string
      document_id: string
      chunk_index: number
    }>>(
      `SELECT id, content, document_id, chunk_index
       FROM document_chunks
       WHERE document_id = $1
       ORDER BY chunk_index ASC`,
      documentId
    )

    if (chunks.length === 0) {
      logger.info('[CyGraph] No chunks found for document — skipping extraction', { documentId })
      return
    }

    const chunkInputs = chunks.map(c => ({
      id: c.id,
      content: c.content,
      documentId: c.document_id,
      pageNumber: undefined,
    }))

    logger.info('[CyGraph] Triggering extraction', {
      documentId,
      tenantId,
      chunkCount: chunkInputs.length,
    })

    await extractFromChunks(chunkInputs, tenantId)
  } catch (err) {
    logger.error('[CyGraph] Document extraction trigger failed:', { documentId, error: err })
  }
}

/**
 * Trigger CyGraph extraction for conversation messages.
 * Treats recent messages as pseudo-chunks for entity extraction.
 */
export async function triggerConversationExtraction(
  threadId: string,
  tenantId: string,
  messages: Array<{ id: string; content: string }>
): Promise<void> {
  if (messages.length === 0) return

  try {
    const chunkInputs = messages.map(m => ({
      id: m.id,
      content: m.content,
      documentId: `thread:${threadId}`,
      pageNumber: undefined,
    }))

    logger.info('[CyGraph] Triggering conversation extraction', {
      threadId,
      tenantId,
      messageCount: chunkInputs.length,
    })

    await extractFromChunks(chunkInputs, tenantId)
  } catch (err) {
    logger.error('[CyGraph] Conversation extraction trigger failed:', { threadId, error: err })
  }
}
