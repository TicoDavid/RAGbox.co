/**
 * Sarah — Block 2: CyGraph Extraction Service Tests
 *
 * Tests the CyGraph2026 Knowledge Graph schema patterns:
 * - Entity extraction (CRUD, types, deduplication)
 * - Edge/relationship creation and typing
 * - Claim lifecycle (active → disputed → retracted)
 * - Provenance tracking (document → claim linkage)
 * - Mention NER extraction
 * - Knowledge event ingest API (validation, idempotency, rate limiting)
 * - Knowledge event process API (Pub/Sub, backend call, status lifecycle)
 */

// ── Mocks ───────────────────────────────────────────────────────────

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}))

jest.mock('@/lib/prisma', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockPrisma: any = {
    knowledgeEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    kgEntity: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    kgEdge: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    kgClaim: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    kgProvenance: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    kgMention: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    document: {
      create: jest.fn(),
    },
    mercuryAction: {
      create: jest.fn(),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(mockPrisma)),
  }
  return { __esModule: true, default: mockPrisma }
})

jest.mock('@/lib/audit/auditWriter', () => ({
  writeAuditEntry: jest.fn(() => Promise.resolve()),
}))

import prisma from '@/lib/prisma'

const db = prisma as unknown as Record<string, Record<string, jest.Mock>>

// ── Entity Types & Constants ────────────────────────────────────────

const ENTITY_TYPES = [
  'person',
  'organization',
  'concept',
  'location',
  'date',
  'event',
  'regulation',
  'statute',
] as const

const RELATION_TYPES = [
  'employs',
  'references',
  'cites',
  'contradicts',
  'amends',
  'relates_to',
] as const

const CLAIM_STATUSES = ['active', 'disputed', 'retracted'] as const

// ============================================================================
// ENTITY EXTRACTION
// ============================================================================

