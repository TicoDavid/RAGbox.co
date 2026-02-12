# RAGbox.co Beta Readiness Audit Results

**Date:** February 11, 2026
**Auditor:** Claude Code (automated)
**Scope:** Full-stack audit per RAGBOX_BETA_READINESS_AUDIT_PRD.md
**Method:** Static analysis, code search, pattern matching

---

## Executive Summary

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Phase 0: Repo Cleanup | 0 | 0 | 0 | 0 | **DONE** |
| Phase 1: UI Components | 2 | 3 | 4 | 2 | 11 |
| Phase 2: API Endpoints | 1 | 3 | 2 | 1 | 7 |
| Phase 3: Integration | 1 | 2 | 1 | 0 | 4 |
| Phase 4: Visual/UX | 1 | 2 | 3 | 1 | 7 |
| Phase 5: Code Quality | 2 | 4 | 5 | 3 | 14 |
| **TOTAL** | **7** | **14** | **15** | **7** | **43** |

**Verdict:** NOT beta-ready. 7 critical + 14 high issues must be resolved first.

---

## PHASE 0: Repository Cleanup — COMPLETED

| Task | Status |
|------|--------|
| Fix default branch to `main` | DONE (previously) |
| Delete 9 stale remote branches | DONE (previously) |
| Move `cors.json` to `terraform/` | DONE (this session) |
| Delete `ragbox-prd.md` | DONE (previously) |
| Delete `RAGBOX_CLEANUP_EPIC.md` | DONE (previously) |
| Update `.gitignore` (settings.local.json, artifacts/) | DONE (this session) |
| Commit `src/lib/firebase.ts` | DONE (this session) |
| Push cleanup commit | DONE (d78a0fe) |
| `git fetch --prune` | DONE |

Remaining branches: `main`, `backup/ui-overhaul-2026-02-06` (intentionally kept)

---

## PHASE 1: UI Component Audit

### ISSUE-001: No Error Boundary Components
**Phase:** 1 | **Severity:** CRITICAL
**Component:** Frontend
**Description:** Zero `ErrorBoundary` components exist anywhere in the codebase. No `error.tsx` files in any App Router segment. An unhandled exception in any component will crash the entire app with a white screen.
**Expected:** Error boundaries around major sections (dashboard, mercury, vault, forge)
**Actual:** None exist
**Fix:** Create `src/app/dashboard/error.tsx`, `src/app/error.tsx`, and wrap major panels with React error boundaries
**Effort:** 3 hours

### ISSUE-002: No Loading State Files (App Router)
**Phase:** 1 | **Severity:** CRITICAL
**Component:** Frontend
**Description:** Zero `loading.tsx` files in any App Router segment. Page transitions show no loading indicator — users see a blank screen during navigation.
**Expected:** `loading.tsx` in `/dashboard`, `/dashboard/audit`, `/dashboard/settings`
**Actual:** None exist
**Fix:** Create `loading.tsx` with skeleton loaders for each route segment
**Effort:** 2 hours

### ISSUE-003: Missing API Routes Referenced by Frontend
**Phase:** 1 | **Severity:** HIGH
**Component:** Frontend
**Description:** Frontend forge components reference API routes that don't exist:
- `/api/templates` — referenced in `TemplateLibrary.tsx:22`
- `/api/templates?id={id}` — referenced in `TemplateSelector.tsx:39`
- `/api/templates/analyze` — referenced in `TemplateUpload.tsx:25`
- `/api/forge/generate` — referenced in `TemplateSelector.tsx:63` (exists as `/api/forge` not `/api/forge/generate`)

**Expected:** All referenced endpoints exist and return data
**Actual:** 3 missing routes, 1 wrong path
**Fix:** Create missing route files or update frontend references
**Effort:** 4 hours

### ISSUE-004: Deprecated Inworld Token Endpoint Still Active
**Phase:** 1 | **Severity:** HIGH
**Component:** Frontend
**Description:** `src/app/api/inworld/token/route.ts` is marked `@deprecated` and logs a security warning, but the route still exists and is accessible. Should be removed or return 410 Gone.
**Expected:** Deprecated endpoint removed
**Actual:** Still responds (returns 403 with deprecation message)
**Fix:** Delete the route file or ensure nothing references it
**Effort:** 0.5 hours

### ISSUE-005: Minimal Accessibility (aria-labels)
**Phase:** 1 | **Severity:** HIGH
**Component:** Frontend
**Description:** Only 3 `aria-label` attributes found across all 80+ components:
- `Navbar.tsx:78` — "Toggle theme"
- `Sidebar.tsx:162` — "Toggle theme"
- None on: chat input, send button, upload button, voice button, navigation items, document actions, privilege toggle

