# CLAUDE.md - RAGbox.co AI Assistant Guide

## Project Overview

RAGbox.co is a secure, compliance-ready RAG (Retrieval-Augmented Generation) platform targeting SMBs in legal, financial, and healthcare sectors. The platform transforms unstructured documents into an intelligent, queryable knowledge base with verified citations, attorney-client privilege protection, and immutable audit logging.

**Tagline:** "Your Files Speak. We Make Them Testify."

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate:dev

# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Project Structure

```
ragbox-co/
├── src/
│   ├── app/                       # Next.js 14 App Router
│   │   ├── layout.tsx             # Root layout
│   │   ├── page.tsx               # Landing page
│   │   ├── login/                 # Authentication page
│   │   ├── dashboard/             # Protected dashboard
│   │   │   ├── page.tsx           # Dashboard home
│   │   │   ├── audit/             # Audit log viewer
│   │   │   ├── settings/          # Settings (vault, security, export)
│   │   │   ├── components/        # Dashboard-specific components
│   │   │   ├── hooks/             # useVoiceChat hook
│   │   │   ├── context/           # TooltipContext
│   │   │   └── constants/         # Dashboard constants & tooltips
│   │   └── api/                   # API routes
│   ├── components/
│   │   ├── ui/                    # Primitive components (TierBadge, Tooltip)
│   │   ├── providers/             # AuthProvider, ThemeProvider
│   │   ├── mercury/               # Chat citation & confidence UI
│   │   ├── voice/                 # VoiceButton, VoiceWaveform
│   │   ├── dropzone/              # File explorer (folder tree, grid, list)
│   │   ├── forge/                 # Template system components
│   │   ├── audit/                 # Audit log visualization
│   │   ├── settings/              # Settings UI
│   │   └── [root]                 # Hero, Navbar, Vault, TheBox, Sidebar
│   ├── lib/
│   │   ├── llm/                   # LLM provider abstraction layer
│   │   ├── rag/                   # RAG pipeline (retrieval, chunking, citations)
│   │   ├── vertex/                # Vertex AI clients
│   │   ├── voice/                 # Voice I/O (Deepgram STT/TTS, audio capture)
│   │   ├── gcp/                   # GCP service clients
│   │   ├── security/              # Security tiers & privilege filtering
│   │   ├── audit/                 # Audit logging & PDF export
│   │   ├── documents/             # Document storage management
│   │   ├── forge/                 # Template analysis & document generation
│   │   ├── db/                    # Database utilities
│   │   ├── auth.ts                # Authentication helpers
│   │   ├── prisma.ts              # Prisma client singleton
│   │   └── utils.ts               # Shared utilities
│   ├── hooks/                     # Custom React hooks
│   │   ├── useVoice.ts            # Voice input/output control
│   │   ├── useDocuments.ts        # Document CRUD operations
│   │   └── useRagSounds.ts        # Sound effects for RAG
│   ├── contexts/
│   │   └── PrivilegeContext.tsx    # Privilege mode state management
│   ├── mercury/                   # Mercury assistant system
│   │   ├── systemPrompt.ts        # Mercury identity & behavior rules
│   │   ├── outputFirewall.ts      # Output validation/filtering
│   │   └── outputFirewall.test.ts # Tests for output firewall
│   └── types/                     # TypeScript type definitions
│       ├── index.ts               # Core entity types
│       ├── rag.ts                 # RAG pipeline types
│       ├── security.ts            # Security/privilege types
│       ├── reasoning.ts           # Reasoning trace types
│       ├── templateAnalysis.ts    # Template analysis types
│       └── next-auth.d.ts         # NextAuth augmentation
├── cli/                           # @ragbox/cli command-line tool
│   └── src/
│       ├── bin/ragbox.ts          # CLI entry point
│       ├── commands/              # auth, vault, query, config
│       ├── lib/                   # api-client, config-store, output
│       └── types.ts               # CLI types
├── prisma/
│   ├── schema.prisma              # Database schema
│   └── migrations/                # Migration history
├── terraform/                     # GCP infrastructure as code (12 files)
├── docs/                          # Documentation
├── public/                        # Static assets
└── .claude/                       # Claude Code configuration
    ├── rules/                     # Coding style, git, security, testing
    ├── agents/                    # Agent definitions
    ├── skills/                    # Skill modules
    └── commands/                  # Custom commands
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS 3.4, Framer Motion |
| Backend | Node.js 20, TypeScript 5.9 |
| Database | PostgreSQL (AlloyDB / Cloud SQL) with pgvector (768-dim, IVFFlat) |
| AI (Production) | Vertex AI Llama 3.3 70B (primary), Vertex AI Gemini 1.5 Pro (fallback) |
| AI (Development) | OpenRouter (Claude, GPT-4, Llama via API) |
| Auth | NextAuth.js 4.24 (Google OAuth, Email OTP) |
| Voice | Deepgram (STT + TTS), Google Cloud TTS (fallback) |
| Storage | GCP Cloud Storage with CMEK encryption |
| Infrastructure | Cloud Run, Cloud Functions, Document AI, BigQuery |
| IaC | Terraform (12 files for complete GCP stack) |

## LLM Provider Architecture

The platform uses a multi-provider LLM abstraction layer (`src/lib/llm/`):

```
LLMProvider (interface)
├── VertexLlamaProvider   # Vertex AI Llama 3.3 70B (production primary)
├── VertexGeminiProvider  # Vertex AI Gemini 1.5 Pro (production fallback)
└── OpenRouterProvider    # OpenRouter API (development only)
```

**Selection via environment:**
- `LLM_PROVIDER=vertex-llama` — Production primary
- `LLM_PROVIDER=vertex-gemini` — Production fallback
- `LLM_PROVIDER=openrouter` — Development

All providers support streaming (`AsyncIterable<LLMStreamChunk>`), token counting, and safety settings.

## Mercury Assistant System

Mercury is the user-facing AI assistant (`src/mercury/`):

- **Identity enforcement:** `systemPrompt.ts` defines non-negotiable identity rules (no vendor disclosure, executive assistant tone)
- **Output firewall:** `outputFirewall.ts` validates all responses before delivery
- **Architecture disclosure:** May describe "Llama 3.3 + Gemini 1.5 + Weaviate" stack only
- **Citation requirement:** Every claim must be backed by a document reference
- **Confidence < 0.85 = Silence Protocol:** Refuses answers below threshold

## RAG Pipeline

Located in `src/lib/rag/`:

| Module | Purpose |
|--------|---------|
| `pipeline.ts` | Orchestrator: embed → retrieve → generate → cite → score |
| `retriever.ts` | pgvector similarity search (top-k chunks) |
| `chunker.ts` | Semantic text segmentation |
| `indexer.ts` | Embedding generation & storage |
| `citation-parser.ts` | Extract citations, confidence scoring |
| `reasoningTrace.ts` | Chain-of-thought reasoning tracking |

**Confidence threshold:** 0.85 (configurable via `AEGIS_CONFIDENCE_THRESHOLD`).

## Security & Privilege System

4-tier security model (`src/lib/security/`):

| Tier | Level | Access |
|------|-------|--------|
| 0 | Open | Default, visible to all users |
| 1 | Restricted | Elevated access required |
| 2 | Privileged | Attorney-client, requires privilege toggle |
| 3 | Sealed | Ultra-restricted (future) |

Key modules:
- `tiers.ts` — Tier definitions & access rules
- `tierFilter.ts` — Filter documents by user tier
- `autoPromotion.ts` — Automatic tier escalation logic

## Voice System

Three-state voice interface (`src/lib/voice/`, `src/components/voice/`):

- **States:** ON / MUTE / OFF (continuous-listening model)
- **STT:** Deepgram (streaming audio capture)
- **TTS:** Deepgram Aura (primary), Google Cloud TTS (fallback)
- **Sanitization:** `sanitizeForTTS.ts` strips markdown before synthesis
- **UI:** `VoiceButton.tsx` (three-state control), `VoiceWaveform.tsx` (audio visualization)

## Document FORGE System

Template-based document analysis and generation (`src/lib/forge/`, `src/components/forge/`):

- `deepseekOcr.ts` — OCR processing for document extraction
- `documentGenerator.ts` — Template-based document creation
- Components: `TemplateLibrary`, `TemplateCard`, `TemplateSelector`, `TemplateUpload`, `TemplatePreview`, `ForgeButton`

## Database Schema (Prisma)

Core models in `prisma/schema.prisma`:

| Model | Purpose |
|-------|---------|
| User | Accounts (Partner, Associate, Auditor roles) |
| Vault | Document containers (open, closed, secure) |
| Document | Files with metadata, security tier, deletion status |
| DocumentChunk | Semantic chunks with pgvector embeddings (768-dim) |
| Query | User queries with confidence scores |
| Answer | Generated answers |
| Citation | Document references with relevance scores |
| AuditLog | Immutable audit trail (action, severity, details) |
| Folder | Hierarchical folder organization |
| Template | FORGE document templates |
| WaitlistEntry | Pioneer program signups |

**Migrations:**
- `20260127185942_init_ragbox_schema` — Initial schema
- `20260127210000_add_ivfflat_index` — IVFFlat index for vector search

## API Routes

### Authentication
| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/[...nextauth]` | POST | NextAuth handler (OAuth, credentials) |
| `/api/auth/send-otp` | POST | Email OTP authentication |

