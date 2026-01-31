# RAGbox.co

**Sovereign RAG platform for legal and financial professionals.**

Your Files Speak. We Make Them Testify.

RAGbox transforms unstructured documents into an intelligent, queryable knowledge base with verified citations, attorney-client privilege protection, and immutable audit logging.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS |
| Backend | Node.js, TypeScript, Next.js API Routes |
| Database | PostgreSQL with pgvector (via Prisma ORM) |
| AI | Vertex AI (Gemini 1.5 Pro, text-embedding-004) |
| Auth | Firebase Authentication |
| Storage | GCP Cloud Storage with CMEK encryption |
| Infrastructure | Cloud Run, Document AI, BigQuery, Terraform |
| Testing | Jest 30, React Testing Library, ts-jest |

## Project Structure

```
RAGbox.co/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── api/                    # API routes (see below)
│   │   ├── dashboard/              # Protected dashboard page
│   │   └── login/                  # Authentication page
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── DashboardLayout.tsx # Three-panel layout shell
│   │   │   ├── GlobalHeader.tsx    # Top navigation bar
│   │   │   ├── vault/             # Document management panel
│   │   │   ├── mercury/           # Chat/query interface
│   │   │   └── forge/             # Asset generation panel
│   │   ├── landing/               # Landing page components
│   │   ├── ui/                    # Reusable primitives
│   │   └── ...
│   ├── stores/                    # Zustand state management
│   │   ├── vaultStore.ts          # Document & folder state
│   │   ├── mercuryStore.ts        # Chat/streaming state
│   │   ├── forgeStore.ts          # Asset generation state
│   │   └── privilegeStore.ts      # Privilege mode state
│   ├── lib/
│   │   ├── audit/                 # Veritas audit logging
│   │   ├── gcp/                   # GCP service clients
│   │   ├── rag/                   # RAG pipeline
│   │   ├── prisma.ts              # Prisma client singleton
│   │   └── ...
│   ├── mercury/                   # Output firewall / safety
│   ├── contexts/                  # React contexts
│   ├── hooks/                     # Custom React hooks
│   ├── types/                     # TypeScript type definitions
│   └── styles/                    # Global styles
├── prisma/                        # Database schema & migrations
├── cli/                           # RAGbox CLI tool
├── terraform/                     # GCP infrastructure as code
├── public/                        # Static assets
├── docs/                          # Documentation
├── jest.config.ts                 # Jest config (node + jsdom projects)
├── Dockerfile                     # Container build
└── cloudbuild.yaml                # GCP Cloud Build config
```

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/documents` | GET | List user documents |
| `/api/documents/extract` | POST | Upload & extract document text |
| `/api/documents/folders` | GET/POST | Manage folders |
| `/api/documents/[id]/privilege` | GET/PATCH | Get/toggle document privilege |
| `/api/documents/[id]/tier` | PATCH | Update document tier |
| `/api/documents/[id]/recover` | POST | Recover deleted document |
| `/api/documents/promote` | POST | Promote document tier |
| `/api/chat` | POST | RAG query (SSE streaming) |
| `/api/privilege` | GET/POST | Global privilege mode |
| `/api/forge/generate` | POST | Generate assets (PDF, reports) |
| `/api/templates/analyze` | POST | Analyze document templates |
| `/api/audit` | GET | Get audit log entries |
| `/api/audit/export` | GET | Export audit PDF |
| `/api/export` | GET | Export all user data |
| `/api/voice/synthesize` | POST | Text-to-speech synthesis |
| `/api/tts` | POST | TTS endpoint |
| `/api/health` | GET | Health check |
| `/api/waitlist` | POST | Pioneer waitlist signup |
| `/api/auth/send-otp` | POST | OTP authentication |

## Core Features

### The Vault (Document Management)
Three-panel layout with collapsible rail, column browser for folder navigation, document preview, and storage tracking. Supports drag-and-drop upload with GCP Cloud Storage backend and Document AI text extraction.

### Mercury (Query Interface)
Streaming RAG chat powered by Vertex AI. SSE-based token streaming, confidence scoring, inline citations with source highlighting, and conversation history. Includes the Silence Protocol — refuses to answer when confidence falls below 85%.

### Forge (Asset Generation)
Template-based document generation. Produces PDFs, reports, and exports from conversation context and document data.

### Privilege System
Binary privilege toggle protecting attorney-client and work-product documents. Safety guards prevent accidental de-privileging: requires explicit confirmation and blocks unmarking while in privilege mode. Full audit trail on all privilege changes.

### Veritas Audit Log
Immutable, hash-verified audit records stored in BigQuery (WORM-compatible). Covers logins, document operations, queries, privilege changes, and data exports. PDF export for regulators.

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your credentials

# Generate Prisma client
npx prisma generate

# Run development server
npm run dev
```

