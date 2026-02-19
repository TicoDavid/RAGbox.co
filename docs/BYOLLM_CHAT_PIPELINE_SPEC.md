# BYOLLM Chat Pipeline Spec — STORY-022

**Author:** Sarah (Junior Eng) | **Date:** 2026-02-19

---

## Executive Summary

The chat pipeline has **three layers**: Frontend → Next.js Proxy → Go Backend.
BYOLLM wiring touches all three. This spec documents:

- **Option A (Next.js proxy pass-through):** Done by Sarah — ships now
- **Option B (Go backend provider routing):** Spec for the Go engineer

---

## Current Architecture

```
Frontend (mercuryStore.ts)
    │  POST /api/chat  { query, llmProvider?, llmModel?, ... }
    ▼
Next.js Proxy (src/app/api/chat/route.ts)
    │  POST ${GO_BACKEND_URL}/api/chat  { query, stream, ... }
    │  ⚠️ DROPS llmProvider and llmModel — only forwards:
    │     query, stream, privilegeMode, history, maxTier, systemPrompt
    ▼
Go Backend (backend/internal/handler/chat.go)
    │  Decodes ChatRequest { Query, PrivilegeMode, Mode, Persona, StrictMode }
    │  ⚠️ No llmProvider/llmModel fields in ChatRequest struct
    ▼
GeneratorService.Generate(ctx, query, chunks, opts)
    │  Uses hardcoded GenAIClient (Vertex AI Gemini)
    │  model = config.VertexAIModel ("gemini-3-pro-preview")
    ▼
GenAIAdapter.GenerateContent(ctx, systemPrompt, userPrompt)
    │  Calls Vertex AI (SDK or REST depending on location)
    ▼
SSE Response: status → token* → citations → confidence → done
```

---

## Option A: Next.js Proxy Pass-Through (DONE)

### What Changed

**File:** `src/app/api/chat/route.ts`

The proxy now:
1. Reads LLMConfig from DB when `llmProvider=byollm`
2. Decrypts the API key via kms-stub
3. Passes `llmProvider`, `llmModel`, `llmApiKey`, `llmBaseUrl` to the Go backend
4. Falls back to AEGIS (no extra fields) if policy is `aegis_only` or no config exists

### Data Flow After Fix

```
Frontend: { llmProvider: "byollm", llmModel: "openai/gpt-4o" }
    ▼
Proxy reads LLMConfig from DB:
  - provider: "openrouter"
  - apiKeyEncrypted: "kms-stub:c2stb3..." → decrypts to raw key
  - baseUrl: null (use default)
  - policy: "choice"
    ▼
Proxy forwards to Go backend:
  { query, stream, ..., llmProvider: "openrouter", llmModel: "openai/gpt-4o",
    llmApiKey: "<raw-key>", llmBaseUrl: null }
```

### Policy Enforcement (in proxy)

| Policy | Behavior |
|--------|----------|
| `choice` | Send BYOLLM fields if config exists and frontend requests it |
| `byollm_only` | Always send BYOLLM fields (ignore frontend aegis selection) |
| `aegis_only` | Never send BYOLLM fields (ignore frontend byollm selection) |

---

## Option B: Go Backend Provider Routing (SPEC)

The Go backend currently hardcodes Vertex AI. To complete BYOLLM, these changes are needed:

### B.1: Extend ChatRequest struct

**File:** `backend/internal/handler/chat.go:21-27`

```go
type ChatRequest struct {
    Query         string `json:"query"`
    PrivilegeMode bool   `json:"privilegeMode"`
    Mode          string `json:"mode"`
    Persona       string `json:"persona"`
    StrictMode    bool   `json:"strictMode"`
    // BYOLLM fields (optional — absent = use AEGIS)
    LLMProvider   string `json:"llmProvider,omitempty"`   // "openrouter", "openai", "anthropic", "google"
    LLMModel      string `json:"llmModel,omitempty"`      // e.g. "openai/gpt-4o"
    LLMApiKey     string `json:"llmApiKey,omitempty"`      // decrypted key from proxy
    LLMBaseUrl    string `json:"llmBaseUrl,omitempty"`     // custom endpoint (optional)
}
```

### B.2: Create BYOLLM GenAI adapter

**New file:** `backend/internal/gcpclient/byollm.go`

Implement `service.GenAIClient` interface for external providers:

```go
type BYOLLMAdapter struct {
    provider string
    apiKey   string
    baseUrl  string
    model    string
}

func NewBYOLLMAdapter(provider, apiKey, baseUrl, model string) *BYOLLMAdapter

// GenerateContent implements service.GenAIClient
func (a *BYOLLMAdapter) GenerateContent(ctx context.Context, systemPrompt, userPrompt string) (string, error)
```

Provider routing inside `GenerateContent`:

| Provider | Endpoint | Auth | Body Format |
|----------|----------|------|-------------|
| `openrouter` | `https://openrouter.ai/api/v1/chat/completions` | `Bearer <key>` | OpenAI-compatible |
| `openai` | `https://api.openai.com/v1/chat/completions` | `Bearer <key>` | OpenAI-compatible |
| `anthropic` | `https://api.anthropic.com/v1/messages` | `x-api-key: <key>` | Anthropic Messages API |
| `google` | `https://generativelanguage.googleapis.com/v1beta/...` | `?key=<key>` | Gemini REST API |

