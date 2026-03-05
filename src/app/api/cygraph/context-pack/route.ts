/**
 * CyGraph Context Pack API
 *
 * GET  /api/cygraph/context-pack?query=...&documentId=...&messageId=...
 * POST /api/cygraph/context-pack  { chunkIds?, documentId?, query? }
 *
 * Combines vector search results with knowledge graph context:
 * 1. Entities mentioned in retrieved chunks
 * 2. Claims tied to those entities
 * 3. Relationships between entities
 *
 * The frontend Evidence tab calls GET; the chat pipeline calls POST.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

interface ContextPackEntity {
  id: string
  name: string
  type: string
  mentionCount: number
}

interface ContextPackClaim {
  id: string
  predicate: string
  objectValue: string
  confidence: number
  subjectEntity: string
}

interface ContextPackRelationship {
  id: string
  fromEntity: string
  fromType: string
  relationship: string
  toEntity: string
  toType: string
  confidence: number
}

interface ContextPack {
  entities: ContextPackEntity[]
  claims: ContextPackClaim[]
  relationships: ContextPackRelationship[]
}

// C1: GET handler for Jordan's Evidence tab
export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unable to determine user identity' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('query') || undefined
  const documentId = searchParams.get('documentId') || undefined
  const messageId = searchParams.get('messageId') || undefined

  // If messageId provided, look up the message content to use as query
  let resolvedQuery = query
  if (!resolvedQuery && !documentId && messageId) {
    try {
      const msg = await prisma.mercuryThreadMessage.findUnique({
        where: { id: messageId },
        select: { content: true },
      })
      if (msg) resolvedQuery = msg.content.slice(0, 200)
    } catch {
      // Fall through — return empty pack
    }
  }

  if (!resolvedQuery && !documentId) {
    return NextResponse.json({ success: true, data: { entities: [], claims: [], relationships: [] } })
  }

  return buildContextPack(userId, { query: resolvedQuery, documentId })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unable to determine user identity' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { chunkIds, documentId, query } = body as {
      chunkIds?: string[]
      documentId?: string
      query?: string
    }

    if (!chunkIds?.length && !documentId && !query) {
      return NextResponse.json(
        { success: false, error: 'Provide chunkIds, documentId, or query' },
        { status: 400 }
      )
    }

    return buildContextPack(userId, { chunkIds, documentId, query })
  } catch (err) {
    logger.error('[CyGraph] Context pack POST error:', err)
    return NextResponse.json({ success: false, error: 'Failed to build context pack' }, { status: 500 })
  }
}

// Shared logic for GET and POST
async function buildContextPack(
  userId: string,
  params: { chunkIds?: string[]; documentId?: string; query?: string }
): Promise<NextResponse> {
  try {
    const { chunkIds, documentId, query } = params
    const tenantId = userId
    const pack: ContextPack = { entities: [], claims: [], relationships: [] }

    // Step 1: Find entities mentioned in the given chunks or document
    let entityIds: string[] = []

    if (chunkIds && chunkIds.length > 0) {
      // Find entities mentioned in specific chunks
      const placeholders = chunkIds.map((_, i) => `$${i + 2}`).join(', ')
      const mentions = await prisma.$queryRawUnsafe<Array<{
        entity_id: string
        mention_count: bigint
      }>>(
        `SELECT entity_id, COUNT(*) as mention_count
         FROM kg_mentions
         WHERE chunk_id IN (${placeholders})
         GROUP BY entity_id
         ORDER BY mention_count DESC
         LIMIT 50`,
        ...chunkIds
      )
      entityIds = mentions.map(m => m.entity_id)

      // Build entity list with mention counts
      if (entityIds.length > 0) {
        const entityPlaceholders = entityIds.map((_, i) => `$${i + 1}`).join(', ')
        const entities = await prisma.$queryRawUnsafe<Array<{
          id: string; name: string; entity_type: string
        }>>(
          `SELECT id, name, entity_type FROM kg_entities WHERE id IN (${entityPlaceholders})`,
          ...entityIds
        )
        const mentionMap = new Map(mentions.map(m => [m.entity_id, Number(m.mention_count)]))
        pack.entities = entities.map(e => ({
          id: e.id,
          name: e.name,
          type: e.entity_type,
          mentionCount: mentionMap.get(e.id) ?? 0,
        }))
      }
    } else if (documentId) {
      // Find all entities mentioned in any chunk of this document
      const mentions = await prisma.$queryRawUnsafe<Array<{
        entity_id: string
        mention_count: bigint
      }>>(
        `SELECT entity_id, COUNT(*) as mention_count
         FROM kg_mentions
         WHERE document_id = $1
         GROUP BY entity_id
         ORDER BY mention_count DESC
         LIMIT 50`,
        documentId
      )
      entityIds = mentions.map(m => m.entity_id)

      if (entityIds.length > 0) {
        const entityPlaceholders = entityIds.map((_, i) => `$${i + 1}`).join(', ')
        const entities = await prisma.$queryRawUnsafe<Array<{
          id: string; name: string; entity_type: string
        }>>(
          `SELECT id, name, entity_type FROM kg_entities WHERE id IN (${entityPlaceholders})`,
          ...entityIds
        )
        const mentionMap = new Map(mentions.map(m => [m.entity_id, Number(m.mention_count)]))
        pack.entities = entities.map(e => ({
          id: e.id,
          name: e.name,
          type: e.entity_type,
          mentionCount: mentionMap.get(e.id) ?? 0,
        }))
      }
    } else if (query) {
      // Fuzzy entity search by name
      const entities = await prisma.$queryRawUnsafe<Array<{
        id: string; name: string; entity_type: string
      }>>(
        `SELECT id, name, entity_type FROM kg_entities
         WHERE tenant_id = $1 AND LOWER(name) LIKE $2
         LIMIT 20`,
        tenantId, `%${query.toLowerCase()}%`
      )
      entityIds = entities.map(e => e.id)
      pack.entities = entities.map(e => ({
        id: e.id,
        name: e.name,
        type: e.entity_type,
        mentionCount: 0,
      }))
    }

    // Step 2: Fetch claims for these entities
    if (entityIds.length > 0) {
      const claimPlaceholders = entityIds.map((_, i) => `$${i + 1}`).join(', ')
      const claims = await prisma.$queryRawUnsafe<Array<{
        id: string
        predicate: string
        object_value: string
        confidence: number
        subject_entity_id: string
      }>>(
        `SELECT c.id, c.predicate, c.object_value, c.confidence, c.subject_entity_id
         FROM kg_claims c
         WHERE c.subject_entity_id IN (${claimPlaceholders})
           AND c.status = 'active'
         ORDER BY c.confidence DESC
         LIMIT 30`,
        ...entityIds
      )

      const entityNameMap = new Map(pack.entities.map(e => [e.id, e.name]))
      pack.claims = claims.map(c => ({
        id: c.id,
        predicate: c.predicate,
        objectValue: c.object_value,
        confidence: c.confidence,
        subjectEntity: entityNameMap.get(c.subject_entity_id) ?? c.subject_entity_id,
      }))
    }

    // Step 3: Fetch relationships (edges) between these entities
    if (entityIds.length > 1) {
      const edgePlaceholders = entityIds.map((_, i) => `$${i + 1}`).join(', ')
      const edges = await prisma.$queryRawUnsafe<Array<{
        id: string
        from_entity_id: string
        to_entity_id: string
        relation_type: string
        weight: number
      }>>(
        `SELECT id, from_entity_id, to_entity_id, relation_type, weight
         FROM kg_edges
         WHERE from_entity_id IN (${edgePlaceholders})
           AND to_entity_id IN (${edgePlaceholders})
         ORDER BY weight DESC
         LIMIT 50`,
        ...entityIds, ...entityIds
      )

      // C2: Map to frontend CyGraphRelationship shape
      const entityNameMap = new Map(pack.entities.map(e => [e.id, e.name]))
      const entityTypeMap = new Map(pack.entities.map(e => [e.id, e.type]))
      pack.relationships = edges.map(e => ({
        id: e.id,
        fromEntity: entityNameMap.get(e.from_entity_id) ?? e.from_entity_id,
        fromType: entityTypeMap.get(e.from_entity_id) ?? 'unknown',
        relationship: e.relation_type,
        toEntity: entityNameMap.get(e.to_entity_id) ?? e.to_entity_id,
        toType: entityTypeMap.get(e.to_entity_id) ?? 'unknown',
        confidence: e.weight,
      }))
    }

    logger.info('[CyGraph] Context pack built', {
      tenantId,
      entities: pack.entities.length,
      claims: pack.claims.length,
      relationships: pack.relationships.length,
    })

    return NextResponse.json({ success: true, data: pack })
  } catch (err) {
    logger.error('[CyGraph] Context pack error:', err)
    return NextResponse.json({ success: false, error: 'Failed to build context pack' }, { status: 500 })
  }
}