## Development Commands

```bash
npm run dev              # Start Next.js dev server
npm run build            # Build for production (prisma generate + next build)
npm run lint             # Run ESLint
npm run type-check       # TypeScript type check (tsc --noEmit)
npm test                 # Run all tests
npm run test:watch       # Jest watch mode
```

### Database

```bash
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run migrations (deploy)
npm run db:migrate:dev   # Run migrations (dev)
npm run db:push          # Push schema to DB
npm run db:studio        # Open Prisma Studio
npm run db:seed          # Seed database
```

### CLI

```bash
npm run cli:install      # Install CLI dependencies
npm run cli:build        # Build CLI
npm run cli              # Run RAGbox CLI
```

## Testing

Jest is configured with two projects:
- **node** — Store tests, API route tests, utility tests (`*.test.ts`)
- **jsdom** — Component tests with React Testing Library (`*.test.tsx`)

Current test suite: **8 test files, 76 tests passing**.

| Test File | Coverage |
|-----------|----------|
| `src/stores/vaultStore.test.ts` | Upload flow, folder mapping, privilege toggle |
| `src/stores/mercuryStore.test.ts` | SSE streaming, JSON fallback, error handling |
| `src/stores/forgeStore.test.ts` | Generation payload, response parsing, accumulation |
| `src/app/api/documents/[id]/privilege/route.test.ts` | Prisma persistence, safety guards, audit logging |
| `src/components/dashboard/DashboardLayout.test.tsx` | Privilege init on mount |
| `src/components/dashboard/vault/VaultPanel.test.tsx` | Mount ordering, collapsed state |
| `src/lib/voice/sanitizeForTTS.test.ts` | TTS text sanitization |
| `src/mercury/outputFirewall.test.ts` | Output safety filtering |

Store tests verify payload shape and state transitions via mocked fetch. The privilege route test covers backend Prisma persistence with mocked dependencies.

## GCP Architecture

```
┌─────────────────────────────────────────────────────┐
│                    User Browser                      │
│                 (Next.js Frontend)                    │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│                  Cloud Run (API)                     │
│                Next.js App Router                    │
└─────────────────────────────────────────────────────┘
       │            │            │            │
       ▼            ▼            ▼            ▼
┌────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  Cloud     │ │ Vertex   │ │ PostgreSQL│ │ BigQuery │
│  Storage   │ │ AI       │ │ pgvector │ │ (Audit)  │
│ (Documents)│ │ (LLM/Emb)│ │ (Prisma) │ │          │
└────────────┘ └──────────┘ └──────────┘ └──────────┘
                    │
                    ▼
          ┌──────────────────┐
          │   Document AI    │
          │ (PDF/OCR Extract)│
          └──────────────────┘
```

## Security

- AES-256 encryption at rest with Customer-Managed Encryption Keys (CMEK)
- Privilege mode safety guards (PRIVILEGE_MODE_SAFETY, CONFIRM_UNMARK_REQUIRED)
- Immutable audit logging with hash verification
- Silence Protocol for low-confidence query suppression
- Firebase Authentication with OTP support
- Output firewall for response safety filtering

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `GOOGLE_CLOUD_PROJECT` | GCP project ID |
| `GCS_BUCKET_NAME` | Cloud Storage bucket |
| `VERTEX_AI_LOCATION` | Vertex AI region |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase Auth config |

## License

UNLICENSED — Proprietary software.

---

**RAGbox.co** — Your Files Speak. We Make Them Testify.
