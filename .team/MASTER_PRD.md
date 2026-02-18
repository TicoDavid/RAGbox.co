# RAGböx Master PRD
## The Single Source of Truth — February 18, 2026
### Owner: David Pierce, CPO | ConnexUS AI Inc.
### Engineering Lead: Sheldon (Chief Engineer) | Prepared by: Dr. Insane (CPO Assistant)

---

## Document Purpose

This is the **Master Product Requirements Document** for RAGböx — the knowledge layer of the ConnexUS AI Autonomous Enterprise Operating System. It serves three audiences simultaneously:

1. **David (CPO)** — What we're building, why it matters, and how it maps to revenue
2. **Sheldon (Chief Engineer)** — What's built, what's broken, what's next, and in what order
3. **ADAM + Sarah (CLI Engineers)** — Atomic execution steps with exact file paths, commands, and acceptance criteria

Every decision in this document traces back to either a verified production state, a committed design decision, or a CPO directive.

---

## PART 1: EXECUTIVE REALITY CHECK

### What RAGböx IS

RAGböx is a **standalone SaaS product going to market NOW.** It is a secure, compliance-ready Retrieval-Augmented Generation platform targeting SMBs in legal, financial, and healthcare sectors. It transforms unstructured documents into an intelligent, queryable knowledge base with verified citations, attorney-client privilege protection, and immutable audit logging.

**Tagline:** *"Your Files Speak. We Make Them Testify."*

**Go-to-market posture:** RAGböx launches independently as ConnexUS AI's first revenue product. It later connects to ATHENA and joins the ConnexUS suite as the Knowledge Layer — but it does NOT depend on ATHENA to ship, sell, or generate revenue. RAGböx stands on its own.

**First vertical:** Legal. Attorney-client privilege is already built. SEC 17a-4 audit chain is production-ready. Law firms have the highest willingness-to-pay for document intelligence.

### What RAGböx IS NOT

