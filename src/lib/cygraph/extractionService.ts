/**
 * CyGraph Extraction Service
 *
 * Takes document chunks (after RAG ingestion) and extracts entities, claims,
 * and relationships using the LLM. Results are stored in the KG tables.
 *
 * Uses Vertex AI Gemini 2.0 Flash for extraction (fast, cheap, structured output).
 * All extraction is async and non-blocking — never delays ingestion.
 */

import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

// ── Types ──────────────────────────────────────────────────────────────

interface ChunkInput {
  id: string
  content: string
  documentId: string
  pageNumber?: number
}

interface ExtractedEntity {
  name: string
  type: string  // Person, Organization, Contract, Date, Obligation, Location, Amount, Regulation
  aliases?: string[]
  attributes?: Record<string, unknown>
}

interface ExtractedClaim {
  claimText: string
  subjectEntity?: string  // References entity by name
  predicate?: string
  objectValue?: string
  confidence: number
}

interface ExtractedRelationship {
  srcEntity: string  // References by name
  relType: string    // SIGNED, OBLIGATES, PARTY_TO, GOVERNS, REFERENCES, etc.
  dstEntity: string
  confidence: number
}

interface ExtractionResult {
  entities: ExtractedEntity[]
  claims: ExtractedClaim[]
  relationships: ExtractedRelationship[]
}

// ── Extraction Prompt ──────────────────────────────────────────────────

const EXTRACTION_PROMPT = `Extract structured knowledge from the following text.
Return ONLY valid JSON with three arrays: entities, claims, relationships.

Rules:
- entities: Named things (people, organizations, contracts, dates, obligations, amounts, regulations, locations)
- claims: Atomic factual statements that can be verified (e.g., "Client must provide 30-day notice")
- relationships: How entities relate (e.g., "ACME Corp" → SIGNED → "Master Agreement")

Entity types: Person, Organization, Contract, Date, Obligation, Location, Amount, Regulation, Event, Concept
Relationship types: SIGNED, OBLIGATES, PARTY_TO, GOVERNS, REFERENCES, EMPLOYS, CITES, AMENDS, CONTRADICTS, RELATES_TO

JSON format:
{
  "entities": [{"name": "...", "type": "...", "aliases": [], "attributes": {}}],
  "claims": [{"claimText": "...", "subjectEntity": "...", "predicate": "...", "objectValue": "...", "confidence": 0.9}],
  "relationships": [{"srcEntity": "...", "relType": "...", "dstEntity": "...", "confidence": 0.9}]
}

Text:
`

// ── LLM Call ───────────────────────────────────────────────────────────

async function callExtractionLLM(text: string): Promise<ExtractionResult | null> {
  const apiUrl = process.env.GO_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
  const authSecret = process.env.INTERNAL_AUTH_SECRET || ''

  try {
    // Use the Go backend's /api/generate endpoint (or direct Vertex AI)
    // For extraction, we use a lightweight non-streaming call
    const res = await fetch(`${apiUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Auth': authSecret,
        'X-User-ID': 'system:cygraph',
      },
      body: JSON.stringify({
        query: EXTRACTION_PROMPT + text.slice(0, 4000),
        stream: false,
        privilegeMode: false,
        maxTier: 1,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) {
      logger.warn('[CyGraph] LLM extraction call failed:', res.status)
      return null
    }

    const data = await res.json()
    const answer = data.data?.answer ?? data.answer ?? ''

    // Parse JSON from the LLM response
    const cleaned = answer.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleaned) as ExtractionResult

    return {
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      claims: Array.isArray(parsed.claims) ? parsed.claims : [],
      relationships: Array.isArray(parsed.relationships) ? parsed.relationships : [],
    }
  } catch (err) {
    logger.warn('[CyGraph] Extraction LLM call failed:', err)
    return null
  }
}

// ── Entity Upsert ──────────────────────────────────────────────────────

async function upsertEntity(tenantId: string, entity: ExtractedEntity): Promise<string> {
  const normalizedName = entity.name.trim()
  const entityType = entity.type.toLowerCase()

  // Try to find existing entity by name (within tenant)
  const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM kg_entities WHERE tenant_id = $1 AND LOWER(name) = LOWER($2) AND entity_type = $3 LIMIT 1`,
    tenantId, normalizedName, entityType
  )

  if (existing.length > 0) {
    return existing[0].id
  }

  // Create new entity
  const result = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `INSERT INTO kg_entities (id, tenant_id, name, entity_type, canonical, metadata, created_at, updated_at)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5::jsonb, NOW(), NOW())
     RETURNING id`,
    tenantId, normalizedName, entityType,
    normalizedName.toLowerCase(),
    entity.attributes ? JSON.stringify(entity.attributes) : null
  )

  return result[0].id
}

