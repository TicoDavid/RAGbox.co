# The Sovereign Uplink (API)

> *"Programmatic access for those who prefer to command from the terminal."*

RAGbox exposes an OpenAI-compatible API, allowing seamless integration with existing toolchains, scripts, and third-party applications.

---

## Authentication

All API requests require a Bearer token.

```bash
Authorization: Bearer sk-ragbox-xxxxxxxxxxxxxxxxxxxx
```

### Obtaining Your API Key:
1. Navigate to **Settings** → **Connections**
2. Click **Generate API Key**
3. Copy and store securely — keys are shown only once

---

## Endpoints

### Chat Completions (OpenAI Compatible)

```
POST /v1/chat/completions
```

Stream intelligent responses grounded in your Vault documents.

**Request:**
```json
{
  "model": "mercury-pro",
  "messages": [
    {
      "role": "user",
      "content": "What are the payment terms in the vendor agreement?"
    }
  ],
  "stream": true,
  "temperature": 0.3
}
```

**Response (SSE Stream):**
```
data: {"choices":[{"delta":{"content":"The payment terms"}}]}
data: {"choices":[{"delta":{"content":" are Net 30..."}}]}
data: [DONE]
```

### Document Ingestion

```
POST /v1/vault/ingest
```

Upload documents programmatically.

**Request:**
```bash
curl -X POST https://api.ragbox.co/v1/vault/ingest \
  -H "Authorization: Bearer sk-ragbox-xxx" \
  -F "file=@contract.pdf" \
  -F "privileged=false" \
  -F "folder_id=contracts"
```

**Response:**
```json
{
  "id": "doc_abc123",
  "name": "contract.pdf",
  "status": "processing",
  "chunks": 47,
  "eta_seconds": 15
}
```

### Document Retrieval

```
GET /v1/vault/documents
```

List all documents in your Vault.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | int | Max results (default: 50) |
| `offset` | int | Pagination offset |
| `folder_id` | string | Filter by folder |
| `privileged` | bool | Include privileged docs (requires admin) |

### Semantic Search

```
POST /v1/vault/search
```

Search your Vault using natural language.

**Request:**
```json
{
  "query": "non-compete clauses",
  "limit": 10,
  "threshold": 0.75
}
```

**Response:**
```json
{
  "results": [
    {
      "document_id": "doc_abc123",
      "chunk_id": "chunk_456",
      "content": "Employee agrees to a 12-month non-compete...",
      "score": 0.92,
      "page": 7
    }
  ]
}
```

---

## Rate Limits

RAGbox allows high-velocity burst traffic for enterprise operations.

| Plan | Requests/Min | Tokens/Day |
|------|--------------|------------|
| Free | 20 | 100,000 |
| Professional | 100 | 1,000,000 |
| Enterprise | Unlimited | Unlimited |

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1699543200
```

---

## SDKs & Libraries

### Python
```python
from ragbox import Client

client = Client(api_key="sk-ragbox-xxx")
response = client.chat.completions.create(
    model="mercury-pro",
    messages=[{"role": "user", "content": "Summarize Q3 earnings"}]
)
print(response.choices[0].message.content)
```

### JavaScript/TypeScript
```typescript
import { RagboxClient } from '@ragbox/sdk';

const client = new RagboxClient({ apiKey: 'sk-ragbox-xxx' });
const response = await client.chat({
  messages: [{ role: 'user', content: 'Summarize Q3 earnings' }]
});
```

### cURL
```bash
curl https://api.ragbox.co/v1/chat/completions \
  -H "Authorization: Bearer sk-ragbox-xxx" \
  -H "Content-Type: application/json" \
  -d '{"model":"mercury-pro","messages":[{"role":"user","content":"Hello"}]}'
```

---

## Error Codes

| Code | Meaning |
|------|---------|
| 400 | Bad Request — Invalid parameters |
| 401 | Unauthorized — Invalid or missing API key |
| 403 | Forbidden — Insufficient permissions |
| 404 | Not Found — Resource doesn't exist |
| 429 | Rate Limited — Slow down |
| 500 | Server Error — Contact support |

---

## Webhooks (Coming Soon)

Register webhooks to receive real-time notifications:
- Document processing complete
- Privileged access detected
- Anomaly in query patterns

---

*For enterprise API support, contact: api@ragbox.co*