**Expected:** WCAG AA compliance — all interactive elements have accessible names
**Actual:** 97%+ of buttons/inputs lack aria-labels
**Fix:** Add aria-labels to all interactive elements across all components
**Effort:** 6 hours

### ISSUE-006: Duplicate State Management Systems
**Phase:** 1 | **Severity:** MEDIUM
**Component:** Frontend
**Description:** Privilege state managed in TWO systems simultaneously:
1. Zustand store: `src/stores/privilegeStore.ts`
2. React Context: `src/contexts/PrivilegeContext.tsx`

Both call `/api/privilege`. Components may use different sources causing state desync.
**Expected:** Single source of truth
**Actual:** Dual state management
**Fix:** Consolidate to Zustand store, remove PrivilegeContext
**Effort:** 2 hours

### ISSUE-007: Old Legacy Components Alongside New Dashboard
**Phase:** 1 | **Severity:** MEDIUM
**Component:** Frontend
**Description:** Legacy components coexist with dashboard rewrite:
- `src/components/Mercury.tsx` (old) vs `src/components/dashboard/mercury/MercuryPanel.tsx` (new)
- `src/components/Vault.tsx` (old) vs `src/components/dashboard/vault/VaultPanel.tsx` (new)
- `src/components/MercuryConsole.tsx` (old) vs new InputBar/ConversationThread

Old components still call `/api/chat` and `/api/documents` directly with `fetch()` instead of Zustand stores.
**Expected:** Dead code removed
**Actual:** Confusing dual implementations
**Fix:** Audit which components are actually rendered, delete unused legacy ones
**Effort:** 3 hours

### ISSUE-008: Multiple Voice Hook Implementations
**Phase:** 1 | **Severity:** MEDIUM
**Component:** Frontend
**Description:** 4 different voice hooks exist:
1. `src/hooks/useVoice.ts` — basic Web Speech API
2. `src/hooks/useSovereignVoice.ts` — Gemini Live + browser STT
3. `src/hooks/useSovereignAgentVoice.ts` — full agent WebSocket
4. `src/hooks/useAgentWebSocket.ts` — raw WebSocket

Plus `src/app/dashboard/hooks/useVoiceChat.ts` (Deepgram). Unclear which is the canonical implementation.
**Expected:** Single voice integration
**Actual:** 5 competing implementations
**Fix:** Determine which voice system is canonical, remove or hide others
**Effort:** 4 hours

### ISSUE-009: VaultAccessModal Has Hardcoded Mock Data
**Phase:** 1 | **Severity:** MEDIUM
**Component:** Frontend
**Description:** `VaultAccessModal.tsx` references `member.avatar` with img tags that likely point to mock/undefined URLs. Line 593 renders user avatars without fallback.
**Expected:** Dynamic data from API
**Actual:** Likely broken images
**Fix:** Add fallback avatar, connect to real user data
**Effort:** 1 hour

### ISSUE-010: Console.log Leaks OTP Codes
**Phase:** 1 | **Severity:** LOW (dev-only, but noted)
**Component:** Frontend
**Description:** `src/lib/auth.ts:185` logs OTP codes to console: `console.log("[OTP] Generated for", email, ":", code)`. This is intentional for dev but must not ship to production.
**Expected:** OTP codes never logged in production
**Actual:** Logged to server console
**Fix:** Gate behind `NODE_ENV === 'development'` check
**Effort:** 0.5 hours

### ISSUE-011: Image Alt Text Issues
**Phase:** 1 | **Severity:** LOW
**Component:** Frontend
**Description:** Two images have empty `alt=""`:
- `SovereignCertificate.tsx:71`
- `EmptyState.tsx:13`

These are decorative images (correct for WCAG), but should be verified they're truly decorative.
**Expected:** Decorative images have `alt=""`, meaningful images have descriptive alt
**Actual:** Mostly correct, needs review
**Fix:** Verify decorative intent, add alt text where meaningful
**Effort:** 0.5 hours

---

## PHASE 2: API Endpoint Audit

### ISSUE-012: Backend `promote_tier` Route Returns 501
**Phase:** 2 | **Severity:** HIGH
**Component:** Backend
**Description:** `POST /api/documents/promote` is still a placeholder returning 501 Not Implemented.
**File:** `backend/internal/router/router.go:88`
**Expected:** Functional tier promotion
**Actual:** Returns `{"success": false, "error": "promote_tier not yet implemented"}`
**Fix:** Implement or remove the route
**Effort:** 2 hours (implement) or 0.5 hours (remove)

