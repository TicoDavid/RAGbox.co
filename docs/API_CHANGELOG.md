# API Changelog — RAGbox.co

> Tracks breaking changes, new endpoints, and modifications to the RAGbox API surface.

---

## 2026-03-03 — MEGA SPRINT (Deploys 29-31)

### Backend Changes

#### Go Backend TTFB Optimization (Sheldon)

Model swap from `gemini-3-pro-preview` to `gemini-2.5-flash`. Self-RAG max iterations reduced from 3 to 1.

**Impact:** Response TTFB reduced from 8-12s to 1-2s. No API contract changes — SSE event shapes and `DonePayload` structure unchanged.

**Confidence threshold:** Maintained at ≥0.60. Tests verify flash model confidence delta ≤0.15 vs previous model.

#### MercuryPersona Auto-Create (Sheldon)

New OAuth users automatically receive a `MercuryPersona` record on first sign-in.

**Defaults:**
| Field | Value |
|-------|-------|
| `name` | Mercury |
| `greeting` | Welcome to RAGbox. |
| `voiceId` | null (system default) |
| `channelConfig` | `{}` |

No API endpoint changes — handled transparently in the NextAuth `signIn` callback via `prisma.user.upsert` + `prisma.mercuryPersona.upsert`.

### Modified Endpoints

#### `POST /api/mercury/config`

**New fields in `channelConfig.voice`:**

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `expressiveness` | number | 0.0–1.0 | Maps to TTS temperature (×2 → 0.0–2.0) |
| `speakingRate` | number | 0.5–2.0 | TTS speaking rate passthrough |
| `modelId` | string? | — | TTS model override (default: system) |

**Example:**
```json
{
  "channels": {
    "voice": {
      "enabled": true,
      "voiceId": "aura-asteria-en",
      "expressiveness": 0.5,
      "speakingRate": 1.0,
      "modelId": null
    }
  }
}
```

#### `GET /api/documents`

**Changed:** Now accepts `?limit=N` query parameter (default: 1000, max: 5000). Previously returned all documents without pagination support.

#### `GET /api/audit/export-formatted`

**Changed:** PDF export now uses async pdfkit rendering with uncompressed content streams. The `generatePdfBuffer` function is now async — callers must `await`.

**PDF structure:** Uncompressed (`compress: false`) for forensic text searchability in compliance contexts.

### New Features

#### Audit Log Search Bar (Jordan — STORY-241)

Frontend-only search/filter for audit entries. Filters by action, user, severity, and date range. No backend API changes.

#### Sovereign Studio Artifact Engine (Sheldon — STORY-235)

Backend artifact generation via Vertex AI. Supports 8 artifact types and 3 tones.

**Artifact types:** `audio`, `video`, `mindmap`, `report`, `compliance`, `infographic`, `deck`, `evidence`

**Tones:** `standard`, `executive`, `forensic`

#### Voice Settings V2 (Jordan — V-006)

UI sliders for expressiveness and speaking rate. Voice preview/audition button. Expanded voice dropdown from 4 hardcoded voices to dynamic list via Inworld API.

#### Perplexity-Style Response Layout (Jordan — STORY-239)

Mercury responses now display with clean cited-answer formatting: prose answer with inline citation badges, collapsible Sources section, and Evidence summary.

#### PDF Export Fix (Sheldon — STORY-237)

PDF audit export engine rebuilt with pdfkit. Real PDF generation with fonts, layout, verification hash footer. Previously returning empty buffers.

#### BYOLLM Regression Fix (Sheldon — STORY-238)

Fixed BYOLLM model routing regression. Custom LLM selection now persists across sessions.

### Security Changes

#### Audit Export Model Masking (Sarah — STORY-231)

Audit export endpoints now sanitize model metadata. Raw model names (e.g., `gemini-2.5-flash`) replaced with `AEGIS` or `Custom LLM` in exported audit entries. Internal audit log retains full model info.

#### Upload Edge Cases (Jordan — STORY-195b)

- 50MB file size limit enforced (413 response)
- Unsupported file types rejected with descriptive errors
- 0-byte file rejection added
- Rate limiting at middleware layer (30/min per user on `/api/documents/extract`)
- Duplicate filename detection (STORY-195 — pending)

#### Privilege Toggle Role Guard (Jordan — STORY-15)

Privileged mode toggle now hidden for non-Partner roles. Only `Partner` and `Admin` users see the privilege badge and toggle in the global header.

#### 429 Rate Limit Toast (Jordan — STORY-202)

Global 429 interceptor in `apiFetch()` shows user-facing toast: "You've reached your query limit. Upgrade your plan for more."

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

*Last updated: March 3, 2026 — Sarah, Engineering, RAGbox.co*
