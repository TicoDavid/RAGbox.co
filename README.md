# RAGbox.co

**Sovereign RAG platform for legal and financial professionals.**

Your Files Speak. We Make Them Testify.

RAGbox transforms unstructured documents into an intelligent, queryable knowledge base with verified citations, attorney-client privilege protection, and immutable audit logging.

---

## Architecture

RAGbox uses a split-service architecture: a **Next.js frontend** and a **Go backend microservice**, both deployed to Cloud Run on GCP.

```
                    ┌─────────────────────────┐
                    │      User Browser        │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Cloud Run: ragbox-app  │
                    │   Next.js 14 (Frontend)  │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │ Cloud Run: ragbox-backend│
                    │     Go 1.25 (API)        │
                    └──┬──────┬──────┬──────┬─┘
                       │      │      │      │
            ┌──────────▼┐ ┌──▼────┐ ┌▼─────┐ ┌▼────────┐
            │  Cloud     │ │Vertex │ │Cloud │ │BigQuery │
            │  Storage   │ │  AI   │ │ SQL  │ │ (Audit) │
            │(Documents) │ │(LLM/  │ │pg +  │ │         │
            │  + CMEK    │ │ Embed)│ │vector│ │         │
            └────────────┘ └──┬────┘ └──────┘ └─────────┘
                              │
                    ┌─────────▼─────────┐
                    │    Document AI     │
                    │  (PDF/OCR Extract) │
                    └───────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS, Zustand |
| Backend | Go 1.25, Chi router, pgx/pgvector |
| Database | Cloud SQL PostgreSQL with pgvector |
| AI | Vertex AI (Gemini, text-embedding-004) |
| Auth | Firebase Authentication, NextAuth.js |
| Storage | Cloud Storage with CMEK encryption |
| Document Processing | Document AI (OCR), Cloud DLP (PII redaction) |
| Monitoring | Prometheus metrics, Cloud Logging |
| Infrastructure | Cloud Run, Terraform, Cloud Build |
| Testing | Jest 30 (frontend), Go testing (backend) |

## Project Structure

```
RAGbox.co/
├── src/                            # Next.js frontend
│   ├── app/                        # App Router (pages + API routes)
│   │   ├── api/                    # Frontend API routes (auth, proxy)
│   │   ├── dashboard/              # Protected dashboard
│   │   │   ├── settings/           # Security & vault settings
│   │   │   └── components/         # Dashboard-specific components
│   │   ├── login/                  # Authentication page
│   │   └── docs/                   # Documentation pages
│   ├── components/
│   │   ├── ui/                     # Reusable primitives (Tooltip, Badge)
│   │   ├── dashboard/
│   │   │   ├── vault/              # Document management panel
│   │   │   ├── mercury/            # Chat/query interface
│   │   │   ├── forge/              # Asset generation panel
│   │   │   └── icons/              # Icon components
│   │   ├── audit/                  # Audit log components
│   │   ├── voice/                  # Voice interaction UI
│   │   ├── settings/               # Settings components
│   │   └── providers/              # Auth & theme providers
│   ├── stores/                     # Zustand state management
│   │   ├── vaultStore.ts           # Document & folder state
│   │   ├── mercuryStore.ts         # Chat/streaming state
│   │   ├── forgeStore.ts           # Asset generation state
│   │   └── privilegeStore.ts       # Privilege mode state
│   ├── lib/
│   │   ├── api.ts                  # apiFetch() helper → Go backend
│   │   ├── backend-proxy.ts        # Backend proxy utilities
│   │   ├── firebase.ts             # Firebase config
│   │   ├── prisma.ts               # Prisma client (frontend DB)
│   │   ├── rag/                    # RAG utilities (chunker, citations)
│   │   ├── llm/                    # LLM providers (Vertex, OpenRouter)
│   │   ├── voice/                  # Voice/TTS utilities
│   │   └── security/               # Security tier management
│   ├── mercury/                    # Output firewall / safety
│   ├── hooks/                      # Custom React hooks
│   ├── contexts/                   # React contexts
│   ├── types/                      # TypeScript type definitions
│   └── styles/                     # Design tokens & global CSS
├── backend/                        # Go backend microservice
│   ├── cmd/server/                 # Server entry point
│   ├── internal/
│   │   ├── config/                 # Configuration management
│   │   ├── handler/                # HTTP handlers (13 files)
│   │   ├── middleware/             # Auth, CORS, logging, monitoring, rate limiting
│   │   ├── model/                  # Data models (user, document, vault, query, audit)
│   │   ├── repository/             # Data access layer (pgx + pgvector)
│   │   ├── service/                # Business logic (14 services)
│   │   │   └── prompts/            # Prompt template files
│   │   ├── router/                 # Chi router setup
│   │   ├── rbac/                   # Role-based access control
│   │   ├── gcpclient/              # GCP service integrations
│   │   └── tools/                  # Utility functions
│   ├── migrations/                 # SQL migrations (idempotent)
│   ├── Dockerfile                  # Multi-stage: Go → distroless
│   └── cloudbuild.yaml             # Backend CI/CD pipeline
├── terraform/                      # GCP infrastructure as code
│   ├── main.tf                     # Provider config & APIs
│   ├── cloudrun.tf                 # Cloud Run services
│   ├── database.tf                 # Cloud SQL (PostgreSQL + pgvector)
│   ├── storage.tf                  # Cloud Storage + CMEK
│   ├── network.tf                  # VPC & connectors
│   ├── iam.tf                      # Service accounts & roles
│   ├── bigquery.tf                 # Audit log storage
│   ├── kms.tf                      # Encryption keys
│   └── billing.tf                  # Billing alerts
├── prisma/                         # Frontend database schema
├── cli/                            # RAGbox CLI tool
├── scripts/                        # Deployment & ops scripts
├── Dockerfile                      # Frontend: multi-stage Node 20
├── cloudbuild.yaml                 # Frontend CI/CD pipeline
└── server.ts                       # Express wrapper for Cloud Run
```

## Core Features

### The Vault (Document Management)
Three-panel layout with collapsible rail, column browser for folder navigation, document preview, and storage tracking. Drag-and-drop upload backed by Cloud Storage, Document AI text extraction, and Cloud DLP PII redaction.

### Mercury (Query Interface)
Streaming RAG chat powered by Vertex AI. The backend pipeline: query embedding (768-dim) → top-20 vector search → weighted re-ranking (0.7 similarity + 0.15 recency + 0.15 parent document) → dedup (max 2 per doc) → top-5 results. SSE streaming with inline citations, confidence scoring, and the **Silence Protocol** — refuses to answer when confidence falls below 85%.

### Self-RAG Reflection
Three-iteration reflection loop evaluating relevance, grounding support, and completeness. Critiques filter low-quality citations before final response. Triggers the Silence Protocol when quality thresholds aren't met.

### Forge (Asset Generation)
Template-based document generation. Three built-in templates for producing PDFs, reports, and exports from conversation context and document data. Generated assets uploaded to Cloud Storage.

### Privilege System
Binary privilege toggle protecting attorney-client and work-product documents. Safety guards prevent accidental de-privileging: requires explicit confirmation and blocks unmarking while in privilege mode. Privileged documents are hidden from queries in normal mode. Full audit trail on all privilege changes.

### Veritas Audit Log
Immutable, SHA-256 hash-chain verified audit records. BigQuery storage (WORM-compatible for SEC 17a-4). Covers logins, document operations, queries, privilege changes, and data exports. Chain integrity verification and plain-text export for regulators.

### GDPR Data Export
Full user data export as ZIP archive containing `documents.json`, `audit_logs.json`, and `manifest.json`.

## Backend API Endpoints

The Go backend exposes these endpoints (all require Firebase auth unless noted):

| Route | Method | Description |
|-------|--------|-------------|
| `/health` | GET | Health check (no auth) |
| `/metrics` | GET | Prometheus metrics (no auth) |
| `/api/v1/documents` | GET | List user documents |
| `/api/v1/documents` | POST | Upload document |
| `/api/v1/documents/{id}` | GET/DELETE | Get/soft-delete document |
| `/api/v1/documents/{id}/recover` | POST | Recover deleted document |
| `/api/v1/documents/{id}/tier` | PATCH | Update security tier |
| `/api/v1/documents/{id}/privilege` | PATCH | Toggle privilege flag |
| `/api/v1/documents/ingest` | POST | Ingest document (parse → chunk → embed) |
| `/api/v1/folders` | GET/POST | List/create folders |
| `/api/v1/folders/{id}` | PATCH/DELETE | Update/delete folder |
| `/api/v1/chat` | POST | RAG query (SSE streaming) |
| `/api/v1/audit` | GET | List audit logs (with filters) |
| `/api/v1/audit/export` | GET | Export audit as plain-text report |
| `/api/v1/forge/generate` | POST | Generate document from template |
| `/api/v1/export` | GET | GDPR data export (ZIP) |

## Frontend API Routes

The Next.js frontend retains these routes for auth and frontend-specific functionality:

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth authentication |
| `/api/auth/send-otp` | POST | OTP login |
| `/api/waitlist` | POST | Pioneer waitlist signup |
| `/api/voice/synthesize` | POST | Text-to-speech |
| `/api/tts` | POST | TTS endpoint |

## Quick Start

### Frontend

```bash
npm install
cp .env.example .env.local    # edit with your credentials
npx prisma generate
npm run dev
```

### Backend

```bash
cd backend
go mod download
# Set DATABASE_URL, GOOGLE_CLOUD_PROJECT, etc.
go run ./cmd/server
```

## Development Commands

### Frontend

```bash
npm run dev              # Start dev server (Express + Next.js)
npm run dev:next         # Next.js dev server only
npm run build            # Prisma generate + Next.js build
npm run lint             # ESLint
npm run type-check       # TypeScript type check (tsc --noEmit)
npm test                 # Jest tests
npm run test:watch       # Jest watch mode
```

### Database (Prisma)

```bash
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run migrations (deploy)
npm run db:migrate:dev   # Run migrations (dev)
npm run db:push          # Push schema to DB
npm run db:studio        # Open Prisma Studio
npm run db:seed          # Seed database
```

### Backend (Go)

```bash
cd backend
go test ./...            # Run all tests
go build ./cmd/server    # Build binary
```

### CLI

```bash
npm run cli:install      # Install CLI dependencies
npm run cli:build        # Build CLI
npm run cli              # Run RAGbox CLI
```

### Operations Scripts

```bash
scripts/doctor.sh        # Environment health check
scripts/ci_local.sh      # Local CI simulation
scripts/smoke_local.sh   # Local smoke tests
scripts/check-deploy.sh  # Verify deployment status
```

## Testing

### Frontend (Jest 30)

13 test files covering stores, components, API utilities, and safety modules:

- **Store tests** — `vaultStore`, `mercuryStore`, `forgeStore`, `privilegeStore` (state transitions, payload shapes, SSE streaming)
- **Component tests** — `DashboardLayout`, `VaultPanel` (mount behavior, privilege init)
- **Utility tests** — `api.ts`, `auth.ts`, `toolErrors.ts`, `sanitizeForTTS.ts`, `outputFirewall.ts`

### Backend (Go)

38 test files with comprehensive coverage:

| Layer | Coverage | Files |
|-------|----------|-------|
| Handlers | 87.9% | audit, chat, documents, export, folders, forge, health, ingest, privilege |
| Services | 90.7% | audit, chunker, document, embedder, forge, generator, parser, pipeline, promptloader, redactor, retriever, selfrag, silence |
| Middleware | 98.4% | auth, cors, logging, monitoring, ratelimit |
| Other | — | config, migrations, repository, rbac, router, gcpclient, tools |

## Deployment

Both services deploy to Cloud Run via Cloud Build:

**Frontend** (`cloudbuild.yaml`):
1. `npm ci` → Prisma generate → lint → type-check → test
2. Multi-stage Docker build (Node 20-alpine, standalone output)
3. Deploy to Cloud Run (`ragbox-app`, us-east4, 2 CPU / 2Gi)

**Backend** (`backend/cloudbuild.yaml`):
1. `go test ./...`
2. Multi-stage Docker build (Go 1.25-alpine → distroless)
3. Deploy to Cloud Run (`ragbox-backend`, us-east4, 1 CPU / 512Mi)

### Infrastructure

Terraform manages all GCP resources:
- Cloud Run (frontend + backend services)
- Cloud SQL (PostgreSQL + pgvector)
- Cloud Storage (CMEK-encrypted document bucket)
- Vertex AI (embeddings + LLM)
- Document AI (OCR processor)
- Cloud DLP (PII redaction)
- BigQuery (immutable audit logs)
- Cloud KMS (encryption keys)
- VPC, connectors, firewall rules
- IAM service accounts and roles
- Billing alerts ($1000 budget at 50%/75%/100%)

## Security

- AES-256 encryption at rest with Customer-Managed Encryption Keys (CMEK)
- Firebase Authentication with OTP support
- Role-based access control (RBAC)
- Rate limiting on all API endpoints
- Privilege mode safety guards with audit trail
- Immutable audit logging with SHA-256 hash-chain verification
- Silence Protocol for low-confidence query suppression
- Cloud DLP PII redaction on document ingestion
- Output firewall for response safety filtering
- Prometheus monitoring (request count, duration, error rate, silence triggers)
- Security headers and CORS middleware

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `GOOGLE_CLOUD_PROJECT` | GCP project ID |
| `GCS_BUCKET_NAME` | Cloud Storage bucket |
| `VERTEX_AI_LOCATION` | Vertex AI region |
| `VERTEX_AI_MODEL` | Gemini model ID |
| `DOCUMENT_AI_PROCESSOR_ID` | Document AI OCR processor |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase Auth config (frontend) |
| `NEXT_PUBLIC_API_URL` | Go backend URL (frontend) |
| `FIREBASE_PROJECT_ID` | Firebase project (backend) |
| `INTERNAL_AUTH_SECRET` | Service-to-service auth secret |
| `FRONTEND_URL` | Allowed CORS origin (backend) |

## License

UNLICENSED — Proprietary software.

---

**RAGbox.co** — Your Files Speak. We Make Them Testify.