### ISSUE-013: No Rate Limiting on Go Backend
**Phase:** 2 | **Severity:** HIGH
**Component:** Backend
**Description:** The Go backend has zero rate limiting. While `server/rate-limit.ts` exists for the Next.js frontend, the Go backend API routes (`/api/chat`, `/api/documents/extract`, `/api/forge`, `/api/export`) are unprotected. A single user could spam the Vertex AI endpoints causing massive GCP costs.
**Expected:** Rate limiting on all mutation/AI endpoints
**Actual:** None
**Fix:** Add rate limiting middleware to Go backend (per-user token bucket)
**Effort:** 4 hours

### ISSUE-014: Frontend-Backend Route Mismatch (Forge)
**Phase:** 2 | **Severity:** MEDIUM
**Component:** Integration
**Description:** Frontend `TemplateSelector.tsx` calls `/api/forge/generate` but the backend route is `POST /api/forge`. The Next.js proxy at `src/app/api/forge/route.ts` may handle this, but it's a potential mismatch.
**Expected:** Consistent route paths
**Actual:** Frontend calls non-existent route
**Fix:** Verify proxy routes, update frontend if needed
**Effort:** 1 hour

### ISSUE-015: PATCH /api/documents/{id} Not Implemented in Backend
**Phase:** 2 | **Severity:** MEDIUM
**Component:** Backend
**Description:** `vaultStore.ts:195` calls `PATCH /api/documents/{id}` for `updateDocument`, but the Go backend router only registers GET and DELETE for `/api/documents/{id}`. No PATCH handler exists.
**Expected:** PATCH endpoint for document updates
**Actual:** Would return 405 Method Not Allowed
**Fix:** Add PATCH handler or route through Next.js proxy
**Effort:** 2 hours

### ISSUE-016: About Route Returns Unknown Content
**Phase:** 2 | **Severity:** LOW
**Component:** Frontend
**Description:** `src/app/api/about/route.ts` exists but is minimal (just a comment on line 1). May return empty response or error.
**Expected:** Clear purpose or removal
**Actual:** Likely dead/stub route
**Fix:** Remove if unused
**Effort:** 0.25 hours

### ISSUE-017: No Backend Health Check for Voice/Deepgram
**Phase:** 2 | **Severity:** HIGH
**Component:** Backend
**Description:** Voice routes (`/api/voice/*`, `/api/tts`) depend on `DEEPGRAM_API_KEY` env var. If not set, `/api/voice/token` returns 500 with `console.error`. No graceful degradation.
**Expected:** Clear error response when service unavailable
**Actual:** Returns 500 with leaked implementation details
**Fix:** Return 503 Service Unavailable with clean message when API key missing
**Effort:** 1 hour

### ISSUE-018: Missing Privilege GET on Document Level
**Phase:** 2 | **Severity:** LOW (PRD lists it but backend uses PATCH only)
**Component:** Backend
**Description:** PRD lists `GET /api/documents/{id}/privilege` but backend only has `PATCH`. The GET is not needed since privilege status is included in document GET response, but PRD and frontend may expect it.
**Expected:** Documented API matches actual
**Actual:** Minor spec mismatch
**Fix:** Update PRD/docs to reflect actual API
**Effort:** 0.25 hours

---

## PHASE 3: Integration Audit

### ISSUE-019: Upload Flow Race Condition Risk
**Phase:** 3 | **Severity:** CRITICAL
**Component:** Integration
**Description:** The upload flow in `src/app/api/documents/extract/route.ts` does:
1. POST to Go backend → get signed URL + document ID
2. Upload file to signed URL
3. POST to `/api/documents/{id}/ingest` to trigger pipeline

Step 3 (lines 135-146) is fire-and-forget with only a `console.warn` on failure. If the ingest trigger fails silently, the document stays in `Pending` status forever with no user feedback.
**Expected:** Reliable pipeline triggering with retry or user notification
**Actual:** Silent failure possible
**Fix:** Add retry logic or surface ingest failure to user
**Effort:** 2 hours

### ISSUE-020: Dual Fetch Patterns (apiFetch vs fetch)
**Phase:** 3 | **Severity:** HIGH
**Component:** Frontend
**Description:** Some components use `apiFetch()` (from `src/lib/api.ts`, adds auth headers via Firebase) while others use raw `fetch()`:
- **Uses apiFetch:** vaultStore, mercuryStore, forgeStore, privilegeStore
- **Uses raw fetch:** PrivilegeContext.tsx, AuditTimeline.tsx, useDocuments.ts, useChat.ts, MercuryConsole.tsx, Vault.tsx, AuthModal.tsx, settings pages

Raw `fetch()` calls may not include Firebase auth token, causing 401 errors when Go backend requires authentication.
**Expected:** All authenticated calls go through apiFetch
**Actual:** ~50% use raw fetch without auth headers
**Fix:** Replace all raw `fetch()` calls to authenticated endpoints with `apiFetch()`
**Effort:** 3 hours

