# API Changelog — RAGbox.co

> Tracks breaking changes, new endpoints, and modifications to the RAGbox API surface.

---

## 2026-02-21 — Deploy 16 (Ship Night)

### New Endpoints

#### `GET /api/mercury/config`

Returns the Mercury agent configuration for the authenticated user's tenant.

**Auth:** Required (NextAuth JWT)

**Response:**
```json
{
  "success": true,
  "data": {
    "config": {
      "name": "Mercury",
      "title": "AI Assistant",
      "greeting": "Welcome to RAGbox. Upload documents and ask me anything.",
      "personalityPrompt": "You are precise, citation-focused...",
      "voiceGender": "female",
      "silenceThreshold": 0.60,
      "channels": {
        "email": { "enabled": false },
        "whatsapp": { "enabled": false },
        "voice": { "enabled": true }
      }
    },
    "presets": {
      "professional": "...",
      "ceo": "...",
      "legal": "..."
    }
  }
}
```

#### `POST /api/mercury/config`

Updates Mercury agent configuration. Supports partial updates.

**Auth:** Required (NextAuth JWT)

**Body (all fields optional):**
```json
{
  "name": "Mercury",
  "title": "AI Assistant",
  "greeting": "Hello, I'm Mercury...",
  "personalityPrompt": "Custom prompt...",
  "personalityPreset": "ceo",
  "voiceGender": "female",
  "silenceThreshold": 0.60,
  "channels": {
    "email": { "enabled": true, "address": "mercury@company.com" },
    "whatsapp": { "enabled": true },
    "voice": { "enabled": true, "voiceId": "aura-asteria-en" }
  }
}
```

**Validation:**
- `name` must not be empty
- `silenceThreshold` must be between 0.1 and 1.0
- `personalityPreset` overrides `personalityPrompt` if both provided

---

### Modified Endpoints

#### `GET /api/mercury/thread`

**Changed:** Thread messages now include unified channel fields.

**New fields on `mercuryThreadMessage`:**
| Field | Type | Description |
|-------|------|-------------|
| `channel` | enum | `dashboard`, `voice`, `whatsapp`, `email`, `sms`, `roam` |
| `direction` | string | `inbound` or `outbound` |
| `channelMessageId` | string? | External message ID (e.g., WhatsApp message SID) |
| `metadata` | JSON? | Channel-specific metadata (delivery status, etc.) |

**Filter support:** Pass `?channel=voice` to filter messages by channel.

#### `GET /api/health`

**Upgraded:** Now checks both database and Go backend connectivity.

**Previous response:**
```json
{ "status": "ok" }
```

**New response:**
```json
{
  "status": "healthy",
  "checks": {
    "database": "ok",
    "backend": "ok"
  }
}
```

**Status codes:**
- `200` — All checks pass (`"healthy"`)
- `503` — One or more checks failed (`"degraded"`)

---

### Rate Limiting (New)

All `/api/*` routes now enforce rate limiting via middleware. Responses include headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests per window |
| `X-RateLimit-Remaining` | Remaining requests in current window |
| `X-RateLimit-Reset` | Unix epoch when window resets |

**Per-route limits (1-minute sliding window):**

| Route | Limit | Key |
|-------|-------|-----|
| `POST /api/chat` | 30/min | Per user (NextAuth session) |
| `POST /api/auth/send-otp` | 5/min | Per IP |
| `POST /api/documents/extract` | 30/min | Per user |
| `POST /api/waitlist` | 5/min | Per IP |
| `POST /api/beta/validate` | 10/min | Per IP |
| `POST /api/v1/knowledge/ingest` | 10/min | Per user |
| All other `/api/*` routes | 120/min | Per IP |

**Exempt routes:** `/api/health`, `/api/auth/callback`, `/api/auth/session`, `/api/auth/providers`, `/api/auth/csrf`

**429 response:**
```json
{
  "error": "Too many requests",
  "retryAfter": 45
}
```

Includes `Retry-After` header with seconds until window resets.

---

### SSE Done Event (Modified)

The `POST /api/chat` SSE stream's `done` event payload has been restructured:

**Previous:** Flat JSON appended to message content (caused BUG-019 — raw JSON visible in chat).

**Current:** Structured `DonePayload` with separate fields:

```json
{
  "type": "done",
  "data": {
    "answer": "The complete prose answer...",
    "citations": [
      {
        "documentName": "contract.pdf",
        "documentId": "doc_abc123",
        "chunkIndex": 3,
        "relevanceScore": 0.92,
        "snippet": "...relevant text excerpt..."
      }
    ],
    "evidence": {
      "totalDocumentsFound": 5,
      "totalCandidates": 23,
      "modelUsed": "aegis/gemini-2.5-flash"
    },
    "sources": [
      {
        "documentName": "contract.pdf",
        "documentId": "doc_abc123"
      }
    ]
  }
}
```

The frontend `chatStore.ts` now stores `citations`, `evidence`, and `sources` in `message.metadata` — never appended to `message.content`.

---

### LLM Policy Endpoint

#### `GET /api/settings/llm`

Returns the tenant's LLM policy configuration.

**Response:**
```json
{
  "data": {
    "policy": "choice"
  }
}
```

**Policy values:** `choice` | `byollm_only` | `aegis_only`

---

## 2026-02-20 — Deploy 12

### Bug Fixes

- **BUG-012:** Thread sidebar toggle visibility fixed
- **BUG-013:** Mercury model selector now reads `activeIntelligence.id` from SettingsContext
- **BUG-014:** Voice WebSocket handler reordered to catch early STT results
- **BUG-015:** Email channel added to ConversationThread filter + ChannelBadge
- **BUG-016:** OTP delivery switched from Resend.com to Gmail API OAuth2 transport
- **BUG-017:** Mic icon removed from Mercury InputBar (redundant with voice panel)

---

*Last updated: February 21, 2026 — Sarah, Engineering, RAGbox.co*
