# RAGbox.co — Full Build Report

**Date:** February 17, 2026
**Version:** 1.0 Production
**Repository:** 344 commits | First commit: January 21, 2026
**Build Duration:** 28 days (Jan 21 – Feb 17, 2026)

---

## Executive Summary

RAGbox.co is a secure, compliance-ready Retrieval-Augmented Generation (RAG) platform targeting SMBs in legal, financial, and healthcare sectors. The platform transforms unstructured documents into an intelligent, queryable knowledge base with verified citations, attorney-client privilege protection, and immutable audit logging.

**Tagline:** *"Your Files Speak. We Make Them Testify."*

### Codebase at a Glance

| Metric | Value |
|--------|-------|
| **Story points delivered** | **822 SP** |
| Total commits | 344 |
| Total lines of code | ~56,355 |
| Frontend files (TS/TSX) | 309 files, 25,531 lines |
| Backend files (Go) | 109 files, 16,997 lines |
| Voice server (TS) | ~10,698 lines |
| Prisma schema | 709 lines, 26 models |
| Terraform IaC | 11 files, 1,760 lines |
| CI/CD pipelines | 3 (frontend, backend, voice) |
| API endpoints | 97 total (67 frontend + 30 backend) |
| Cloud Run services | 3 |
| Smoke test coverage | 18 endpoints |
| Build phases completed | 14 phases (E0–E8 + Phases 10–20 + post-deploy) |
| Equivalent team output | ~5-person team over 4–5 months |

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Frontend (Next.js)](#2-frontend-nextjs)
3. [Go Backend](#3-go-backend)
4. [Mercury Voice Server](#4-mercury-voice-server)
5. [Database & Schema](#5-database--schema)
6. [Infrastructure (Terraform)](#6-infrastructure-terraform)
7. [CI/CD Pipelines](#7-cicd-pipelines)
8. [Security & Compliance](#8-security--compliance)
9. [Integrations](#9-integrations)
10. [Design System](#10-design-system)
11. [Testing](#11-testing)
12. [Build History (Epics)](#12-build-history-epics)
13. [Production Status](#13-production-status)
14. [IAM & Service Accounts](#14-iam--service-accounts)
15. [Deployment Runbook](#15-deployment-runbook)

---

## 1. Architecture Overview

```
                         ┌──────────────────────────────────────┐
                         │           Cloud Run (us-east4)       │
                         │                                      │
  Users ──── HTTPS ────▶ │  ragbox-app        (Next.js 14)     │
                         │  ragbox-backend    (Go 1.25)         │
                         │  mercury-voice     (Node.js WS)      │
                         │                                      │
                         └───────┬──────────┬──────────┬────────┘
                                 │          │          │
                    ┌────────────┘    ┌─────┘    ┌─────┘
                    ▼                 ▼          ▼
              ┌──────────┐    ┌───────────┐  ┌──────────────┐
              │Cloud SQL │    │ Vertex AI │  │Cloud Storage │
              │PostgreSQL│    │  Gemini   │  │  (CMEK)      │
              │+pgvector │    │text-embed │  │              │
              └──────────┘    └───────────┘  └──────────────┘
                    │
              ┌─────┘
              ▼
        ┌───────────┐    ┌─────────────┐    ┌──────────┐
        │ BigQuery  │    │ Document AI │    │   DLP    │
        │  (Audit)  │    │   (OCR)     │    │ (PII)    │
        └───────────┘    └─────────────┘    └──────────┘
```

### Data Flow — RAG Pipeline

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

### Service Architecture

| Service | Stack | Memory | CPU | Instances | Purpose |
|---------|-------|--------|-----|-----------|---------|
| `ragbox-app` | Next.js 14 + React 18 | 2Gi | 2 | 0–100 | Frontend + API routes |
| `ragbox-backend` | Go 1.25 + chi | 512Mi | 1 | 0–10 | RAG pipeline + document processing |
| `mercury-voice` | Node.js + WebSocket | 1Gi | 1 | 0–5 | Voice agent (Inworld + Deepgram) |

---

## 2. Frontend (Next.js)

### Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Next.js (App Router) | 14.2.35 |
| UI | React | 18.3.1 |
| Styling | Tailwind CSS | 3.4.19 |
| State | Zustand | 5.0.10 |
| Auth | NextAuth | 4.24.13 |
| Animation | Framer Motion | 12.27.5 |
| Icons | Lucide React | 0.562.0 |
| Markdown | react-markdown + remark-gfm | 10.1.0 / 4.0.1 |
| DB ORM | Prisma | 5.22.0 |
| Testing | Jest + Testing Library | 30.2.0 |
| TypeScript | strict mode | 5.9.3 |

### Page Routes (13)

| Route | Description |
|-------|-------------|
| `/` | Landing page with Hero, FeatureGrid, TrustBar |
| `/login` | Authentication (Google OAuth, OTP) |
| `/dashboard` | Main workspace (Vault + Mercury + Forge) |
| `/dashboard/audit` | Audit log timeline viewer |
| `/dashboard/settings` | Settings hub with sidebar layout |
| `/dashboard/settings/vault` | Vault management |
| `/dashboard/settings/security` | Security & privilege tiers |
| `/dashboard/settings/mercury` | Mercury voice/persona config |
| `/dashboard/settings/integrations` | WhatsApp/Vonage integration |
| `/dashboard/settings/export` | GDPR data export |
| `/docs/[slug]` | Dynamic documentation pages |

### API Routes (67)

**Authentication & Session (4)**
- `POST /api/auth/[...nextauth]` — NextAuth OAuth + credentials
- `POST /api/auth/send-otp` — OTP authentication
- `GET /api/agent/session` — AI agent session management

**Document Management (16)**
- `GET|POST /api/documents` — List/create documents
- `POST /api/documents/extract` — Upload & extract text
- `GET|PATCH|DELETE /api/documents/[id]` — Single document CRUD
- `POST /api/documents/[id]/ingest` — Trigger ingestion pipeline
- `GET /api/documents/[id]/chunks` — Get document chunks
- `GET /api/documents/[id]/download` — Download original
- `PATCH /api/documents/[id]/privilege` — Toggle privilege protection
- `POST /api/documents/[id]/recover` — Recover soft-deleted
- `POST /api/documents/[id]/verify` — Integrity verification
- `POST /api/documents/[id]/star` — Star/favorite toggle
- `PATCH /api/documents/[id]/tier` — Update security tier
- `GET|POST /api/documents/folders` — Folder CRUD
- `DELETE /api/documents/folders/[id]` — Delete folder

**Mercury Chat & Actions (6)**
- `GET|POST /api/mercury/thread` — Unified thread management
- `GET|POST /api/mercury/thread/messages` — Message persistence
- `POST /api/mercury/actions` — Tool action execution
- `POST /api/mercury/actions/send-email` — Email dispatch
- `POST /api/mercury/actions/send-sms` — SMS dispatch
- `GET /api/persona` — Persona/lens management

**Query, Chat & Generation (6)**
- `POST /api/chat` — RAG query (SSE streaming)
- `GET /api/models` — Available LLM models
- `GET|POST /api/templates` — Template library
- `POST /api/templates/analyze` — Document analysis
- `POST /api/forge` — Document generation (FORGE)
- `GET|POST /api/studio/generate` — Studio artifacts

**Voice & TTS (4)**
- `POST /api/voice` — Voice chat endpoint
- `GET /api/voice/token` — Session token
- `GET /api/voice/health` — Health check
- `POST /api/voice/synthesize` — Text-to-speech
- `POST /api/tts` — TTS provider routing

**WhatsApp Integration (5)**
- `GET /api/whatsapp/contacts` — Contact list
- `GET /api/whatsapp/conversations` — Conversation list
- `GET|POST /api/whatsapp/conversations/[id]/messages` — Messages
- `POST /api/whatsapp/conversations/[id]/read` — Mark read
- `GET|POST /api/webhooks/whatsapp` — Webhook receiver

**Audit & Compliance (3)**
- `GET /api/audit` — Query audit logs
- `GET /api/audit/entries` — Detailed entries
- `GET /api/audit/export` — Export (PDF/JSON)

**Content Intelligence (3)**
- `GET /api/content-gaps` — List knowledge gaps
- `GET /api/content-gaps/[id]` — Gap details
- `GET /api/content-gaps/summary` — Analytics summary

**Vault & Health (3)**
- `GET /api/vaults` — List vaults
- `POST /api/vaults/[id]/health-check` — Run diagnostic
- `GET /api/vaults/[id]/health-checks` — Check history

**ROAM Compliance (4)**
- `GET /api/roam/groups` — Compliance groups
- `GET /api/roam/compliance` — Compliance data
- `POST /api/roam/process-event` — Event processing
- `POST /api/webhooks/roam` — HMAC-verified webhook

**Admin (3)**
- `POST /api/admin/migrate` — Database migrations (internal auth)
- `POST /api/admin/reindex` — Vector index rebuild (internal auth)
- `GET|POST /api/admin/tenants` — Multi-tenant management

**V1 Public API (5)**
- `GET /api/v1/docs` — API documentation
- `GET /api/v1/documents` — Document endpoints
- `GET|POST /api/v1/keys` — API key management
- `GET /api/v1/knowledge` — Knowledge base
- `POST /api/v1/query` — RAG query

**Other (5)**
- `GET /api/export` — GDPR data export (ZIP)
- `GET|POST /api/privilege` — Bulk privilege ops
- `POST /api/waitlist` — Waitlist signup
- `POST /api/mcp` — Model Context Protocol
- `GET|POST /api/settings/integrations` — Integration config

### Component Library (95 files)

**Dashboard Core**
- `DashboardLayout.tsx` — Main container with responsive layout (608 lines)
- `GlobalHeader.tsx` — Logo, user menu, model badge, Aegis indicator (1,850 lines)
- `StealthRails.tsx` — Sidebar navigation rail (342 lines)
- `OnboardingChecklist.tsx` — Setup wizard
- `ComplianceWidget.tsx` — Compliance status display

**Vault (Document Management)**
- `VaultPanel.tsx` — Main vault viewer (272 lines)
- `VaultExplorer.tsx` — Full-screen document explorer (852 lines)
- `VaultAccessModal.tsx` — Permission management (696 lines)
- `SovereignCertificate.tsx` — Document certificate (211 lines)
- `SovereignExplorer.tsx` — Advanced explorer with CommandDeck, NavigationTree, FileMatrix, DeepInspector (495 lines)
- Security components: `SecurityBadge`, `SecurityDropdown`, `RagIndexToggle`, `SecurityTiers`

**Mercury (Chat & Voice)**
- `MercuryPanel.tsx` — Main chat panel (354 lines)
- `ConversationThread.tsx` — Message thread with channel filtering (196 lines)
- `Message.tsx` — Chat message with ReactMarkdown, ActionButtons (Copy/ThumbsUp/ThumbsDown)
- `InputBar.tsx` — Message input with attachments (276 lines)
- `AgentDriverPanel.tsx` — Agent controls (551 lines)
- `IntelligenceMatrix.tsx` — Persona selection matrix (511 lines)
- `VoiceTrigger.tsx` / `VoicePanel.tsx` / `MercuryVoicePanel.tsx` — Voice controls
- `ToolConfirmationDialog.tsx` — Email/SMS confirmation (488 lines)
- `ConfidenceBadge.tsx` — 3-tier confidence indicator (green/amber/red)
- `CitationTag.tsx` — Source citation chips
- `EmptyState.tsx` — No-messages state

**Forge & Studio**
- `ForgePanel.tsx` / `ForgeRail.tsx` — Document generation UI
- `SovereignStudio.tsx` — Template studio editor (821 lines)
- `TemplateSelector.tsx` / `TemplateLibrary.tsx` — Template browsing

**WhatsApp**
- `WhatsAppPanel.tsx` — Conversation UI (477 lines)

**Landing Page**
- `Hero.tsx`, `FeatureGrid.tsx`, `TheBox.tsx`, `TrustBar.tsx`, `AuthModal.tsx`, `Navbar.tsx`

### Zustand Stores (6)

| Store | Lines | Purpose |
|-------|-------|---------|
| `mercuryStore.ts` | 574 | Chat, threads, streaming, actions, personas, channels |
| `vaultStore.ts` | 384 | Documents, folders, selection, search, upload |
| `whatsappStore.ts` | 246 | Contacts, conversations, messages |
| `forgeStore.ts` | 80 | Asset generation |
| `privilegeStore.ts` | — | Privilege mode toggle |
| `contentIntelligenceStore.ts` | — | Content gap tracking |

### Custom Hooks (9)

| Hook | Lines | Purpose |
|------|-------|---------|
| `useSovereignAgentVoice.ts` | 915 | Full agent voice with Inworld/Deepgram |
| `useVoiceChat.ts` | 540 | Dashboard voice integration |
| `useAgentWebSocket.ts` | 507 | WebSocket for agent communication |
| `useSovereignVoice.ts` | 339 | Advanced voice agent control |
| `useVoiceRAG.ts` | 229 | Combined voice + RAG |
| `useChat.ts` | 225 | RAG query streaming + citations |
| `useVoice.ts` | 218 | Voice capture/playback |
| `useDocuments.ts` | 212 | Document CRUD operations |
| `useMediaQuery.ts` | — | Responsive design detection |

### Library Code (60 files across 18 directories)

| Directory | Key Files | Purpose |
|-----------|-----------|---------|
| `lib/rag/` | chunker, citation-parser, silenceProtocol, reasoningTrace | RAG pipeline utilities |
| `lib/llm/` | provider, vertex-gemini, vertex-llama, openrouter | Multi-model LLM abstraction |
| `lib/vertex/` | rag-client, gemini-live-client | Vertex AI SDK wrappers |
| `lib/voice/` | deepgram-client, inworld-client, audio-capture/playback | Voice I/O |
| `lib/mercury/` | toolRouter (14 patterns), toolExecutor, sseParser | Mercury tool system |
| `lib/security/` | tiers, tierFilter, autoPromotion | Security tier management |
| `lib/audit/` | auditWriter (hash-chain), pdfExport | Compliance audit |
| `lib/studio/` | generator, prompts | Document generation |
| `lib/forge/` | documentGenerator, deepseekOcr | Template-based generation |
| `lib/roam/` | roamClient, roamFormat, roamVerify, complianceIngest | ROAM compliance |
| `lib/api/` | apiKeyManager, apiKeyMiddleware | V1 API key system |
| `lib/cache/` | redisClient, queryCache | Performance caching |

---

## 3. Go Backend

### Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Language | Go | 1.25 |
| Router | chi | 5.2.5 |
| Database | pgx/v5 + pgvector-go | 5.8.0 / 0.3.0 |
| Auth | Firebase Admin SDK | 4.19.0 |
| AI | Vertex AI SDK | 0.15.0 |
| OCR | Document AI SDK | 1.40.0 |
| Storage | Cloud Storage SDK | 1.56.0 |
| Metrics | Prometheus client_golang | 1.23.2 |
| Image | distroless/static-debian12 | — |

### Architecture (Clean Layers)

```
Handler (HTTP) → Service (Business Logic) → Repository (Database)
     ↓                    ↓                        ↓
  Validation        Interfaces (mock)          pgx + pgvector
  Auth context      GCP client adapters        Prepared statements
  SSE streaming     Prompt loading             Transactions
```

### API Endpoints (30)

**Documents (13 routes)**
| Method | Path | Timeout | Purpose |
|--------|------|---------|---------|
| GET | `/api/documents` | 30s | List user documents |
| POST | `/api/documents/extract` | 30s | Upload + extract |
| GET | `/api/documents/{id}` | 30s | Get document |
| PATCH | `/api/documents/{id}` | 30s | Update metadata |
| DELETE | `/api/documents/{id}` | 30s | Soft/hard delete |
| POST | `/api/documents/{id}/recover` | 30s | Recover deleted |
| PATCH | `/api/documents/{id}/tier` | 30s | Update security tier |
| PATCH | `/api/documents/{id}/privilege` | 30s | Toggle privilege |
| DELETE | `/api/documents/{id}/chunks` | 30s | Delete chunks |
| GET | `/api/documents/{id}/download` | 30s | Signed URL download |
| POST | `/api/documents/{id}/verify` | 30s | Integrity check |
| POST | `/api/documents/{id}/star` | 30s | Star toggle |
| POST | `/api/documents/{id}/ingest` | 120s | Pipeline trigger |

**Folders (3)** — CRUD for hierarchical folders

**Chat (1)** — `POST /api/chat` (SSE streaming, no write timeout, 10/min rate limit)

**Audit (2)** — List with filters + plaintext export

**Content Gaps (3)** — List, summary, update status

**KB Health (2)** — Run diagnostic, history

**Privilege (2)** — Query and toggle user privilege mode

**Export (1)** — GDPR ZIP export (60s timeout)

**Forge (1)** — AI report generation (60s timeout, 5/min rate limit)

**Health (1)** — `GET /api/health` (public)

**Metrics (1)** — `GET /metrics` (Prometheus, public)

### Services (18)

| Service | Purpose |
|---------|---------|
| `RetrieverService` | Query embedding → top-20 vector search → re-rank → dedup → top-5 |
| `GeneratorService` | Vertex AI Gemini with prompt sandwich + JSON citation parsing |
| `SelfRAGService` | 3-iteration reflection (relevance, support, completeness critiques) |
| `SilenceResponse` | Structured refusal when confidence < 0.85 |
| `EmbedderService` | Vertex AI text-embedding-004, batch + L2 normalization |
| `ChunkerService` | Semantic chunking with paragraph/sentence split + 20% overlap |
| `ParserService` | Document AI OCR with text parser fallback |
| `RedactorService` | DLP PII redaction (names, emails, SSNs, credit cards) |
| `PipelineService` | Orchestrator: parse → redact → chunk → embed |
| `DocumentService` | Signed URL generation, record creation |
| `AuditService` | SHA-256 hash-chain, BigQuery async, WORM compliance |
| `PromptLoader` | 5 prompt files, hot-reload, BuildSystemPrompt sandwich |
| `ForgeService` | Template-based report generation |
| `ContentGapService` | Missing content tracking + remediation |
| `KBHealthService` | Document freshness, chunk count, embedding coverage |
| `SessionService` | Learning session analytics |
| `AuthService` | Firebase token validation + user provisioning |

### Middleware Stack (7 layers)

```
1. SecurityHeaders  (X-Frame-Options, HSTS, XSS Protection)
2. Logging          (Structured JSON via slog)
3. CORS             (Configurable origin)
4. Monitoring       (Prometheus: counters, histograms, gauges)
5. Auth             (InternalOrFirebase: x-internal-auth OR Firebase token)
6. RateLimit        (Token bucket: 60/min general, 10/min chat, 5/min forge)
7. Timeout          (Per-route: 30s/60s/120s, SSE exempt)
```

### Repositories (9)

| Repository | Model | Key Operations |
|------------|-------|----------------|
| `DocumentRepo` | Document | CRUD, recover, tier, privilege, checksum, chunk count |
| `ChunkRepo` | DocumentChunk | BulkInsert, SimilaritySearch (pgvector cosine), delete by doc |
| `AuditRepo` | AuditLog | Create (hash-chain), list (filters), VerifyChain |
| `UserRepo` | User | EnsureUser (upsert), roles, last login |
| `FolderRepo` | Folder | CRUD, list by parent |
| `ContentGapRepo` | ContentGap | CRUD, status updates |
| `KBHealthRepo` | KBHealth | Create, latest, history |
| `SessionRepo` | LearningSession | CRUD, status, list by user |
| `db.go` | Pool | NewPool (pgx), Close, HealthCheck |

### Prompt Templates (5)

| File | Purpose |
|------|---------|
| `rules_engine.txt` | Grounding rules, citation style [1][2][3], Silence Protocol |
| `mercury_identity.txt` | Neutral professional tone, fact-focused |
| `persona_cfo.txt` | Financial/risk decision-making lens |
| `persona_legal.txt` | Compliance/regulatory/liability lens |
| `compliance_strict.txt` | GDPR, HIPAA, SOX reminders, audit emphasis |

### GCP Client Adapters (7)

| Client | Service | Purpose |
|--------|---------|---------|
| `genai.go` | Vertex AI Gemini | GenerateContent, health check |
| `embedding.go` | Vertex AI Embeddings | Batch embed, L2 normalize, 768-dim |
| `docai.go` | Document AI | OCR via ProcessOnline |
| `storage.go` | Cloud Storage | Signed URLs, upload/download |
| `dlp.go` | DLP | PII scanning |
| `text_parser.go` | — | Fallback text extraction |
| `noop_redactor.go` | — | Dev mode (PII scan disabled) |

---

## 4. Mercury Voice Server

**Location:** `server/mercury-voice/`

| Property | Value |
|----------|-------|
| Runtime | Node.js 20 + TypeScript |
| Protocol | WebSocket (wss://) |
| AI Runtime | Deepgram STT + Go Backend LLM + Deepgram TTS |
| STT | Deepgram |
| TTS | Google Cloud TTS |
| Cloud Run | `mercury-voice` service |
| Timeout | 3600s (WebSocket long-lived) |
| Session affinity | Enabled |
| Production URL | `wss://app.ragbox.co/agent/ws` |

**Components:**
- `RAGboxNode` — Custom graph node: tool detection + Go backend `/api/chat` SSE + markdown stripping
- `DashboardBridge` — Translates dashboard voice protocol to/from Inworld graph pipeline
- Graph: TextInput → RAGboxNode → TextChunking → TTS

---

## 5. Database & Schema

### PostgreSQL + pgvector

| Property | Value |
|----------|-------|
| Engine | PostgreSQL 15 |
| Instance | Cloud SQL (`ragbox-sovereign-prod:us-east4:ragbox-db`) |
| Access | Private IP only (10.45.0.3) |
| SSL | Required |
| Tier | db-custom-2-4096 (2 vCPU, 4GB RAM) |
| Disk | 100GB PD-SSD, autoresize |
| Backup | Daily 03:00 UTC, 30 retained, 7-day PITR |
| Encryption | CMEK (KMS `database-key`, 90-day rotation) |
| Extensions | pgvector (768-dim cosine similarity) |

### Prisma Schema (26 models, 709 lines)

**Core Domain:**
- `User` — email, name, image, role (Partner/Associate/Auditor), status, privilege settings
- `Tenant` — Multi-tenant isolation
- `Vault` — Document container (status: open/closed/secure)
- `Document` — file metadata, index_status, privilege_level, security_tier, deletion_status
- `DocumentChunk` — 768-dim pgvector embedding, token count, content hash
- `Folder` — Hierarchical tree (parent_id)

**Query & RAG:**
- `Query` — user question, outcome (Answered/Refused), confidence, model used, latency
- `Answer` — LLM response text (1:1 with Query)
- `Citation` — document_id, chunk_id, relevance_score, excerpt, citation_index

**Conversation:**
- `MercuryThread` — Unified thread across channels
- `MercuryThreadMessage` — Messages with channel tag (dashboard/whatsapp/voice/roam)
- `MercuryAction` — Tool actions (email, SMS, WhatsApp)
- `MercuryPersona` — Tenant-scoped AI assistant configuration

**Audit & Compliance:**
- `AuditLog` — Basic events
- `AuditEntry` — Hash-chained, tamper-evident (SEC 17a-4 WORM)

**Intelligence:**
- `ContentGap` — Missing knowledge detection
- `KBHealthCheck` — KB quality metrics
- `LearningSession` — Session analytics

**WhatsApp:**
- `WhatsAppContact` — E.164 phone numbers
- `WhatsAppConversation` — Per-contact threads
- `WhatsAppMessage` — text/audio/image/document types
- `IntegrationSettings` — Provider config + permissions

**Other:**
- `Template` — FORGE document templates
- `ApiKey` — SHA-256 hashed, scoped, with expiration
- `WaitlistEntry` — Pioneer program signups

### Go Backend Migrations (11 tables)

```sql
-- Created via backend/migrations/001_initial_schema.up.sql
users, vaults, documents, document_chunks, queries,
answers, citations, audit_logs, folders, content_gaps,
learning_sessions

-- Created via /api/admin/migrate (Next.js managed)
mercury_threads, mercury_thread_messages, mercury_actions,
mercury_personas, whatsapp_contacts, whatsapp_conversations,
whatsapp_messages, integration_settings, api_keys, waitlist_entries
```

---

## 6. Infrastructure (Terraform)

### Terraform Modules (11 files)

| File | Resources Provisioned |
|------|----------------------|
| `main.tf` | Provider config, API enablement (13 GCP APIs), naming |
| `variables.tf` | 30+ configurable variables |
| `outputs.tf` | 20+ exported values |
| `network.tf` | VPC, subnet, VPC connector, Cloud Router, NAT, firewall |
| `database.tf` | Cloud SQL instance, database, admin user, read replica |
| `storage.tf` | Documents bucket (CMEK, versioning), temp bucket |
| `kms.tf` | Keyring + 3 crypto keys (documents, database, secrets) |
| `iam.tf` | 3 service accounts, role bindings |
| `bigquery.tf` | Audit dataset + table (7-year retention, partitioned) |
| `cloudrun.tf` | Cloud Run service configuration |
| `billing.tf` | Budget alerts ($1000) + monitoring policies |

### Networking

```
VPC: ragbox-prod-vpc (10.0.0.0/16)
├── Subnet: ragbox-prod-subnet-main (private Google access, flow logs)
├── VPC Connector: ragbox-prod-connector (10.8.0.0/28, 2-10 instances)
├── Cloud Router + NAT: Outbound internet
├── Private Service Connect: Cloud SQL peering
└── Firewall: Allow internal, deny ingress (default)
```

### Encryption (KMS)

| Key | Purpose | Rotation |
|-----|---------|----------|
| `document-key` | Cloud Storage CMEK | 90 days |
| `database-key` | Cloud SQL CMEK | 90 days |
| `secrets-key` | Secret Manager CMEK | 90 days |

### BigQuery Audit

| Property | Value |
|----------|-------|
| Dataset | `ragbox_prod_audit` |
| Table | `audit_log` |
| Partitioning | DAY (on timestamp) |
| Clustering | [action, user_id] |
| Retention | 7 years (2,557 days) |
| Schema | event_id, timestamp, user_id, action, resource_id, resource_type, details (JSON) |

### Billing & Monitoring

| Alert | Condition | Window |
|-------|-----------|--------|
| Budget 50% | $500 spent | Monthly |
| Budget 75% | $750 spent | Monthly |
| Budget 100% | $1000 spent | Monthly |
| Latency p95 | > 2 seconds | 5 min |
| Error rate | > 5% (5xx) | 5 min |

---

## 7. CI/CD Pipelines

### Frontend Pipeline (`cloudbuild.yaml`)

```
Step 1:  install-deps      npm ci
Step 2:  generate-prisma   npx prisma generate
Step 3:  lint               npm run lint              (parallel with 4)
Step 4:  type-check         npm run type-check        (parallel with 3)
Step 5:  test               Jest (non-blocking)
Step 6:  build-image        Docker build + cache
Step 7:  push-image         Artifact Registry
Step 8:  deploy             Cloud Run (ragbox-app)
Step 9:  run-migrations     POST /api/admin/migrate + /api/admin/reindex
Step 10: smoke-test         18 endpoint validation
Step 11: notify             Success log
```

**Machine:** E2_HIGHCPU_8 | **Timeout:** 1800s | **Typical duration:** ~5-6 minutes

### Backend Pipeline (`backend/cloudbuild.yaml`)

```
Step 1: test     go test ./...
Step 2: build    Docker (distroless)
Step 3: push     Artifact Registry (SHA + latest)
Step 4: deploy   Cloud Run (ragbox-backend)
```

**Machine:** E2_HIGHCPU_8 | **Timeout:** 900s

### Voice Pipeline (`server/mercury-voice/cloudbuild.yaml`)

```
Step 1: build          Docker (node:20)
Step 2: push-sha       Artifact Registry
Step 3: push-latest    Artifact Registry
Step 4: deploy         Cloud Run (mercury-voice, session-affinity, 3600s timeout)
```

### Smoke Test (`scripts/smoke-test.sh`)

18 endpoints tested post-deploy:

| Category | Endpoints | Expected |
|----------|-----------|----------|
| Public | Landing, Auth session, Auth providers | 200 |
| Protected GET | Documents, Mercury thread/messages, Persona, Audit, Content gaps, Studio | 401 |
| Protected POST | Mercury send, Studio generate | 401 |
| Webhooks | ROAM (no sig), WhatsApp verify | 200/401, 200/400/403 |
| Export | Export, Audit export | 401 |
| Backend proxy | Documents POST (no body) | 401/411 |

---

## 8. Security & Compliance

### Encryption

| Layer | Method |
|-------|--------|
| At rest (Storage) | AES-256 via CMEK (KMS `document-key`) |
| At rest (Database) | CMEK (KMS `database-key`) |
| At rest (Secrets) | CMEK (KMS `secrets-key`) |
| In transit | TLS 1.3 (Cloud Run managed) |
| Database connections | SSL required |

### Authentication

| Method | Use Case |
|--------|----------|
| Google OAuth 2.0 | Dashboard login via NextAuth |
| Firebase ID tokens | Go backend API calls |
| `x-internal-auth` header | Internal service-to-service |
| API keys (SHA-256 hashed) | V1 public API |
| HMAC-SHA256 signatures | Webhook verification (ROAM, WhatsApp) |

### Security Headers

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=63072000; includeSubDomains
Content-Security-Policy: script-src 'self' 'unsafe-inline' 'unsafe-eval'; ...
Referrer-Policy: strict-origin-when-cross-origin
```

### Privilege System

- **3 security tiers**: Standard, Confidential, Privileged
- **Privilege Mode toggle**: Binary on/off (amber UI accent when active)
- **Document-level privilege**: Hidden in normal mode, visible in privileged mode
- **Auto-promotion**: Content sensitivity triggers tier elevation

### Audit Trail (SEC 17a-4 WORM)

- **Hash-chained**: Each entry's hash includes previous entry's hash (SHA-256)
- **Tamper-evident**: `VerifyChain()` detects any modification
- **BigQuery sink**: Append-only, 7-year retention
- **Actions logged**: document.upload, document.delete, privilege.toggle, mercury.query, mercury.response, query.executed, silence.triggered

### Rate Limiting

| Endpoint | Limit |
|----------|-------|
| General API | 60 requests/min per user |
| Chat (RAG query) | 10 requests/min per user |
| Forge (generation) | 5 requests/min per user |

### PII Protection

- **Document AI**: OCR text extraction
- **DLP**: PII redaction (names, emails, SSNs, credit cards, phone numbers)
- **Non-fatal**: PII scan failure doesn't block document processing

---

## 9. Integrations

### Google Cloud Platform

| Service | Purpose |
|---------|---------|
| Cloud Run | App hosting (3 services) |
| Cloud SQL | PostgreSQL + pgvector |
| Cloud Storage | Document storage (CMEK) |
| Vertex AI Gemini | LLM generation (gemini-2.0-flash / gemini-3-pro-preview) |
| Vertex AI Embeddings | text-embedding-004 (768-dim) |
| Document AI | OCR text extraction |
| DLP | PII redaction |
| BigQuery | Audit log storage (WORM) |
| Cloud KMS | Encryption key management |
| Secret Manager | Credentials storage |
| Cloud Logging | Structured JSON logs |
| Pub/Sub | Async webhook processing |
| VPC | Private networking |

### External Services

| Service | Purpose | Integration |
|---------|---------|-------------|
| Vonage | WhatsApp Business API | Webhook + REST API |
| Deepgram | Speech-to-text | WebSocket streaming |
| Inworld | Voice agent runtime | Graph pipeline + WebSocket |
| OpenRouter | Multi-model LLM routing | REST API |
| Firebase | Authentication | ID tokens + admin SDK |
| ROAM | Compliance framework | HMAC-verified webhooks |

### Multi-Channel Mercury

| Channel | Transport | Auth |
|---------|-----------|------|
| Dashboard | HTTPS (SSE streaming) | NextAuth JWT |
| WhatsApp | Vonage webhook → Go backend | HMAC signature |
| Voice | WebSocket (mercury-voice) | Session token |
| ROAM | Pub/Sub webhook | HMAC-SHA256 |

---

## 10. Design System

### Midnight Cobalt Theme (Default)

```css
/* Brand */
--brand-blue: #2463EB          /* Royal Cobalt — primary actions */
--brand-blue-hover: #60A5FA    /* Sky Cobalt — hover state */

/* Backgrounds */
--bg-primary: #0A192F          /* Midnight Cobalt — main */
--bg-secondary: #112240        /* Deep Navy — cards/panels */
--bg-tertiary: #1B2D4B         /* Lighter Navy — inputs */
--bg-elevated: #233554         /* Hover states */

/* Text */
--text-primary: #E5E7EB        /* Frosted Silver */
--text-secondary: #C0C0C0      /* Sterling Silver */
--text-tertiary: #94A3B8       /* Muted Blue-Grey */

/* Privilege (Amber Accent) */
--privilege-color: #f59e0b     /* Amber 500 */
--privilege-bg: #451a03        /* Amber 950 */
--privilege-border: #b45309    /* Amber 700 */

/* Status */
--success: #10b981  --danger: #ef4444  --warning: #f59e0b
```

### Additional Themes
- **Cyber Noir** — Black/cyan hacker aesthetic
- **Forest Dark** — Military green ops
- **Obsidian Gold** — Executive luxury (Midas Protocol)

### Typography

| Font | Usage | Weight |
|------|-------|--------|
| Space Grotesk | Headlines, authority | Bold |
| Plus Jakarta Sans | Body text, dashboard | Regular/Medium |
| Inter | Fallback body | Regular |
| JetBrains Mono | Code, citations, data | Regular |

### Layout Dimensions

```css
--header-height: 56px
--rail-width: 56px
--vault-expanded-width: 400px
```

---

## 11. Testing

### Frontend Tests (13 files)

| File | Lines | Coverage |
|------|-------|----------|
| `vaultStore.test.ts` | 298 | Store CRUD, search, selection |
| `vaultStore.extended.test.ts` | 369 | Edge cases, persistence |
| `mercuryStore.test.ts` | 274 | Chat, streaming, channels |
| `mercuryStore.extended.test.ts` | 303 | Actions, personas, threads |
| `forgeStore.test.ts` | 205 | Generation, assets |
| `privilegeStore.test.ts` | 190 | Toggle, filtering |
| `api.test.ts` | — | API client |
| `auth.test.ts` | 188 | Auth utilities |
| `sanitizeForTTS.test.ts` | — | TTS text cleanup |
| `toolErrors.test.ts` | — | Mercury tool errors |
| `outputFirewall.test.ts` | — | LLM output safety |
| `DashboardLayout.test.tsx` | — | Layout rendering |
| `VaultPanel.test.tsx` | — | Vault component |

**Framework:** Jest 30.2.0 + ts-jest + @testing-library/react

### Backend Tests (42 files)

| Layer | Test Files | Coverage |
|-------|-----------|----------|
| Handlers | 12 | 87.9% |
| Services | 18 | 90.7% |
| Middleware | 7 | 98.4% |
| Repositories | 9 | Integration tests |
| GCP Clients | 3 | Mock-based |
| Other | 3 | Tools, RBAC |

**Framework:** Go testing + table-driven tests + mock interfaces

---

## 12. Build History & Story Points

### Phase Breakdown (822 SP Total)

| Phase | Name | Tasks | SP | Key Deliverables |
|-------|------|:-----:|:--:|------------------|
| **E0** | Project Scaffold | 8 | 32 | Config, DB pool, migrations (11 tables), Firebase auth, CORS, router, Dockerfile |
| **E1** | Document Ingestion | 5 | 30 | Models, signed URLs, Document AI parser, DLP redactor, pipeline orchestrator |
| **E2** | Chunking & Embedding | 3 | 24 | Semantic chunker, Vertex AI embedder (768-dim), chunk repo (pgvector) |
| **E3** | RAG Retrieval | 1 | 13 | RetrieverService with re-ranking + dedup |
| **E4** | Self-RAG Generation | 6 | 42 | Generator, SelfRAG (3-iter reflection), Silence Protocol, 5 prompts, SSE chat |
| **E5** | Audit & Compliance | 3 | 18 | Hash-chain audit, VerifyChain (WORM), audit handlers + export |
| **E6** | Forge & Integrations | 3 | 21 | ForgeService, GDPR export, full CRUD handlers |
| **E7** | Frontend Rewiring | 2 | 12 | Zustand stores → Go backend, deleted duplicate API routes |
| **E8** | Testing & Deployment | 3 | 24 | 87-98% coverage, Prometheus monitoring, Terraform billing alerts |
| **Ph10** | ATOMIC Deploy | 9 | 45 | WhatsApp webhook, Cloud SQL private IP, Vonage sandbox |
| **Ph10.5** | Mercury Upgrade | 8 | 40 | Tool router (14 patterns), tool executor, SSE parser, WhatsApp polling |
| **Ph11** | Mercury Voice | 6 | 42 | Inworld runtime, RAGboxNode, DashboardBridge, Cloud Run voice service |
| **Ph20** | Meet Your Mercury | 10 | 40 | Persona system, onboarding, help system, chat scroll, voice wiring |
| **Post-Deploy** | Bug Fixes | 10 | 30 | Markdown rendering, action buttons, auth, audit, confidence colors |
| — | Frontend UI | 95 | 120 | 95 components, 13 pages, design system (4 themes) |
| — | Frontend API Routes | 67 | 100 | 67 API routes (proxies, auth, CRUD, webhooks) |
| — | Frontend Libraries | 60 | 60 | LLM providers, voice, mercury tools, security, audit |
| — | Stores + Hooks | 15 | 60 | 6 Zustand stores, 9 custom hooks (voice, chat, WS) |
| — | Infrastructure | 16 | 69 | Terraform (11 modules), CI/CD (3 pipelines), smoke test, IAM |
| | | | | |
| | **TOTAL** | | **822** | |

### Story Points by Layer

| Layer | SP | % of Total |
|-------|----|:----------:|
| Go Backend (E0–E8) | 216 | 26% |
| Frontend (UI + API + Lib + Stores) | 340 | 41% |
| Integrations (Ph10, 10.5, 11) | 127 | 16% |
| Infrastructure (Terraform + CI/CD) | 69 | 8% |
| Phase 20 + Bug Fixes | 70 | 9% |

### Velocity

| Metric | Value |
|--------|-------|
| Total story points | **822 SP** |
| Build duration | 28 days |
| Average velocity | **29.4 SP/day** |
| Commits per day | 12.3 |
| Lines of code per day | ~2,013 |
| Equivalent team output | ~5-person team over 4–5 months (8–10 sprints) |

---

## 13. Production Status

### Current Deployment (Feb 17, 2026)

| Metric | Status |
|--------|--------|
| Frontend build | `c35a2b1` — SUCCESS |
| Backend build | Deployed & healthy |
| Voice server | Deployed & healthy |
| Smoke test | **18/18 endpoints passing** |
| GCP audit errors | **0** (all resolved) |
| Database migrations | 12/13 OK, 1 SKIPPED (expected) |

### Production URLs

| Service | URL |
|---------|-----|
| Frontend | `https://ragbox-app-4rvm4ohelq-uk.a.run.app` |
| Backend | `https://ragbox-backend-100739220279.us-east4.run.app` |
| Voice WS | `wss://app.ragbox.co/agent/ws` |

### Recent Bug Fixes (Feb 17)

| Bug | Fix |
|-----|-----|
| BUG-01: Markdown not rendering | Added ReactMarkdown + remarkGfm to Message.tsx |
| BUG-02: Action buttons empty | Added Copy/ThumbsUp/ThumbsDown with Lucide icons |
| BUG-03: Upload chat spam | 2-second debounce batch in MercuryPanel.tsx |
| BUG-04: Studio 401 | Switched to NextAuth `getToken()` |
| BUG-06: Audit log empty | Added `writeAuditEntry` to chat + upload flows |
| BUG-07: Model name exposed | Shows "M.E.R.C.U.R.Y." when Aegis active |
| BUG-08: Confidence 2-tier | 3-tier: green (≥85%), amber (70-84%), red (<70%) |
| BUG-09: Badge contrast | White/translucent on user messages |

---

## 14. IAM & Service Accounts

| Service Account | Roles |
|-----------------|-------|
| `100739220279-compute@developer.gserviceaccount.com` | `roles/editor`, `roles/run.admin` |
| `ragbox-prod-cloudrun@ragbox-sovereign-prod.iam.gserviceaccount.com` | `roles/cloudsql.client`, `roles/aiplatform.user`, `roles/storage.objectAdmin`, `roles/secretmanager.secretAccessor`, `roles/cloudkms.cryptoKeyEncrypterDecrypter`, `roles/bigquery.dataEditor`, `roles/logging.logWriter` |
| `service-100739220279@gcp-sa-cloudbuild.iam.gserviceaccount.com` | Cloud Build managed SA |

### GCP Secrets (14)

| Secret | Consumer |
|--------|----------|
| `ragbox-prod-database-url` | Frontend (Prisma) |
| `ragbox-database-url` | Backend (pgx) |
| `firebase-api-key` | Frontend |
| `firebase-auth-domain` | Frontend |
| `firebase-project-id` | Frontend + Backend |
| `nextauth-secret` | Frontend |
| `nextauth-url` | Frontend |
| `google-client-id` | Frontend (OAuth) |
| `google-client-secret` | Frontend (OAuth) |
| `ragbox-backend-url` | Frontend → Backend proxy |
| `ragbox-internal-auth-secret` | All services (internal auth) |
| `vonage-api-secret` | Frontend (WhatsApp) |
| `roam-api-key` | Frontend (ROAM) |
| `roam-webhook-secret` | Frontend (ROAM) |

---

## 15. Deployment Runbook

### Standard Deploy (Frontend)

```bash
# Push to main triggers Cloud Build automatically, OR manual:
cd /c/Users/d0527/RAGbox.co
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=SHORT_SHA="$(git rev-parse --short HEAD)" \
  --project=ragbox-sovereign-prod
```

### Backend Deploy

```bash
cd /c/Users/d0527/RAGbox.co/backend
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=SHORT_SHA="$(git rev-parse --short HEAD)" \
  --project=ragbox-sovereign-prod
```

### Voice Server Deploy

```bash
cd /c/Users/d0527/RAGbox.co/server/mercury-voice
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=SHORT_SHA="$(git rev-parse --short HEAD)" \
  --project=ragbox-sovereign-prod
```

### Post-Deploy Verification

```bash
# Automated smoke test
bash scripts/smoke-test.sh https://ragbox-app-4rvm4ohelq-uk.a.run.app

# Check for GCP audit errors
gcloud logging read 'severity=ERROR AND timestamp>="DEPLOY_TIME"' \
  --project=ragbox-sovereign-prod --limit=20

# Manual migration (if needed)
INTERNAL_SECRET=$(gcloud secrets versions access latest \
  --secret=ragbox-internal-auth-secret --project=ragbox-sovereign-prod)
curl -X POST "https://ragbox-app-4rvm4ohelq-uk.a.run.app/api/admin/migrate" \
  -H "x-internal-auth: $INTERNAL_SECRET"
```

---

## Appendix: File Count Summary

| Category | Files | Lines |
|----------|------:|------:|
| Frontend (src/) | 309 | 25,531 |
| Go Backend | 109 | 16,997 |
| Voice Server | ~50 | ~10,698 |
| Prisma Schema | 1 | 709 |
| Terraform | 11 | 1,760 |
| Scripts | 8 | ~500 |
| Cloud Build | 3 | ~420 |
| Config files | ~10 | ~300 |
| **Total** | **~501** | **~56,355** |

---

*Report generated February 17, 2026 — RAGbox.co v1.0 Production*
*344 commits over 28 days*
