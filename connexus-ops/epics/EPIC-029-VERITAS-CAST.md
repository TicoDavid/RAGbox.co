# EPIC-029: VERITAS CAST

## Operation VERITAS Cast — From Vault to Voice, Every Word Proven

**Epic ID:** EPIC-029  
**Version:** 1.0 — Production-Ready Specification  
**Date:** March 7, 2026  
**Filed by:** Zane, PM  
**Owner:** David Pierce, CPO  
**Status:** Ready for immediate development

---

## CPO DIRECTIVE

> *"Take every RAG query result we produce and let the user turn it into a branded podcast or investigative video brief — with full Veritas traceability. This is the legitimate, enterprise-grade version. Every claim cited. Every source linked. Every generation logged immutably. Ship it as a new tool in the Studio Sidebar alongside Forge."*
>
> — David Pierce, CPO

---

## 1. Executive Summary

Veritas Cast adds a **one-click branded audio and video report generator** to RAGböx. Users trigger a Cast from any Mercury RAG query result. The system generates a structured podcast-style script via Gemini 2.5, synthesizes professional audio via GCP Cloud Text-to-Speech, assembles full production video with branded slides, animated citations, and intro/outro sequences via FFmpeg, then signs everything cryptographically and logs it to the Veritas immutable ledger.

The feature ships as a new tab in the **Studio Sidebar** (right panel, alongside Forge) and runs on a **4th Cloud Run microservice** (`cast-service`) with async job processing via Pub/Sub.

### Feature Name

**Veritas Cast**

### Tagline

*"From Vault to Voice — Every Word Proven"*

### One-Line Description

One-click generation of fully branded, professional podcast-style audio and video investigative reports — 100% grounded in RAGböx data, Self-RAG verified, and permanently traceable via the Veritas immutable ledger.

---

## 2. Business Purpose

Replaces the dangerous "untraceable content" concept with the enterprise-grade, auditable version: branded audio/video briefs for investor relations, legal discovery, executive briefings, compliance reporting, and client delivery. Every claim is traceable to source documents with cryptographic proof.

### Target Users

- **Attorneys** preparing case summary briefs for partners or clients
- **CFOs / IR leads** producing investor update podcasts from financial documents
- **Compliance officers** generating audit summary videos with full evidence trails
- **Consultants** delivering branded analysis packages to clients

### Revenue Impact

- Veritas Cast is a **Professional / Enterprise tier feature** ($399/$999 plans)
- Drives upgrade conversion from Starter ($149) tier
- Differentiator: no competitor offers RAG-grounded, cryptographically signed media generation

---

## 3. Success Metrics (Hard Requirements)

| Metric | Target |
|--------|--------|
| Citation accuracy | 100% of claims in generated Casts must reference Self-RAG-verified chunks |
| Veritas compliance | Every Cast has a permanent audit trail + chain-of-custody PDF |
| Audio generation (5 min) | ≤ 90 seconds end-to-end |
| Video generation (15 min) | ≤ 4 minutes end-to-end |
| Audio quality | Neural2 voice, 192kbps MP3, SSML prosody markers |
| Video quality | 1920×1080 H.264, branded slides, animated citation cards |
| Silence Protocol | If any Self-RAG score < 0.85 → Cast generation refused |
| Cryptographic signing | SHA-256 hash of all media files embedded in Veritas ledger |
| Signed URL security | Short-lived (15-60 min), generated on-demand, no pre-baked long URLs |

---

## 4. Architecture Overview

### 4.1 System Context — Where Veritas Cast Lives

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                             │
│                    (app.ragbox.co — Next.js 14)                  │
│                                                                  │
│  ┌──────────┐  ┌──────────────────┐  ┌────────────────────────┐ │
│  │  Vault   │  │    Mercury Chat  │  │   Studio Sidebar       │ │
│  │  (left)  │  │    (center)      │  │   ┌──────┐ ┌────────┐ │ │
│  │  420px   │  │    flexible      │  │   │Forge │ │ CAST ★ │ │ │
│  │          │  │                  │  │   │(tab) │ │ (tab)  │ │ │
│  │          │  │                  │  │   └──────┘ └────────┘ │ │
│  │          │  │                  │  │   380px               │ │
│  └──────────┘  └──────────────────┘  └────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────────┘
                           │
            HTTPS (Next.js API routes proxy)
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                  ▼
   ┌──────────┐     ┌──────────┐      ┌──────────────┐
   │ragbox-app│     │ragbox-   │      │mercury-voice │
   │Next.js 14│     │backend   │      │Inworld v0.8  │
   └──────────┘     │Go 1.25   │      └──────────────┘
                    └────┬─────┘
                         │ POST /api/chat (reuse existing RAG)
                         │ GET /api/documents/{id}/chunks
                         │
                    ┌────▼──────────────────┐
                    │   cast-service ★ NEW  │
                    │   Go 1.25             │
                    │   debian-slim + FFmpeg │
                    │   4 vCPU / 16 GiB     │
                    └────┬──────────────────┘
                         │
              ┌──────────┼──────────────┐
              ▼          ▼              ▼
        ┌──────────┐ ┌────────┐  ┌──────────┐
        │Vertex AI │ │Cloud   │  │Cloud     │
        │Gemini 2.5│ │TTS     │  │Storage   │
        │(scripts) │ │Neural2 │  │(media +  │
        └──────────┘ │(audio) │  │ CMEK)    │
                     └────────┘  └──────────┘
                                      │
                              ┌───────┴────────┐
                              │  BigQuery      │
                              │  (Veritas      │
                              │   audit ext)   │
                              └────────────────┘
```

### 4.2 Async Job Flow

```
User clicks "Generate Veritas Cast"
         │
         ▼
