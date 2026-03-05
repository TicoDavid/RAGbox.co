# CyGraph2026 — Knowledge Graph for RAGbox

> Developer guide to the CyGraph2026 knowledge graph subsystem: entity extraction, relationship modeling, claim tracking, and context pack assembly.

---

## Overview

CyGraph2026 is RAGbox's knowledge graph layer. It extracts structured entities, relationships, and claims from documents and conversations, then uses graph traversal to augment RAG queries with contextual knowledge.

**Pipeline:** Documents → Entity Extraction → Graph Storage → Context Pack → RAG Augmentation

---

## Data Model

CyGraph uses 5 Prisma models stored in PostgreSQL:

### KgEntity (Nodes)

Represents real-world objects: people, organizations, concepts, locations, dates, events, regulations, statutes.

| Field | Type | Description |
|-------|------|-------------|
| `id` | CUID | Primary key |
| `tenantId` | string | Multi-tenant isolation |
| `name` | string | Display name |
| `entityType` | enum | `person`, `organization`, `concept`, `location`, `date`, `event`, `regulation`, `statute` |
| `canonical` | string | Normalized form for deduplication (lowercase, underscore-separated) |
| `metadata` | JSON | Type-specific attributes (e.g., title, email for person) |
| `mergedInto` | string? | Points to canonical entity after deduplication |

**Indexes:** `(tenantId, entityType)`, `(tenantId, name)`, `mergedInto`

### KgEdge (Relationships)

Directed edges between entities with typed relationships.

| Field | Type | Description |
|-------|------|-------------|
| `fromEntityId` | FK | Source entity |
| `toEntityId` | FK | Target entity |
| `relationType` | enum | `employs`, `references`, `cites`, `contradicts`, `amends`, `relates_to` |
| `weight` | float | Relationship strength (default 1.0, range 0-1) |

**Cascade delete:** Edges are removed when either connected entity is deleted.

### KgClaim (Facts/Assertions)

Triple-like statements: subject → predicate → object.

| Field | Type | Description |
|-------|------|-------------|
| `subjectEntityId` | FK | The entity making/receiving the claim |
| `predicate` | string | Action or relationship (e.g., `earned_revenue_of`, `was_convicted_of`) |
| `objectValue` | string | Plain text value |
| `objectEntityId` | FK? | Optional reference to another entity |
| `confidence` | float | Assertion confidence (0.0-1.0, default 1.0) |
| `status` | enum | `active`, `disputed`, `retracted` |

**Lifecycle:** Claims start as `active`. They can be `disputed` when contradicting evidence appears, and `retracted` when proven false. Confidence is adjusted accordingly.

### KgProvenance (Evidence)

Links claims to their source documents for audit trail.

| Field | Type | Description |
|-------|------|-------------|
| `claimId` | FK | The claim being supported |
| `documentId` | string | Source document ID |
| `chunkId` | string? | Specific chunk reference |
| `excerpt` | string | Exact passage text |
| `pageNumber` | int? | Page reference |
| `confidence` | float | Extraction confidence |

### KgMention (NER Spans)

Records where entities are mentioned in documents with character offsets.

| Field | Type | Description |
|-------|------|-------------|
| `entityId` | FK | Referenced entity |
| `documentId` | string | Document containing the mention |
| `mentionText` | string | Exact text span |
| `startOffset` | int | Start character position |
| `endOffset` | int | End character position |
| `confidence` | float | NER extraction confidence |

---

## Entity Deduplication

When the same entity appears with different names (e.g., "John Smith", "J. Smith", "Mr. Smith"), CyGraph uses the `mergedInto` field to point duplicates to a canonical entity.

**Canonical normalization:** `name.toLowerCase().trim().replace(/\s+/g, '_')`

After merging, the duplicate entity retains its original data but its `mergedInto` field points to the canonical entity. All graph traversals follow `mergedInto` pointers to resolve to the canonical entity.

---

## Knowledge Event Ingestion

External systems can push knowledge events via the REST API:

```
POST /api/v1/knowledge/ingest
```

**Flow:**
1. Validate payload (Zod schema)
2. Check rate limit (100 events/min/tenant)
3. Check idempotency (unique `tenantId` + `event_id`)
4. Create Document + KnowledgeEvent in transaction
5. Publish to Pub/Sub topic `ragbox-knowledge-ingest`
6. Return 202 Accepted

**Processing (async):**
1. Pub/Sub delivers to `/api/v1/knowledge/process`
2. Status updates: `received` → `processing` → `indexed` or `failed`
3. Go backend extracts text, generates embeddings, stores chunks
4. Callback URL fired on completion (if configured)

**Content types supported:** `text/plain`, `text/markdown`, `text/html`, `application/json`

---

## Context Pack Assembly

When a user queries Mercury, CyGraph augments the RAG pipeline with graph context:

### Step 1: Query Entity Extraction

Extract named entities from the user's query using pattern matching and canonical normalization.

### Step 2: Entity Lookup

Match extracted names to KgEntity records via canonical form. Follow `mergedInto` pointers to resolve duplicates.

### Step 3: Graph Traversal

Starting from matched entities, traverse 1-2 hops through KgEdge relationships. Filter by edge weight threshold (default 0.5). Use BFS with visited set to prevent cycles.

### Step 4: Claim Collection

Collect active and disputed claims for all traversed entities. Sort by confidence descending. Exclude retracted claims.

### Step 5: Provenance Retrieval

Fetch provenance records for collected claims. These provide document-grounded evidence excerpts.

### Step 6: Context Pack Assembly

Combine into a structured context block injected into the RAG prompt:

```
=== Knowledge Graph Context ===
Entities: organization: Acme Corp, person: John Smith
Facts: earned_revenue_of($1.2M) [conf: 0.95]; was_employed_by(Acme Corp) [conf: 0.88]
Evidence: [1] Revenue was reported as $1.2M in Q3. [2] John Smith joined Acme Corp in 2022.
=== End KG Context ===
```

The context pack respects a token budget (default 2000 tokens) to avoid consuming too much of the LLM context window.

---

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/knowledge/ingest` | POST | Ingest knowledge event |
| `/api/v1/knowledge/process` | POST | Process event (Pub/Sub push) |
| `/api/v1/knowledge` | GET | Vault statistics |
| `/api/v1/knowledge/events` | GET | List events with filters |

---

## Test Coverage

| Suite | Tests | File |
|-------|-------|------|
| Entity extraction | 8 | `src/__tests__/cygraph/extractionService.test.ts` |
| Edge extraction | 7 | same |
| Claim lifecycle | 9 | same |
| Provenance tracking | 5 | same |
| Mention extraction | 4 | same |
| Ingest validation | 8 | same |
| Idempotency/rate limit | 4 | same |
| File type derivation | 6 | same |
| Process status lifecycle | 8 | same |
| Dead letter queue | 4 | same |
| Context pack | 25 | `src/__tests__/cygraph/contextPack.test.ts` |
| **Total** | **88** | |

---

*Last updated: March 4, 2026 — Sarah, Engineering, RAGbox.co*
