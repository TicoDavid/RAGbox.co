# RAGbox.co — Build, Deploy & Test Guide

This document defines the complete build order for RAGbox.co, from a clean checkout through production deployment. Follow each phase sequentially; every step within a phase must pass before moving to the next phase.

---

## Prerequisites

| Tool | Minimum Version | Check Command |
|------|-----------------|---------------|
| Node.js | 20.x | `node -v` |
| npm | 10.x | `npm -v` |
| PostgreSQL | 15+ with pgvector | `psql --version` |
| Docker | 24+ | `docker --version` |
| gcloud CLI | 460+ | `gcloud --version` |
| Terraform | 1.5+ | `terraform --version` |
| Git | 2.x | `git --version` |

**Not all tools are needed for every phase.** The table below shows which are required:

| Phase | Node | npm | PostgreSQL | Docker | gcloud | Terraform |
|-------|------|-----|------------|--------|--------|-----------|
| 1 — Install & Generate | x | x | | | | |
| 2 — Static Checks | x | x | | | | |
| 3 — Tests | x | x | | | | |
| 4 — Production Build | x | x | | | | |
| 5 — Database | | | x | (or Docker) | | |
| 6 — Local Dev Server | x | x | x | | | |
| 7 — UI Verification | x | x | x | | | |
| 8 — Docker Image | | | | x | | |
| 9 — GCP Infrastructure | | | | | x | x |
| 10 — Cloud Deploy | | | | x | x | |
| 11 — Post-Deploy | | | | | x | |

---

## Phase 1 — Install & Generate

These steps have no external service dependencies. They prepare the local toolchain.

```bash
# 1.1  Install all dependencies (main app)
npm install

# 1.2  Generate the Prisma client (no database connection needed)
npm run db:generate

# 1.3  Install CLI dependencies
npm run cli:install

# 1.4  Build CLI
npm run cli:build
```

**Pass criteria:** All commands exit 0. `node_modules/` exists. `node_modules/.prisma/client/` exists. `cli/dist/` exists.

---

## Phase 2 — Static Checks

Run these before touching any runtime services. They catch type errors, lint violations, and configuration problems at zero cost.

```bash
# 2.1  TypeScript type checking (strict mode)
npm run type-check

# 2.2  ESLint
npm run lint
```

**Pass criteria:** Both commands exit 0 with no errors. Warnings are acceptable but should be reviewed.

**Common failures:**
- Missing `@/` path imports → check `tsconfig.json` paths
- Unused variables → remove or prefix with `_`
- React hook dependency warnings → fix or suppress with justification

---

## Phase 3 — Tests

```bash
# 3.1  Run full test suite
npm test

# 3.2  (Optional) Run with coverage report
npx jest --coverage
```

**Current test files:**
- `src/mercury/outputFirewall.test.ts` — Mercury output validation
- `src/lib/voice/sanitizeForTTS.test.ts` — TTS text sanitization

**Pass criteria:** All tests pass. Coverage target is 80%+ for tested modules.

---

## Phase 4 — Production Build

This compiles the Next.js app in standalone mode. It will surface any SSR-time import errors or missing environment variable references that TypeScript alone cannot catch.

```bash
# 4.1  Build for production (runs prisma generate automatically)
npm run build
```

**Pass criteria:** `.next/` directory created. `.next/standalone/` directory exists (standalone output). No build errors.

**Common failures:**
- Server components importing client-only modules → add `'use client'` directive
- Missing env vars referenced at build time → set dummy values or use `process.env` only at runtime
- Webpack resolution errors → check `next.config.js` serverExternalPackages and fallback config

---

## Phase 5 — Database Setup

You need PostgreSQL 15+ with the `pgvector` extension enabled.

### Option A: Docker (recommended for local dev)

```bash
# 5.1  Start PostgreSQL with pgvector
docker run -d \
  --name ragbox-db \
  -e POSTGRES_USER=ragbox \
  -e POSTGRES_PASSWORD=ragbox \
  -e POSTGRES_DB=ragbox \
  -p 5432:5432 \
  pgvector/pgvector:pg16

# 5.2  Verify it's running
docker exec ragbox-db pg_isready -U ragbox
```

### Option B: Local PostgreSQL

```bash
# 5.1  Connect and enable pgvector
psql -U postgres -c "CREATE DATABASE ragbox;"
psql -U postgres -d ragbox -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Option C: Cloud SQL / AlloyDB

Provision via Terraform in Phase 9. Skip this phase and return after infrastructure is up.

### Apply migrations

```bash
# 5.3  Set DATABASE_URL in .env.local (see Phase 6 for full env setup)
#      Example: postgresql://ragbox:ragbox@localhost:5432/ragbox

