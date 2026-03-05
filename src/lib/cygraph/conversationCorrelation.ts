/**
 * CyGraph Cross-Channel Correlation — FINAL WAVE Task 8
 *
 * After extracting entities from a conversation message, checks if those
 * entities also exist in document-sourced entities. If so, creates
 * DISCUSSED_IN edges linking document entities to conversation context.
 *
 * This enables queries like:
 * "This entity appears in Document X AND was discussed in your voice
 *  conversation on March 3rd"
 */

import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

/**
 * After extracting entities from a conversation (voice, chat, Slack, ROAM),
 * correlate them with document-sourced entities and create DISCUSSED_IN edges.
 *
 * @param conversationEntityIds - Entity IDs found in the conversation
 * @param tenantId - Tenant scope
 * @param threadId - Mercury thread ID (the conversation)
 * @param channel - Channel type: 'web' | 'voice' | 'roam' | 'slack' | 'phone'
 */
export async function correlateConversationEntities(
  conversationEntityIds: string[],
  tenantId: string,
  threadId: string,
  channel: string,
): Promise<number> {
  if (conversationEntityIds.length === 0) return 0

  let edgesCreated = 0

  for (const entityId of conversationEntityIds) {
    try {
      // Check if this entity has document-sourced mentions (kg_mentions with document_id)
      const docMentions = await prisma.$queryRawUnsafe<Array<{
        document_id: string
        mention_count: bigint
      }>>(
        `SELECT document_id, COUNT(*) as mention_count
         FROM kg_mentions
         WHERE entity_id = $1 AND document_id IS NOT NULL
         GROUP BY document_id
         LIMIT 10`,
        entityId,
      )

      if (docMentions.length === 0) continue

      // Entity exists in documents — create DISCUSSED_IN edge to the thread
      // Check if edge already exists to avoid duplicates
      const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM kg_edges
         WHERE from_entity_id = $1
           AND to_entity_id = $2
           AND relation_type = 'discussed_in'
         LIMIT 1`,
        entityId, threadId,
      )

      if (existing.length > 0) continue

      // Create DISCUSSED_IN edge: Entity → DISCUSSED_IN → Thread
      await prisma.$executeRawUnsafe(
        `INSERT INTO kg_edges (id, tenant_id, from_entity_id, to_entity_id, relation_type, weight, metadata, valid_from, created_at)
         VALUES (gen_random_uuid()::text, $1, $2, $3, 'discussed_in', $4, $5::jsonb, NOW(), NOW())`,
        tenantId,
        entityId,
        threadId,
        0.85, // Default confidence for cross-channel links
        JSON.stringify({
          channel,
          documentIds: docMentions.map(m => m.document_id),
          mentionCounts: Object.fromEntries(
            docMentions.map(m => [m.document_id, Number(m.mention_count)])
          ),
        }),
      )
      edgesCreated++
    } catch (err) {
      logger.warn('[CyGraph] Cross-channel correlation failed for entity:', entityId, err)
    }
  }

  if (edgesCreated > 0) {
    logger.info('[CyGraph] Cross-channel correlation complete', {
      tenantId,
      threadId,
      channel,
      edgesCreated,
    })
  }

  return edgesCreated
}
