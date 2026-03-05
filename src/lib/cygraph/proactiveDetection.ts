/**
 * CyGraph Proactive Pattern Detection — FINAL WAVE Task 9
 *
 * After every N entities extracted, runs background analysis to find:
 * 1. Contradictions: entities in multiple docs with conflicting claims
 * 2. Inconsistencies: claims with overlapping subjects but different predicates
 * 3. Gaps: entities mentioned in conversations but not in any documents
 * 4. Patterns: recurring entity co-occurrence across documents
 *
 * Findings are stored as MercuryProactiveInsight records and surfaced
 * in the Mercury thread as proactive messages.
 */

import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

const ENTITY_THRESHOLD = 50 // Run analysis every N entities
const MAX_INSIGHTS_PER_RUN = 10

interface InsightCandidate {
  type: 'contradiction' | 'inconsistency' | 'gap' | 'pattern'
  summary: string
  entities: string[]
  documents: string[]
  confidence: number
}

/**
 * Check if analysis should run based on entity count.
 * Runs every ENTITY_THRESHOLD entities per tenant.
 */
export async function shouldRunAnalysis(tenantId: string): Promise<boolean> {
  const result = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM kg_entities WHERE tenant_id = $1 AND merged_into IS NULL`,
    tenantId,
  )
  const count = Number(result[0]?.count ?? 0)
  return count > 0 && count % ENTITY_THRESHOLD === 0
}

/**
 * Run proactive pattern detection for a tenant.
 * Identifies contradictions, inconsistencies, gaps, and patterns.
 */
export async function runProactiveAnalysis(
  tenantId: string,
  userId: string,
): Promise<number> {
  const t0 = Date.now()
  const insights: InsightCandidate[] = []

  // 1. Find contradictions: same entity, conflicting claims
  const contradictions = await findContradictions(tenantId)
  insights.push(...contradictions)

  // 2. Find inconsistencies: overlapping predicates with different values
  const inconsistencies = await findInconsistencies(tenantId)
  insights.push(...inconsistencies)

  // 3. Find gaps: entities in conversations not in documents
  const gaps = await findGaps(tenantId)
  insights.push(...gaps)

  // 4. Find patterns: recurring entity co-occurrence
  const patterns = await findPatterns(tenantId)
  insights.push(...patterns)

  // Deduplicate against existing insights
  const existing = await prisma.$queryRawUnsafe<Array<{ summary: string }>>(
    `SELECT summary FROM mercury_proactive_insights
     WHERE user_id = $1 AND dismissed = false
     ORDER BY created_at DESC LIMIT 50`,
    userId,
  )
  const existingSummaries = new Set(existing.map(e => e.summary))

  // Store new insights
  let stored = 0
  for (const insight of insights.slice(0, MAX_INSIGHTS_PER_RUN)) {
    if (existingSummaries.has(insight.summary)) continue

    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO mercury_proactive_insights (id, user_id, insight_type, summary, entities, documents, confidence, created_at)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, NOW())`,
        userId,
        insight.type,
        insight.summary,
        insight.entities,
        insight.documents,
        insight.confidence,
      )
      stored++
    } catch (err) {
      logger.warn('[CyGraph] Insight storage failed:', err)
    }
  }

  logger.info('[CyGraph] Proactive analysis complete', {
    tenantId,
    candidates: insights.length,
    stored,
    latencyMs: Date.now() - t0,
  })

  return stored
}

/**
 * Find entities with conflicting claims across documents.
 * E.g., Doc A says "Contract value: $1M", Doc B says "Contract value: $2M"
 */
async function findContradictions(tenantId: string): Promise<InsightCandidate[]> {
  const results: InsightCandidate[] = []

  // Find claims with same subject + predicate but different object values
  const conflicts = await prisma.$queryRawUnsafe<Array<{
    entity_name: string
    predicate: string
    values: string
    doc_count: bigint
    entity_id: string
  }>>(
    `SELECT e.name as entity_name, c.predicate,
            STRING_AGG(DISTINCT c.object_value, ' vs. ') as values,
            COUNT(DISTINCT p.document_id) as doc_count,
            e.id as entity_id
     FROM kg_claims c
     JOIN kg_entities e ON c.subject_entity_id = e.id
     JOIN kg_provenance p ON p.claim_id = c.id
     WHERE c.tenant_id = $1 AND c.status = 'active' AND e.merged_into IS NULL
     GROUP BY e.id, e.name, c.predicate
     HAVING COUNT(DISTINCT c.object_value) > 1
     LIMIT 10`,
    tenantId,
  )

  for (const row of conflicts) {
    // Fetch document IDs involved
    const docs = await prisma.$queryRawUnsafe<Array<{ document_id: string }>>(
      `SELECT DISTINCT p.document_id
       FROM kg_provenance p
       JOIN kg_claims c ON p.claim_id = c.id
       WHERE c.subject_entity_id = $1 AND c.predicate = $2`,
      row.entity_id, row.predicate,
    )

    results.push({
      type: 'contradiction',
      summary: `Conflicting values for "${row.entity_name}" (${row.predicate}): ${row.values}`,
      entities: [row.entity_name],
      documents: docs.map(d => d.document_id),
      confidence: 0.8,
    })
  }

  return results
}