- It is NOT a sub-module that waits for ATHENA (it ships independently)
- It is NOT a general-purpose chatbot (it's a citation-verified knowledge engine)
- It is NOT a developer tool (business owners upload documents, ask questions, get proven answers)
- It is NOT open beta (invite-only, 50 codes, hand-picked legal vertical users)

### Verified Production Metrics (Feb 18, 2026)

| Metric | Value | Source |
|--------|-------|--------|
| Total commits | 344+ | GitHub main branch |
| Lines of code | ~56,355 | Build report |
| Story points delivered | 822 SP | Phase tracking |
| Build duration | 28 days (Jan 21 – Feb 17) | Commit history |
| Prisma models | 26+ | schema.prisma |
| API endpoints | 97 total (67 frontend + 30 backend) | Route inventory |
| Cloud Run services | 4 (ragbox-app, ragbox-backend, mercury-voice, ragbox-document-worker) | GCP |
| Backend test coverage | 87-98% | Go test suite |
| Frontend test coverage | ~4% | Jest (CRITICAL GAP) |
| GCP Project | ragbox-sovereign-prod | Production |
| Region | us-east4 | All services |

---

## PART 2: ARCHITECTURE — AS BUILT

### Service Map

```
Users ──── HTTPS ────▶  Cloud Run (us-east4)
                        ├── ragbox-app        (Next.js 14 + React 18)  — Frontend + API routes
                        ├── ragbox-backend    (Go 1.25 + chi)          — RAG pipeline + docs
                        ├── mercury-voice     (Node.js + WebSocket)    — Voice agent
                        └── ragbox-document-worker                     — Pub/Sub processor
                              │          │          │
                              ▼          ▼          ▼
                        Cloud SQL    Vertex AI   Cloud Storage
                        PostgreSQL   Gemini      (CMEK)
                        +pgvector    text-embed
                              │
                        ┌─────┴─────┐
                        ▼           ▼
                   BigQuery    Document AI
                   (Audit)     (OCR)
```

### Data Flow — RAG Pipeline (WORKING)

```
Document Upload → Document AI (OCR) → DLP (PII Redaction) →
Semantic Chunker (paragraph/sentence, 20% overlap) →
Vertex AI Embedder (768-dim, L2 normalized) →
PostgreSQL + pgvector (cosine similarity)

User Query → Embed Query → Top-20 Vector Search →
Re-rank (0.7 sim + 0.15 recency + 0.15 parentDoc) →
Dedup (max 2/doc) → Top-5 Chunks →
Gemini Generator (system prompt sandwich) →
Self-RAG (3 iterations: relevance, support, completeness) →
Response + Citations [1][2][3] | Silence Protocol (<85%)
```

### Database Schema (26 Models)

**Core Domain:** User, Tenant, Vault, Document, DocumentChunk, Folder

**Query & RAG:** Query, Answer, Citation

**Conversation:** MercuryThread, MercuryThreadMessage, MercuryAction, MercuryPersona

**Audit & Compliance:** AuditLog (DEPRECATED), AuditEntry (hash-chained, SEC 17a-4)

**Agent Email (NEW — Feb 18):** AgentEmailCredential

**Intelligence:** ContentGap, KBHealthCheck, LearningSession

**WhatsApp:** WhatsAppContact, WhatsAppConversation, WhatsAppMessage, IntegrationSettings

**Other:** Template, ApiKey, WaitlistEntry

### Authentication Stack

| Method | Use Case |
|--------|----------|
| Google OAuth 2.0 | Dashboard login via NextAuth |
| Firebase ID tokens | Go backend API calls |
| x-internal-auth header | Internal service-to-service |
| API keys (SHA-256 hashed) | V1 public API (rbx_live_ prefix) |
| HMAC-SHA256 signatures | Webhook verification (ROAM, WhatsApp) |

### Secrets Inventory (GCP Secret Manager)

| Secret | Consumer | Status |
|--------|----------|--------|
| ragbox-prod-database-url | Frontend (Prisma) | ✅ Active |
| ragbox-database-url | Backend (pgx) | ✅ Active |
| firebase-api-key | Frontend | ✅ Active |
| firebase-auth-domain | Frontend | ✅ Active |
| firebase-project-id | Frontend + Backend | ✅ Active |
| nextauth-secret | Frontend | ✅ Active |
| nextauth-url | Frontend | ✅ Active |
| google-client-id | Frontend (OAuth) | ✅ Active |
| google-client-secret | Frontend (OAuth) | ✅ Active |
| ragbox-backend-url | Frontend → Backend proxy | ✅ Active |
| ragbox-internal-auth-secret | All services (internal auth) | ✅ Active |
| vonage-api-secret | Frontend (WhatsApp) | ✅ Active |
| roam-api-key | Frontend (ROAM) | ✅ Active |
| roam-webhook-secret | Frontend (ROAM) | ✅ Active |
| roam-client-id | Frontend (ROAM) | ✅ Active |
| gmail-pubsub-token | Frontend (Gmail push) | ✅ Active |
| gmail-cron-secret | Frontend (Gmail polling) | ✅ Active |

---

## PART 3: WHAT'S WORKING (Verified Feb 18, 2026)

### Core RAG Pipeline ✅

- Document upload, OCR extraction, PII redaction
- Semantic chunking with 20% overlap
- Vertex AI embedding (768-dim, L2 normalized)
- pgvector cosine similarity search
- Re-ranking with sim/recency/parentDoc weighting
- Self-RAG reflection (3 iterations)
- Silence Protocol (confidence < 85%)
- Citation generation with source/page/paragraph
- SSE streaming responses

### Mercury Chat ✅

- Unified thread model across channels (dashboard, WhatsApp, voice, ROAM)
- Tool router with 14 patterns (send-email, send-sms, etc.)
- Persona system with tenant-scoped configuration
- Dynamic prompt injection based on persona

### Multi-Channel Integration ✅

- **WhatsApp (Vonage):** Credentials live, webhook handler deployed
- **ROAM:** API key, webhook secret, client ID all configured. Mercury home office created
- **Gmail (NEW):** OAuth connected, refresh token stored (encrypted AES-256-GCM), send verified ✅
- **SMS:** Send action route working
- **Voice (WebSocket):** Inworld runtime deployed but BROKEN (see Part 4)

### Infrastructure ✅

- Cloud Build CI/CD (3 pipelines: frontend, backend, voice)
- Smoke test suite (18 endpoints)
- Terraform IaC (11 modules)
- Billing alerts ($1000 monthly)
- Monitoring (latency p95, error rate, DLQ alerts)

### Security & Compliance ✅

- AES-256 encryption at rest (CMEK)
- TLS 1.3 in transit
- Hash-chained audit entries (SEC 17a-4 WORM)
- PostgreSQL Row-Level Security
- Rate limiting (60/min general, 10/min chat, 5/min forge)
- Security headers (HSTS, X-Frame-Options, CSP)
- Privilege system (Standard/Confidential/Privileged tiers)

---

## PART 4: WHAT'S BROKEN OR INCOMPLETE

### CRITICAL (Blocking Production Use)

| ID | Issue | Impact | Owner |
|----|-------|--------|-------|
| C-01 | Frontend test coverage at ~4% | Every UI change is a blind push | ADAM/Sarah |
| C-02 | Inworld voice integration broken | Mercury voice panel shows "Connecting..." | Sheldon (architecture decision needed) |
| C-03 | OAuth app in Google Testing mode | Gmail refresh tokens expire every 7 days | David (needs Google verification or weekly re-auth) |
| C-04 | Test email subject has encoding bug | `Ã¢ÂÂ` characters + raw UUID in subject | Sarah |
| C-05 | Session polling bug | Dashboard hammering /api/auth/session ~4x/second | ADAM |

### HIGH (Degrading Quality)

| ID | Issue | Impact | Owner |
|----|-------|--------|-------|
| H-01 | No agent identity page | Evelyn exists in DB but has no UI "home" | Sheldon (spec first) |
| H-02 | Duplicate Cloud Build triggers | Multiple builds fire on same push, wasting minutes | ADAM |
| H-03 | AuditLog/AuditEntry dual system | Frontend writes to deprecated AuditLog, backend to AuditEntry | Phase 2 migration |
| H-04 | OpenRouter API key in client-side code | Security exposure | ADAM (move to server-side) |
| H-05 | Gmail inbound processing not built | Can send but can't receive/process incoming email | ADAM (Agent Email PRD) |
| H-06 | ragbox.co domain not mapped | Custom domain not connected to Cloud Run | David (DNS config) |

### MEDIUM (Technical Debt)

| ID | Issue | Impact | Owner |
|----|-------|--------|-------|
| M-01 | Agent email refresh tokens encrypted with NEXTAUTH_SECRET | Should use KMS for key rotation + audit | Phase 2 |
| M-02 | Remaining console.log statements (8) | Minor noise in production logs | Sarah |
| M-03 | OTP plaintext in dev logs | Should be cleaned even for dev mode | Sarah |
| M-04 | No accessibility (a11y) | Major effort, blocks enterprise sales | Backlog |
| M-05 | WhatsApp webhook-to-Mercury connection unverified | Credentials live but end-to-end untested | Sarah |
| M-06 | ROAM webhook-to-Mercury integration incomplete | Webhook handler exists but Mercury brain not wired | ADAM |

---

## PART 5: THE BUILD — PRIORITIZED EXECUTION PLAN

### GO-TO-MARKET PRICING (Dr. Insane Recommendation — Awaiting David Approval)

| Tier | Price | Includes |
|------|-------|----------|
| **Starter** | $149/mo | 1 Vault, 500 documents, RAG chat, citations, basic audit log |
| **Professional** | $399/mo | 3 Vaults, 2,000 documents, Mercury persona (chat + email), privilege controls, full audit |
| **Enterprise** | $999/mo | Unlimited Vaults, unlimited documents, Mercury persona (all channels incl. voice), API access, dedicated onboarding |

Mercury (email/SMS/voice agent) is an add-on at Starter tier but included at Professional and above. This creates natural upgrade pressure.

### BETA ACCESS MODEL

Invite-only. 50 codes total:
- 20 codes → David's direct network (legal vertical)
- 20 codes → Inbound from landing page CTA
- 10 codes → Reserved for investor demos

### THE 3-DAY SPRINT (Sheldon's Plan + Dr. Insane's Priorities)

**Day 1 — Stabilize (In Progress)**
- Fix session polling bug (ADAM)
- Fix test email subject encoding (Sarah)
- Move OpenRouter API key server-side (ADAM)
- Deduplicate Cloud Build triggers (ADAM)
- Verify WhatsApp end-to-end (Sarah)
- Complete app.ragbox.co domain mapping (David — DNS propagating)

**Day 2 — Build the Demo Centerpiece**
- Evelyn Monroe agent identity page (/dashboard/agents/[agentId]) — Sheldon specs, ADAM builds
- Legal Starter Vault scaffold — 8-10 synthetic legal documents (NDAs, leases, engagement letters, compliance policies) generated as formatted PDFs
- Pre-load Legal Starter Vault into demo tenant for instant "aha moment"

**Day 3 — Demo Polish + Smoke Test**
- End-to-end demo script: Sign up → Legal Vault pre-loaded → Ask question → Get cited answer → Mercury chat → Send test email
- Smoke test every critical path
- Record 90-second demo video for landing page
- Landing page: add "Request Beta Access" CTA (email + company + use case capture)

### Tier 0: Already Done Today (Feb 18)

| Task | Commit | Status |
|------|--------|--------|
| P4: Frontend health endpoint | 6c3cab0 | ✅ Deployed |
| P2: Rate limiting middleware | 6c3cab0 | ✅ Deployed |
| Q4: Starred field reconciliation | 6c3cab0 | ✅ Deployed |
| P1: Audit system deprecation | a5fe728 / 5cd1628 | ✅ Deployed |
| Gmail OAuth flow complete | — | ✅ Connected |
| Agent email KMS→AES fix | e8b24c9 | ✅ Deployed |
| Orphaned secrets cleanup | — | ✅ Cleaned |
| Test email verified | — | ✅ Working |

### Tier 1: IMMEDIATE (This Week) — Unblock Demo Readiness

**Goal:** RAGböx can be shown to an investor or client with confidence.

| # | Task | Owner | Est | Blocks |
|---|------|-------|-----|--------|
| 1.1 | Fix test email subject encoding + remove UUID | Sarah | 1h | — |
| 1.2 | Fix session polling bug (debounce /api/auth/session) | ADAM | 2h | — |
| 1.3 | Move OpenRouter API key to server-side | ADAM | 1h | — |
| 1.4 | Deduplicate Cloud Build triggers | ADAM | 30m | — |
| 1.5 | Verify WhatsApp end-to-end (send test message, confirm webhook receives) | Sarah | 2h | — |
| 1.6 | Map ragbox.co domain to Cloud Run | David | 1h | DNS access |

### Tier 2: SHORT-TERM (Next 2 Weeks) — Agent Email Complete

**Goal:** Evelyn Monroe can send AND receive email autonomously.

This tier executes the **Agent Email PRD** (already specced by Sheldon) across 5 parallel CLI tracks:

| CLI | Focus | Key Deliverables |
|-----|-------|-----------------|
| CLI-A | Database + Models | AgentEmailCredential in Prisma, migration, encryption utils |
| CLI-B | OAuth Connect Flow | Per-agent Gmail OAuth, token storage, consent screen |
| CLI-C | Send Email | Agent-scoped send using stored credentials, Mercury integration |
| CLI-D | Receive Email | Gmail push notifications via Pub/Sub, inbound processing, Cortex storage |
| CLI-E | Settings UI + Compliance | Agent email management page, privacy policy, Google verification prep |

**Execution order:** CLI-A first (15 min, unblocks everything) → CLI-B + C + D in parallel → CLI-E anytime.

### Tier 3: MID-TERM (Weeks 3-4) — Agent Identity & Voice Resolution

**Goal:** Every Mercury persona has a visible "home" in the UI, and the voice question is resolved.

| # | Task | Owner | Est | Blocks |
|---|------|-------|-----|--------|
| 3.1 | Agent identity page (/dashboard/agents/[agentId]) | Sheldon specs → ADAM builds | 1 week | Sheldon spec |
| 3.2 | Voice architecture decision: fix Inworld OR pivot to Cartesia | Sheldon + David | Decision | — |
| 3.3 | ROAM Mercury brain integration | ADAM | 3 days | — |
| 3.4 | Frontend test coverage to 30% minimum | Sarah | 1 week | — |
| 3.5 | Weekly Gmail token refresh cron (interim until Google verification) | ADAM | 2h | — |

### Tier 4: Q2 TARGET — Production Multi-Tenant

**Goal:** RAGböx is ready for paying customers beyond ConnexUS internal use.

| # | Task | Owner | Est |
|---|------|-------|-----|
| 4.1 | Full AuditLog → AuditEntry data migration (with rollback plan) | Sheldon designs, ADAM executes | 1 week |
| 4.2 | KMS encryption for agent email credentials | ADAM | 3 days |
| 4.3 | Landing page polish (ragbox.co) | Sarah + Design | 1 week |
| 4.4 | Onboarding wizard (Phase 20 "Meet Your Mercury") | ADAM | 1 week |
| 4.5 | Google OAuth app verification (publish from Testing) | David | 4-6 weeks (Google timeline) |
| 4.6 | Multi-agent deployment (multiple personas per tenant) | Sheldon specs → ADAM | 2 weeks |
| 4.7 | Embedded help system | Sarah | 1 week |

---

## PART 6: FILE MAP — WHAT EXISTS AND WHERE

### Frontend Pages (13)

| Route | Description | Status |
|-------|-------------|--------|
| / | Landing page (Hero, FeatureGrid, TrustBar) | ✅ Built |
| /login | Authentication (Google OAuth, OTP) | ✅ Built |
| /dashboard | Main workspace (Vault + Mercury + Forge) | ✅ Built |
| /dashboard/audit | Audit log timeline viewer | ✅ Built |
| /dashboard/settings | Settings hub with sidebar layout | ✅ Built |
| /dashboard/settings/vault | Vault management | ✅ Built |
| /dashboard/settings/security | Security & privilege tiers | ✅ Built |
| /dashboard/settings/mercury | Mercury voice/persona config + Gmail integration | ✅ Built |
| /dashboard/settings/integrations | WhatsApp/Vonage integration | ✅ Built |
| /dashboard/settings/export | GDPR data export | ✅ Built |
| /docs/[slug] | Dynamic documentation pages | ✅ Built |
| /dashboard/agents/[agentId] | Agent identity page | ❌ MISSING (Tier 3) |

### API Routes (67 Frontend + 30 Backend)

**Authentication (4):** NextAuth, send-otp, agent session

**Documents (16):** Full CRUD, extract, ingest, chunks, download, privilege, recover, verify, star, tier, folders

**Mercury (6):** Thread management, message persistence, tool actions, send-email, send-sms, persona

**Query & Chat (6):** RAG query (SSE), models, templates, analyze, forge, studio

**Voice (4):** Voice endpoint, token, health, synthesize, TTS routing

**WhatsApp (5):** Contacts, conversations, messages, mark-read, webhook

**Audit (3):** Query logs, detailed entries, export

**Content Intelligence (3):** Gaps list, details, summary

**Vault & Health (3):** List vaults, health check, history

**ROAM (4):** Groups, compliance, event processing, webhook

**Admin (3):** Migrate, reindex, tenant management

**V1 Public API (5):** Documentation, documents, query, health, API keys

**Agent Email (NEW — 9 routes):** OAuth connect, callback, disconnect, send, test, inbound webhook, cron, credential status, settings

### Go Backend Services (18)

RetrieverService, GeneratorService, SelfRAGService, SilenceResponse, EmbedderService, ChunkerService, ParserService, RedactorService, PipelineService, DocumentService, AuditService, PromptLoader, ForgeService, ContentGapService, KBHealthService, SessionService, AuthService, Middleware Stack (7 layers)

### Zustand Stores (6)

vaultStore, mercuryStore, forgeStore, privilegeStore + 2 additional

### Custom Hooks (9)

useVoiceChat + 8 additional (voice, chat, WebSocket)

---

## PART 7: FUTURE ConnexUS SUITE INTEGRATION

RAGböx ships independently. These integrations are **future roadmap** items that happen AFTER RAGböx has paying customers.

### Phase 1: Standalone (NOW — Q1 2026)
RAGböx.co operates as an independent SaaS product. Own domain, own billing, own onboarding. No ATHENA dependency.

### Phase 2: ATHENA Connection (Q2-Q3 2026)
RAGböx becomes the Knowledge Layer within ATHENA. V-Reps query RAGböx for cited answers. Mercury personas inherit RAGböx vaults. Shared authentication via AEGIS.

### Phase 3: Full Suite Integration (Q4 2026+)
PROTEUS orchestrates RAGböx operations. VERITAS consumes RAGböx audit entries. ARGUS links customer interactions to document citations.

| System | Integration | Status |
|--------|-------------|--------|
| Google Cloud Platform | All infrastructure | ✅ Production |
| Vonage | WhatsApp Business API | ✅ Credentials live |
| ROAM | Team communication (Mercury home office) | ✅ Webhook configured |
| Gmail | Agent email (OAuth 2.0) | ✅ Connected |
| Deepgram | Speech-to-text | ✅ Deployed |
| Cartesia | Text-to-speech | 🔄 Potential Inworld replacement |
| Inworld | Voice agent runtime | ⚠️ BROKEN |
| Twilio / SignalWire | Telephony (ATHENA-level) | ✅ Production (ATHENA) |

---

## PART 8: TEAM OPERATING MODEL

### Chain of Command

```
David Pierce (CPO)
  ├── Identifies what needs to happen
  ├── Makes go/no-go decisions
  └── Answers business questions that block engineering

Dr. Insane (CPO Assistant — This Document)
  ├── Maintains Master PRD (this document)
  ├── Cross-references product decisions against roadmap
  └── Flags contradictions and scope creep

Sheldon (Chief Engineer — Dedicated Chat)
  ├── Designs technical approach
  ├── Writes engineering specs
  ├── Reviews all auth/crypto/DB changes before merge
  └── Approves or redirects before ADAM/Sarah execute

ADAM (CLI Engineer — Claude Code/Terminal)
  ├── Executes code in terminal
  ├── Handles complex builds, migrations, deployments
  └── Shows Sheldon diffs before committing auth/crypto/DB changes

Sarah (Junior Engineer — Claude Code/Terminal)
  ├── Executes scoped tasks and QA
  ├── Runs verification checks
  ├── Flags auth/crypto/DB bugs to Sheldon (no direct push)
  └── All PRs to feature branches, never directly to main
```

### Review Protocol

| Change Category | Who Can Push Directly | Who Must Review |
|----------------|----------------------|-----------------|
| UI components, styling | ADAM, Sarah | — |
| API routes (non-auth) | ADAM, Sarah | — |
| Auth, OAuth, session | ADAM only | Sheldon approves |
| Crypto, encryption | ADAM only | Sheldon approves |
| Database migrations | ADAM only | Sheldon approves |
| Cloud Run config | ADAM only | Sheldon approves |
| Secret Manager changes | ADAM only | Sheldon approves |

---

## PART 9: DECISIONS — RESOLVED AND OPEN

### RESOLVED (Dr. Insane Rulings — Feb 18, 2026)

**DECISION 1: Which Industry Starter Vault ships first?**
→ **Legal only.** Ship one vertical brilliantly. NDA, lease agreement, engagement letter, compliance policy. User uploads nothing on day one — pre-loaded vault delivers instant "aha moment." Healthcare, Finance, Real Estate are Q2 fast-follows.

**DECISION 2: Landing page updates before beta?**
→ **Ship as-is on GHL with one addition:** "Request Beta Access" CTA capturing email + company + use case. Polish comes after 10 paying users.

**DECISION 3: Pricing tiers?**
→ See Part 5 pricing table. Mercury is add-on at Starter, included at Professional+. Awaiting David's final approval.

**DECISION 4: Demo content — real or synthetic?**
→ **Synthetic but realistic.** 8-10 legal documents generated as formatted PDFs. We control the demo narrative because we wrote the answers.

**DECISION 5: Beta access model?**
→ **Invite-only.** 50 codes. 20 David's network, 20 inbound, 10 investor demos.

### STILL OPEN (Awaiting David)

**DECISION 6: Voice Architecture**
Fix Inworld or pivot to Cartesia? Blocks Tier 3 voice work. Sheldon needs direction.

**DECISION 7: Evelyn Monroe — demo prop or real client deployment?**
Determines polish level and whether the agent identity page is throwaway or production.

**DECISION 8: Go-live timeline confirmation**
Sheldon has proposed a 3-day sprint. Does David confirm this pace, or is there a hard deadline we're building toward (investor meeting, client demo, conference)?

**DECISION 9: Pricing approval**
Dr. Insane's pricing recommendation ($149/$399/$999) needs David's sign-off before it goes on the landing page.

---

## PART 10: DEPLOYMENT REFERENCE

### Standard Frontend Deploy

```bash
cd C:\Users\d0527\RAGbox.co
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=SHORT_SHA="$(git rev-parse --short HEAD)" \
  --project=ragbox-sovereign-prod
```

### Backend Deploy

```bash
cd C:\Users\d0527\RAGbox.co\backend
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=SHORT_SHA="$(git rev-parse --short HEAD)" \
  --project=ragbox-sovereign-prod
```

### Voice Server Deploy

```bash
cd C:\Users\d0527\RAGbox.co\server\mercury-voice
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=SHORT_SHA="$(git rev-parse --short HEAD)" \
  --project=ragbox-sovereign-prod
```

### Post-Deploy Verification

```bash
# Smoke test
bash scripts/smoke-test.sh https://ragbox-app-4rvm4ohelq-uk.a.run.app

# Check for errors
gcloud logging read 'severity=ERROR AND timestamp>="DEPLOY_TIME"' \
  --project=ragbox-sovereign-prod --limit=20

# Health check
curl -s https://ragbox-app-4rvm4ohelq-uk.a.run.app/api/health
```

### Production URLs

| Service | URL |
|---------|-----|
| Frontend | https://ragbox-app-4rvm4ohelq-uk.a.run.app |
| Backend | https://ragbox-backend-100739220279.us-east4.run.app |
| Voice WS | wss://mercury-voice-4rvm4ohelq-uk.a.run.app/agent/ws |
| Custom Domain | ragbox.co (NOT YET MAPPED) |

---

## PART 11: SUCCESS METRICS

### Demo Readiness (Tier 1 Complete)

- [ ] Landing page loads at ragbox.co
- [ ] Sign up → Dashboard in under 30 seconds
- [ ] Upload a document → Ask a question → Get cited answer
- [ ] Mercury chat responds with persona identity
- [ ] Send test email from connected Gmail
- [ ] No console errors visible in browser
- [ ] Session polling fixed (no hammering)

### Agent Email Complete (Tier 2 Complete)

- [ ] Per-agent OAuth connect flow works
- [ ] Agent sends email from its own Gmail
- [ ] Agent receives and processes inbound email
- [ ] Mercury thread shows email messages alongside chat
- [ ] Multiple agents can have different Gmail accounts

### Production Ready (Tier 4 Complete)

- [ ] Frontend test coverage ≥ 30%
- [ ] All audit writes go to AuditEntry (hash-chained)
- [ ] KMS encryption for sensitive credentials
- [ ] Google OAuth app verified (no 7-day token expiry)
- [ ] Onboarding wizard guides new users
- [ ] At least one paying customer live

---

## REVISION HISTORY

| Date | Author | Change |
|------|--------|--------|
| 2026-02-18 | Dr. Insane | Initial Master PRD created from project knowledge, Sheldon session, ADAM audit, and production verification |

---

*© 2026 ConnexUS AI Inc. — CONFIDENTIAL*

*"Your Files Speak. We Make Them Testify."*
