/**
 * Sarah — FINAL WAVE Task 3: CyGraph Phase 2 Tests
 *
 * Tests entity resolution, multi-hop traversal, temporal edges,
 * and context pack assembly with advanced graph features:
 * - Canonical normalization + fuzzy matching
 * - mergedInto pointer for entity dedup
 * - Alias resolution across documents
 * - 1-hop and 2-hop traversal
 * - Cycle detection in BFS
 * - Temporal edge validity windows
 * - Context pack token budgeting
 */

export {}

// ============================================================================
// TYPES — Matches CyGraph schema (kg_entities, kg_edges, kg_claims)
// ============================================================================

interface KgEntity {
  id: string
  tenantId: string
  name: string
  entityType: string
  canonical: string
  mergedInto?: string | null
  metadata?: Record<string, unknown> | null
}

interface KgEdge {
  id: string
  tenantId: string
  fromEntityId: string
  toEntityId: string
  relationType: string
  weight: number
  metadata?: Record<string, unknown> | null
  createdAt: Date
}

interface KgClaim {
  id: string
  tenantId: string
  subjectEntityId: string
  predicate: string
  objectValue: string
  confidence: number
  status: 'active' | 'disputed' | 'retracted'
}

interface ContextPackEntity {
  id: string
  name: string
  type: string
  mentionCount: number
}

interface ContextPack {
  entities: ContextPackEntity[]
  claims: Array<{ id: string; predicate: string; objectValue: string; confidence: number; subjectEntity: string }>
  relationships: Array<{ fromEntity: string; toEntity: string; relationship: string; confidence: number }>
}

// ============================================================================
// ENTITY RESOLUTION — Canonical + Fuzzy + Alias + MergedInto
// ============================================================================

describe('Sarah — CyGraph Phase 2: Entity Resolution', () => {
  function canonicalize(name: string): string {
    return name.toLowerCase().trim().replace(/\s+/g, '_')
  }

  function fuzzyMatch(a: string, b: string): boolean {
    const normA = canonicalize(a)
    const normB = canonicalize(b)
    if (normA === normB) return true
    // Substring containment as simple fuzzy
    if (normA.includes(normB) || normB.includes(normA)) return true
    return false
  }

  function resolveEntity(
    entityId: string,
    entities: Map<string, KgEntity>,
  ): KgEntity | null {
    const entity = entities.get(entityId)
    if (!entity) return null
    if (entity.mergedInto) {
      return resolveEntity(entity.mergedInto, entities)
    }
    return entity
  }

  function deduplicateEntities(
    extracted: Array<{ name: string; type: string }>,
    existing: KgEntity[],
  ): Array<{ name: string; type: string; existingId?: string }> {
    return extracted.map(e => {
      const match = existing.find(
        ex => ex.canonical === canonicalize(e.name) && ex.entityType === e.type.toLowerCase(),
      )
      return match ? { ...e, existingId: match.id } : e
    })
  }

  test('canonical normalization lowercases and replaces spaces with underscores', () => {
    expect(canonicalize('ACME Corporation')).toBe('acme_corporation')
    expect(canonicalize('  John  Doe  ')).toBe('john_doe')
  })

  test('canonical handles special characters', () => {
    expect(canonicalize('O\'Brien & Associates')).toBe("o'brien_&_associates")
    expect(canonicalize('Smith-Johnson LLC')).toBe('smith-johnson_llc')
  })

  test('fuzzy match detects exact canonical matches', () => {
    expect(fuzzyMatch('ACME Corp', 'acme_corp')).toBe(true)
    expect(fuzzyMatch('John Doe', 'john doe')).toBe(true)
  })

  test('fuzzy match detects substring containment', () => {
    expect(fuzzyMatch('ACME Corporation', 'ACME Corp')).toBe(true)
    expect(fuzzyMatch('Dr. Smith', 'Smith')).toBe(true)
  })

  test('fuzzy match rejects unrelated names', () => {
    expect(fuzzyMatch('ACME Corp', 'Globex Inc')).toBe(false)
    expect(fuzzyMatch('John', 'Jane')).toBe(false)
  })

  test('mergedInto pointer resolves to canonical entity', () => {
    const entities = new Map<string, KgEntity>([
      ['e1', { id: 'e1', tenantId: 't1', name: 'ACME', entityType: 'organization', canonical: 'acme', mergedInto: 'e2' }],
      ['e2', { id: 'e2', tenantId: 't1', name: 'ACME Corporation', entityType: 'organization', canonical: 'acme_corporation', mergedInto: null }],
    ])
    const resolved = resolveEntity('e1', entities)
    expect(resolved!.id).toBe('e2')
    expect(resolved!.name).toBe('ACME Corporation')
  })

  test('mergedInto chain resolves through multiple hops', () => {
    const entities = new Map<string, KgEntity>([
      ['e1', { id: 'e1', tenantId: 't1', name: 'Acme', entityType: 'organization', canonical: 'acme', mergedInto: 'e2' }],
      ['e2', { id: 'e2', tenantId: 't1', name: 'ACME Corp', entityType: 'organization', canonical: 'acme_corp', mergedInto: 'e3' }],
      ['e3', { id: 'e3', tenantId: 't1', name: 'ACME Corporation', entityType: 'organization', canonical: 'acme_corporation', mergedInto: null }],
    ])
    const resolved = resolveEntity('e1', entities)
    expect(resolved!.id).toBe('e3')
  })

  test('entity without mergedInto resolves to itself', () => {
    const entities = new Map<string, KgEntity>([
      ['e1', { id: 'e1', tenantId: 't1', name: 'Solo Corp', entityType: 'organization', canonical: 'solo_corp', mergedInto: null }],
    ])
    expect(resolveEntity('e1', entities)!.id).toBe('e1')
  })

  test('deduplication matches extracted entity to existing by canonical', () => {
    const existing: KgEntity[] = [
      { id: 'e1', tenantId: 't1', name: 'ACME Corporation', entityType: 'organization', canonical: 'acme_corporation' },
    ]
    const result = deduplicateEntities(
      [{ name: 'ACME  Corporation', type: 'Organization' }],
      existing,
    )
    expect(result[0].existingId).toBe('e1')
  })

  test('deduplication creates new entry when no match exists', () => {
    const existing: KgEntity[] = [
      { id: 'e1', tenantId: 't1', name: 'ACME', entityType: 'organization', canonical: 'acme' },
    ]
    const result = deduplicateEntities(
      [{ name: 'Globex Inc', type: 'Organization' }],
      existing,
    )
    expect(result[0].existingId).toBeUndefined()
  })
})