### ISSUE-021: Search Not Connected to Backend
**Phase:** 3 | **Severity:** HIGH
**Component:** Integration
**Description:** The GlobalHeader has a search bar but no corresponding search API endpoint exists on the Go backend. Frontend likely filters client-side only (if implemented at all). With many documents, this won't scale.
**Expected:** Server-side document search
**Actual:** Client-side filtering at best
**Fix:** Add search query parameter to `GET /api/documents` or create dedicated search endpoint
**Effort:** 3 hours

### ISSUE-022: Forge Template Library Not Connected
**Phase:** 3 | **Severity:** MEDIUM
**Component:** Integration
**Description:** `TemplateLibrary.tsx` fetches from `/api/templates` which doesn't exist. `TemplateUpload.tsx` posts to `/api/templates/analyze` which also doesn't exist. The Forge template system is not wired up.
**Expected:** Working template management
**Actual:** Frontend calls non-existent endpoints
**Fix:** Create template API routes or disable template library UI
**Effort:** 4 hours (implement) or 1 hour (disable)

---

## PHASE 4: Visual/UX Audit

### ISSUE-023: Missing HSTS and CSP Security Headers
**Phase:** 4 | **Severity:** CRITICAL
**Component:** Frontend
**Description:** `next.config.js` sets X-Frame-Options, X-Content-Type-Options, and Referrer-Policy, but is missing:
- `Strict-Transport-Security` (HSTS) — required for beta
- `Content-Security-Policy` (CSP) — prevents XSS

The older `ragbox-co/next.config.js` has HSTS but main config doesn't.
**Expected:** All OWASP-recommended headers
**Actual:** Missing HSTS and CSP
**Fix:** Add headers to next.config.js
**Effort:** 1 hour

### ISSUE-024: OpenRouter API Key Exposed in Client Bundle
**Phase:** 4 | **Severity:** HIGH
**Component:** Frontend
**Description:** `next.config.js:11` sets `OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY` in the `env` block, which exposes it to the client-side JavaScript bundle. This key should only be available server-side.
**Expected:** API keys only on server
**Actual:** Exposed to client bundle
**Fix:** Remove from `env` block, access only in API routes via `process.env`
**Effort:** 0.5 hours

### ISSUE-025: No Dark/Light Theme Toggle on Dashboard
**Phase:** 4 | **Severity:** MEDIUM
**Component:** Frontend
**Description:** Landing page Navbar and Sidebar have theme toggle buttons, but the dashboard `GlobalHeader.tsx` does not expose a visible theme toggle. The `ThemeProvider.tsx` exists but may not be active in the dashboard layout.
**Expected:** Consistent theme toggling
**Actual:** Only available on landing page
**Fix:** Add theme toggle to GlobalHeader or settings
**Effort:** 1 hour

### ISSUE-026: Responsive Design Not Verified
**Phase:** 4 | **Severity:** MEDIUM
**Component:** Frontend
**Description:** Dashboard uses a 3-panel layout (Vault rail | Mercury | Forge rail) with hardcoded CSS dimensions. No responsive breakpoint media queries found in `DashboardLayout.tsx`. Mobile/tablet experience likely broken.
**Expected:** Responsive design with breakpoints
**Actual:** Desktop-only layout
**Fix:** Add responsive breakpoints, collapsible panels for mobile
**Effort:** 8 hours

### ISSUE-027: Loading States Only in 7 of 80+ Components
**Phase:** 4 | **Severity:** MEDIUM
**Component:** Frontend
**Description:** Only 7 components reference loading/isLoading patterns:
- IntelligenceMatrix, AuthModal, MercuryConsole, TemplateLibrary, Vault, AuditTimeline, Mercury

The other 73+ components have no loading states. Components that fetch data (settings pages, forge panel, voice panel) show nothing while loading.
**Expected:** Loading indicators during all async operations
**Actual:** Most components show blank/nothing during loads
**Fix:** Add loading states to all data-fetching components
**Effort:** 4 hours

### ISSUE-028: No Toast/Notification System
**Phase:** 4 | **Severity:** LOW
**Component:** Frontend
**Description:** No toast notification library or component found. Errors are either `console.error`'d or shown via `window.confirm`. User has no visible feedback for success/failure of operations like delete, privilege toggle, or upload completion.
**Expected:** Toast notifications for user actions
**Actual:** Silent failures
**Fix:** Add toast library (e.g., sonner, react-hot-toast) and wire up to all actions
**Effort:** 3 hours

### ISSUE-029: Form Keyboard Handling
**Phase:** 4 | **Severity:** HIGH
**Component:** Frontend
**Description:** Chat input in `InputBar.tsx` has onKeyDown handling (13 handlers found), but need to verify Shift+Enter inserts newline vs sending. Other forms (auth modal, folder creation) may not handle Enter key properly.
**Expected:** Enter sends, Shift+Enter newline in chat; Enter submits forms
**Actual:** Needs manual verification
**Fix:** Verify and fix keyboard handling across all input forms
**Effort:** 2 hours