[ragbox-app] POST /api/cast/generate
  → validates auth, plan tier, query confidence
  → returns 202 Accepted + cast_id
  → publishes to Pub/Sub topic: veritas-cast-jobs
         │
         ▼
[Pub/Sub: veritas-cast-jobs]
  → push subscription to cast-service
         │
         ▼
[cast-service] receives job
  │
  ├─ Step 1: Fetch Self-RAG result + citations from ragbox-backend
  │
  ├─ Step 2: Generate structured podcast script (Gemini 2.5 Pro)
  │          → JSON schema enforced → SSML + plain text per segment
  │
  ├─ Step 3: Synthesize audio (Cloud TTS Long Audio API → GCS)
  │          → Neural2 voice + SSML prosody
  │          → FFmpeg: mix intro/outro music stings
  │
  ├─ Step 4: Generate branded slide PNGs (fogleman/gg)
  │          → 1920×1080, Obsidian Gold theme, citation cards
  │
  ├─ Step 5: Assemble video (FFmpeg)
  │          → slides + audio + text overlays + logo watermark
  │          → H.264 CRF 20, AAC 192kbps
  │
  ├─ Step 6: Sign media (SHA-256 hash during upload)
  │          → Generate chain-of-custody PDF (maroto v2)
  │          → Upload all to Cloud Storage (CMEK encrypted)
  │
  └─ Step 7: Log to Veritas (BigQuery streaming insert)
             → Update cast status in PostgreSQL → notify frontend
```

---

## 5. Integration Points (Per AS-BUILT Section 19)

| Integration Pattern | Reference | What We Do |
|---|---|---|
| **Option A: New API Endpoint** | Section 19, Option A | New Next.js proxy routes at `src/app/api/cast/` → Go cast-service |
| **Option B: New Dashboard Panel** | Section 19, Option B | New tab in Studio Sidebar at `src/components/dashboard/cast/` + `castStore.ts` |
| **Option D: Extend RAG Pipeline** | Section 19, Option D | Read-only — consume existing Self-RAG results, do not modify pipeline |
| **New: 4th Cloud Run Service** | Extension of existing pattern | `cast-service` follows ragbox-backend patterns (chi, pgx, Firebase auth) |

---

## 6. New GCP Services Required

| Service | API to Enable | Purpose | Already Active? |
|---------|--------------|---------|-----------------|
| Cloud Text-to-Speech | `texttospeech.googleapis.com` | Audio synthesis | **No — must enable** |
| Cloud Pub/Sub | `pubsub.googleapis.com` | Async job queue | **No — must enable** |
| Vertex AI (Gemini 2.5) | Already enabled | Script generation | Yes (existing) |
| Cloud Storage | Already enabled | Media file storage | Yes (existing, new bucket) |
| BigQuery | Already enabled | Veritas audit extension | Yes (existing, schema extension) |
| Cloud KMS | Already enabled | CMEK for media bucket | Yes (existing, new key) |

---

## 7. New Secrets (GCP Secret Manager)

| Secret Name | Purpose | Consumer |
|-------------|---------|----------|
| `cast-service-url` | Cast service internal URL | ragbox-app (proxy) |
| `cast-internal-auth-secret` | Service-to-service auth (cast ↔ backend) | cast-service, ragbox-backend |
| `cast-sendgrid-api-key` | Email delivery of Cast reports | cast-service |
| `cast-branding-bucket` | GCS bucket for org branding assets | cast-service |

---

## 8. Database Schema Additions

### 8.1 PostgreSQL — New Tables (via Prisma migration, pgx runtime access)

```prisma
model VeritasCast {
  id              String   @id @default(uuid())
  tenantId        String
  userId          String
  queryId         String
  status          String   @default("pending") // pending | scripting | synthesizing | assembling | signing | complete | failed
  format          String   // audio | video | both
  lengthMinutes   Int      // 5 | 15
  voiceId         String   @default("en-US-Neural2-D")
  scriptJson      Json?
  audioUrl        String?
  videoUrl        String?
  veritasPdfUrl   String?
  contentHash     String?  // SHA-256 of all media
  confidenceScore Float?
  errorMessage    String?
  createdAt       DateTime @default(now())
  completedAt     DateTime?
  expiresAt       DateTime // default: createdAt + 90 days
  
  tenant          Tenant   @relation(fields: [tenantId], references: [id])
  user            User     @relation(fields: [userId], references: [id])
  query           Query    @relation(fields: [queryId], references: [id])
  steps           VeritasCastStep[]
  
  @@index([tenantId, userId])
  @@index([status])
}

model VeritasCastStep {
  id              String   @id @default(uuid())
  castId          String
  stepName        String   // script_generated | audio_synthesized | video_assembled | media_signed | media_distributed
  inputHash       String?
  outputHash      String?
  durationMs      Int?
  metadata        Json?    // step-specific data (model used, voice config, etc.)
  timestamp       DateTime @default(now())
  
  cast            VeritasCast @relation(fields: [castId], references: [id])
  
  @@index([castId])
}