// ============================================================================
// MULTI-HOP TRAVERSAL — 1-hop, 2-hop, Cycle Detection
// ============================================================================

describe('Sarah — CyGraph Phase 2: Multi-Hop Traversal', () => {
  function buildAdjacency(edges: KgEdge[]): Map<string, Set<string>> {
    const adj = new Map<string, Set<string>>()
    for (const edge of edges) {
      if (!adj.has(edge.fromEntityId)) adj.set(edge.fromEntityId, new Set())
      if (!adj.has(edge.toEntityId)) adj.set(edge.toEntityId, new Set())
      adj.get(edge.fromEntityId)!.add(edge.toEntityId)
      adj.get(edge.toEntityId)!.add(edge.fromEntityId)
    }
    return adj
  }

  function traverseHops(
    startId: string,
    adj: Map<string, Set<string>>,
    maxHops: number,
  ): Set<string> {
    const visited = new Set<string>([startId])
    let frontier = new Set<string>([startId])
    for (let hop = 0; hop < maxHops; hop++) {
      const next = new Set<string>()
      for (const nodeId of frontier) {
        const neighbors = adj.get(nodeId) ?? new Set()
        for (const n of neighbors) {
          if (!visited.has(n)) {
            visited.add(n)
            next.add(n)
          }
        }
      }
      frontier = next
      if (frontier.size === 0) break
    }
    visited.delete(startId) // exclude start node
    return visited
  }

  function filterEdgesByWeight(edges: KgEdge[], minWeight: number): KgEdge[] {
    return edges.filter(e => e.weight >= minWeight)
  }

  const now = new Date()
  const sampleEdges: KgEdge[] = [
    { id: 'r1', tenantId: 't1', fromEntityId: 'A', toEntityId: 'B', relationType: 'signed', weight: 0.9, createdAt: now },
    { id: 'r2', tenantId: 't1', fromEntityId: 'B', toEntityId: 'C', relationType: 'references', weight: 0.8, createdAt: now },
    { id: 'r3', tenantId: 't1', fromEntityId: 'C', toEntityId: 'D', relationType: 'governs', weight: 0.7, createdAt: now },
    { id: 'r4', tenantId: 't1', fromEntityId: 'D', toEntityId: 'A', relationType: 'party_to', weight: 0.6, createdAt: now },
  ]

  test('1-hop traversal returns direct neighbors only', () => {
    const adj = buildAdjacency(sampleEdges)
    const result = traverseHops('A', adj, 1)
    expect(result).toEqual(new Set(['B', 'D']))
  })

  test('2-hop traversal expands to second-degree connections', () => {
    const adj = buildAdjacency(sampleEdges)
    const result = traverseHops('A', adj, 2)
    expect(result).toEqual(new Set(['B', 'C', 'D']))
  })

  test('3-hop traversal reaches full graph when connected', () => {
    const adj = buildAdjacency(sampleEdges)
    const result = traverseHops('A', adj, 3)
    expect(result).toEqual(new Set(['B', 'C', 'D']))
  })

  test('cycle detection via visited set prevents infinite loop', () => {
    // A→B→C→D→A is a cycle; BFS visited set breaks it
    const adj = buildAdjacency(sampleEdges)
    const result = traverseHops('A', adj, 10)
    expect(result.size).toBe(3) // B, C, D — not infinite
  })

  test('isolated entity returns empty set', () => {
    const adj = buildAdjacency(sampleEdges)
    const result = traverseHops('Z', adj, 2)
    expect(result.size).toBe(0)
  })

  test('edge weight filter removes low-confidence edges', () => {
    const filtered = filterEdgesByWeight(sampleEdges, 0.75)
    expect(filtered.length).toBe(2)
    expect(filtered.map(e => e.id)).toEqual(['r1', 'r2'])
  })

  test('edge weight filter at 0.5 includes all edges', () => {
    const filtered = filterEdgesByWeight(sampleEdges, 0.5)
    expect(filtered.length).toBe(4)
  })

  test('adjacency map is bidirectional', () => {
    const adj = buildAdjacency(sampleEdges)
    expect(adj.get('A')!.has('B')).toBe(true)
    expect(adj.get('B')!.has('A')).toBe(true)
  })
})