---

## PHASE 5: Code Quality Audit

### ISSUE-030: 188 Console.log/error/warn Statements in Production Code
**Phase:** 5 | **Severity:** CRITICAL
**Component:** Frontend
**Description:** 188 `console.log/error/warn` statements found across `src/`. Breakdown:
- `console.log`: ~90 (debug logging left in production code)
- `console.error`: ~75 (error logging — some acceptable, many leak implementation details)
- `console.warn`: ~23 (warnings — some acceptable)

**Worst offenders:**
- `src/lib/auth.ts` — 15 statements including OTP codes
- `src/app/dashboard/hooks/useVoiceChat.ts` — 22 statements
- `src/hooks/useSovereignAgentVoice.ts` — 14 statements
- `src/lib/voice/deepgram-client.ts` — 6 statements
- `src/lib/vertex/gemini-live-client.ts` — 12 statements
- `src/lib/vertex/rag-client.ts` — 6 statements

**Expected:** Structured logging only, no console.log in production
**Actual:** Debug logging everywhere
**Fix:** Replace with structured logger, remove debug statements, gate behind NODE_ENV
**Effort:** 6 hours

### ISSUE-031: OTP Code Logged in Plaintext (Security)
**Phase:** 5 | **Severity:** CRITICAL
**Component:** Frontend
**Description:** `src/lib/auth.ts:185` logs OTP code in plaintext: `console.log("[OTP] Generated for", email, ":", code)`. Lines 96, 198-200 also dump OTP store contents. In production, this exposes authentication codes in server logs.
**Expected:** OTP codes never logged
**Actual:** Logged with full email + code
**Fix:** Remove all OTP logging or gate strictly behind development environment
**Effort:** 0.5 hours

### ISSUE-032: Only 1 TODO Comment (Clean)
**Phase:** 5 | **Severity:** LOW
**Component:** Frontend
**Description:** Only 1 TODO found:
- `src/hooks/useSovereignVoice.ts:161` — "TODO: Replace with WebSocket connection to session.wsUrl for full Inworld integration"

Zero TODOs in backend Go code.
**Expected:** No blocking TODOs
**Actual:** 1 non-blocking TODO (voice feature enhancement)
**Fix:** Track as future enhancement, not blocking
**Effort:** 0 hours (not blocking)

### ISSUE-033: Only 2 TypeScript `any` Types (Clean)
**Phase:** 5 | **Severity:** LOW
**Component:** Frontend
**Description:** Only 2 `any` types found:
- `StudioPanel.tsx:173` — `insightType as any`
- `ToolConfirmationDialog.tsx:107` — `event: any` (SpeechRecognition event)

TypeScript strict mode is enabled. Very clean.
**Expected:** Zero any types
**Actual:** 2 (both in edge cases)
**Fix:** Type the SpeechRecognition event, fix the cast
**Effort:** 0.5 hours

### ISSUE-034: Hardcoded localhost Fallback URLs
**Phase:** 5 | **Severity:** HIGH
**Component:** Frontend
**Description:** Multiple files have hardcoded `localhost` fallbacks:
- `useAgentWebSocket.ts:226` — `ws://localhost:3000/agent/ws`
- `useSovereignAgentVoice.ts:419` — `ws://localhost:3000/agent/ws`
- `chat/route.ts:13` — `http://localhost:8080`
- `backend-proxy.ts:11` — `http://localhost:8080`
- `documents/extract/route.ts:4` — `http://localhost:8080`
- `agent/session/route.ts:52` — `localhost:3000`

These will fail silently in production if env vars are missing, or worse, expose internal architecture.
**Expected:** Fail loudly if env vars missing, no localhost fallbacks in production
**Actual:** Silent fallback to localhost
**Fix:** Throw error if `NEXT_PUBLIC_API_URL` / `GO_BACKEND_URL` not set in production
**Effort:** 2 hours

### ISSUE-035: Backend Has No Security Headers
**Phase:** 5 | **Severity:** HIGH
**Component:** Backend
**Description:** The Go backend sets no security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options). Only CORS is configured. Since the backend serves API responses, minimal headers needed, but best practice is to set them.
**Expected:** Security headers on all API responses
**Actual:** Only CORS
**Fix:** Add security headers middleware to Go backend
**Effort:** 1 hour

### ISSUE-036: Backend Input Validation Gaps
**Phase:** 5 | **Severity:** HIGH
**Component:** Backend
**Description:** Backend handlers need review for input validation. The Go handlers decode JSON but may not validate all fields (length limits, format checks). Specific gaps need per-handler review.
**Expected:** All inputs validated with clear error messages
**Actual:** Basic JSON decoding, limited field validation
**Fix:** Add validation middleware or per-handler validation
**Effort:** 4 hours

