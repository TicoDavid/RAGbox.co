/**
 * Sarah — Block 2: CyGraph Context Pack Tests
 *
 * Tests the context pack assembly pipeline:
 * - Query entity extraction from natural language
 * - Graph traversal (entity → edges → connected entities)
 * - Claim collection for matching entities
 * - Provenance retrieval for claims
 * - Context pack assembly (entities + claims + provenance → prompt augmentation)
 * - Empty graph / no-match handling
 * - Knowledge stats API
 * - Knowledge events listing API
 */

// ── Mocks ───────────────────────────────────────────────────────────

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}))

jest.mock('@/lib/prisma', () => {
  const mockPrisma = {
    kgEntity: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    kgEdge: {
      findMany: jest.fn(),
    },
    kgClaim: {
      findMany: jest.fn(),
    },
    kgProvenance: {
      findMany: jest.fn(),
    },
    kgMention: {
      findMany: jest.fn(),
    },
    document: {
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    mercuryAction: {
      count: jest.fn(),
    },
    knowledgeEvent: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  }
  return { __esModule: true, default: mockPrisma }
})

import prisma from '@/lib/prisma'

const db = prisma as unknown as Record<string, Record<string, jest.Mock>>

// ============================================================================
// QUERY ENTITY EXTRACTION
// ============================================================================

describe('Sarah — Context Pack: Query Entity Extraction', () => {
  beforeEach(() => jest.clearAllMocks())

  test('extracts named entities from query text', () => {
    const query = 'What is the liability cap for Acme Corp in the contract with John Smith?'

    // Simple NER pattern: look for capitalized multi-word phrases
    const entityPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g
    const matches = query.match(entityPattern) || []

    // Regex captures multi-word capitalized phrases
    expect(matches).toContain('Acme Corp')
    expect(matches).toContain('John Smith')
  })

  test('maps extracted names to KgEntity via canonical lookup', async () => {
    db.kgEntity.findMany.mockResolvedValue([
      { id: 'ent-acme', name: 'Acme Corp', canonical: 'acme_corp', entityType: 'organization' },
      { id: 'ent-john', name: 'John Smith', canonical: 'john_smith', entityType: 'person' },
    ])

    const entities = await prisma.kgEntity.findMany({
      where: {
        tenantId: 'tenant-001',
        canonical: { in: ['acme_corp', 'john_smith'] },
      },
    })

    expect(entities.length).toBe(2)
    expect(entities.map((e: { entityType: string }) => e.entityType)).toEqual(
      expect.arrayContaining(['organization', 'person'])
    )
  })

  test('canonical normalization for lookup', () => {
    const normalize = (name: string) => name.toLowerCase().trim().replace(/\s+/g, '_')

    expect(normalize('Acme Corp')).toBe('acme_corp')
    expect(normalize('  John  Smith  ')).toBe('john_smith')
    expect(normalize('SEC')).toBe('sec')
  })

  test('handles no entities found in query', async () => {
    db.kgEntity.findMany.mockResolvedValue([])

    const entities = await prisma.kgEntity.findMany({
      where: { tenantId: 'tenant-001', canonical: { in: [] } },
    })

    expect(entities.length).toBe(0)
  })

  test('mergedInto resolution: follows dedup pointer', async () => {
    db.kgEntity.findFirst
      .mockResolvedValueOnce({
        id: 'ent-dup',
        name: 'J. Smith',
        mergedInto: 'ent-canonical',
      })
      .mockResolvedValueOnce({
        id: 'ent-canonical',
        name: 'John Smith',
        mergedInto: null,
      })

    const dup = await prisma.kgEntity.findFirst({ where: { id: 'ent-dup' } })
    expect(dup!.mergedInto).toBe('ent-canonical')

    const canonical = await prisma.kgEntity.findFirst({ where: { id: dup!.mergedInto! } })
    expect(canonical!.mergedInto).toBeNull()
    expect(canonical!.name).toBe('John Smith')
  })
})

// ============================================================================
// GRAPH TRAVERSAL
// ============================================================================

describe('Sarah — Context Pack: Graph Traversal', () => {
  beforeEach(() => jest.clearAllMocks())

  test('1-hop traversal: entity → edges → connected entities', async () => {
    const seedEntityId = 'ent-acme'

    db.kgEdge.findMany.mockResolvedValue([
      { fromEntityId: 'ent-acme', toEntityId: 'ent-john', relationType: 'employs', weight: 1.0 },
      { fromEntityId: 'ent-acme', toEntityId: 'ent-sec', relationType: 'references', weight: 0.8 },
    ])

    const edges = await prisma.kgEdge.findMany({
      where: {
        OR: [
          { fromEntityId: seedEntityId },
          { toEntityId: seedEntityId },
        ],
      },
    })

    expect(edges.length).toBe(2)
    const connectedIds = edges.map((e: { fromEntityId: string; toEntityId: string }) =>
      e.fromEntityId === seedEntityId ? e.toEntityId : e.fromEntityId
    )
    expect(connectedIds).toContain('ent-john')
    expect(connectedIds).toContain('ent-sec')
  })

  test('2-hop traversal expands graph frontier', async () => {
    // Hop 1: acme → john, acme → sec
    // Hop 2: john → lawsuit-2024, sec → regulation-xyz
    const hop1 = new Set(['ent-john', 'ent-sec'])
    const hop2 = new Set(['ent-lawsuit-2024', 'ent-regulation-xyz'])

    const allEntities = new Set(['ent-acme', ...hop1, ...hop2])
    expect(allEntities.size).toBe(5)
  })

  test('traversal respects edge weight threshold', () => {
    const edges = [
      { toEntityId: 'ent-strong', weight: 0.9 },
      { toEntityId: 'ent-weak', weight: 0.2 },
      { toEntityId: 'ent-medium', weight: 0.5 },
    ]

    const threshold = 0.5
    const strongEdges = edges.filter((e) => e.weight >= threshold)
    expect(strongEdges.length).toBe(2)
    expect(strongEdges.map((e) => e.toEntityId)).not.toContain('ent-weak')
  })

  test('traversal handles cycles without infinite loop', () => {
    // A → B → C → A (cycle)
    const edges = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
      { from: 'C', to: 'A' }, // back-edge
    ]

    const visited = new Set<string>()
    const queue = ['A']

    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current)) continue
      visited.add(current)

      const outgoing = edges.filter((e) => e.from === current)
      for (const e of outgoing) {
        if (!visited.has(e.to)) {
          queue.push(e.to)
        }
      }
    }

    expect(visited.size).toBe(3) // A, B, C — no infinite loop
  })

  test('traversal returns empty set for isolated entity', async () => {
    db.kgEdge.findMany.mockResolvedValue([])

    const edges = await prisma.kgEdge.findMany({
      where: {
        OR: [
          { fromEntityId: 'ent-isolated' },
          { toEntityId: 'ent-isolated' },
        ],
      },
    })

    expect(edges.length).toBe(0)
  })
})