model CastBranding {
  id              String   @id @default(uuid())
  tenantId        String   @unique
  logoGcsPath     String?
  primaryColor    String   @default("#F59E0B")
  fontFamily      String   @default("Inter")
  introMusicPath  String?
  outroText       String   @default("Generated by RAGböx Veritas • Every claim verified")
  
  tenant          Tenant   @relation(fields: [tenantId], references: [id])
}
```

### 8.2 BigQuery — Veritas Audit Extension

New event types added to existing `veritas_audit` table via JSON `event_data` column:

| Event Type | event_data Fields |
|------------|-------------------|
| `cast.initiated` | `{cast_id, query_id, format, voice_id}` |
| `cast.script_generated` | `{cast_id, model, token_count, segment_count}` |
| `cast.audio_synthesized` | `{cast_id, voice_id, duration_seconds, char_count}` |
| `cast.video_assembled` | `{cast_id, resolution, duration_seconds, frame_count}` |
| `cast.media_signed` | `{cast_id, content_hash, pdf_hash}` |
| `cast.distributed` | `{cast_id, recipient_email, signed_url_expiry}` |
| `cast.accessed` | `{cast_id, accessor_ip, accessor_agent}` |
| `cast.expired` | `{cast_id, media_deleted}` |

Hash chain computation includes: `SHA256(event_id | timestamp | event_type | schema_version | cast_id | content_hash | JSON_CANONICAL(event_data) | previous_event_hash)`

---

## 9. Terraform Additions

### 9.1 New Resources

```
terraform/
├── cast.tf              # Cloud Run cast-service
├── cast-pubsub.tf       # Pub/Sub topic + subscription + dead letter
├── cast-storage.tf      # New GCS bucket for media (CMEK)
├── cast-kms.tf          # New KMS key for media bucket
└── cast-iam.tf          # Service account + roles
```

| Resource | Type | Key Config |
|----------|------|------------|
| `cast-service` | `google_cloud_run_v2_service` | 4 vCPU, 16 GiB, debian-slim+FFmpeg, `cpu_idle=false`, concurrency=1, timeout=600s |
| `veritas-cast-jobs` | `google_pubsub_topic` | Standard topic |
| `cast-push-sub` | `google_pubsub_subscription` | Push to cast-service URL, OIDC auth, ack_deadline=300s, dead_letter after 5 retries |
| `cast-dead-letter` | `google_pubsub_topic` | Dead letter for failed casts |
| `ragbox-cast-media` | `google_storage_bucket` | us-east4, CMEK, lifecycle: delete after 90 days |
| `cast-media-key` | `google_kms_crypto_key` | 90-day rotation, purpose: ENCRYPT_DECRYPT |
| `cast-sa` | `google_service_account` | `cast-sa@ragbox-sovereign-prod.iam.gserviceaccount.com` |

### 9.2 IAM Bindings for cast-sa

| Role | Resource | Purpose |
|------|----------|---------|
| `roles/aiplatform.user` | Project | Gemini 2.5 access |
| `roles/texttospeech.user` | Project | Cloud TTS access |
| `roles/storage.objectAdmin` | `ragbox-cast-media` bucket | Read/write media |
| `roles/cloudkms.cryptoKeyEncrypterDecrypter` | `cast-media-key` | CMEK |
| `roles/bigquery.dataEditor` | `veritas_audit` dataset | Streaming inserts |
| `roles/run.invoker` | `cast-service` | Pub/Sub push authentication |

---

## 10. New Go Microservice: cast-service

### 10.1 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | Go | 1.25 |
| HTTP Router | chi | 5.2.5 |
| Database | pgx/v5 | 5.8.0 |
| Gemini SDK | `google.golang.org/genai` | Latest (NEW — not deprecated vertexai SDK) |
| TTS SDK | `cloud.google.com/go/texttospeech/apiv1` | v1.16.0 |
| Storage SDK | `cloud.google.com/go/storage` | 1.56.0 |
| BigQuery SDK | `cloud.google.com/go/bigquery` | Latest |
| Pub/Sub SDK | `cloud.google.com/go/pubsub` | Latest |
| FFmpeg wrapper | `github.com/u2takey/ffmpeg-go` | Latest |
| 2D graphics | `github.com/fogleman/gg` | Latest |
| PDF generation | `github.com/johnfercher/maroto/v2` | Latest |
| Firebase Auth | `firebase.google.com/go/v4` | 4.19.0 |
| Container base | `debian:bookworm-slim` + FFmpeg | — |

### 10.2 Service Structure

```
cast-service/
├── cmd/server/main.go           # Entry point, chi router, health check
├── internal/
│   ├── config/config.go         # Environment + Secret Manager
│   ├── handler/
│   │   ├── cast.go              # POST /api/cast/generate, GET /api/cast/{id}, GET /api/cast/list
│   │   ├── branding.go          # GET/PUT /api/cast/branding
│   │   ├── media.go             # GET /api/cast/{id}/audio, GET /api/cast/{id}/video
│   │   └── pubsub.go            # POST /internal/cast/process (Pub/Sub push endpoint)
│   ├── service/
│   │   ├── scriptwriter.go      # Gemini 2.5 Pro script generation
│   │   ├── tts.go               # Cloud TTS Long Audio synthesis
│   │   ├── audiomixer.go        # FFmpeg: intro/outro mixing, normalization
│   │   ├── slidegen.go          # fogleman/gg: branded 1920×1080 PNGs
│   │   ├── videoassembler.go    # FFmpeg: slides + audio → H.264 MP4
│   │   ├── veritassigner.go     # SHA-256, chain-of-custody PDF
│   │   └── distributor.go       # Signed URLs, SendGrid email
│   ├── repository/
│   │   ├── cast.go              # VeritasCast CRUD (pgx)
│   │   └── audit.go             # BigQuery streaming inserts
│   ├── model/
│   │   ├── cast.go              # Domain models
│   │   └── script.go            # PodcastScript, ScriptSegment, Citation
│   ├── middleware/
│   │   ├── auth.go              # InternalOrFirebase (same pattern as ragbox-backend)
│   │   └── logging.go           # Structured JSON slog
│   └── gcpclient/
│       ├── genai.go             # Gemini 2.5 client (NEW SDK)
│       ├── tts.go               # Cloud TTS client
│       ├── storage.go           # GCS signed URLs, upload
│       └── bigquery.go          # Streaming insert client
├── prompts/
│   ├── script_podcast.txt       # Podcast script generation prompt
│   ├── script_executive.txt     # Executive briefing prompt
│   └── storyboard.txt           # Video storyboard generation prompt
├── assets/
│   ├── fonts/                   # Inter, Space Grotesk (TrueType)
│   ├── templates/               # Slide templates (background PNGs)
│   └── audio/                   # Default intro/outro stings (MP3)
├── Dockerfile                   # Multi-stage: Go build → debian-slim + FFmpeg
├── cloudbuild-cast.yaml         # CI/CD pipeline
└── go.mod
```

### 10.3 Dockerfile (Critical — FFmpeg requires debian-slim, not distroless)

```dockerfile
FROM golang:1.25 AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o cast-service ./cmd/server/

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg fonts-liberation ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/cast-service /usr/local/bin/cast-service
COPY --from=build /app/prompts /app/prompts
COPY --from=build /app/assets /app/assets
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/cast-service"]
```

### 10.4 API Endpoints (cast-service: 8 routes)

| Method | Path | Timeout | Auth | Purpose |
|--------|------|---------|------|---------|
| POST | `/api/cast/generate` | 30s | Firebase JWT | Initiate Cast — validates, publishes to Pub/Sub, returns 202 + cast_id |
| GET | `/api/cast/{id}` | 30s | Firebase JWT | Get Cast status + metadata |
| GET | `/api/cast/list` | 30s | Firebase JWT | List user's Casts (paginated) |
| GET | `/api/cast/{id}/audio` | 30s | Firebase JWT | Generate short-lived signed URL for audio |
| GET | `/api/cast/{id}/video` | 30s | Firebase JWT | Generate short-lived signed URL for video |
| GET | `/api/cast/{id}/report` | 30s | Firebase JWT | Generate short-lived signed URL for Veritas PDF |
| PUT | `/api/cast/branding` | 30s | Firebase JWT | Update org branding config |
| POST | `/internal/cast/process` | 600s | Pub/Sub OIDC | Async worker endpoint (Pub/Sub push) |
| GET | `/health` | 5s | None | Health check |

### 10.5 Prompt Templates

**Script Generation Prompt (script_podcast.txt):**

```
You are a world-class investigative journalist producing a professional podcast brief.

