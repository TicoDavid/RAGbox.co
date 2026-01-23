# RAGbox.co - Ralph Wiggum Agent Build

## 🎭 What is the Ralph Wiggum Agent?

The Ralph Wiggum Agent is an autonomous coding workflow that:
1. Reads a PRD (Product Requirements Document)
2. Breaks it into small, testable user stories with acceptance criteria
3. Iteratively implements each story using AI (Claude Code)
4. Commits changes, updates status, and logs progress
5. Loops until all stories are complete

This approach prevents "vibe coding" a massive prompt—instead, you give the agent bite-sized, verifiable tickets.

## 📁 Project Structure

```
ragbox-ralph/
├── PRD.md              # Product Requirements Document
├── stories.json        # User stories with acceptance criteria (Kanban)
├── agents.md           # Long-term memory (architecture decisions, patterns)
├── progress.txt        # Short-term memory (iteration log)
├── ralph.js            # The Ralph Wiggum runner script
├── CLAUDE.md           # AI assistant guide for code generation
└── ragbox-co/          # The actual codebase
    ├── src/
    │   ├── app/        # Next.js App Router
    │   ├── components/ # React components
    │   ├── lib/        # Utilities and services
    │   ├── hooks/      # Custom React hooks
    │   └── types/      # TypeScript types
    ├── prisma/         # Database schema
    ├── terraform/      # GCP infrastructure
    └── functions/      # Cloud Functions
```

## 🚀 Quick Start

### 1. Review the PRD

```bash
cat PRD.md
```

The PRD defines:
- Product vision and target users
- GCP architecture (Vertex AI, AlloyDB, Cloud Run, etc.)
- Design system (Cyber-Noir theme)
- Core features (Vault, Interrogation, Privilege, Audit)

### 2. Review the Stories

```bash
cat stories.json | jq '.stories | length'  # Count stories
cat stories.json | jq '.stories[] | select(.priority == "critical")'  # Critical path
```

Each story has:
- Unique ID (S001, S002, ...)
- Epic (E1: Foundation, E2: Auth, E3: Vault, E4: Query, E5: Privilege, E6: Audit)
- Priority (critical, high, medium, low)
- Acceptance criteria (testable requirements)
- Files to create/modify

### 3. Run Ralph (Manual Mode)

```bash
node ralph.js
```

This will:
1. Load stories from `stories.json`
2. Pick the next `todo` story by priority
3. Generate a prompt for Claude Code
4. Wait for you to implement

### 4. Implement with Claude Code

Copy the generated prompt into Claude Code or Claude.ai with computer use:

```bash
# In Claude Code, run:
claude "$(cat /path/to/prompt.txt)"
```

Or paste directly into the Claude.ai interface.

### 5. Update Story Status

After implementing, update `stories.json`:

```json
{
  "id": "S001",
  "status": "done"  // was: "todo"
}
```

### 6. Repeat

Run `ralph.js` again to pick the next story.

## 🏗️ GCP Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                            │
│                     (Next.js Frontend)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Cloud Run (API)                            │
│                   Express/Fastify + Next.js                     │
└─────────────────────────────────────────────────────────────────┘
          │              │              │              │
          ▼              ▼              ▼              ▼
┌───────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Cloud Storage │ │  Vertex AI  │ │   AlloyDB   │ │  BigQuery   │
│  (Documents)  │ │  (LLM/Emb)  │ │  (Vectors)  │ │   (Audit)   │
└───────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │    Document AI      │
              │  (PDF/OCR Extract)  │
              └─────────────────────┘
