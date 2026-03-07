/**
 * Mercury Thread Message Embedding — S-P1-04
 *
 * Embeds conversation messages via Vertex AI text-embedding-004 and stores
 * the vector in mercury_thread_messages.embedding for RAG recall.
 *
 * Uses RETRIEVAL_DOCUMENT task type so thread messages live in the same
 * vector space as document chunks (searched with RETRIEVAL_QUERY).
 *
 * Fire-and-forget: callers should not await this in the critical path.
 */

import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

const PROJECT = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'ragbox-sovereign-prod'
const LOCATION = process.env.VERTEX_AI_LOCATION || 'us-east4'
const MODEL = 'text-embedding-004'

interface EmbeddingResponse {
  predictions: Array<{
    embeddings: {
      values: number[]
    }
  }>
}

/**
 * Embed a single message and store the vector.
 * Non-blocking, non-fatal — errors are logged but don't propagate.
 */
export async function embedThreadMessage(messageId: string, content: string): Promise<void> {
  try {
    if (!content || content.trim().length < 3) return

    const vector = await embedText(content)
    if (!vector) return

    // Store embedding using raw SQL (Prisma doesn't support pgvector natively)
    const vectorStr = `[${vector.join(',')}]`
    await prisma.$executeRawUnsafe(
      `UPDATE mercury_thread_messages SET embedding = $1::vector WHERE id = $2`,
      vectorStr,
      messageId
    )
  } catch (error) {
    logger.error('[EmbedMessage] Failed to embed thread message:', error)
  }
}

/**
 * Batch embed multiple messages. Used by backfill jobs.
 */
export async function embedThreadMessageBatch(
  messages: Array<{ id: string; content: string }>
): Promise<number> {
  const validMessages = messages.filter(m => m.content && m.content.trim().length >= 3)
  if (validMessages.length === 0) return 0

  try {
    const texts = validMessages.map(m => m.content)
    const vectors = await embedTexts(texts)
    if (!vectors || vectors.length !== validMessages.length) return 0

    let embedded = 0
    for (let i = 0; i < validMessages.length; i++) {
      try {
        const vectorStr = `[${vectors[i].join(',')}]`
        await prisma.$executeRawUnsafe(
          `UPDATE mercury_thread_messages SET embedding = $1::vector WHERE id = $2`,
          vectorStr,
          validMessages[i].id
        )
        embedded++
      } catch (err) {
        logger.error('[EmbedMessage] Batch update failed for message:', { id: validMessages[i].id, error: err })
      }
    }

    return embedded
  } catch (error) {
    logger.error('[EmbedMessage] Batch embedding failed:', error)
    return 0
  }
}

/**
 * Embed a single text using Vertex AI text-embedding-004.
 */
async function embedText(text: string): Promise<number[] | null> {
  const results = await embedTexts([text])
  return results?.[0] ?? null
}

/**
 * Embed multiple texts in a single API call.
 * Uses RETRIEVAL_DOCUMENT task type for storage (matches Go backend).
 */
async function embedTexts(texts: string[]): Promise<number[][] | null> {
  try {
    // Use Google default credentials via metadata server or ADC
    const { GoogleAuth } = await import('google-auth-library')
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] })
    const client = await auth.getClient()
    const token = await client.getAccessToken()

    const url = LOCATION === 'global'
      ? `https://aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/global/publishers/google/models/${MODEL}:predict`
      : `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${MODEL}:predict`

    const instances = texts.map(content => ({
      content,
      task_type: 'RETRIEVAL_DOCUMENT',
    }))

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.token}`,
      },
      body: JSON.stringify({ instances }),
    })

    if (!response.ok) {
      const errText = await response.text()
      logger.error('[EmbedMessage] Vertex AI error:', { status: response.status, error: errText })
      return null
    }

    const data = await response.json() as EmbeddingResponse
    return data.predictions.map(p => p.embeddings.values)
  } catch (error) {
    logger.error('[EmbedMessage] Embedding API call failed:', error)
    return null
  }
}