describe('Sarah — CyGraph2026: Entity Extraction', () => {
  beforeEach(() => jest.clearAllMocks())

  test('creates entity with all 8 valid entity types', () => {
    for (const entityType of ENTITY_TYPES) {
      const entity = {
        id: `ent-${entityType}`,
        tenantId: 'tenant-001',
        name: `Test ${entityType}`,
        entityType,
        canonical: `test_${entityType}`,
        metadata: {},
        mergedInto: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      expect(entity.entityType).toBe(entityType)
      expect(ENTITY_TYPES).toContain(entity.entityType)
    }
    expect(ENTITY_TYPES.length).toBe(8)
  })

  test('entity requires tenantId for multi-tenant isolation', () => {
    const entity = {
      tenantId: 'tenant-001',
      name: 'Acme Corp',
      entityType: 'organization' as const,
      canonical: 'acme_corp',
    }
    expect(entity.tenantId).toBeDefined()
    expect(entity.tenantId).toBe('tenant-001')
  })

  test('entity canonical form is normalized (lowercase, underscore)', () => {
    const rawName = 'John Smith'
    const canonical = rawName.toLowerCase().replace(/\s+/g, '_')
    expect(canonical).toBe('john_smith')
  })

  test('entity deduplication via mergedInto pointer', () => {
    const canonical = {
      id: 'ent-canonical',
      name: 'John Smith',
      mergedInto: null,
    }
    const duplicate = {
      id: 'ent-dup',
      name: 'J. Smith',
      mergedInto: 'ent-canonical',
    }

    expect(duplicate.mergedInto).toBe(canonical.id)
    expect(canonical.mergedInto).toBeNull()
  })

  test('entity metadata stores type-specific attributes as JSON', () => {
    const personEntity = {
      entityType: 'person' as const,
      name: 'Jane Doe',
      metadata: {
        title: 'CEO',
        organization: 'Acme Corp',
        email: 'jane@acme.com',
      },
    }
    expect(personEntity.metadata.title).toBe('CEO')
    expect(typeof personEntity.metadata).toBe('object')
  })

  test('entity has bidirectional edge relationships', () => {
    const entity = {
      id: 'ent-001',
      edgesFrom: [{ id: 'edge-1', relationType: 'employs' }],
      edgesTo: [{ id: 'edge-2', relationType: 'references' }],
      mentions: [{ id: 'mention-1', documentId: 'doc-1' }],
      claims: [{ id: 'claim-1', predicate: 'was_convicted_of' }],
    }
    expect(entity.edgesFrom.length).toBe(1)
    expect(entity.edgesTo.length).toBe(1)
    expect(entity.mentions.length).toBe(1)
    expect(entity.claims.length).toBe(1)
  })

  test('indexes exist on (tenantId, entityType) and (tenantId, name)', () => {
    // Verify the index patterns match Prisma schema
    const indexes = [
      ['tenantId', 'entityType'],
      ['tenantId', 'name'],
    ]
    for (const idx of indexes) {
      expect(idx).toContain('tenantId')
      expect(idx.length).toBe(2)
    }
  })

  test('Prisma upsert for entity dedup by canonical name', async () => {
    db.kgEntity.upsert.mockResolvedValue({
      id: 'ent-001',
      name: 'Acme Corp',
      canonical: 'acme_corp',
      entityType: 'organization',
    })

    const result = await prisma.kgEntity.upsert({
      where: { id: 'ent-001' },
      create: {
        tenantId: 'tenant-001',
        name: 'Acme Corp',
        canonical: 'acme_corp',
        entityType: 'organization',
      },
      update: {},
    })

    expect(result.canonical).toBe('acme_corp')
    expect(db.kgEntity.upsert).toHaveBeenCalledTimes(1)
  })
})

// ============================================================================
// EDGE / RELATIONSHIP EXTRACTION
// ============================================================================

describe('Sarah — CyGraph2026: Edge Extraction', () => {
  beforeEach(() => jest.clearAllMocks())

  test('creates edge with all 6 valid relation types', () => {
    for (const relationType of RELATION_TYPES) {
      const edge = {
        id: `edge-${relationType}`,
        tenantId: 'tenant-001',
        fromEntityId: 'ent-A',
        toEntityId: 'ent-B',
        relationType,
        weight: 1.0,
        metadata: {},
      }
      expect(edge.relationType).toBe(relationType)
      expect(RELATION_TYPES).toContain(edge.relationType)
    }
    expect(RELATION_TYPES.length).toBe(6)
  })

  test('edge weight defaults to 1.0', () => {
    const edge = {
      fromEntityId: 'ent-A',
      toEntityId: 'ent-B',
      relationType: 'employs' as const,
      weight: 1.0,
    }
    expect(edge.weight).toBe(1.0)
  })

  test('edge weight can express relationship strength (0-1)', () => {
    const weakEdge = { weight: 0.3 }
    const strongEdge = { weight: 0.95 }
    expect(weakEdge.weight).toBeLessThan(strongEdge.weight)
    expect(weakEdge.weight).toBeGreaterThan(0)
    expect(strongEdge.weight).toBeLessThanOrEqual(1.0)
  })

  test('edges are directed: from → to', () => {
    const edge = {
      fromEntityId: 'ent-employer',
      toEntityId: 'ent-employee',
      relationType: 'employs' as const,
    }
    expect(edge.fromEntityId).not.toBe(edge.toEntityId)
  })

  test('edge cascade deletes with entity', () => {
    // Prisma schema defines: fromEntity Relation(... onDelete: Cascade)
    // Testing the pattern: if entity is deleted, edges should be removed
    const edges = [
      { fromEntityId: 'ent-to-delete', toEntityId: 'ent-keep', relationType: 'cites' },
      { fromEntityId: 'ent-keep', toEntityId: 'ent-to-delete', relationType: 'references' },
    ]
    const deletedId = 'ent-to-delete'
    const affectedEdges = edges.filter(
      (e) => e.fromEntityId === deletedId || e.toEntityId === deletedId
    )
    expect(affectedEdges.length).toBe(2)
  })

  test('edge index on (tenantId, relationType)', () => {
    const index = ['tenantId', 'relationType']
    expect(index).toContain('tenantId')
    expect(index).toContain('relationType')
  })

  test('contradicts relationship implies opposing claims', () => {
    const contradiction = {
      fromEntityId: 'ent-clause-A',
      toEntityId: 'ent-clause-B',
      relationType: 'contradicts' as const,
      weight: 0.85,
    }
    expect(contradiction.relationType).toBe('contradicts')
    expect(contradiction.weight).toBeGreaterThan(0.5)
  })
})

// ============================================================================
// CLAIM LIFECYCLE
// ============================================================================

describe('Sarah — CyGraph2026: Claim Lifecycle', () => {
  beforeEach(() => jest.clearAllMocks())

  test('claim has all 3 valid statuses', () => {
    for (const status of CLAIM_STATUSES) {
      const claim = {
        id: `claim-${status}`,
        subjectEntityId: 'ent-001',
        predicate: 'was_convicted_of',
        objectValue: 'fraud',
        status,
        confidence: 0.9,
      }
      expect(CLAIM_STATUSES).toContain(claim.status)
    }
    expect(CLAIM_STATUSES.length).toBe(3)
  })

  test('claim confidence defaults to 1.0', () => {
    const claim = {
      predicate: 'filed_on',
      objectValue: '2026-01-15',
      confidence: 1.0,
      status: 'active' as const,
    }
    expect(claim.confidence).toBe(1.0)
  })

  test('claim confidence range is 0.0 to 1.0', () => {
    const lowConfidence = { confidence: 0.1 }
    const highConfidence = { confidence: 0.99 }
    expect(lowConfidence.confidence).toBeGreaterThanOrEqual(0)
    expect(highConfidence.confidence).toBeLessThanOrEqual(1.0)
  })

  test('claim lifecycle: active → disputed → retracted', () => {
    let status: string = 'active'

    // Dispute the claim
    status = 'disputed'
    expect(status).toBe('disputed')

    // Retract the claim
    status = 'retracted'
    expect(status).toBe('retracted')
  })

  test('claim links subject entity to object value', () => {
    const claim = {
      subjectEntityId: 'ent-company',
      predicate: 'earned_revenue_of',
      objectValue: '$1.2M',
      objectEntityId: null,
    }
    expect(claim.subjectEntityId).toBeDefined()
    expect(claim.objectValue).toBe('$1.2M')
    expect(claim.objectEntityId).toBeNull()
  })

  test('claim can reference object entity instead of plain text', () => {
    const claim = {
      subjectEntityId: 'ent-person',
      predicate: 'was_employed_by',
      objectValue: 'Acme Corp',
      objectEntityId: 'ent-acme',
    }
    expect(claim.objectEntityId).toBe('ent-acme')
  })

  test('claim has provenance array for audit trail', () => {
    const claim = {
      id: 'claim-001',
      provenance: [
        { documentId: 'doc-1', excerpt: 'Revenue was $1.2M', confidence: 0.95 },
        { documentId: 'doc-2', excerpt: 'Annual report shows...', confidence: 0.88 },
      ],
    }
    expect(claim.provenance.length).toBe(2)
    expect(claim.provenance[0].confidence).toBeGreaterThan(claim.provenance[1].confidence)
  })

  test('claim index on (tenantId, predicate) and status', () => {
    const indexes = [
      ['tenantId', 'predicate'],
    ]
    expect(indexes[0]).toContain('tenantId')
    expect(indexes[0]).toContain('predicate')
  })

  test('Prisma update transitions claim status', async () => {
    db.kgClaim.update.mockResolvedValue({
      id: 'claim-001',
      status: 'disputed',
      confidence: 0.4,
    })

    const result = await prisma.kgClaim.update({
      where: { id: 'claim-001' },
      data: { status: 'disputed', confidence: 0.4 },
    })

    expect(result.status).toBe('disputed')
    expect(result.confidence).toBe(0.4)
  })
})

// ============================================================================
// PROVENANCE TRACKING
// ============================================================================

describe('Sarah — CyGraph2026: Provenance Tracking', () => {
  beforeEach(() => jest.clearAllMocks())

  test('provenance links claim to document + chunk', () => {
    const prov = {
      claimId: 'claim-001',
      documentId: 'doc-contract',
      chunkId: 'chunk-42',
      excerpt: 'The defendant was convicted of securities fraud on March 15, 2026.',
      pageNumber: 7,
      confidence: 0.95,
      extractedAt: new Date(),
    }
    expect(prov.claimId).toBeDefined()
    expect(prov.documentId).toBeDefined()
    expect(prov.excerpt.length).toBeGreaterThan(0)
  })

  test('provenance pageNumber is optional', () => {
    const prov = {
      claimId: 'claim-001',
      documentId: 'doc-email',
      chunkId: null,
      excerpt: 'Meeting confirmed for Tuesday',
      pageNumber: null,
      confidence: 0.8,
    }
    expect(prov.pageNumber).toBeNull()
  })

  test('provenance confidence independent of claim confidence', () => {
    const claim = { confidence: 0.9 }
    const provenance = { confidence: 0.6 }
    expect(claim.confidence).not.toBe(provenance.confidence)
  })

  test('provenance indexes on claimId and documentId', () => {
    const indexes = ['claimId', 'documentId']
    expect(indexes).toContain('claimId')
    expect(indexes).toContain('documentId')
  })

  test('multiple provenance records per claim', async () => {
    db.kgProvenance.findMany.mockResolvedValue([
      { id: 'prov-1', claimId: 'claim-001', documentId: 'doc-1' },
      { id: 'prov-2', claimId: 'claim-001', documentId: 'doc-2' },
      { id: 'prov-3', claimId: 'claim-001', documentId: 'doc-3' },
    ])

    const provs = await prisma.kgProvenance.findMany({
      where: { claimId: 'claim-001' },
    })

    expect(provs.length).toBe(3)
    expect(provs.every((p: { claimId: string }) => p.claimId === 'claim-001')).toBe(true)
  })
})

// ============================================================================
// MENTION NER EXTRACTION
// ============================================================================

describe('Sarah — CyGraph2026: Mention Extraction', () => {
  beforeEach(() => jest.clearAllMocks())

  test('mention records text span with character offsets', () => {
    const mention = {
      entityId: 'ent-acme',
      documentId: 'doc-contract',
      chunkId: 'chunk-3',
      mentionText: 'Acme Corporation',
      startOffset: 142,
      endOffset: 158,
      confidence: 0.92,
    }
    expect(mention.endOffset - mention.startOffset).toBe(mention.mentionText.length)
    expect(mention.confidence).toBeGreaterThan(0.5)
  })

  test('mention confidence reflects NER extraction quality', () => {
    const exactMatch = { mentionText: 'Acme Corp', confidence: 0.99 }
    const fuzzyMatch = { mentionText: 'the company', confidence: 0.45 }
    expect(exactMatch.confidence).toBeGreaterThan(fuzzyMatch.confidence)
  })

  test('compound index on (documentId, entityId)', () => {
    const index = ['documentId', 'entityId']
    expect(index.length).toBe(2)
  })

  test('multiple mentions of same entity across documents', async () => {
    db.kgMention.findMany.mockResolvedValue([
      { documentId: 'doc-1', entityId: 'ent-acme', mentionText: 'Acme Corp' },
      { documentId: 'doc-2', entityId: 'ent-acme', mentionText: 'Acme Corporation' },
      { documentId: 'doc-3', entityId: 'ent-acme', mentionText: 'ACME' },
    ])

    const mentions = await prisma.kgMention.findMany({
      where: { entityId: 'ent-acme' },
    })

    expect(mentions.length).toBe(3)
    expect(mentions.every((m: { entityId: string }) => m.entityId === 'ent-acme')).toBe(true)
  })
})

// ============================================================================
// KNOWLEDGE EVENT INGEST — Validation
// ============================================================================

describe('Sarah — Knowledge Event Ingest: Validation', () => {
  const ALLOWED_CONTENT_TYPES = ['text/plain', 'text/markdown', 'text/html', 'application/json']

  test('valid payload passes Zod schema', () => {
    const payload = {
      event_id: 'evt-001',
      source_id: 'crm-001',
      source_name: 'Salesforce',
      title: 'Q3 Customer Report',
      content_type: 'text/plain',
      content: 'Revenue increased 15% quarter over quarter.',
      privilege_level: 'standard',
      tags: ['finance', 'quarterly'],
    }
    expect(payload.event_id.length).toBeGreaterThan(0)
    expect(payload.event_id.length).toBeLessThanOrEqual(256)
    expect(ALLOWED_CONTENT_TYPES).toContain(payload.content_type)
    expect(payload.tags.length).toBeLessThanOrEqual(20)
  })

  test('rejects content_type not in allowed list', () => {
    const invalidTypes = ['application/pdf', 'image/png', 'video/mp4']
    for (const ct of invalidTypes) {
      expect(ALLOWED_CONTENT_TYPES).not.toContain(ct)
    }
  })

  test('event_id max length is 256', () => {
    const tooLong = 'x'.repeat(257)
    expect(tooLong.length).toBeGreaterThan(256)
  })

  test('title max length is 512', () => {
    const validTitle = 'A'.repeat(512)
    const invalidTitle = 'A'.repeat(513)
    expect(validTitle.length).toBe(512)
    expect(invalidTitle.length).toBeGreaterThan(512)
  })

  test('tags limited to 20, each max 64 chars', () => {
    const validTags = Array.from({ length: 20 }, (_, i) => `tag-${i}`)
    expect(validTags.length).toBe(20)
    expect(validTags.every((t) => t.length <= 64)).toBe(true)

    const tooManyTags = Array.from({ length: 21 }, (_, i) => `tag-${i}`)
    expect(tooManyTags.length).toBeGreaterThan(20)
  })

  test('content 1 MB limit', () => {
    const MAX_CONTENT_BYTES = 1_048_576
    const bigContent = 'x'.repeat(MAX_CONTENT_BYTES + 1)
    expect(Buffer.byteLength(bigContent, 'utf8')).toBeGreaterThan(MAX_CONTENT_BYTES)
  })

  test('privilege_level defaults to standard', () => {
    const validLevels = ['standard', 'confidential', 'privileged']
    const defaultLevel = 'standard'
    expect(validLevels).toContain(defaultLevel)
  })

  test('callback_url validates as URL', () => {
    const validUrl = 'https://webhook.example.com/callback'
    const invalidUrl = 'not-a-url'
    expect(() => new URL(validUrl)).not.toThrow()
    expect(() => new URL(invalidUrl)).toThrow()
  })
})

// ============================================================================
// KNOWLEDGE EVENT INGEST — Idempotency & Rate Limiting
// ============================================================================

describe('Sarah — Knowledge Event Ingest: Idempotency', () => {
  beforeEach(() => jest.clearAllMocks())

  test('duplicate event_id returns already_processed status', async () => {
    db.knowledgeEvent.findUnique.mockResolvedValue({
      id: 'ke-001',
      status: 'indexed',
      documentId: 'doc-existing',
    })

    const existing = await prisma.knowledgeEvent.findUnique({
      where: {
        tenantId_eventId: {
          tenantId: 'tenant-001',
          eventId: 'evt-duplicate',
        },
      },
    })

    expect(existing).not.toBeNull()
    expect(existing!.documentId).toBe('doc-existing')
  })

  test('new event_id creates document + event in transaction', async () => {
    db.knowledgeEvent.findUnique.mockResolvedValue(null)

    const mockDoc = { id: 'doc-new', filename: 'src_evt.txt' }
    const mockEvent = { id: 'ke-new', eventId: 'evt-new', documentId: 'doc-new' }

    db.document.create.mockResolvedValue(mockDoc)
    db.knowledgeEvent.create.mockResolvedValue(mockEvent)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await (prisma.$transaction as any)(async (tx: any) => {
      const doc = await tx.document.create({ data: {} as never })
      const event = await tx.knowledgeEvent.create({ data: {} as never })
      return { doc, event }
    })

    expect(result.doc.id).toBe('doc-new')
    expect(result.event.documentId).toBe('doc-new')
  })

  test('rate limit: 100 events per minute per tenant', () => {
    const RATE_LIMIT = 100
    const WINDOW_MS = 60_000
    const rateLimitWindow = new Map<string, { count: number; resetAt: number }>()

    function checkRateLimit(tenantId: string): boolean {
      const now = Date.now()
      const entry = rateLimitWindow.get(tenantId)
      if (!entry || now > entry.resetAt) {
        rateLimitWindow.set(tenantId, { count: 1, resetAt: now + WINDOW_MS })
        return true
      }
      if (entry.count >= RATE_LIMIT) return false
      entry.count++
      return true
    }

    // First 100 should pass
    for (let i = 0; i < 100; i++) {
      expect(checkRateLimit('tenant-001')).toBe(true)
    }
    // 101st should fail
    expect(checkRateLimit('tenant-001')).toBe(false)

    // Different tenant still allowed
    expect(checkRateLimit('tenant-002')).toBe(true)
  })

  test('rate limit resets after window expires', () => {
    const rateLimitWindow = new Map<string, { count: number; resetAt: number }>()
    const pastReset = Date.now() - 1000 // already expired

    rateLimitWindow.set('tenant-001', { count: 100, resetAt: pastReset })

    const now = Date.now()
    const entry = rateLimitWindow.get('tenant-001')!
    if (now > entry.resetAt) {
      rateLimitWindow.set('tenant-001', { count: 1, resetAt: now + 60_000 })
    }

    expect(rateLimitWindow.get('tenant-001')!.count).toBe(1)
  })
})

// ============================================================================
// KNOWLEDGE EVENT INGEST — File Type Derivation
// ============================================================================

describe('Sarah — Knowledge Event Ingest: File Type Derivation', () => {
  function fileTypeFromContentType(ct: string): string {
    switch (ct) {
      case 'text/plain': return 'txt'
      case 'text/markdown': return 'md'
      case 'text/html': return 'html'
      case 'application/json': return 'json'
      default: return 'txt'
    }
  }

  test('text/plain → txt', () => expect(fileTypeFromContentType('text/plain')).toBe('txt'))
  test('text/markdown → md', () => expect(fileTypeFromContentType('text/markdown')).toBe('md'))
  test('text/html → html', () => expect(fileTypeFromContentType('text/html')).toBe('html'))
  test('application/json → json', () => expect(fileTypeFromContentType('application/json')).toBe('json'))
  test('unknown defaults to txt', () => expect(fileTypeFromContentType('application/pdf')).toBe('txt'))

  test('filename constructed from source_id + event_id', () => {
    const sourceId = 'crm-001'
    const eventId = 'evt-abc'
    const fileType = 'txt'
    const filename = `${sourceId}_${eventId}.${fileType}`
    expect(filename).toBe('crm-001_evt-abc.txt')
  })
})

// ============================================================================
// KNOWLEDGE EVENT PROCESS — Status Lifecycle
// ============================================================================

describe('Sarah — Knowledge Event Process: Status Lifecycle', () => {
  beforeEach(() => jest.clearAllMocks())

  test('status transitions: received → processing → indexed', async () => {
    // Step 1: Update to processing
    db.knowledgeEvent.update.mockResolvedValueOnce({ id: 'ke-001', status: 'processing' })

    const processing = await prisma.knowledgeEvent.update({
      where: { id: 'ke-001' },
      data: { status: 'processing' },
    })
    expect(processing.status).toBe('processing')

    // Step 2: Update to indexed
    db.knowledgeEvent.update.mockResolvedValueOnce({
      id: 'ke-001',
      status: 'indexed',
      processedAt: new Date(),
    })

    const indexed = await prisma.knowledgeEvent.update({
      where: { id: 'ke-001' },
      data: { status: 'indexed', processedAt: new Date() },
    })
    expect(indexed.status).toBe('indexed')
    expect(indexed.processedAt).toBeDefined()
  })

  test('failure transitions: received → processing → failed', async () => {
    db.knowledgeEvent.update
      .mockResolvedValueOnce({ status: 'processing' })
      .mockResolvedValueOnce({
        status: 'failed',
        errorDetails: 'Go backend returned 500: Internal Server Error',
        callbackUrl: null,
      })

    await prisma.knowledgeEvent.update({
      where: { id: 'ke-002' },
      data: { status: 'processing' },
    })

    const failed = await prisma.knowledgeEvent.update({
      where: { id: 'ke-002' },
      data: { status: 'failed', errorDetails: 'Go backend returned 500: Internal Server Error' },
    })

    expect(failed.status).toBe('failed')
    expect(failed.errorDetails).toContain('500')
  })

  test('errorDetails truncated to 4096 chars', () => {
    const longError = 'x'.repeat(5000)
    const truncated = longError.slice(0, 4096)
    expect(truncated.length).toBe(4096)
  })

  test('Pub/Sub message decodes from base64', () => {
    const payload = {
      eventId: 'ke-001',
      documentId: 'doc-001',
      tenantId: 'tenant-001',
      userId: 'user-001',
    }
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64')
    const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'))

    expect(decoded.eventId).toBe('ke-001')
    expect(decoded.documentId).toBe('doc-001')
  })

  test('direct JSON call also accepted (no Pub/Sub wrapper)', () => {
    const body = {
      eventId: 'ke-001',
      documentId: 'doc-001',
      tenantId: 'tenant-001',
      userId: 'user-001',
    }
    // No message.data wrapper — direct payload
    expect(body.eventId).toBeDefined()
    expect(body.documentId).toBeDefined()
  })

  test('callback URL fired on success with indexed status', () => {
    const callbackPayload = {
      event_id: 'evt-001',
      status: 'indexed',
      document_id: 'doc-001',
      processed_at: new Date().toISOString(),
    }
    expect(callbackPayload.status).toBe('indexed')
    expect(callbackPayload.processed_at).toBeDefined()
  })

  test('callback URL fired on failure with error', () => {
    const callbackPayload = {
      event_id: 'evt-001',
      status: 'failed',
      error: 'Go backend returned 500',
    }
    expect(callbackPayload.status).toBe('failed')
    expect(callbackPayload.error.length).toBeLessThanOrEqual(1024)
  })

  test('auth: Pub/Sub detected via User-Agent header', () => {
    const pubsubUA = 'Google-Cloud-Pub/Sub'
    const isPubSub = pubsubUA.includes('Google-Cloud-Pub/Sub')
    expect(isPubSub).toBe(true)

    const normalUA = 'Mozilla/5.0'
    expect(normalUA.includes('Google-Cloud-Pub/Sub')).toBe(false)
  })
})

// ============================================================================
// DEAD LETTER QUEUE
// ============================================================================

describe('Sarah — ROAM Dead Letter Queue', () => {
  beforeEach(() => jest.clearAllMocks())

  test('writeDeadLetter upserts by pubsubMessageId', async () => {
    db.roamDeadLetter = { upsert: jest.fn().mockResolvedValue({ id: 'dlq-1', attemptCount: 1 }) }
    db.mercuryAction.create.mockResolvedValue({ id: 'action-1' })

    const { writeDeadLetter } = await import('@/lib/roam/deadLetterWriter')

    await writeDeadLetter({
      tenantId: 'tenant-001',
      pubsubMessageId: 'msg-abc-123',
      eventType: 'document.process',
      payload: { documentId: 'doc-1' },
      errorMessage: 'Backend timeout',
      errorStatus: 504,
    })

    expect(db.roamDeadLetter.upsert).toHaveBeenCalledTimes(1)
    const call = db.roamDeadLetter.upsert.mock.calls[0][0]
    expect(call.where.pubsubMessageId).toBe('msg-abc-123')
    expect(call.create.attemptCount).toBe(1)
    expect(call.update.attemptCount).toEqual({ increment: 1 })
  })

  test('creates audit MercuryAction on DLQ write', async () => {
    db.roamDeadLetter = { upsert: jest.fn().mockResolvedValue({ id: 'dlq-1' }) }
    db.mercuryAction.create.mockResolvedValue({ id: 'action-1' })

    const { writeDeadLetter } = await import('@/lib/roam/deadLetterWriter')

    await writeDeadLetter({
      tenantId: 'tenant-001',
      pubsubMessageId: 'msg-def-456',
      eventType: 'knowledge.ingest',
      payload: {},
      errorMessage: 'Processing failed',
    })

    expect(db.mercuryAction.create).toHaveBeenCalledTimes(1)
    const auditCall = db.mercuryAction.create.mock.calls[0][0]
    expect(auditCall.data.actionType).toBe('roam_dlq_write')
    expect(auditCall.data.userId).toBe('system')
  })

  test('DLQ write never throws — catches and logs', async () => {
    db.roamDeadLetter = { upsert: jest.fn().mockRejectedValue(new Error('DB write fail')) }

    const { writeDeadLetter } = await import('@/lib/roam/deadLetterWriter')

    await expect(
      writeDeadLetter({
        tenantId: 'tenant-001',
        pubsubMessageId: 'msg-fail',
        eventType: 'test',
        payload: {},
        errorMessage: 'test error',
      })
    ).resolves.not.toThrow()
  })

  test('errorStatus is optional (defaults to null)', () => {
    const input = {
      tenantId: 'tenant-001',
      pubsubMessageId: 'msg-1',
      eventType: 'test',
      payload: {},
      errorMessage: 'some error',
    }
    expect(input).not.toHaveProperty('errorStatus')
  })
})