# 5.4  Apply all migrations
npm run db:migrate

# 5.5  (Optional) Seed sample data
npm run db:seed

# 5.6  (Optional) Inspect with Prisma Studio
npm run db:studio
```

**Pass criteria:** Both migrations applied successfully:
1. `20260127185942_init_ragbox_schema`
2. `20260127210000_add_ivfflat_index`

All 11 tables created: User, Vault, Document, DocumentChunk, Query, Answer, Citation, AuditLog, Folder, Template, WaitlistEntry.

---

## Phase 6 — Environment Configuration

```bash
# 6.1  Create local env file
cp .env.example .env.local
```

Edit `.env.local` with the values below. Items marked **required** must be set for the dev server to start. Items marked **feature** are needed only for specific features.

### Minimum viable configuration

```bash
# Database (required)
DATABASE_URL=postgresql://ragbox:ragbox@localhost:5432/ragbox

# Auth (required)
NEXTAUTH_SECRET=<run: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000

# App (required)
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# LLM — pick one (feature: chat/RAG)
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct
```

### Full configuration

```bash
# Google OAuth (feature: Google login)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Embeddings (feature: document indexing & RAG)
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Voice (feature: voice I/O)
DEEPGRAM_API_KEY=...

# RAG tuning
AEGIS_CONFIDENCE_THRESHOLD=0.85
CONFIDENCE_THRESHOLD=0.85
RAG_GENERATION_MODEL=gemini-2.0-flash-001

# GCP services (feature: cloud storage, Document AI)
GOOGLE_CLOUD_PROJECT=your-project
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
GCS_BUCKET_NAME=ragbox-documents-dev

# Encryption (feature: CMEK)
KMS_KEY_RING=ragbox-keys
KMS_KEY_NAME=document-key

# Vertex AI — production LLM (feature: prod LLM)
VERTEX_AI_LOCATION=us-central1
VERTEX_AI_MODEL=gemini-1.5-pro
```

**Pass criteria:** `.env.local` exists with at least DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, NODE_ENV, NEXT_PUBLIC_APP_URL set.

---

## Phase 7 — Local Dev Server & UI Verification

This phase validates the full application stack running locally, including the new UI currently being built.

```bash
# 7.1  Start the dev server
npm run dev
```

Open `http://localhost:3000` and verify each screen:

### Landing Page (`/`)

| Element | What to check |
|---------|---------------|
| Navbar | Logo renders, theme toggle works (dark/light), Sign In and Request Demo buttons visible |
| Hero | Headline text renders with gold gradient, "The Box" artifact animates, CTA buttons clickable |
| FeatureGrid | 4 cards render (Silence Protocol, Privilege Switch, Fort Knox, Audit Trail), hover lift effect works |
| Footer | 4 columns render, status indicator pulses green |
| AuthModal | Clicking Sign In opens modal, Google OAuth button present |
| VideoModal | "See How It Works" opens video player overlay |
| Responsive | Check at 375px, 768px, 1024px, 1440px widths |

### Login Page (`/login`)

| Element | What to check |
|---------|---------------|
| Shield animation | Concentric rings rotate, gradient scan line moves |
| Auth buttons | Google, Microsoft/Azure AD, SAML/SSO options visible |
| Glassmorphism | Backdrop blur effect renders on card |
| Copy | "Authenticate to Access Vault" headline, "Your documents await" subtext |

### Dashboard (`/dashboard`) — requires authentication

| Element | What to check |
|---------|---------------|
| 4-column layout | Vaults (260px fixed), Security Drop (resizable), Mercury Chat (flex center), Studio/Forge (resizable) |
| Column resizing | Drag dividers between columns; widths persist on page reload (localStorage) |
| Header | Global search input, protocol mode selector (Standard/Legal/Executive/Analyst), theme toggle, user avatar |
| Vaults panel | List of vaults, create new vault button, vault status indicators (open/closed/secure) |
| Security Drop | File drop zone accepts files, folder tree renders, storage indicator shows usage, tier badges (0-3) |
| Mercury Chat | Message input works, streaming responses render token-by-token, citations render as chips, confidence badge shows score |
| Studio/Forge | Artifact grid renders, column toggle (1/2/4), design prompt input |
| Privilege toggle | Toggle privilege mode, screen border pulse appears in privilege mode |
| Modals | CreateVault, SaveToVault, SecurityModal all open and close correctly |
| Side drawer | Code viewer, variations gallery, session history tabs |

### Settings Pages (`/dashboard/settings/*`)

| Page | What to check |
|------|---------------|
| Vault settings | Vault list, status toggles |
| Security settings | Tier configuration, privilege options |
| Export settings | Data export controls |