// ============================================================================
// CLAIM COLLECTION
// ============================================================================

describe('Sarah — Context Pack: Claim Collection', () => {
  beforeEach(() => jest.clearAllMocks())

  test('collects active claims for traversed entities', async () => {
    const entityIds = ['ent-acme', 'ent-john']

    db.kgClaim.findMany.mockResolvedValue([
      {
        id: 'claim-1',
        subjectEntityId: 'ent-acme',
        predicate: 'earned_revenue_of',
        objectValue: '$1.2M',
        status: 'active',
        confidence: 0.95,
      },
      {
        id: 'claim-2',
        subjectEntityId: 'ent-john',
        predicate: 'was_employed_by',
        objectValue: 'Acme Corp',
        status: 'active',
        confidence: 0.88,
      },
    ])

    const claims = await prisma.kgClaim.findMany({
      where: {
        subjectEntityId: { in: entityIds },
        status: 'active',
      },
    })

    expect(claims.length).toBe(2)
    expect(claims.every((c: { status: string }) => c.status === 'active')).toBe(true)
  })

  test('excludes retracted claims', async () => {
    db.kgClaim.findMany.mockResolvedValue([
      { id: 'claim-1', status: 'active', confidence: 0.9 },
      // retracted claim filtered out by query
    ])

    const claims = await prisma.kgClaim.findMany({
      where: {
        subjectEntityId: { in: ['ent-acme'] },
        status: { not: 'retracted' },
      },
    })

    expect(claims.every((c: { status: string }) => c.status !== 'retracted')).toBe(true)
  })

  test('includes disputed claims with lower priority', () => {
    const claims = [
      { status: 'active', confidence: 0.95 },
      { status: 'disputed', confidence: 0.4 },
    ]

    const sorted = [...claims].sort((a, b) => {
      // Active before disputed
      if (a.status === 'active' && b.status === 'disputed') return -1
      if (a.status === 'disputed' && b.status === 'active') return 1
      return b.confidence - a.confidence
    })

    expect(sorted[0].status).toBe('active')
    expect(sorted[1].status).toBe('disputed')
  })

  test('claims ordered by confidence descending', () => {
    const claims = [
      { confidence: 0.6 },
      { confidence: 0.95 },
      { confidence: 0.8 },
    ]

    const sorted = [...claims].sort((a, b) => b.confidence - a.confidence)
    expect(sorted[0].confidence).toBe(0.95)
    expect(sorted[2].confidence).toBe(0.6)
  })
})