CONTEXT (Self-RAG verified, confidence ≥ 0.85):
{context_json}

REFLECTION SCORES:
{reflection_json}

CITATIONS:
{citations_json}

INSTRUCTIONS:
1. Write a professional {length}-minute podcast script using ONLY the provided context.
2. Every factual claim MUST reference the exact citation ID in [brackets] — e.g., [CIT-1].
3. Use natural spoken language — conversational but authoritative.
4. Include SSML tags for natural delivery:
   - <break time="500ms"/> between sentences
   - <break time="1s"/> between sections
   - <emphasis level="strong">key terms</emphasis>
   - <prosody rate="slow">critical findings</prosody>
5. Structure: Intro → Key Findings → Analysis → Implications → Closing
6. End with: "This brief was generated by RAGböx Veritas. Every claim is traceable to its source document."
7. Do NOT fabricate, speculate, or add information not present in the context.

OUTPUT FORMAT: Respond ONLY with valid JSON matching this exact schema.
```

---

## 11. Frontend Changes

### 11.1 New Components

```
src/components/dashboard/cast/
├── CastPanel.tsx              # Main panel — tab in Studio Sidebar
├── CastTrigger.tsx            # "Generate Veritas Cast" button (appears on Mercury results)
├── CastConfigModal.tsx        # Format, length, voice selection
├── CastProgressModal.tsx      # Animated progress: Scripting → Synthesizing → Assembling → Signing
├── CastPlayer.tsx             # Audio/video player with inline citation cards
├── CastList.tsx               # "My Veritas Casts" — list with status, play, download
├── CastBrandingSettings.tsx   # Org branding config (logo, colors, intro music)
└── CastVeritasReport.tsx      # Inline preview of chain-of-custody PDF
```

### 11.2 New Zustand Store

```typescript
// src/stores/castStore.ts
interface CastStore {
  casts: VeritasCast[]
  activeCast: VeritasCast | null
  isGenerating: boolean
  generationStep: 'idle' | 'scripting' | 'synthesizing' | 'assembling' | 'signing' | 'complete' | 'failed'
  branding: CastBranding | null
  
  generateCast: (queryId: string, config: CastConfig) => Promise<string>
  fetchCasts: () => Promise<void>
  fetchCast: (castId: string) => Promise<void>
  getAudioUrl: (castId: string) => Promise<string>
  getVideoUrl: (castId: string) => Promise<string>
  getReportUrl: (castId: string) => Promise<string>
  pollCastStatus: (castId: string) => void
  updateBranding: (branding: Partial<CastBranding>) => Promise<void>
}
```

### 11.3 New Next.js API Routes (7 proxy routes)

```
src/app/api/cast/
├── generate/route.ts          # POST → cast-service /api/cast/generate
├── [id]/route.ts              # GET → cast-service /api/cast/{id}
├── list/route.ts              # GET → cast-service /api/cast/list
├── [id]/audio/route.ts        # GET → cast-service /api/cast/{id}/audio
├── [id]/video/route.ts        # GET → cast-service /api/cast/{id}/video
├── [id]/report/route.ts       # GET → cast-service /api/cast/{id}/report
└── branding/route.ts          # PUT → cast-service /api/cast/branding
```

### 11.4 UI Integration Points

1. **Mercury Chat**: After any RAG response with confidence ≥ 0.85, show a subtle **"Generate Veritas Cast"** button (Lucide `podcast` icon) beneath the response
2. **Studio Sidebar**: New **"Cast"** tab alongside Forge, using Lucide `radio` icon in the collapsed rail
3. **Cast Config Modal**: Opens on trigger — user selects format (Audio / Video / Both), length (5 min / 15 min), voice
4. **Progress Modal**: Full-screen overlay with animated steps: "Writing script… Rendering voice… Assembling video… Stamping Veritas proof…"
5. **Cast Player**: Custom player in Cast panel with waveform visualization, citation cards that appear at timestamps and link to source docs in the Vault
6. **Theme compliance**: All UI follows Obsidian Gold — `#0A192F` background, `#2463EB` accent, Lucide icons, CSS custom properties

