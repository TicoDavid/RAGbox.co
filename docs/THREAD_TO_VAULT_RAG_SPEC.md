# Thread-to-Vault RAG Integration — Architecture Spec

> **Status:** Spec only — not yet implemented
> **Author:** Sarah (Frontend Engineer)
> **Date:** February 20, 2026

---

## Goal

Allow Mercury to recall past conversations when answering new questions. Today, RAG only searches vault documents. This spec describes how to index thread messages alongside document chunks so the LLM can reference both.

---

## Current State

| Layer | How It Works |
|-------|-------------|
| **Document ingestion** | Upload → Document AI extraction → chunk → embed via `text-embedding-004` → store in AlloyDB `pgvector` |
| **Query pipeline** | User query → embed → vector similarity search → top-K document chunks → LLM context |
| **Thread storage** | Messages persisted in `mercury_thread_messages` (Prisma) — plain text, no embeddings |

**Gap:** Thread messages are never embedded or searchable via RAG.

---

## Proposed Architecture

### 1. Embed thread messages into the same vector table

After each assistant response, embed the exchange (user query + assistant answer) as a single chunk:

```
Source: conversation
ThreadId: thread_abc123
Content: "Q: What are the termination clauses?\nA: Section 4.2 of the MSA states..."
Embedding: [0.012, -0.034, ...]
```

**Why combine Q+A as one chunk?** The answer contains the synthesized knowledge. Embedding just the question misses the insight. Embedding both ensures future queries like "What did we discuss about termination?" retrieve the full context.

### 2. Tag chunks with source type

Add a `source_type` discriminator to the embedding table:

| Field | Type | Values |
|-------|------|--------|
| `source_type` | `enum` | `'document'` \| `'conversation'` |
| `thread_id` | `string?` | Set for conversation chunks, null for documents |
| `message_id` | `string?` | Reference to `mercury_thread_messages.id` |

### 3. RAG retrieval: search both sources

Modify the retrieval query to search across all chunk types:

```sql
SELECT content, source_type, similarity
FROM embeddings
WHERE user_id = $1
  AND 1 - (embedding <=> $2) > 0.60
ORDER BY embedding <=> $2
LIMIT 10
```

The LLM prompt template should distinguish sources:

```
[From your documents — Contract.pdf, §4.2]
The termination clause requires 30 days written notice...

[From a previous conversation — Feb 18, 2026]
You asked about termination clauses. The MSA requires 30 days notice...
```

### 4. Respect privilege mode

Conversation chunks should inherit the privilege mode active when they were created:

- **Open mode conversation** → visible in all queries
- **Privileged mode conversation** → only visible when privilege toggle is active

Store `privilege_mode: boolean` on conversation chunks.

---

## Implementation Steps

| Step | Work | Owner | Estimate |
|------|------|-------|----------|
| 1 | Add `source_type`, `thread_id`, `message_id`, `privilege_mode` columns to embeddings table | Backend (Sheldon) | 1h |
| 2 | Create `embedConversation()` function — called after assistant response | Backend (Sheldon) | 2h |
| 3 | Update RAG retrieval query to include conversation chunks | Backend (Sheldon) | 1h |
| 4 | Update prompt template to label conversation sources | Backend (Sheldon) | 30min |
| 5 | Add conversation citation type to frontend citation renderer | Frontend (Sarah) | 1h |
| 6 | Thread deletion should cascade-delete conversation embeddings | Backend (Sheldon) | 30min |

**Total estimate:** ~6 hours

---

## Risks and Considerations

1. **Volume:** Heavy users may generate thousands of conversation chunks. Consider a rolling window (e.g., last 90 days) or a max chunk count per user.

2. **Embedding cost:** Each Q+A pair = 1 embedding API call (~$0.00001). At 50 queries/day = $0.0005/day/user. Negligible.

3. **Stale context:** Old conversation answers may reference documents that have since been updated. The LLM should prefer document chunks over conversation chunks when both are relevant (weight document source_type higher in ranking).

4. **Privacy:** Conversation embeddings contain synthesized answers that may reference privileged documents. Ensure privilege mode filtering is applied consistently.

5. **Deduplication:** If the user asks the same question twice, both conversations will be embedded. The vector similarity search naturally deduplicates since both chunks will have near-identical embeddings — only the top result is returned.

---

## Not In Scope (For Now)

- Cross-user conversation search (team knowledge sharing)
- Conversation summarization (compressing long threads into single chunks)
- Automatic thread archival
- Voice/WhatsApp channel conversation indexing (dashboard only for now)

---

*This is an architectural spec. Implementation will be scheduled after the current ship sprint.*