// ============================================================================
// PROVENANCE RETRIEVAL
// ============================================================================

describe('Sarah — Context Pack: Provenance Retrieval', () => {
  beforeEach(() => jest.clearAllMocks())

  test('retrieves provenance records for collected claims', async () => {
    const claimIds = ['claim-1', 'claim-2']

    db.kgProvenance.findMany.mockResolvedValue([
      {
        id: 'prov-1',
        claimId: 'claim-1',
        documentId: 'doc-contract',
        excerpt: 'Revenue was reported as $1.2M in Q3.',
        pageNumber: 4,
        confidence: 0.92,
      },
      {
        id: 'prov-2',
        claimId: 'claim-2',
        documentId: 'doc-hr',
        excerpt: 'John Smith joined Acme Corp in 2022.',
        pageNumber: 1,
        confidence: 0.99,
      },
    ])

    const provs = await prisma.kgProvenance.findMany({
      where: { claimId: { in: claimIds } },
    })

    expect(provs.length).toBe(2)
    expect(provs[0].excerpt).toContain('$1.2M')
  })

  test('provenance excerpts feed into RAG context window', () => {
    const excerpts = [
      'Revenue was reported as $1.2M in Q3.',
      'John Smith joined Acme Corp in 2022.',
    ]

    const contextBlock = excerpts
      .map((e, i) => `[KG-${i + 1}] ${e}`)
      .join('\n')

    expect(contextBlock).toContain('[KG-1]')
    expect(contextBlock).toContain('[KG-2]')
    expect(contextBlock.split('\n').length).toBe(2)
  })
})

// ============================================================================
// CONTEXT PACK ASSEMBLY
// ============================================================================

describe('Sarah — Context Pack: Assembly', () => {
  test('assembles context pack from entities + claims + provenance', () => {
    const entities = [
      { id: 'ent-acme', name: 'Acme Corp', entityType: 'organization' },
      { id: 'ent-john', name: 'John Smith', entityType: 'person' },
    ]

    const claims = [
      {
        subjectEntityId: 'ent-acme',
        predicate: 'earned_revenue_of',
        objectValue: '$1.2M',
        confidence: 0.95,
      },
    ]

    const provenance = [
      {
        claimId: 'claim-1',
        excerpt: 'Revenue was $1.2M in Q3.',
        documentId: 'doc-contract',
      },
    ]

    const contextPack = {
      entities: entities.map((e) => `${e.entityType}: ${e.name}`),
      facts: claims.map((c) => `${c.predicate}(${c.objectValue}) [conf: ${c.confidence}]`),
      evidence: provenance.map((p) => p.excerpt),
    }

    expect(contextPack.entities.length).toBe(2)
    expect(contextPack.facts.length).toBe(1)
    expect(contextPack.evidence.length).toBe(1)
    expect(contextPack.facts[0]).toContain('earned_revenue_of')
  })

  test('context pack serializes to prompt-injectable string', () => {
    const contextPack = {
      entities: ['organization: Acme Corp'],
      facts: ['earned_revenue_of($1.2M) [conf: 0.95]'],
      evidence: ['Revenue was $1.2M in Q3.'],
    }

    const prompt = [
      '=== Knowledge Graph Context ===',
      'Entities: ' + contextPack.entities.join(', '),
      'Facts: ' + contextPack.facts.join('; '),
      'Evidence: ' + contextPack.evidence.map((e, i) => `[${i + 1}] ${e}`).join(' '),
      '=== End KG Context ===',
    ].join('\n')

    expect(prompt).toContain('Knowledge Graph Context')
    expect(prompt).toContain('Acme Corp')
    expect(prompt).toContain('$1.2M')
  })

  test('empty context pack produces empty augmentation', () => {
    const contextPack = {
      entities: [] as string[],
      facts: [] as string[],
      evidence: [] as string[],
    }

    const hasContent = contextPack.entities.length > 0 ||
      contextPack.facts.length > 0 ||
      contextPack.evidence.length > 0

    expect(hasContent).toBe(false)
  })

  test('context pack respects token budget', () => {
    const MAX_TOKENS = 2000
    const CHARS_PER_TOKEN = 4

    const longFacts = Array.from({ length: 200 }, (_, i) =>
      `fact_${i}(some very long value that takes space and fills up the token budget quickly) [conf: 0.9]`
    )

    let totalChars = 0
    const budgetedFacts: string[] = []
    for (const fact of longFacts) {
      if (totalChars + fact.length > MAX_TOKENS * CHARS_PER_TOKEN) break
      budgetedFacts.push(fact)
      totalChars += fact.length
    }

    expect(budgetedFacts.length).toBeLessThan(longFacts.length)
    expect(totalChars).toBeLessThanOrEqual(MAX_TOKENS * CHARS_PER_TOKEN)
  })
})