---

## 12. Severity Breakdown

| Severity | Count | Description |
|----------|-------|-------------|
| **P0 — Critical** | 4 stories | Core pipeline: script gen, TTS, video assembly, Veritas signing |
| **P1 — High** | 6 stories | Infrastructure, UI, branding, distribution, audit |
| **P2 — Medium** | 4 stories | Polish, settings, Cast management, advanced video features |
| **P3 — Low** | 1 story | Email delivery templates |

**Total: 15 stories across 5 tracks**

---

## 13. Track 1: Infrastructure & Service Skeleton (P0/P1)

Sets up the 4th Cloud Run service, Pub/Sub, Terraform, CI/CD, and database schema.

| Story | Title | Sev | Agent | Points |
|-------|-------|-----|-------|--------|
| **STORY-200** | Terraform: cast-service Cloud Run + Pub/Sub + GCS bucket + KMS + IAM | **P0** | ADAM | 8 |
| **STORY-201** | cast-service Go skeleton — chi router, health check, Firebase auth, Pub/Sub handler | **P0** | Sheldon | 5 |
| **STORY-202** | Database migration — VeritasCast + VeritasCastStep + CastBranding tables | **P1** | Sheldon | 3 |
| **STORY-203** | CI/CD pipeline — cloudbuild-cast.yaml with Docker build + deploy + smoke test | **P1** | ADAM | 3 |

### STORY-200: Terraform Infrastructure (ADAM)

**Acceptance Criteria:**
- [ ] `cast-service` Cloud Run service: 4 vCPU, 16 GiB, debian-slim base, `cpu_idle=false`, concurrency=1, min_instances=0, max_instances=5, timeout=600s
- [ ] `veritas-cast-jobs` Pub/Sub topic with `cast-push-sub` push subscription → cast-service `/internal/cast/process` endpoint, OIDC auth, ack_deadline=300s
- [ ] `cast-dead-letter` Pub/Sub topic, max delivery attempts=5
- [ ] `ragbox-cast-media` GCS bucket in us-east4, CMEK with `cast-media-key`, lifecycle rule: delete after 90 days
- [ ] `cast-sa` service account with roles per Section 9.2
- [ ] VPC connector attached (same `ragbox-prod-connector`)
- [ ] All secrets created in Secret Manager
- [ ] `texttospeech.googleapis.com` and `pubsub.googleapis.com` APIs enabled

### STORY-201: cast-service Go Skeleton (Sheldon)

**Acceptance Criteria:**
- [ ] chi router with middleware stack matching ragbox-backend pattern (SecurityHeaders → Logging → CORS → Auth → RateLimit → Timeout)
- [ ] All 9 routes registered per Section 10.4
- [ ] Pub/Sub push endpoint at `/internal/cast/process` with message parsing and idempotency check on cast_id
- [ ] Firebase JWT verification reusing same pattern as ragbox-backend
- [ ] `x-internal-auth` support for service-to-service calls from ragbox-app
- [ ] GCP client initialization: genai, tts, storage, bigquery
- [ ] Health check at `/health` returning 200
- [ ] Prometheus metrics: `cast_generation_total`, `cast_generation_duration_seconds`, `cast_generation_errors_total`
- [ ] **CRITICAL:** Use `google.golang.org/genai` for Gemini SDK — NOT the deprecated `cloud.google.com/go/vertexai/genai`

### STORY-202: Database Migration (Sheldon)

**Acceptance Criteria:**
- [ ] Prisma schema additions per Section 8.1 — VeritasCast, VeritasCastStep, CastBranding
- [ ] pgx repository with prepared statements for all CRUD operations
- [ ] Idempotent migration SQL that can run multiple times safely
- [ ] BigQuery schema extension: add `event_data JSON` column to veritas_audit table via `ALTER TABLE ADD COLUMN IF NOT EXISTS`
- [ ] BigQuery new event types per Section 8.2 documented in code comments

---

## 14. Track 2: Cast Generation Pipeline (P0)

The core engine — script generation, audio synthesis, video assembly, and cryptographic signing.

| Story | Title | Sev | Agent | Points |
|-------|-------|-----|-------|--------|
| **STORY-204** | Script Writer — Gemini 2.5 Pro structured JSON script generation with SSML | **P0** | Sheldon | 8 |
| **STORY-205** | TTS Renderer — Cloud TTS Long Audio API with Neural2 voice + FFmpeg audio mixing | **P0** | Sheldon | 8 |
| **STORY-206** | Video Assembler — Branded slide generation (gg) + FFmpeg composite to H.264 MP4 | **P0** | Sheldon | 13 |
| **STORY-207** | Veritas Signer — SHA-256 media hashing + chain-of-custody PDF + BigQuery audit log | **P0** | Sheldon | 5 |

### STORY-204: Script Writer (Sheldon)

**Pain:** Need to convert Self-RAG output into a structured, broadcast-quality podcast script with SSML markers and citation references.

**Implementation:**
1. Fetch Self-RAG result + citations via internal call to ragbox-backend `/api/chat` (reuse query_id)
2. Call Gemini 2.5 Pro via `google.golang.org/genai` with:
   - `ResponseMIMEType: "application/json"`
   - `ResponseSchema` enforcing PodcastScript struct (Section 10.5)
   - Temperature: 0.2 for consistency
   - Prompt from `prompts/script_podcast.txt`
3. Validate returned JSON against schema
4. Validate SSML segments with XML parser
5. Log `cast.script_generated` to BigQuery

