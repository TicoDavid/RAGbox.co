# RAGbox API Reference v1.0

> **Base URL:** `https://app.ragbox.co/api/v1` | **Auth:** `X-API-Key: rbx_live_xxxxx` | **February 2026**

---

## Quick Start

```bash
# Set your API key
export RAGBOX_KEY="rbx_live_your_key_here"

# Upload a document
curl -X POST https://app.ragbox.co/api/v1/documents \
  -H "X-API-Key: $RAGBOX_KEY" \
  -F "file=@document.pdf"

# Ask a question
curl -X POST https://app.ragbox.co/api/v1/query \
  -H "X-API-Key: $RAGBOX_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the cancellation policy?"}'
```

---

## Authentication

**Header:** `X-API-Key: rbx_live_xxxxx`
**Alternative:** `Authorization: Bearer rbx_live_xxxxx`

### Creating API Keys
Dashboard → Settings → API Keys → Create. Keys are shown once at creation. Store securely.

### Key Format
`rbx_live_` prefix + 64-character hex string. Keys are SHA-256 hashed at rest.

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| General API | 60 requests/min |
| RAG query | 10 requests/min |
| Document upload | 5 requests/min |
| Forge (generation) | 5 requests/min |

429 responses include `Retry-After` header.

---

## Documents

### List Documents

```
GET /api/v1/documents
```

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| limit | integer | 50 | Max results (1-100) |
| offset | integer | 0 | Pagination offset |
| sort | string | uploaded_at | Sort field: title, uploaded_at, size |

**Response:**
```json
{
  "documents": [
    {
      "id": "clx1abc...",
      "title": "Office Policies v2.3",
      "filename": "office-policies.pdf",
      "size_bytes": 245760,
      "pages": 12,
      "chunks": 34,
      "security_tier": "standard",
      "indexed": true,
      "uploaded_at": "2026-02-15T10:30:00Z"
    }
  ],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

### Upload Document

```
POST /api/v1/documents
Content-Type: multipart/form-data
```

**Form Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | Yes | PDF, DOCX, TXT, MD, CSV (max 50MB) |
| title | string | No | Custom title (default: filename) |
| folder_id | string | No | Target folder ID |

**Response:**
```json
{
  "id": "clx1abc...",
  "title": "Office Policies v2.3",
  "status": "processing",
  "pipeline": "parse → redact → chunk → embed"
}
```

Document processing is async. Status transitions: `processing` → `indexed` (or `failed`).

### Get Document

```
GET /api/v1/documents/:id
```

### Delete Document

```
DELETE /api/v1/documents/:id
```

---

## RAG Query

### Ask a Question

```
POST /api/v1/query
Content-Type: application/json
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| query | string | Yes | Natural language question |
| conversation_id | string | No | Multi-turn conversation context |
| model | string | No | LLM override (gemini-1.5-flash, claude-3.5-sonnet, gpt-4o) |
| stream | boolean | No | SSE streaming (default: true) |

**Example:**
```json
{
  "query": "What is the cancellation fee?",
  "stream": false
}
```

**Response (non-streaming):**
```json
{
  "answer": "The cancellation fee is $50 for appointments cancelled less than 24 hours in advance.",
  "confidence": 0.92,
  "sources": [
    {
      "document": "Office Policies v2.3",
      "page": 4,
      "section": "4.1 Cancellation Policy",
      "relevance": 0.94
    }
  ],
  "silence": false,
  "model": "gemini-1.5-flash",
  "tokens_used": 847
}
```

**Silence Protocol:** When confidence < 0.85 or no relevant documents exist, RAGbox returns a structured refusal instead of hallucinating:
```json
{
  "answer": "",
  "confidence": 0.31,
  "sources": [],
  "silence": true,
  "silence_reason": "No documents contain information about this topic."
}
```

**SSE Streaming (default):**
```
event: token
data: {"text": "The cancellation"}

event: token
data: {"text": " fee is $50"}

event: done
data: {"answer": "The cancellation fee is $50...", "sources": [...], "confidence": 0.92}
```

---

## Knowledge Search

### Semantic Search

```
GET /api/v1/knowledge?q=cancellation+policy&limit=5
```

Returns document chunks ranked by semantic similarity without generating an answer.

---

## API Keys

### List Keys

