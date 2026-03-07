# Sheldon — S-P1-04 Spike: Thread-to-Vault RAG

**Date:** 2026-03-07
**Status:** SPIKE COMPLETE — Architecture documented, no code pushed
**Complexity:** MEDIUM

---

## Goal

Make Mercury conversation messages searchable via the RAG pipeline. Users should be able to ask "What did I discuss about contract X last week?" and get answers from their own conversation history.

## Current State

- **MercuryThread** / **MercuryThreadMessage** tables exist (`mercury_threads`, `mercury_thread_messages`)
- Messages have `content`, `role`, `channel`, `metadata`, `createdAt`
- Messages are **NOT embedded** — no `embedding` column, no pgvector index
- Only `DocumentChunk` has embeddings today (`vector(768)` via `text-embedding-004`)

## Proposed Architecture

### Option A: Embed Thread Messages as Document Chunks (Recommended)

Reuse the existing embedding pipeline by treating conversation messages as "virtual documents":

1. **On message persist:** After writing to `mercury_thread_messages`, queue for embedding
2. **Embedding worker:** Batch-embed messages using `text-embedding-004` (same model as docs)
3. **Storage:** Add `embedding vector(768)` column to `mercury_thread_messages` OR create synthetic `DocumentChunk` rows with `source = 'thread'`
4. **Query time:** Go backend similarity search already queries `document_chunks` — extend to include thread messages when `searchThreads: true`

**Pros:** Reuses existing embedding infra, same vector space, single query path
**Cons:** Increases chunk count, needs source filtering

### Option B: Separate Thread Embedding Table

1. New table `mercury_thread_embeddings` with `(messageId, embedding vector(768), createdAt)`
2. Separate similarity query in Go backend
3. Merge results with document chunks by score

**Pros:** Clean separation, no pollution of document chunks
**Cons:** Two queries, two indexes, more complexity

### Recommendation: Option A

The simpler path. Thread messages become searchable alongside documents. Add a `source` discriminator to filter when needed.

## Schema Changes Required

```sql
-- Option A: Add embedding column to thread messages
ALTER TABLE mercury_thread_messages
  ADD COLUMN embedding vector(768);

CREATE INDEX idx_thread_msg_embedding
  ON mercury_thread_messages
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Add source column to document_chunks for discrimination
ALTER TABLE document_chunks
  ADD COLUMN source TEXT DEFAULT 'document';
```

## Go Backend Changes

```
POST /api/chat
  + searchThreads: bool (default false)

Internal query:
  1. Existing: similarity_search(document_chunks, query_embedding, limit=10)
  2. New: similarity_search(mercury_thread_messages, query_embedding, limit=5, WHERE userId = ?)
  3. Merge by score, deduplicate
```

## Embedding Pipeline

```
Message Persist → PubSub/Queue → Embedding Worker → UPDATE mercury_thread_messages SET embedding = ?
```

- Batch size: 25 messages per API call (Vertex AI batch limit)
- Latency: ~200ms per batch, fire-and-forget (async)
- Cost: ~$0.00002 per message (768-dim embedding)

## Effort Estimate

| Component | Work |
|-----------|------|
| Schema migration | 1 SQL file |
| Embedding worker (Node.js cron or Cloud Function) | ~150 LOC |
| Go backend query extension | ~50 LOC |
| Frontend toggle ("Search conversations") | ~20 LOC |
| **Total** | ~2-3 days |

## Dependencies

- AlloyDB pgvector extension (already enabled)
- `text-embedding-004` Vertex AI model (already in use)
- Go backend `/api/chat` handler (existing)

## Open Questions for David

1. Should thread search be opt-in per query or always-on?
2. Should ALL channels (dashboard, whatsapp, voice) be embedded, or just dashboard?
3. Retention: embed only last N days of messages, or all history?

---

**Sheldon — spike only, no code pushed**
