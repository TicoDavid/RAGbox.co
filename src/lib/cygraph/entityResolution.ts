/**
 * CyGraph Entity Resolution — FINAL WAVE Task 5
 *
 * Resolves duplicate entities across documents:
 * 1. Canonical name matching (lowercase, strip Inc/LLC/Corp suffixes)
 * 2. Alias matching (check kg_entities metadata aliases array)
 * 3. Fuzzy matching (Levenshtein distance < 3 for names > 5 chars)
 *
 * When a new entity matches an existing one, merges via mergedInto pointer.
 */

import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

// ── Canonical Normalization ─────────────────────────────────────────────

const SUFFIX_PATTERN = /\b(inc|llc|corp|corporation|ltd|limited|co|company|plc|gmbh|ag|sa|srl|nv|bv)\.?\s*$/i
const WHITESPACE = /\s+/g

/**
 * Normalize a name to canonical form:
 * - lowercase
 * - strip legal suffixes (Inc, LLC, Corp, etc.)
 * - collapse whitespace
 * - trim
 */
export function canonicalize(name: string): string {
  return name
    .toLowerCase()
    .replace(SUFFIX_PATTERN, '')
    .replace(WHITESPACE, ' ')
    .trim()
}

// ── Levenshtein Distance ────────────────────────────────────────────────

/**
 * Compute Levenshtein edit distance between two strings.
 * Used for fuzzy matching of entity names.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length

  // Early exit for empty strings
  if (m === 0) return n
  if (n === 0) return m

  // Use single-row DP for memory efficiency
  const prev = Array.from({ length: n + 1 }, (_, i) => i)
  const curr = new Array<number>(n + 1)

  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(
        prev[j] + 1,       // deletion
        curr[j - 1] + 1,   // insertion
        prev[j - 1] + cost  // substitution
      )
    }
    // Swap rows
    for (let j = 0; j <= n; j++) prev[j] = curr[j]
  }

  return prev[n]
}

// ── Match Types ─────────────────────────────────────────────────────────

export interface EntityMatch {
  entityId: string
  entityName: string
  matchType: 'canonical' | 'alias' | 'fuzzy'
  distance?: number  // For fuzzy matches
}

interface KgEntityRow {
  id: string
  name: string
  canonical: string | null
  metadata: string | null
  merged_into: string | null
}

// ── Core Resolution ─────────────────────────────────────────────────────

/**
 * Resolve an entity name against existing entities in the knowledge graph.
 * Returns the best match if found, null if the entity is new.
 *
 * Resolution order:
 * 1. Exact canonical match
 * 2. Alias match (metadata.aliases array)
 * 3. Fuzzy match (Levenshtein distance < 3 for names > 5 chars)
 */
export async function resolveEntity(
  tenantId: string,
  name: string,
  entityType: string,
): Promise<EntityMatch | null> {
  const canonical = canonicalize(name)
  if (!canonical) return null

  // 1. Canonical match — exact normalized name
  const canonicalMatches = await prisma.$queryRawUnsafe<KgEntityRow[]>(
    `SELECT id, name, canonical, metadata::text, merged_into
     FROM kg_entities
     WHERE tenant_id = $1
       AND entity_type = $2
       AND merged_into IS NULL
       AND (canonical = $3 OR LOWER(name) = $4)
     LIMIT 1`,
    tenantId, entityType.toLowerCase(), canonical, canonical,
  )

  if (canonicalMatches.length > 0) {
    return {
      entityId: canonicalMatches[0].id,
      entityName: canonicalMatches[0].name,
      matchType: 'canonical',
    }
  }

  // 2. Alias match — check metadata.aliases array for each candidate
  const aliasMatches = await prisma.$queryRawUnsafe<KgEntityRow[]>(
    `SELECT id, name, canonical, metadata::text, merged_into
     FROM kg_entities
     WHERE tenant_id = $1
       AND entity_type = $2
       AND merged_into IS NULL
       AND metadata IS NOT NULL
       AND metadata->'aliases' IS NOT NULL
     LIMIT 100`,
    tenantId, entityType.toLowerCase(),
  )

  for (const row of aliasMatches) {
    try {
      const meta = row.metadata ? JSON.parse(row.metadata) : null
      const aliases: string[] = Array.isArray(meta?.aliases) ? meta.aliases : []
      const match = aliases.some(alias => canonicalize(alias) === canonical)
      if (match) {
        return {
          entityId: row.id,
          entityName: row.name,
          matchType: 'alias',
        }
      }
    } catch {
      // Skip malformed metadata
    }
  }

  // 3. Fuzzy match — Levenshtein distance < 3 for names > 5 chars
  if (canonical.length > 5) {
    const candidates = await prisma.$queryRawUnsafe<KgEntityRow[]>(
      `SELECT id, name, canonical, metadata::text, merged_into
       FROM kg_entities
       WHERE tenant_id = $1
         AND entity_type = $2
         AND merged_into IS NULL
       LIMIT 200`,
      tenantId, entityType.toLowerCase(),
    )

    let bestMatch: EntityMatch | null = null
    let bestDistance = Infinity

    for (const row of candidates) {
      const candidateCanonical = row.canonical || canonicalize(row.name)
      const dist = levenshtein(canonical, candidateCanonical)
      if (dist > 0 && dist < 3 && dist < bestDistance) {
        bestDistance = dist
        bestMatch = {
          entityId: row.id,
          entityName: row.name,
          matchType: 'fuzzy',
          distance: dist,
        }
      }
    }

    if (bestMatch) return bestMatch
  }

  return null
}