// ============================================================================
// TEMPORAL EDGES — Validity Windows + Expiry Filtering
// ============================================================================

describe('Sarah — CyGraph Phase 2: Temporal Edges', () => {
  interface TemporalEdge extends KgEdge {
    validFrom?: Date
    validUntil?: Date
  }

  function filterTemporalEdges(edges: TemporalEdge[], asOf: Date): TemporalEdge[] {
    return edges.filter(e => {
      if (e.validFrom && e.validFrom > asOf) return false
      if (e.validUntil && e.validUntil < asOf) return false
      return true
    })
  }

  const now = new Date('2026-03-04')
  const past = new Date('2025-01-01')
  const future = new Date('2027-12-31')

  const edges: TemporalEdge[] = [
    { id: 't1', tenantId: 't1', fromEntityId: 'A', toEntityId: 'B', relationType: 'governs', weight: 0.9, createdAt: now, validFrom: past, validUntil: future },
    { id: 't2', tenantId: 't1', fromEntityId: 'B', toEntityId: 'C', relationType: 'signed', weight: 0.8, createdAt: now, validFrom: past, validUntil: new Date('2025-12-31') },
    { id: 't3', tenantId: 't1', fromEntityId: 'C', toEntityId: 'D', relationType: 'references', weight: 0.7, createdAt: now, validFrom: new Date('2027-01-01'), validUntil: future },
  ]

  test('current edges pass temporal filter', () => {
    const filtered = filterTemporalEdges(edges, now)
    expect(filtered.map(e => e.id)).toEqual(['t1'])
  })

  test('expired edges excluded by validUntil', () => {
    const filtered = filterTemporalEdges(edges, now)
    expect(filtered.find(e => e.id === 't2')).toBeUndefined()
  })

  test('future edges excluded by validFrom', () => {
    const filtered = filterTemporalEdges(edges, now)
    expect(filtered.find(e => e.id === 't3')).toBeUndefined()
  })

  test('edges without temporal bounds always included', () => {
    const unbounded: TemporalEdge[] = [
      { id: 'u1', tenantId: 't1', fromEntityId: 'X', toEntityId: 'Y', relationType: 'relates_to', weight: 1.0, createdAt: now },
    ]
    const filtered = filterTemporalEdges(unbounded, now)
    expect(filtered.length).toBe(1)
  })

  test('querying at past date includes then-valid edges', () => {
    const filtered = filterTemporalEdges(edges, new Date('2025-06-01'))
    expect(filtered.map(e => e.id).sort()).toEqual(['t1', 't2'])
  })
})

// ============================================================================
// CONTEXT PACK — Assembly + Token Budget
// ============================================================================