// ── Main Extraction Function ───────────────────────────────────────────

/**
 * Extract entities, claims, and relationships from document chunks.
 * Fire-and-forget — does not block the caller.
 */
export async function extractFromChunks(
  chunks: ChunkInput[],
  tenantId: string
): Promise<void> {
  if (chunks.length === 0) return

  const t0 = Date.now()
  let totalEntities = 0
  let totalClaims = 0
  let totalRelationships = 0

  // Process chunks in batches of 3 for better context
  const batchSize = 3
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize)
    const combinedText = batch.map(c => c.content).join('\n\n---\n\n')

    const result = await callExtractionLLM(combinedText)
    if (!result) continue

    // Upsert entities and build name → ID map
    const entityMap = new Map<string, string>()
    for (const entity of result.entities) {
      try {
        const entityId = await upsertEntity(tenantId, entity)
        entityMap.set(entity.name.toLowerCase(), entityId)

        // Create mentions for each chunk in this batch
        for (const chunk of batch) {
          await prisma.$executeRawUnsafe(
            `INSERT INTO kg_mentions (id, entity_id, document_id, chunk_id, mention_text, confidence, created_at)
             VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW())
             ON CONFLICT DO NOTHING`,
            entityId, chunk.documentId, chunk.id, entity.name, 0.9
          )
        }
        totalEntities++
      } catch (err) {
        logger.warn('[CyGraph] Entity upsert failed:', entity.name, err)
      }
    }

    // Create claims with provenance
    for (const claim of result.claims) {
      try {
        const subjectId = claim.subjectEntity
          ? entityMap.get(claim.subjectEntity.toLowerCase()) ?? null
          : null

        if (!subjectId) continue // Skip claims without a resolved subject

        const claimResult = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
          `INSERT INTO kg_claims (id, tenant_id, subject_entity_id, predicate, object_value, confidence, status, created_at)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, 'active', NOW())
           RETURNING id`,
          tenantId, subjectId, claim.predicate ?? 'states',
          claim.objectValue ?? claim.claimText,
          claim.confidence
        )

        // Add provenance for each chunk
        const claimId = claimResult[0].id
        for (const chunk of batch) {
          await prisma.$executeRawUnsafe(
            `INSERT INTO kg_provenance (id, claim_id, document_id, chunk_id, excerpt, page_number, confidence, extracted_at)
             VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, NOW())`,
            claimId, chunk.documentId, chunk.id,
            claim.claimText.slice(0, 500),
            chunk.pageNumber ?? null,
            claim.confidence
          )
        }
        totalClaims++
      } catch (err) {
        logger.warn('[CyGraph] Claim insert failed:', err)
      }
    }

    // Create edges (relationships)
    for (const rel of result.relationships) {
      try {
        const srcId = entityMap.get(rel.srcEntity.toLowerCase())
        const dstId = entityMap.get(rel.dstEntity.toLowerCase())
        if (!srcId || !dstId) continue

        await prisma.$executeRawUnsafe(
          `INSERT INTO kg_edges (id, tenant_id, from_entity_id, to_entity_id, relation_type, weight, created_at)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW())`,
          tenantId, srcId, dstId, rel.relType.toLowerCase(), rel.confidence
        )
        totalRelationships++
      } catch (err) {
        logger.warn('[CyGraph] Edge insert failed:', err)
      }
    }
  }

  logger.info('[CyGraph] Extraction complete', {
    tenantId,
    chunks: chunks.length,
    entities: totalEntities,
    claims: totalClaims,
    relationships: totalRelationships,
    latencyMs: Date.now() - t0,
  })
}