### Documents
| Route | Method | Description |
|-------|--------|-------------|
| `/api/documents` | GET/POST | List/upload documents |
| `/api/documents/[id]` | GET/DELETE | Get/delete document |
| `/api/documents/[id]/privilege` | PATCH | Toggle privilege flag |
| `/api/documents/[id]/tier` | PATCH | Adjust security tier |
| `/api/documents/[id]/recover` | POST | Recover soft-deleted document |
| `/api/documents/extract` | POST | Extract text from document |
| `/api/documents/promote` | POST | Promote to higher tier |
| `/api/documents/folders` | POST | Create/manage folders |

### RAG & Query
| Route | Method | Description |
|-------|--------|-------------|
| `/api/chat` | POST | Main RAG query (streaming) |
| `/api/templates/analyze` | POST | Analyze document template |
| `/api/templates` | GET/POST | Template CRUD |
| `/api/forge/generate` | POST | Generate from template |

### Voice
| Route | Method | Description |
|-------|--------|-------------|
| `/api/voice/token` | GET | Voice session token |
| `/api/voice` | POST | Handle voice input |
| `/api/voice/synthesize` | POST | Text-to-speech synthesis |
| `/api/tts` | POST | Legacy TTS endpoint |

### System
| Route | Method | Description |
|-------|--------|-------------|
| `/api/privilege` | PATCH | Toggle user privilege mode |
| `/api/audit` | GET | Get audit log entries |
| `/api/audit/export` | GET | Export audit PDF |
| `/api/health` | GET | Health check |
| `/api/about` | GET | System info (Mercury identity) |
| `/api/waitlist` | POST | Waitlist signup |
| `/api/export` | GET | Export all user data (GDPR) |