### ISSUE-037: No Backend Request Timeout Configuration
**Phase:** 5 | **Severity:** MEDIUM
**Component:** Backend
**Description:** Cloud Run has a 300s timeout, but the Go HTTP server and individual handler contexts may not have appropriate timeouts. Long-running requests (Document AI, Vertex AI) could hold connections indefinitely.
**Expected:** Per-handler timeout contexts
**Actual:** Relies solely on Cloud Run timeout
**Fix:** Add `context.WithTimeout` to AI-calling handlers
**Effort:** 2 hours

### ISSUE-038: ServerActions bodySizeLimit Set to 100MB
**Phase:** 5 | **Severity:** MEDIUM
**Component:** Frontend
**Description:** `next.config.js:53` sets `bodySizeLimit: '100mb'` for server actions. This is extremely high and could enable DoS via large payload uploads.
**Expected:** Reasonable limit (10-20MB for documents)
**Actual:** 100MB
**Fix:** Reduce to 50MB (matching document upload limit)
**Effort:** 0.25 hours

### ISSUE-039: Deprecated ScriptProcessorNode Usage
**Phase:** 5 | **Severity:** MEDIUM
**Component:** Frontend
**Description:** `useAgentWebSocket.ts:115` uses `ScriptProcessorNode` which is deprecated in Web Audio API. The code comments note this but uses it for compatibility.
**Expected:** AudioWorklet usage
**Actual:** Deprecated API used
**Fix:** Migrate to AudioWorklet (already used in audio-capture.ts as primary)
**Effort:** 2 hours

### ISSUE-040: Multiple Duplicate Client Libraries
**Phase:** 5 | **Severity:** MEDIUM
**Component:** Frontend
**Description:** Duplicate implementations exist:
- Document AI: `src/lib/gcp/documentai.ts` (frontend) + `backend/internal/gcpclient/docai.go` (backend)
- Embeddings: `src/lib/vertex/embeddings-client.ts` (frontend) + `backend/internal/service/embedder.go` (backend)
- RAG pipeline: `src/lib/rag/pipeline.ts` (frontend) + `backend/internal/service/pipeline.go` (backend)
- BigQuery audit: `src/lib/gcp/bigquery.ts` + `src/lib/audit/logger.ts` (frontend) + `backend/internal/service/audit.go` (backend)

Frontend copies are likely from the pre-Go-backend era and may be dead code.
**Expected:** Single backend implementation
**Actual:** Duplicate code, frontend copies may be unused
**Fix:** Verify frontend copies are unused, delete if so
**Effort:** 3 hours

### ISSUE-041: DeepSeek/OpenRouter API Key Management
**Phase:** 5 | **Severity:** MEDIUM
**Component:** Frontend
**Description:** Multiple third-party AI services configured:
- OpenRouter: API key exposed via `next.config.js` env block (see ISSUE-024)
- DeepSeek: `DEEPSEEK_ENDPOINT_URL` + `DEEPSEEK_API_KEY` used in `src/lib/gcp/deepseek.ts`
- Deepgram: `DEEPGRAM_API_KEY` used in voice routes

These may not all be needed for beta. DeepSeek has a Gemini fallback already.
**Expected:** Minimal external dependencies for beta
**Actual:** 3+ third-party AI services
**Fix:** Determine which are needed for beta, disable/remove others
**Effort:** 1 hour

### ISSUE-042: No Frontend Test Coverage for Dashboard Components
**Phase:** 5 | **Severity:** LOW
**Component:** Frontend
**Description:** Only 5 test files found:
- `stores/mercuryStore.test.ts`
- `stores/forgeStore.test.ts`
- `stores/vaultStore.test.ts`
- `components/dashboard/DashboardLayout.test.tsx`
- `components/dashboard/vault/VaultPanel.test.tsx`

No tests for: Mercury chat, auth flow, forge panel, audit page, voice features, settings.
**Expected:** 70%+ test coverage
**Actual:** <10% estimated
**Fix:** Add integration tests for critical flows
**Effort:** 16 hours

### ISSUE-043: Large Bundle Risk (serverComponentsExternalPackages)
**Phase:** 5 | **Severity:** LOW
**Component:** Frontend
**Description:** `next.config.js:56` externalizes `ws`, `bufferutil`, `utf-8-validate`, `pdf-parse`, `mammoth`. These native modules are correctly externalized, but `pdf-parse` and `mammoth` may pull significant dependencies. Should verify they're only used server-side.
**Expected:** Minimal client bundle
**Actual:** Needs verification
**Fix:** Audit imports to ensure server-only modules aren't accidentally client-bundled
**Effort:** 1 hour