**Acceptance Criteria:**
- [ ] Structured JSON output with segments containing both plain text and SSML
- [ ] Every factual claim references a valid citation ID from the original query
- [ ] Silence Protocol: if source query confidence < 0.85, refuse generation with clear error
- [ ] Script length matches requested duration (5 min ≈ 750 words, 15 min ≈ 2,250 words)
- [ ] SSML validated against Cloud TTS supported tags
- [ ] Step logged to VeritasCastStep with model, token count, duration

### STORY-205: TTS Renderer (Sheldon)

**Pain:** Need to synthesize 5-15 minute professional audio from SSML script, including branded intro/outro music.

**Implementation:**
1. Use Cloud TTS **Long Audio Synthesis API** (`SynthesizeLongAudio`) — writes async to GCS
   - Voice: Neural2 (default: `en-US-Neural2-D` male, `en-US-Neural2-F` female)
   - Audio encoding: MP3 at 192kbps
   - SSML input with `<break>`, `<emphasis>`, `<prosody>` markers
2. Poll Long Audio operation for completion
3. Download synthesized audio from GCS temp location
4. FFmpeg post-processing:
   - Mix intro music sting (3s fade-in under narration start)
   - Mix outro music sting (3s fade-out under closing)
   - Normalize audio levels (loudnorm filter, -16 LUFS broadcast standard)
   - Output: MP3 192kbps, 24kHz
5. Upload final audio to `ragbox-cast-media` bucket with CMEK

**Acceptance Criteria:**
- [ ] Audio output sounds professional — natural pauses, emphasis on key terms
- [ ] Intro/outro music stings mixed at -15dB below narration
- [ ] Audio normalized to broadcast standard (-16 LUFS)
- [ ] 5-min Cast audio ≤ 90s generation time
- [ ] CMEK encryption verified on stored object
- [ ] Step logged with voice_id, duration_seconds, character_count

**Key Constraint:** Standard TTS has 5,000-byte SSML limit. Long Audio API supports up to 1,000,000 bytes but is async (writes to GCS). For scripts exceeding 5,000 bytes SSML, MUST use Long Audio API.

### STORY-206: Video Assembler (Sheldon)

**Pain:** Need full production video with branded slides, animated citation cards, text overlays, logo watermark, and smooth transitions.

**Implementation:**
1. **Storyboard generation**: Call Gemini 2.5 Pro with script JSON to produce storyboard JSON:
   - Slide count, text per slide, which citations appear when, transition timings
2. **Slide PNG generation** (fogleman/gg):
   - Canvas: 1920×1080
   - Background: `#0A192F` (Primary) with subtle gradient
   - Title card: Section headline in Inter 48px bold, `#E6F1FF`
   - Body text: Key findings in Inter 24px, `#8892B0`
   - Citation cards: Rounded rectangle, `#112240` fill, amber `#F59E0B` left border, document name + page number
   - Logo watermark: RAGböx logo at bottom-right, 40% opacity
   - Intro slide: Full Obsidian Gold branding — org logo (if set), Cast title, date
   - Outro slide: "Every claim verified" + Veritas hash + QR code linking to chain-of-custody PDF
3. **FFmpeg video assembly**:
   ```
   slides (PNGs) → concat with crossfade transitions (0.5s)
   + audio track (from STORY-205)
   + drawtext filter for animated citation popups
   + overlay filter for logo watermark
   → H.264 libx264 CRF 20, preset fast, AAC 192kbps
   → -movflags +faststart for web playback
   → 1920×1080, 30fps
   ```
4. Upload final MP4 to `ragbox-cast-media` with CMEK

**Acceptance Criteria:**
- [ ] Video plays correctly in browser (H.264 + AAC + faststart)
- [ ] 1920×1080 resolution, professional quality
- [ ] Obsidian Gold design system applied — correct colors, fonts, spacing
- [ ] Citation cards appear at correct timestamps matching audio narration
- [ ] Logo watermark visible but non-intrusive (40% opacity, bottom-right)
- [ ] Smooth crossfade transitions between slides
- [ ] Intro slide with branding, outro slide with Veritas hash
- [ ] 15-min video ≤ 4 minutes generation time on 4 vCPU
- [ ] Step logged with resolution, duration, frame_count

### STORY-207: Veritas Signer (Sheldon)

**Pain:** Every Cast must be cryptographically signed with a full chain-of-custody PDF — this is the compliance differentiator.

**Implementation:**
1. **SHA-256 hashing**: Use `io.TeeReader` during Cloud Storage upload to hash simultaneously
   - Hash audio bytes, video bytes, and PDF bytes
   - Concatenate all hashes into a single content_hash: `SHA256(audio_hash + video_hash + pdf_hash)`
2. **Chain-of-custody PDF** (maroto v2):
   - Page 1: Cover — RAGböx logo, Cast title, date, content_hash, QR code
   - Page 2: Full podcast script with live hyperlinks — each citation links to `app.ragbox.co/dashboard?doc={document_id}&page={page_number}`
   - Page 3: Reflection scores table — relevance, support, completeness per chunk
   - Page 4: Chain-of-custody timeline — every VeritasCastStep with timestamps and hashes
   - Page 5: Cryptographic certificate — content_hash, signing timestamp, user who initiated
   - Footer: "This document is part of the RAGböx Veritas immutable audit trail. Tampering with this record is detectable."
3. **BigQuery streaming insert**: Log `cast.media_signed` with content_hash, pdf_hash
4. **FFmpeg metadata embedding**: Write content_hash and cast_id into MP4/MP3 metadata fields