## NPM Scripts

```bash
# Development
npm run dev              # Start dev server
npm run lint             # Run ESLint
npm run type-check       # TypeScript check
npm run test             # Run Jest tests
npm run test:watch       # Jest watch mode

# Database
npm run db:generate      # Regenerate Prisma client
npm run db:migrate       # Apply migrations
npm run db:migrate:dev   # Create & apply migration interactively
npm run db:push          # Sync schema to database
npm run db:studio        # Open Prisma Studio
npm run db:seed          # Seed sample data

# Build & Deploy
npm run build            # Build for production (runs prisma generate first)
npm run start            # Start production server

# CLI Tool
npm run cli:build        # Build CLI
npm run cli:dev          # Watch rebuild CLI
npm run cli:install      # Install CLI dependencies
npm run cli              # Execute CLI
npm run ragbox           # Alias for CLI
```

## CLI Tool

The `cli/` directory contains `@ragbox/cli`, a command-line interface for headless RAGbox operations:

| Command | Description |
|---------|-------------|
| `ragbox auth` | Authentication workflows |
| `ragbox vault` | List/upload documents |
| `ragbox query` | Execute RAG queries from terminal |
| `ragbox config` | Configuration management |

Built with: commander, inquirer, ora, chalk, conf, node-fetch.

## Environment Variables