### Audit Log (`/dashboard/audit`)

| Element | What to check |
|---------|---------------|
| Timeline | AuditTimeline renders events chronologically |
| Entries | AuditEntry components show action, severity, timestamp, details |
| Export | PDF export button triggers download |

### API Smoke Tests

Run these from a separate terminal while the dev server is running:

```bash
# Health check
curl -s http://localhost:3000/api/health | jq .

# System info
curl -s http://localhost:3000/api/about | jq .

# Waitlist (POST)
curl -s -X POST http://localhost:3000/api/waitlist \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User"}' | jq .
```

**Pass criteria:** All pages render without console errors. All interactive elements respond. API endpoints return valid JSON.

---

## Phase 8 — Docker Image Build

```bash
# 8.1  Build the production Docker image
docker build -t ragbox:latest .

# 8.2  Verify image size (should be < 500MB for Alpine)
docker images ragbox:latest

# 8.3  Test the container locally
docker run --rm -p 8080:8080 \
  -e DATABASE_URL=postgresql://ragbox:ragbox@host.docker.internal:5432/ragbox \
  -e NEXTAUTH_SECRET=$(openssl rand -base64 32) \
  -e NEXTAUTH_URL=http://localhost:8080 \
  -e NODE_ENV=production \
  ragbox:latest

# 8.4  Verify container responds
curl -s http://localhost:8080/api/health | jq .
```

**Pass criteria:** Docker build completes without errors. Container starts and `/api/health` returns 200. Image runs as non-root user `nextjs` on port 8080.

---

## Phase 9 — GCP Infrastructure (Terraform)

Skip this phase for local-only development.

```bash
# 9.1  Authenticate to GCP
gcloud auth login
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID

# 9.2  Enable required APIs
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  storage.googleapis.com \
  cloudkms.googleapis.com \
  bigquery.googleapis.com \
  aiplatform.googleapis.com \
  documentai.googleapis.com \
  secretmanager.googleapis.com

# 9.3  Configure Terraform
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars:
#   project_id       = "your-project-id"
#   region           = "us-central1"
#   environment      = "prod"    # or "dev" / "staging"

# 9.4  Initialize and plan
terraform init
terraform plan -out=tfplan

# 9.5  Review the plan carefully, then apply
terraform apply tfplan

# 9.6  Capture outputs
terraform output
# Note: DATABASE_URL, Cloud Run URL, bucket name, KMS key info
```

**Resources provisioned:**
- Cloud SQL PostgreSQL (pgvector enabled)
- Cloud Storage bucket (CMEK encrypted)
- Cloud Run service (placeholder, updated in Phase 10)
- BigQuery dataset (audit logs)
- Cloud KMS key ring and key
- VPC with connector
- IAM service accounts and bindings

**Estimated monthly cost:** $180-450 depending on usage tier.

**Pass criteria:** `terraform apply` completes with no errors. All outputs populated.

---

## Phase 10 — Production Deployment

### Option A: Cloud Build (CI/CD — recommended)

```bash
# 10.1  Submit build
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_REGION=us-central1,_SERVICE_NAME=ragbox

# This executes 10 steps automatically:
#   1. npm ci
#   2. prisma generate
#   3. eslint
#   4. tsc --noEmit
#   5. jest --passWithNoTests
#   6. docker build
#   7. docker push to Artifact Registry
#   8. gcloud run deploy
#   9. prisma migrate deploy (against Cloud SQL)
#  10. Success notification
```

### Option B: Manual deployment

```bash
# 10.1  Tag and push Docker image
docker tag ragbox:latest gcr.io/YOUR_PROJECT/ragbox:latest
docker push gcr.io/YOUR_PROJECT/ragbox:latest

# 10.2  Deploy to Cloud Run
gcloud run deploy ragbox \
  --image gcr.io/YOUR_PROJECT/ragbox:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --cpu 2 \
  --memory 2Gi \
  --min-instances 0 \
  --max-instances 100 \
  --concurrency 80 \
  --timeout 300 \
  --vpc-connector ragbox-prod-connector \
  --service-account ragbox-prod-cloudrun@YOUR_PROJECT.iam.gserviceaccount.com \
  --set-env-vars "NODE_ENV=production"

# 10.3  Set secrets (use Secret Manager references)
gcloud run services update ragbox \
  --region us-central1 \
  --set-secrets "DATABASE_URL=ragbox-database-url:latest,NEXTAUTH_SECRET=ragbox-nextauth-secret:latest,OPENROUTER_API_KEY=ragbox-openrouter-key:latest"

# 10.4  Apply database migrations against production
DATABASE_URL=<production-connection-string> npm run db:migrate
```