---

## Prioritized Repair List

### Critical (Beta Blockers) — Fix Immediately

| # | Issue | Component | Effort |
|---|-------|-----------|--------|
| 1 | ISSUE-001: No Error Boundaries | Frontend | 3h |
| 2 | ISSUE-002: No Loading States (App Router) | Frontend | 2h |
| 3 | ISSUE-023: Missing HSTS + CSP Headers | Frontend | 1h |
| 4 | ISSUE-030: 188 Console Statements | Frontend | 6h |
| 5 | ISSUE-031: OTP Codes Logged in Plaintext | Frontend | 0.5h |
| 6 | ISSUE-019: Upload Pipeline Silent Failure | Integration | 2h |
| 7 | ISSUE-024: OpenRouter Key in Client Bundle | Frontend | 0.5h |
| | | **Subtotal** | **15h** |

### High Priority — Fix Before Beta

| # | Issue | Component | Effort |
|---|-------|-----------|--------|
| 8 | ISSUE-003: Missing Template API Routes | Frontend | 4h |
| 9 | ISSUE-005: Minimal Accessibility | Frontend | 6h |
| 10 | ISSUE-013: No Go Backend Rate Limiting | Backend | 4h |
| 11 | ISSUE-020: Dual Fetch Patterns | Frontend | 3h |
| 12 | ISSUE-021: Search Not Connected | Integration | 3h |
| 13 | ISSUE-029: Form Keyboard Handling | Frontend | 2h |
| 14 | ISSUE-034: Hardcoded localhost URLs | Frontend | 2h |
| 15 | ISSUE-035: Backend No Security Headers | Backend | 1h |
| 16 | ISSUE-036: Backend Input Validation | Backend | 4h |
| 17 | ISSUE-012: promote_tier Returns 501 | Backend | 0.5h |
| 18 | ISSUE-004: Deprecated Inworld Endpoint | Frontend | 0.5h |
| 19 | ISSUE-017: Voice Route Error Handling | Frontend | 1h |
| | | **Subtotal** | **31h** |

### Medium Priority — Fix After Beta Launch

| # | Issue | Component | Effort |
|---|-------|-----------|--------|
| 20 | ISSUE-006: Duplicate Privilege State | Frontend | 2h |
| 21 | ISSUE-007: Legacy Component Cleanup | Frontend | 3h |
| 22 | ISSUE-008: Multiple Voice Hooks | Frontend | 4h |
| 23 | ISSUE-009: VaultAccessModal Mock Data | Frontend | 1h |
| 24 | ISSUE-014: Forge Route Mismatch | Integration | 1h |
| 25 | ISSUE-015: Missing PATCH /documents/{id} | Backend | 2h |
| 26 | ISSUE-022: Forge Template Library | Integration | 4h |
| 27 | ISSUE-025: No Dashboard Theme Toggle | Frontend | 1h |
| 28 | ISSUE-026: Responsive Design | Frontend | 8h |
| 29 | ISSUE-027: Missing Loading States | Frontend | 4h |
| 30 | ISSUE-037: Backend Request Timeouts | Backend | 2h |
| 31 | ISSUE-038: 100MB bodySizeLimit | Frontend | 0.25h |
| 32 | ISSUE-039: Deprecated ScriptProcessor | Frontend | 2h |
| 33 | ISSUE-040: Duplicate Client Libraries | Frontend | 3h |
| 34 | ISSUE-041: Multiple AI Service Keys | Frontend | 1h |
| | | **Subtotal** | **38.25h** |

### Low Priority — Polish

| # | Issue | Component | Effort |
|---|-------|-----------|--------|
| 35 | ISSUE-010: Console.log OTP (dev) | Frontend | 0.5h |
| 36 | ISSUE-011: Image Alt Text Review | Frontend | 0.5h |
| 37 | ISSUE-016: Dead About Route | Frontend | 0.25h |
| 38 | ISSUE-018: Privilege GET Spec Mismatch | Docs | 0.25h |
| 39 | ISSUE-028: No Toast System | Frontend | 3h |
| 40 | ISSUE-032: 1 Non-blocking TODO | Frontend | 0h |
| 41 | ISSUE-033: 2 TypeScript any Types | Frontend | 0.5h |
| 42 | ISSUE-042: Low Frontend Test Coverage | Frontend | 16h |
| 43 | ISSUE-043: Bundle Size Audit | Frontend | 1h |
| | | **Subtotal** | **22h** |

---

## Total Estimated Effort

| Priority | Hours |
|----------|-------|
| Critical | 15h |
| High | 31h |
| Medium | 38.25h |
| Low | 22h |
| **Total** | **106.25h** |