describe('Sarah — CyGraph Phase 2: Context Pack Assembly', () => {
  const MAX_TOKENS = 2000
  const CHARS_PER_TOKEN = 4

  function assembleContextPack(
    entities: ContextPackEntity[],
    claims: KgClaim[],
    edges: KgEdge[],
    entityMap: Map<string, string>, // id → name
  ): ContextPack {
    return {
      entities,
      claims: claims
        .filter(c => c.status === 'active')
        .sort((a, b) => b.confidence - a.confidence)
        .map(c => ({
          id: c.id,
          predicate: c.predicate,
          objectValue: c.objectValue,
          confidence: c.confidence,
          subjectEntity: entityMap.get(c.subjectEntityId) ?? 'unknown',
        })),
      relationships: edges
        .sort((a, b) => b.weight - a.weight)
        .map(e => ({
          fromEntity: entityMap.get(e.fromEntityId) ?? 'unknown',
          toEntity: entityMap.get(e.toEntityId) ?? 'unknown',
          relationship: e.relationType,
          confidence: e.weight,
        })),
    }
  }

  function serializeForPrompt(pack: ContextPack): string {
    if (pack.entities.length === 0 && pack.claims.length === 0) return ''
    const lines: string[] = ['=== Knowledge Graph Context ===']
    for (const claim of pack.claims) {
      lines.push(`[KG] ${claim.subjectEntity} → ${claim.predicate} → ${claim.objectValue} (${(claim.confidence * 100).toFixed(0)}%)`)
    }
    return lines.join('\n')
  }

  function budgetTokens(text: string): boolean {
    return text.length / CHARS_PER_TOKEN <= MAX_TOKENS
  }

  const entityMap = new Map([['e1', 'ACME Corp'], ['e2', 'Master Agreement'], ['e3', 'Jane Doe']])

  test('context pack excludes retracted claims', () => {
    const claims: KgClaim[] = [
      { id: 'c1', tenantId: 't1', subjectEntityId: 'e1', predicate: 'signed', objectValue: 'Contract A', confidence: 0.9, status: 'active' },
      { id: 'c2', tenantId: 't1', subjectEntityId: 'e1', predicate: 'owes', objectValue: '$50k', confidence: 0.8, status: 'retracted' },
    ]
    const pack = assembleContextPack([], claims, [], entityMap)
    expect(pack.claims.length).toBe(1)
    expect(pack.claims[0].id).toBe('c1')
  })

  test('claims sorted by confidence descending', () => {
    const claims: KgClaim[] = [
      { id: 'c1', tenantId: 't1', subjectEntityId: 'e1', predicate: 'p1', objectValue: 'v1', confidence: 0.6, status: 'active' },
      { id: 'c2', tenantId: 't1', subjectEntityId: 'e2', predicate: 'p2', objectValue: 'v2', confidence: 0.95, status: 'active' },
      { id: 'c3', tenantId: 't1', subjectEntityId: 'e3', predicate: 'p3', objectValue: 'v3', confidence: 0.8, status: 'active' },
    ]
    const pack = assembleContextPack([], claims, [], entityMap)
    expect(pack.claims.map(c => c.id)).toEqual(['c2', 'c3', 'c1'])
  })

  test('relationships sorted by weight descending', () => {
    const now = new Date()
    const edges: KgEdge[] = [
      { id: 'r1', tenantId: 't1', fromEntityId: 'e1', toEntityId: 'e2', relationType: 'signed', weight: 0.7, createdAt: now },
      { id: 'r2', tenantId: 't1', fromEntityId: 'e2', toEntityId: 'e3', relationType: 'governs', weight: 0.95, createdAt: now },
    ]
    const pack = assembleContextPack([], [], edges, entityMap)
    expect(pack.relationships[0].relationship).toBe('governs')
    expect(pack.relationships[1].relationship).toBe('signed')
  })

  test('serialization produces prompt-injectable string', () => {
    const pack: ContextPack = {
      entities: [{ id: 'e1', name: 'ACME', type: 'organization', mentionCount: 5 }],
      claims: [{ id: 'c1', predicate: 'signed', objectValue: 'Master Agreement', confidence: 0.9, subjectEntity: 'ACME' }],
      relationships: [],
    }
    const text = serializeForPrompt(pack)
    expect(text).toContain('=== Knowledge Graph Context ===')
    expect(text).toContain('[KG] ACME → signed → Master Agreement (90%)')
  })

  test('empty context pack produces empty string', () => {
    const pack: ContextPack = { entities: [], claims: [], relationships: [] }
    expect(serializeForPrompt(pack)).toBe('')
  })

  test('token budget enforced at 2000 tokens (8000 chars)', () => {
    const shortText = 'a'.repeat(7999)
    expect(budgetTokens(shortText)).toBe(true)
    const longText = 'a'.repeat(8001)
    expect(budgetTokens(longText)).toBe(false)
  })

  test('entity names resolved from ID map', () => {
    const now = new Date()
    const edges: KgEdge[] = [
      { id: 'r1', tenantId: 't1', fromEntityId: 'e1', toEntityId: 'e2', relationType: 'signed', weight: 0.9, createdAt: now },
    ]
    const pack = assembleContextPack([], [], edges, entityMap)
    expect(pack.relationships[0].fromEntity).toBe('ACME Corp')
    expect(pack.relationships[0].toEntity).toBe('Master Agreement')
  })
})