**Acceptance Criteria:**
- [ ] SHA-256 hash computed during upload (single pass, no re-read)
- [ ] PDF contains all citation hyperlinks that resolve to correct Vault documents
- [ ] PDF contains QR code that resolves to the Cast detail page
- [ ] BigQuery event logged with full hash chain
- [ ] MP4 metadata contains `comment` field with JSON: `{cast_id, content_hash, generated_by}`
- [ ] MP3 ID3v2 TXXX frame contains same metadata

---

## 15. Track 3: Frontend UI (P1/P2)

| Story | Title | Sev | Agent | Points |
|-------|-------|-----|-------|--------|
| **STORY-208** | Cast tab in Studio Sidebar — panel, trigger button, config modal | **P1** | Jordan | 8 |
| **STORY-209** | Cast progress modal with animated step indicators | **P1** | Jordan | 3 |
| **STORY-210** | Cast player — audio/video playback with inline citation cards | **P1** | Jordan | 8 |
| **STORY-211** | Cast list — "My Veritas Casts" with status, play, download, share | **P2** | Jordan | 5 |
| **STORY-212** | Cast branding settings — logo upload, color picker, intro music | **P2** | Jordan | 3 |

### STORY-208: Cast Tab in Studio Sidebar (Jordan)

**Implementation:**
1. Add `CastPanel.tsx` to `src/components/dashboard/cast/`
2. Register in `DashboardLayout.tsx` as new tab in right panel rail
3. Collapsed rail icon: Lucide `radio` (24px, `#8892B0`, active: `#2463EB`)
4. Create `castStore.ts` with state per Section 11.2
5. Add `CastTrigger.tsx` button that renders below Mercury RAG responses when confidence ≥ 0.85
6. `CastConfigModal.tsx`:
   - Format: Audio / Video / Both (radio group)
   - Length: 5 min / 15 min (toggle)
   - Voice: Dropdown of available Neural2 voices
   - "Generate Cast" button → calls `castStore.generateCast()`
7. Wire all 7 Next.js API proxy routes

**Acceptance Criteria:**
- [ ] Cast tab visible in Studio Sidebar rail, toggles panel correctly
- [ ] "Generate Veritas Cast" button appears only on high-confidence Mercury results
- [ ] Config modal follows Obsidian Gold — `#112240` surface, `#2463EB` buttons
- [ ] All interactions respect CSS custom property theme system (Cobalt/Noir/Forest/Obsidian)
- [ ] Responsive: panel collapses to 56px rail on smaller screens

### STORY-210: Cast Player (Jordan)

**Implementation:**
1. Custom audio player with waveform visualization (Web Audio API)
2. Video player using native `<video>` with custom Obsidian Gold controls
3. Citation card overlay: when a citation is spoken in audio, a card slides in showing document name, page, and excerpt
4. Click on citation card → opens document in Vault at the referenced page
5. Download buttons: Audio (MP3), Video (MP4), Veritas Report (PDF)

**Acceptance Criteria:**
- [ ] Audio plays with waveform visualization
- [ ] Video plays inline in the Cast panel
- [ ] Citation cards appear at correct timestamps (keyed to script segment timings)
- [ ] Clicking a citation navigates to the source document in the Vault
- [ ] Download buttons generate fresh short-lived signed URLs (not pre-cached)

---

## 16. Track 4: Distribution & Access Control (P1/P2)

| Story | Title | Sev | Agent | Points |
|-------|-------|-----|-------|--------|
| **STORY-213** | Signed URL access layer — short-lived URLs, on-demand generation, access logging | **P1** | Sheldon | 5 |
| **STORY-214** | Email delivery — branded email with Cast link via SendGrid | **P3** | Sarah | 3 |

### STORY-213: Signed URL Access Layer (Sheldon)

**Pain:** V4 signed URLs cannot be revoked once issued. Must implement a proxy-based access control layer.

**Implementation:**
1. Store access grants in PostgreSQL: `cast_id`, `user_id`, `revoked_at`, `expires_at`
2. When user requests audio/video/report: check grant status → if active, generate fresh V4 signed URL (15-min expiry) → return URL → log `cast.accessed` to BigQuery
3. "Revoke Access" endpoint: sets `revoked_at` on grant → subsequent URL requests return 403
4. For external sharing: generate one-time share token → recipient hits `/api/cast/share/{token}` → validates token → generates signed URL → logs access

**Acceptance Criteria:**
- [ ] Signed URLs expire after 15 minutes
- [ ] Revoked casts return 403 on all media endpoints
- [ ] Every access logged to BigQuery with accessor IP and user agent
- [ ] External share tokens are single-use and expire after 24 hours

---

## 17. Track 5: Testing & Certification (P1)

| Story | Title | Sev | Agent | Points |
|-------|-------|-----|-------|--------|
| **STORY-215** | Unit + integration tests for cast-service — all services, handlers, repository | **P1** | Sarah | 8 |
| **STORY-216** | End-to-end Cast generation test — audio + video + Veritas PDF on sample query | **P1** | Sarah | 5 |

### STORY-215: Test Suite (Sarah)

**Acceptance Criteria:**
- [ ] Unit tests for scriptwriter (mock Gemini, validate JSON schema output)
- [ ] Unit tests for veritassigner (deterministic SHA-256 hashing)
- [ ] Integration tests for TTS (mock Cloud TTS, validate SSML input)
- [ ] Integration tests for video assembler (mock FFmpeg, validate command construction)
- [ ] Repository tests against test PostgreSQL instance
- [ ] Minimum 80% code coverage on cast-service

### STORY-216: E2E Certification (Sarah + Dr. Insane)

**Acceptance Criteria:**
- [ ] Generate 5-min audio Cast from sample legal document set
- [ ] Generate 15-min video Cast from sample financial document set
- [ ] Verify all citations in Cast match source documents
- [ ] Verify Veritas PDF contains correct hashes and hyperlinks
- [ ] Verify BigQuery audit trail contains all 7 event types
- [ ] Verify Silence Protocol blocks Cast when confidence < 0.85
- [ ] Performance: audio ≤ 90s, video ≤ 4 min
- [ ] Dr. Insane signs off on full certification