```
GET /api/v1/keys
```

### Create Key

```
POST /api/v1/keys
Content-Type: application/json
```

```json
{
  "name": "Production V-Rep",
  "expires_at": "2027-02-21T00:00:00Z"
}
```

**Response (key shown only once):**
```json
{
  "id": "key_abc123",
  "name": "Production V-Rep",
  "key": "rbx_live_a1b2c3d4e5f6...",
  "created_at": "2026-02-21T15:00:00Z",
  "expires_at": "2027-02-21T00:00:00Z"
}
```

### Delete Key

```
DELETE /api/v1/keys/:id
```

---

## MCP Server

```
POST /api/mcp
Content-Type: application/json
X-API-Key: rbx_live_xxxxx
```

RAGbox implements the Model Context Protocol (MCP) v1.0 specification. See the [MCP Server Specification](/docs/mcp-server-spec) for full tool definitions, examples, and integration guides.

**Available MCP Tools:** `search_documents`, `get_document`, `query_knowledge`, `list_documents`

---

## Mercury Chat

### Send Message

```
POST /api/mercury/thread/messages
Content-Type: application/json
```

```json
{
  "content": "What files are in my vault?",
  "channel": "api"
}
```

### Get Thread Messages

```
GET /api/mercury/thread/messages?limit=50
```

---

## Webhooks

### ROAM

```
POST /api/webhooks/roam
```
HMAC-SHA256 signature verification via Standard Webhooks spec. Headers: `webhook-id`, `webhook-timestamp`, `webhook-signature`.

### WhatsApp (Vonage)

```
GET /api/webhooks/whatsapp  — Verification (returns verify token)
POST /api/webhooks/whatsapp — Inbound messages
```

---

## Audit Trail

### Query Audit Log

```
GET /api/audit?action=mercury.query&limit=50
```

### Export Audit

```
GET /api/audit/export?format=json
GET /api/audit/export?format=pdf
```

Hash-chained (SHA-256), tamper-evident, SEC 17a-4 compliant.

---

## Health

```
GET /api/health
```

```json
{
  "status": "ok",
  "database": "connected",
  "latency_ms": 4,
  "version": "0.2.0"
}
```

---

## Error Responses

All errors return JSON:

```json
{
  "error": {
    "code": 401,
    "message": "Invalid or missing API key",
    "type": "authentication_error"
  }
}
```

| HTTP Code | Type | Description |
|-----------|------|-------------|
| 400 | bad_request | Missing required fields or invalid format |
| 401 | authentication_error | Missing or invalid API key |
| 403 | authorization_error | Insufficient permissions for resource |
| 404 | not_found | Resource does not exist |
| 411 | length_required | Content-Length header missing on POST |
| 429 | rate_limit_error | Too many requests |
| 500 | internal_error | Server error (contact support) |

---

## Security

- HTTPS required (TLS 1.3)
- API keys SHA-256 hashed at rest
- Documents encrypted at rest (AES-256 via CMEK)
- PII auto-redacted during ingestion (DLP)
- Row-level security per tenant
- All queries logged to tamper-evident audit trail
- SOC 2 + HIPAA compliant infrastructure

---

## SDK Examples

### Python
```python
import httpx

client = httpx.Client(
    base_url="https://app.ragbox.co/api/v1",
    headers={"X-API-Key": "rbx_live_your_key_here"}
)

# Upload
with open("policy.pdf", "rb") as f:
    r = client.post("/documents", files={"file": f})
    print(r.json())

# Query
r = client.post("/query", json={"query": "What is the refund policy?", "stream": False})
print(r.json()["answer"])
```

### JavaScript
```javascript
const response = await fetch("https://app.ragbox.co/api/v1/query", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "rbx_live_your_key_here"
  },
  body: JSON.stringify({ query: "What is the refund policy?", stream: false })
});
const data = await response.json();
console.log(data.answer);
```

### curl
```bash
# List documents
curl -H "X-API-Key: rbx_live_xxx" https://app.ragbox.co/api/v1/documents

# Ask a question
curl -X POST https://app.ragbox.co/api/v1/query \
  -H "X-API-Key: rbx_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{"query":"summarize all documents","stream":false}'
```

---

*© 2026 ConnexUS AI Inc. | support@ragbox.co | docs.ragbox.co*