```

### GCP Services Used

| Service | Purpose |
|---------|---------|
| Cloud Run | Serverless containers for app hosting |
| Cloud Storage | Document vault with CMEK encryption |
| AlloyDB | PostgreSQL with pgvector for embeddings |
| Vertex AI | Gemini 1.5 Pro for RAG, text-embedding-004 |
| Document AI | PDF/image text extraction |
| Cloud KMS | Customer-managed encryption keys |
| BigQuery | WORM-compliant audit logging |
| Secret Manager | Secure credential storage |
| Identity Platform | Authentication (Firebase Auth) |

## 📋 User Stories Breakdown

### Epic 1: Foundation (E1)
- S001: Initialize Next.js 14 Project [CRITICAL]
- S002: Create Design System Components [CRITICAL]
- S022: Set Up GCP Infrastructure with Terraform [HIGH]
- S024: Configure CI/CD with Cloud Build [HIGH]

### Epic 2: Auth & Landing (E2)
- S003: Build Landing Page Hero Section [HIGH]
- S004: Build Landing Page Features Section [MEDIUM]
- S005: Implement Firebase Authentication [CRITICAL]
- S023: Build Pioneer Waitlist Signup [MEDIUM]

### Epic 3: Document Management (E3)
- S006: Create Dashboard Layout [CRITICAL]
- S007: Build Document Upload Drop Zone [CRITICAL]
- S008: Implement GCP Cloud Storage Upload [CRITICAL]
- S009: Implement Document AI Text Extraction [CRITICAL]
- S010: Implement Vertex AI Embeddings [CRITICAL]
- S011: Set Up AlloyDB with pgvector [CRITICAL]
- S012: Build Document List View [HIGH]
- S025: Implement One-Click Data Export [MEDIUM]

### Epic 4: Query Engine (E4)
- S013: Build Mercury Chat Interface [CRITICAL]
- S014: Implement RAG Query Pipeline [CRITICAL]
- S015: Implement Citation Highlighting [HIGH]
- S016: Implement Silence Protocol [CRITICAL]

### Epic 5: Privilege System (E5)
- S017: Implement Privilege Toggle [CRITICAL]
- S018: Implement Document Privilege Tagging [HIGH]

### Epic 6: Audit System (E6)
- S019: Implement Veritas Audit Log [CRITICAL]
- S020: Build Audit Log Viewer [HIGH]
- S021: Implement Audit Report Export [HIGH]

## 🎨 Design System

### Colors (Cyber-Noir)
- Background: `#050505` (OLED Black)
- Primary: `#00F0FF` (Electric Cyan)
- Warning: `#FFAB00` (Amber - Low Confidence)
- Danger: `#FF3D00` (Neon Red - Privilege Mode)
- Border: `#333333`

### Typography
- Headers: Space Grotesk
- Body: Inter
- Code/Citations: JetBrains Mono

### Key Visual Elements
- Glassmorphism cards: `bg-black/50 backdrop-blur-lg border border-[#333]`
- Glow effects: `shadow-[0_0_20px_rgba(0,240,255,0.3)]`
- Terminal log aesthetic for ingestion
- Citation links with Electric Cyan hover
- Privilege mode: red border pulse

## 🛡️ Security Features

1. **Silence Protocol**: Refuses to answer when confidence < 85%
2. **Privilege Toggle**: Binary mode - no partial access
3. **CMEK Encryption**: Customer-managed keys for all documents
4. **Veritas Audit Log**: Immutable, hash-verified activity records
5. **Zero Data Retention**: Data deleted when user requests

## 📊 Metrics

| Metric | Target |
|--------|--------|
| Total Stories | 25 |
| Story Points | ~95 |
| Confidence Threshold | 85% |
| Time to First Token | < 2s |
| Document Ingestion | < 30s/PDF |
| Beta Users Target | 5,000 |

## 🔧 Development Commands

```bash
# Start development
cd ragbox-co
npm install
npm run dev

# Run linting
npm run lint

# Type check
npm run type-check

# Run tests
npm test

# Build for production
npm run build

# Deploy to GCP
npm run deploy
```

## 📝 Contributing (Ralph Wiggum Style)

1. Pick a story from `stories.json`
2. Update status to `in_progress`
3. Implement ALL acceptance criteria
4. Create ALL specified files
5. Update status to `done`
6. Log iteration in `progress.txt`
7. Run `ralph.js` for the next story

## 🔗 Resources

- [PRD Document](./PRD.md)
- [User Stories](./stories.json)
- [Agent Memory](./agents.md)
- [Progress Log](./progress.txt)
- [Claude Guide](./CLAUDE.md)

---

**RAGbox**: Your Files Speak. We Make Them Testify.

*Built with the Ralph Wiggum Agent methodology for GCP.*