The adapter must:
- Convert system+user prompts to provider-specific format
- Parse the response back to a plain string (same as GenAIAdapter returns)
- Respect 30-second timeout via context
- Return structured errors for 401/429/500

### B.3: Router wiring — create per-request Generator

**File:** `backend/internal/handler/chat.go:55` (inside `Chat()`)

Currently the `Generator` is a single shared instance wired at startup. For BYOLLM, we need per-request routing:

```go
// After decoding ChatRequest:
var generator service.Generator = deps.Generator // default AEGIS

if req.LLMProvider != "" && req.LLMApiKey != "" {
    byollmClient := gcpclient.NewBYOLLMAdapter(
        req.LLMProvider, req.LLMApiKey, req.LLMBaseUrl, req.LLMModel,
    )
    generator = service.NewGeneratorService(byollmClient, req.LLMModel)
    generator.(*service.GeneratorService).SetPromptLoader(deps.Generator.(*service.GeneratorService).promptLoader)
}
```

Then pass `generator` instead of `deps.Generator` to the pipeline:

```go
// Line 236: change deps.Generator to generator
initial, err := generator.Generate(ctx, req.Query, retrieval.Chunks, opts)
```

**Critical:** The SelfRAG service also calls Generator. Either:
- Create a per-request SelfRAGService with the BYOLLM generator, OR
- Pass the generator explicitly to `Reflect()`

Recommend option 2 — add generator param to `Reflect()`:
```go
func (s *SelfRAGService) Reflect(ctx context.Context, query string,
    chunks []RankedChunk, initial *GenerationResult,
    generator ...Generator) (*ReflectionResult, error)
```

### B.4: AEGIS fallback on BYOLLM failure

**File:** `backend/internal/handler/chat.go`

When policy is `choice` and BYOLLM fails:

```go
initial, err := generator.Generate(ctx, req.Query, retrieval.Chunks, opts)
if err != nil && req.LLMProvider != "" {
    // BYOLLM failed — fall back to AEGIS
    slog.Warn("BYOLLM generation failed, falling back to AEGIS",
        "provider", req.LLMProvider, "error", err)
    generator = deps.Generator // reset to AEGIS
    initial, err = generator.Generate(ctx, req.Query, retrieval.Chunks, opts)
}
if err != nil {
    // Both BYOLLM and AEGIS failed
    sendEvent(w, flusher, "error", ...)
    return
}
```

### B.5: Audit trail — model_used in SSE confidence event

**File:** `backend/internal/handler/chat.go:279-283`

The confidence event should include the model used:

```go
confidenceJSON, _ := json.Marshal(map[string]interface{}{
    "score":      result.FinalConfidence,
    "iterations": result.Iterations,
    "modelUsed":  result.ModelUsed,     // ← ADD
    "provider":   req.LLMProvider,      // ← ADD (empty = "aegis")
    "latencyMs":  result.LatencyMs,     // ← ADD
})
```

### B.6: Security — API key handling

The raw API key arrives in the request body from the Next.js proxy (server-to-server, internal auth). It is:
- Never logged (slog must NOT include `req.LLMApiKey`)
- Never stored by the Go backend
- Used only for the single request, then discarded
- Protected by `X-Internal-Auth` header validation

---

## Files Summary

| Layer | File | Change Type |
|-------|------|-------------|
| **Next.js** | `src/app/api/chat/route.ts` | **Modified** — BYOLLM pass-through (Option A, done) |
| **Go** | `backend/internal/handler/chat.go` | Extend ChatRequest + per-request generator routing |
| **Go** | `backend/internal/gcpclient/byollm.go` | **New** — BYOLLM adapter implementing GenAIClient |
| **Go** | `backend/internal/service/selfrag.go` | Minor — accept optional generator override in Reflect() |
| **Go** | `backend/internal/service/generator.go` | No changes needed (GeneratorService already accepts any GenAIClient) |
| **Go** | `backend/internal/config/config.go` | No changes needed (BYOLLM config comes per-request, not from env) |

---

## SSE Event Contract (unchanged)

```
event: status    data: {"stage":"retrieving"}
event: status    data: {"stage":"generating","iteration":1}
event: token     data: {"text":"The "}
event: token     data: {"text":"answer "}
event: citations data: [{"chunkId":"...","documentId":"...","excerpt":"..."}]
event: confidence data: {"score":0.92,"iterations":2,"modelUsed":"openai/gpt-4o","provider":"openrouter","latencyMs":1200}
event: done      data: {}
```

The only addition is `modelUsed`, `provider`, and `latencyMs` in the `confidence` event.

---

## Other Callers of Go /api/chat

These callers do NOT send BYOLLM fields and will continue using AEGIS:

| Caller | File | BYOLLM? |
|--------|------|---------|
| WhatsApp processor | `server/whatsapp/processor.ts:159` | No — automated channel |
| Roam processor | `src/app/api/roam/process-event/route.ts:186` | No — automated channel |
| V1 Query API | `src/app/api/v1/query/route.ts:41` | No — external API |
| Mercury Voice | `server/mercury-voice/server/components/nodes/ragbox_node.ts:155` | No — voice pipeline |

These are correct — BYOLLM is a user-facing dashboard feature, not for automated channels.