/**
 * Find claims where overlapping subjects have inconsistent predicates.
 */
async function findInconsistencies(tenantId: string): Promise<InsightCandidate[]> {
  const results: InsightCandidate[] = []

  // Find entities with many claims that have low-confidence entries
  const lowConfidence = await prisma.$queryRawUnsafe<Array<{
    entity_name: string
    predicate: string
    object_value: string
    confidence: number
    entity_id: string
  }>>(
    `SELECT e.name as entity_name, c.predicate, c.object_value, c.confidence, e.id as entity_id
     FROM kg_claims c
     JOIN kg_entities e ON c.subject_entity_id = e.id
     WHERE c.tenant_id = $1 AND c.status = 'active' AND c.confidence < 0.6 AND e.merged_into IS NULL
     ORDER BY c.confidence ASC
     LIMIT 10`,
    tenantId,
  )

  for (const row of lowConfidence) {
    results.push({
      type: 'inconsistency',
      summary: `Low-confidence claim: "${row.entity_name}" ${row.predicate} "${row.object_value}" (${Math.round(row.confidence * 100)}% confidence)`,
      entities: [row.entity_name],
      documents: [],
      confidence: 0.6,
    })
  }

  return results
}

/**
 * Find entities mentioned in conversations (DISCUSSED_IN edges) but
 * with no document-sourced claims.
 */
async function findGaps(tenantId: string): Promise<InsightCandidate[]> {
  const results: InsightCandidate[] = []

  const gapEntities = await prisma.$queryRawUnsafe<Array<{
    entity_name: string
    entity_type: string
    discussion_count: bigint
  }>>(
    `SELECT e.name as entity_name, e.entity_type,
            COUNT(DISTINCT ed.id) as discussion_count
     FROM kg_entities e
     JOIN kg_edges ed ON ed.from_entity_id = e.id AND ed.relation_type = 'discussed_in'
     LEFT JOIN kg_mentions m ON m.entity_id = e.id AND m.document_id IS NOT NULL
     WHERE e.tenant_id = $1 AND e.merged_into IS NULL AND m.id IS NULL
     GROUP BY e.id, e.name, e.entity_type
     HAVING COUNT(DISTINCT ed.id) >= 2
     LIMIT 10`,
    tenantId,
  )

  for (const row of gapEntities) {
    results.push({
      type: 'gap',
      summary: `"${row.entity_name}" (${row.entity_type}) was discussed ${row.discussion_count} times but has no supporting documents in the vault.`,
      entities: [row.entity_name],
      documents: [],
      confidence: 0.7,
    })
  }

  return results
}

/**
 * Find recurring entity co-occurrence patterns across documents.
 */
async function findPatterns(tenantId: string): Promise<InsightCandidate[]> {
  const results: InsightCandidate[] = []

  // Find entity pairs that frequently co-occur in documents
  const coOccurrences = await prisma.$queryRawUnsafe<Array<{
    entity_a: string
    entity_b: string
    doc_count: bigint
  }>>(
    `SELECT e1.name as entity_a, e2.name as entity_b, COUNT(DISTINCT m1.document_id) as doc_count
     FROM kg_mentions m1
     JOIN kg_mentions m2 ON m1.document_id = m2.document_id AND m1.entity_id < m2.entity_id
     JOIN kg_entities e1 ON m1.entity_id = e1.id AND e1.merged_into IS NULL
     JOIN kg_entities e2 ON m2.entity_id = e2.id AND e2.merged_into IS NULL
     WHERE e1.tenant_id = $1
     GROUP BY e1.name, e2.name
     HAVING COUNT(DISTINCT m1.document_id) >= 3
     ORDER BY doc_count DESC
     LIMIT 5`,
    tenantId,
  )

  for (const row of coOccurrences) {
    results.push({
      type: 'pattern',
      summary: `"${row.entity_a}" and "${row.entity_b}" co-occur across ${row.doc_count} documents — they may have a significant relationship.`,
      entities: [row.entity_a, row.entity_b],
      documents: [],
      confidence: 0.75,
    })
  }

  return results
}