```bash
# LLM Provider Selection
LLM_PROVIDER=openrouter|vertex-llama|vertex-gemini
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct

# Vertex AI (Production)
GOOGLE_CLOUD_PROJECT=ragbox-prod
VERTEX_AI_LOCATION=us-central1
VERTEX_AI_MODEL=gemini-1.5-pro
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json

# Database
DATABASE_URL=postgresql://user:pass@host:5432/ragbox

# Authentication (NextAuth)
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Embedding
EMBEDDING_PROVIDER=openai|local-bge
OPENAI_API_KEY=sk-...

# Storage
GCS_BUCKET_NAME=ragbox-documents-prod

# Encryption
KMS_KEY_RING=ragbox-keys
KMS_KEY_NAME=document-key

# Voice
DEEPGRAM_API_KEY=...

# RAG & Safety
AEGIS_CONFIDENCE_THRESHOLD=0.85
CONFIDENCE_THRESHOLD=0.85
RAG_GENERATION_MODEL=gemini-2.0-flash-001

# App
NODE_ENV=development|production
NEXT_PUBLIC_APP_URL=https://ragbox.co
```

## Design System

### Colors (Cyber-Noir Theme)
```css
--background: #050505;      /* OLED Black */
--primary: #00F0FF;         /* Electric Cyan */
--warning: #FFAB00;         /* Amber */
--danger: #FF3D00;          /* Neon Red */
--border: #333333;
--text: #FFFFFF;
--text-muted: #888888;
```

### Typography
- **Headers:** Space Grotesk (Google Fonts)
- **Body:** Inter (Google Fonts)
- **Code/Citations:** JetBrains Mono (Google Fonts)

### Component Patterns
- Tailwind CSS for styling
- Glassmorphism for cards: `bg-black/50 backdrop-blur-lg border border-[#333]`
- Glow effects: `shadow-[0_0_20px_rgba(0,240,255,0.3)]`
- Animations via Framer Motion

## Testing

- **Framework:** Jest 30 with ts-jest preset
- **Config:** `jest.config.ts` with `@/` module alias
- **Coverage target:** 80%+
- **Test pattern:** `**/*.test.ts`

Existing test files:
- `src/mercury/outputFirewall.test.ts` — Mercury output validation
- `src/lib/voice/sanitizeForTTS.test.ts` — TTS sanitization

```bash
npm run test             # Run all tests
npm run test:watch       # Watch mode
```

## Debugging

### Common Issues

1. **LLM not responding**
   - Check `LLM_PROVIDER` is set correctly
   - For OpenRouter: verify `OPENROUTER_API_KEY`
   - For Vertex: check `GOOGLE_APPLICATION_CREDENTIALS` and IAM permissions
   - Check quotas in GCP Console

2. **Database connection failed**
   - Verify `DATABASE_URL` format
   - Run `npm run db:push` to test connection
   - Check VPC connector for Cloud Run deployments

3. **File upload fails**
   - Check Cloud Storage bucket permissions
   - Verify CMEK key access
   - Check file size limits (50MB default)

4. **Voice not working**
   - Verify `DEEPGRAM_API_KEY` is set
   - Check browser microphone permissions
   - Ensure HTTPS (required for WebRTC)

### Logging
```typescript
import { logger } from '@/lib/logger';

logger.info('User uploaded document', { userId, filename });
logger.error('RAG query failed', { error, query });
```

## Deployment

### Docker (Multi-Stage Build)
- Stage 1 (`deps`): Install dependencies, generate Prisma client
- Stage 2 (`builder`): Build Next.js (standalone output)
- Stage 3 (`runner`): Minimal Node 20 Alpine image, non-root user

### Cloud Build Pipeline (`cloudbuild.yaml`)
1. Install dependencies
2. Generate Prisma client
3. Run ESLint
4. Type checking (tsc)
5. Build & deploy

### Terraform (`terraform/`)
12 IaC files covering: project setup, AlloyDB/Cloud SQL, Cloud Storage (CMEK), Cloud Run, BigQuery (audit), Cloud KMS, VPC/network, IAM, variables, outputs.

## Security Checklist

- [ ] No hardcoded secrets (API keys, passwords, tokens)
- [ ] Environment variables in Secret Manager (not .env in production)
- [ ] CMEK encryption enabled on Cloud Storage
- [ ] VPC Service Controls configured
- [ ] IAM roles follow least-privilege
- [ ] Audit logging enabled for all sensitive operations
- [ ] Rate limiting on API routes
- [ ] CORS configured for allowed origins only
- [ ] All user inputs validated (Zod schemas)
- [ ] SQL injection prevention (Prisma parameterized queries)

## Contributing

1. Create a feature branch: `git checkout -b feature/story-id`
2. Implement the story acceptance criteria
3. Write tests for new functionality
4. Run `npm run lint && npm run test`
5. Submit PR with story ID in title