// ── Merge Entity ────────────────────────────────────────────────────────

/**
 * Merge a duplicate entity into the canonical entity.
 * Sets mergedInto pointer and adds the duplicate name as an alias.
 */
export async function mergeEntity(
  duplicateId: string,
  canonicalId: string,
  duplicateName: string,
): Promise<void> {
  // Set mergedInto pointer
  await prisma.$executeRawUnsafe(
    `UPDATE kg_entities SET merged_into = $1, updated_at = NOW() WHERE id = $2`,
    canonicalId, duplicateId,
  )

  // Add duplicate name as alias on canonical entity
  await prisma.$executeRawUnsafe(
    `UPDATE kg_entities
     SET metadata = COALESCE(metadata, '{}'::jsonb) ||
       jsonb_build_object('aliases',
         COALESCE(metadata->'aliases', '[]'::jsonb) || to_jsonb($1::text)
       ),
       updated_at = NOW()
     WHERE id = $2`,
    duplicateName, canonicalId,
  )

  // Redirect edges from duplicate to canonical
  await prisma.$executeRawUnsafe(
    `UPDATE kg_edges SET from_entity_id = $1 WHERE from_entity_id = $2`,
    canonicalId, duplicateId,
  )
  await prisma.$executeRawUnsafe(
    `UPDATE kg_edges SET to_entity_id = $1 WHERE to_entity_id = $2`,
    canonicalId, duplicateId,
  )

  // Redirect mentions
  await prisma.$executeRawUnsafe(
    `UPDATE kg_mentions SET entity_id = $1 WHERE entity_id = $2`,
    canonicalId, duplicateId,
  )

  // Redirect claims
  await prisma.$executeRawUnsafe(
    `UPDATE kg_claims SET subject_entity_id = $1 WHERE subject_entity_id = $2`,
    canonicalId, duplicateId,
  )

  logger.info('[CyGraph] Entity merged', {
    duplicate: duplicateId,
    canonical: canonicalId,
    name: duplicateName,
  })
}

// ── Upsert with Resolution ──────────────────────────────────────────────

/**
 * Smart entity upsert: resolves against existing entities before creating new.
 * Returns the entity ID (existing or new).
 */
export async function upsertWithResolution(
  tenantId: string,
  name: string,
  entityType: string,
  aliases?: string[],
  attributes?: Record<string, unknown>,
): Promise<string> {
  // Try to resolve against existing entities
  const match = await resolveEntity(tenantId, name, entityType)

  if (match) {
    // If fuzzy match, add the new name as an alias
    if (match.matchType === 'fuzzy') {
      await prisma.$executeRawUnsafe(
        `UPDATE kg_entities
         SET metadata = COALESCE(metadata, '{}'::jsonb) ||
           jsonb_build_object('aliases',
             COALESCE(metadata->'aliases', '[]'::jsonb) || to_jsonb($1::text)
           ),
           updated_at = NOW()
         WHERE id = $2`,
        name, match.entityId,
      )
    }
    return match.entityId
  }

  // No match — create new entity
  const canonical = canonicalize(name)
  const meta: Record<string, unknown> = { ...attributes }
  if (aliases?.length) meta.aliases = aliases

  const result = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `INSERT INTO kg_entities (id, tenant_id, name, entity_type, canonical, metadata, created_at, updated_at)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5::jsonb, NOW(), NOW())
     RETURNING id`,
    tenantId,
    name.trim(),
    entityType.toLowerCase(),
    canonical,
    Object.keys(meta).length > 0 ? JSON.stringify(meta) : null,
  )

  return result[0].id
}