**Pass criteria:** Cloud Run service is active. Deployment shows "Serving 100% of traffic."

---

## Phase 11 — Post-Deployment Verification

Run all checks against the production URL.

```bash
PROD_URL=https://ragbox-XXXXXX-uc.a.run.app  # from gcloud run output

# 11.1  Health check
curl -s $PROD_URL/api/health | jq .

# 11.2  System identity
curl -s $PROD_URL/api/about | jq .

# 11.3  Landing page renders
curl -s -o /dev/null -w "%{http_code}" $PROD_URL
# Expect: 200

# 11.4  Login page renders
curl -s -o /dev/null -w "%{http_code}" $PROD_URL/login
# Expect: 200

# 11.5  Auth endpoints respond
curl -s -o /dev/null -w "%{http_code}" $PROD_URL/api/auth/providers
# Expect: 200

# 11.6  Test waitlist signup
curl -s -X POST $PROD_URL/api/waitlist \
  -H "Content-Type: application/json" \
  -d '{"email":"deploy-test@ragbox.co","name":"Deploy Test"}' | jq .
```

### Authenticated feature tests (manual)

1. **Login flow** — Navigate to `/login`, sign in with Google OAuth, verify redirect to `/dashboard`
2. **Vault creation** — Create a new vault, verify it appears in the Vaults panel
3. **Document upload** — Drop a PDF/DOCX into Security Drop, verify ingestion completes
4. **RAG query** — Ask Mercury a question about the uploaded document, verify streaming response with citations
5. **Privilege toggle** — Enable privilege mode, verify border pulse appears, verify privileged documents become visible
6. **Audit log** — Navigate to `/dashboard/audit`, verify events logged for all actions above
7. **Voice** (if Deepgram configured) — Click voice button, speak a question, verify STT transcription and TTS response
8. **FORGE** (if templates exist) — Open Studio panel, select a template, generate a document
9. **Export** — Test audit PDF export, test GDPR data export

**Pass criteria:** All health checks return 200. Manual feature tests pass without errors. Audit log records all actions.

---

## Phase Summary & Dependency Graph

```
Phase 1: Install & Generate
    │
    v
Phase 2: Static Checks (type-check + lint)
    │
    v
Phase 3: Tests
    │
    v
Phase 4: Production Build
    │
    ├──────────────────────────┐
    v                          v
Phase 5: Database Setup    Phase 8: Docker Image
    │                          │
    v                          │
Phase 6: Env Config            │
    │                          │
    v                          │
Phase 7: Local Dev + UI        │
    │                          │
    │    Phase 9: Terraform ───┤
    │         │                │
    │         v                v
    │    Phase 10: Cloud Deploy
    │         │
    v         v
Phase 11: Post-Deploy Verification
```

Phases 5-7 (local) and Phases 8-9 (infra) can run in parallel. Phase 10 requires both paths to complete.

---

## Troubleshooting

### `prisma generate` fails
- Ensure `node_modules/` exists (run `npm install` first)
- Check `prisma/schema.prisma` has no syntax errors

### `npm run build` fails with "Module not found"
- Verify `next.config.js` has the module in `serverExternalPackages`
- Check `webpack.resolve.fallback` for Node.js built-ins

### Docker build fails at Prisma stage
- The Dockerfile copies `prisma/` before `npm ci` — ensure `schema.prisma` is committed
- Check that the Prisma binary target includes `linux-musl-openssl-3.0.x` for Alpine

### Terraform apply fails
- Verify all required APIs are enabled (step 9.2)
- Check IAM permissions on the service account running Terraform
- For Cloud SQL: pgvector extension must be enabled after instance creation

### Database migration fails
- Verify `DATABASE_URL` is reachable from your machine
- For Cloud SQL: use Cloud SQL Auth Proxy or VPC connector
- Check that pgvector extension is installed: `SELECT * FROM pg_extension WHERE extname = 'vector';`

### Cloud Run returns 503
- Check container logs: `gcloud run services logs read ragbox --region us-central1`
- Verify all Secret Manager references resolve
- Check VPC connector is attached and healthy
- Verify Cloud SQL instance accepts connections from the VPC

### Voice not working
- Deepgram requires HTTPS in production (Cloud Run provides this)
- Browser must grant microphone permission
- Check `DEEPGRAM_API_KEY` is set and valid

### Mercury refuses to answer (Silence Protocol)
- Confidence score below 0.85 threshold
- Upload more relevant documents to improve retrieval quality
- Check that document indexing completed (`indexStatus = 'Indexed'` in DocumentChunk)