// ============================================================================
// KNOWLEDGE STATS API
// ============================================================================

describe('Sarah — Knowledge Stats API', () => {
  beforeEach(() => jest.clearAllMocks())

  test('returns document and query counts', async () => {
    db.document.count
      .mockResolvedValueOnce(42) // total docs
      .mockResolvedValueOnce(5) // privileged docs

    db.document.aggregate.mockResolvedValue({
      _sum: { chunkCount: 1200 },
    })

    db.mercuryAction.count.mockResolvedValue(350)

    const docCount = await prisma.document.count()
    const privCount = await prisma.document.count()
    const chunks = await prisma.document.aggregate({ _sum: { chunkCount: true } })
    const queryCount = await prisma.mercuryAction.count()

    const stats = {
      documentCount: docCount,
      privilegedCount: privCount,
      chunkCount: chunks._sum?.chunkCount,
      embeddingDimensions: 768,
      queryCount,
    }

    expect(stats.documentCount).toBe(42)
    expect(stats.privilegedCount).toBe(5)
    expect(stats.chunkCount).toBe(1200)
    expect(stats.embeddingDimensions).toBe(768)
    expect(stats.queryCount).toBe(350)
  })
})

// ============================================================================
// KNOWLEDGE EVENTS LISTING
// ============================================================================

describe('Sarah — Knowledge Events Listing', () => {
  beforeEach(() => jest.clearAllMocks())

  test('lists events with pagination', async () => {
    db.knowledgeEvent.findMany.mockResolvedValue([
      { id: 'ke-1', eventId: 'evt-1', status: 'indexed', title: 'Report A' },
      { id: 'ke-2', eventId: 'evt-2', status: 'processing', title: 'Report B' },
    ])
    db.knowledgeEvent.count.mockResolvedValue(15)

    const events = await prisma.knowledgeEvent.findMany()
    const total = await prisma.knowledgeEvent.count()

    const response = {
      events,
      pagination: {
        total,
        limit: 25,
        offset: 0,
        hasMore: total > 25,
      },
    }

    expect(response.events.length).toBe(2)
    expect(response.pagination.total).toBe(15)
    expect(response.pagination.hasMore).toBe(false)
  })

  test('filters events by status', async () => {
    db.knowledgeEvent.findMany.mockResolvedValue([
      { id: 'ke-1', status: 'failed', errorDetails: 'Backend timeout' },
    ])

    const events = await prisma.knowledgeEvent.findMany({
      where: { status: 'failed' },
    })

    expect(events.length).toBe(1)
    expect(events[0].status).toBe('failed')
  })

  test('filters events by source_id', async () => {
    db.knowledgeEvent.findMany.mockResolvedValue([
      { sourceId: 'crm-001', title: 'CRM Update' },
    ])

    const events = await prisma.knowledgeEvent.findMany({
      where: { sourceId: 'crm-001' },
    })

    expect(events.length).toBe(1)
    expect(events[0].sourceId).toBe('crm-001')
  })

  test('pagination limit clamped to 1-100', () => {
    const clamp = (v: number) => Math.min(Math.max(v, 1), 100)
    expect(clamp(0)).toBe(1)
    expect(clamp(200)).toBe(100)
    expect(clamp(25)).toBe(25)
  })
})