**Recommendation:** Focus on Critical (15h) + High (31h) = **46 hours** of work to reach beta-ready state. Medium and Low issues can be addressed post-launch in prioritized sprints.

---

## Zustand Store Summary

| Store | File | State Shape |
|-------|------|-------------|
| `useVaultStore` | `src/stores/vaultStore.ts` | `documents: Record<id, VaultItem>`, `folders: Record<id, FolderNode>`, `isCollapsed`, `isExplorerMode`, `currentPath`, `selectedItemId`, `isLoading`, `error`, `storage` |
| `useMercuryStore` | `src/stores/mercuryStore.ts` | `messages: ChatMessage[]`, `inputValue`, `isStreaming`, `streamingContent`, `abortController`, `attachments: SessionAttachment[]`, `activePersona`, `isRefocusing`, `temperaturePreset` |
| `useForgeStore` | `src/stores/forgeStore.ts` | `assets: GeneratedAsset[]`, `isGenerating`, `currentGenerationType` |
| `usePrivilegeStore` | `src/stores/privilegeStore.ts` | `isEnabled`, `lastChanged` |

## Frontend API Route Map

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/auth/[...nextauth]` | GET, POST | NextAuth OAuth + OTP |
| `/api/auth/send-otp` | POST | Send OTP email |
| `/api/chat` | POST | Proxy to Go backend `/api/chat` (SSE) |
| `/api/documents` | GET | Proxy to Go backend (list) |
| `/api/documents/extract` | POST | Upload → GCS → DB → Ingest trigger |
| `/api/documents/[id]` | GET, DELETE | Proxy to Go backend |
| `/api/documents/[id]/privilege` | PATCH | Proxy to Go backend |
| `/api/documents/[id]/recover` | POST | Proxy to Go backend |
| `/api/documents/[id]/tier` | PATCH | Proxy to Go backend |
| `/api/documents/folders` | GET, POST | Proxy to Go backend |
| `/api/documents/folders/[id]` | DELETE | Proxy to Go backend |
| `/api/privilege` | GET, POST | Proxy to Go backend |
| `/api/forge` | POST | Proxy to Go backend |
| `/api/audit` | GET | Proxy to Go backend |
| `/api/audit/export` | GET | Proxy to Go backend |
| `/api/export` | GET | Proxy to Go backend |
| `/api/voice` | POST, GET | Voice session + SSE |
| `/api/voice/synthesize` | POST | Deepgram TTS proxy |
| `/api/voice/token` | POST | Deepgram API key proxy |
| `/api/tts` | POST | Google Cloud TTS |
| `/api/studio/generate` | POST | Studio artifact generation |
| `/api/scrape` | POST | URL scraping (with SSRF protection) |
| `/api/waitlist` | POST | Waitlist signup |
| `/api/about` | ? | Minimal/stub |
| `/api/agent/session` | POST | Agent session creation |
| `/api/inworld/token` | POST | **DEPRECATED** |

## Backend API Route Map

| Route | Method | Handler | Status |
|-------|--------|---------|--------|
| `/api/health` | GET | `handler.Health` | Working |
| `/metrics` | GET | Prometheus | Working |
| `/api/documents` | GET | `handler.ListDocuments` | Working |
| `/api/documents/extract` | POST | `handler.UploadDocument` | Working |
| `/api/documents/{id}` | GET | `handler.GetDocument` | Working |
| `/api/documents/{id}` | DELETE | `handler.DeleteDocument` | Working |
| `/api/documents/{id}/recover` | POST | `handler.RecoverDocument` | Working |
| `/api/documents/{id}/tier` | PATCH | `handler.UpdateDocumentTier` | Working |
| `/api/documents/promote` | POST | `placeholder("promote_tier")` | **501** |
| `/api/documents/{id}/privilege` | PATCH | `handler.ToggleDocPrivilege` | Working |
| `/api/documents/{id}/ingest` | POST | `handler.IngestDocument` | Working |
| `/api/documents/folders` | GET | `handler.ListFolders` | Working |
| `/api/documents/folders` | POST | `handler.CreateFolder` | Working |
| `/api/documents/folders/{id}` | DELETE | `handler.DeleteFolder` | Working |
| `/api/privilege` | GET | `handler.GetPrivilege` | Working |
| `/api/privilege` | POST | `handler.TogglePrivilege` | Working |
| `/api/chat` | POST | `handler.Chat` | Working (SSE) |
| `/api/audit` | GET | `handler.ListAudit` | Working |
| `/api/audit/export` | GET | `handler.ExportAudit` | Working |
| `/api/export` | GET | `handler.ExportData` | Working |
| `/api/forge` | POST | `handler.ForgeHandler` | Working |

---

*Generated by Claude Code — February 11, 2026*