---

## 18. Agent Assignment Summary

| Agent | Stories | Points | Scope |
|-------|---------|--------|-------|
| **Sheldon** | 8 | 52 | Go microservice, Gemini SDK, TTS, video assembly, Veritas signer, signed URLs |
| **Jordan** | 5 | 27 | Studio Sidebar UI, Cast player, progress modal, branding settings |
| **Sarah** | 3 | 16 | Tests, e2e certification, email delivery |
| **ADAM** | 2 | 11 | Terraform (Cloud Run, Pub/Sub, GCS, KMS, IAM), CI/CD pipeline |
| **Dr. Insane** | 0 (+cert) | — | Final EPIC-029 certification after all tracks complete |
| **Zane** | 0 (+coord) | — | Session coordination, story handoffs, documentation |
| **CPO** | 0 (+decisions) | — | Voice selection approval, branding defaults, tier gating |

**Total: 15 stories, 106 story points**

---

## 19. Execution Phases

### Phase 1 — Foundation (P0 Infrastructure)

**Stories:** 200, 201, 202, 203  
**Agents:** ADAM + Sheldon in parallel  
**Target:** 1 session  
**Gate:** cast-service deployed to Cloud Run with health check passing, Pub/Sub topic created, database migrated

### Phase 2 — Core Pipeline (P0 Generation)

**Stories:** 204, 205, 206, 207  
**Agent:** Sheldon (sequential — each step depends on previous)  
**Target:** 2-3 sessions  
**Gate:** End-to-end Cast generation working: query → script → audio → video → signed → stored

### Phase 3 — Frontend & Distribution (P1)

**Stories:** 208, 209, 210, 213  
**Agents:** Jordan + Sheldon in parallel  
**Target:** 1-2 sessions  
**Gate:** User can trigger Cast from Mercury, see progress, play result, download media

### Phase 4 — Polish & Settings (P2/P3)

**Stories:** 211, 212, 214  
**Agents:** Jordan + Sarah  
**Target:** 1 session  
**Gate:** Cast list, branding settings, email delivery all functional

### Phase 5 — Test & Certify

**Stories:** 215, 216  
**Agents:** Sarah + Dr. Insane  
**Target:** 1 session  
**Gate:** All tests passing, full certification signed off, EPIC-029 closed

---

## 20. Estimated Cost (Monthly, 500 Casts)

| Service | Cost | Notes |
|---------|------|-------|
| Cloud TTS (Neural2) | $48.80 | 4.05M characters after 1M free tier |
| Vertex AI Gemini 2.5 Pro | $31.25 | 500 scripts × ~8K tokens each |
| Cloud Run (cast-service) | $21–46 | 4 vCPU/16 GiB, ~200 video jobs × 10 min |
| Cloud Storage | $5.88 | ~150 GB steady state + egress |
| Cloud KMS | $0.32 | 5 key versions |
| BigQuery | ~$0.01 | Within free tier at this volume |
| Pub/Sub | $0.00 | Within free tier |
| **Total** | **~$107–132/mo** | |

---

## 21. Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Deprecated Vertex AI Go SDK breaks before migration | High | STORY-201 mandates `google.golang.org/genai` from day one. Do NOT use old SDK. |
| 5,000-byte TTS standard limit exceeded by SSML scripts | High | Use Long Audio API exclusively. Chunk SSML if needed. |
| Signed URLs cannot be revoked | Medium | Short-lived URLs (15 min) + proxy access layer (STORY-213) |
| FFmpeg processing exceeds Pub/Sub ack deadline (300s) | Medium | Monitor processing times. If >5 min consistently, migrate video to Cloud Run Jobs pattern. |
| Video quality inconsistent across slide content | Medium | Pre-test slide generation with edge cases (long text, many citations, non-Latin chars) |
| Gemini structured output occasionally malformed | Low | XML-validate SSML post-generation. Retry with lower temperature on failure. Max 3 retries. |
| Cloud TTS voice quality insufficient for premium brand | Low | Neural2 is high quality. Upgrade path: Gemini TTS or ElevenLabs if user demand exists. |

---

## 22. Dependencies & Prerequisites

| Dependency | Status | Blocker? |
|------------|--------|----------|
| EPIC-028 Phase 2 (conversation memory) | In flight — Sheldon | No — Cast reads completed query results, not active conversations |
| P0 user/profile 500 fix | Pending deploy | No — Cast uses Firebase JWT directly |
| Voice WebSocket fix | Pending deploy | No — Cast is text-to-audio, not real-time voice |
| Google OAuth verification | Deferred | No — Cast is post-login feature |

**No blocking dependencies. EPIC-029 can start immediately.**

---

## 23. CPO Decisions Required

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Default voice for Casts | Neural2-D (male) / Neural2-F (female) / User choice | User choice with Neural2-D default |
| Plan tier gating | Starter / Professional+ / Enterprise only | Professional+ ($399) — premium feature |
| Maximum Casts per month per plan | Unlimited / 10 / 25 / 50 | Professional: 25/mo, Enterprise: unlimited |
| Default Cast expiry | 30 / 60 / 90 days | 90 days (aligns with GCS lifecycle) |
| Branding: allow custom voice clone upload? | Yes (v1) / No (v2 consideration) | No for v1 — regulatory complexity. Revisit v2. |

---

*"Our RAG is the value of this whole entire product. Now we make it talk."*

— David Pierce, CPO

---

**EPIC-029: VERITAS CAST**  
**15 stories · 106 points · 5 tracks · 5 phases**  
**Target: 6-8 sessions**

— Zane, PM | ConnexUS AI Inc.
