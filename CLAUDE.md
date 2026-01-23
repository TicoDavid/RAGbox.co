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
# Edit .env.local with your GCP credentials

# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Deploy to GCP
npm run deploy
```

## Project Structure

```
ragbox-co/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Landing page
│   │   ├── login/              # Authentication
│   │   ├── dashboard/          # Protected dashboard
│   │   └── api/                # API routes
│   ├── components/
│   │   ├── ui/                 # Reusable primitives
│   │   ├── landing/            # Landing page
│   │   ├── vault/              # Document management
│   │   ├── mercury/            # Chat interface
│   │   ├── privilege/          # Privilege system
│   │   └── audit/              # Audit logging
│   ├── lib/
│   │   ├── gcp/                # GCP service clients
│   │   ├── rag/                # RAG pipeline
│   │   └── audit/              # Audit utilities
│   ├── hooks/                  # Custom React hooks
│   ├── contexts/               # React contexts
│   └── types/                  # TypeScript types
├── prisma/                     # Database schema
├── terraform/                  # Infrastructure as code
├── functions/                  # Cloud Functions
└── public/                     # Static assets
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS |
| Backend | Node.js, Express/Fastify, TypeScript |
| Database | AlloyDB with pgvector (or Cloud SQL PostgreSQL) |
| AI | Vertex AI (Gemini 1.5 Pro, text-embedding-004) |
| Auth | Firebase Authentication |
| Storage | GCP Cloud Storage with CMEK |
| Infrastructure | Cloud Run, Cloud Functions, Document AI |

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
- Use Tailwind CSS for styling
- Glassmorphism for cards: `bg-black/50 backdrop-blur-lg border border-[#333]`
- Glow effects: `shadow-[0_0_20px_rgba(0,240,255,0.3)]`
- Animations via Framer Motion

## Key Features

### 1. The Vault (Document Upload)
- Drag-and-drop upload with "Feed the Box" prompt
- Terminal-style ingestion log
- AES-256 encryption at rest

### 2. The Interrogation (Query Interface)
- Natural language queries
- Streaming responses
- Confidence scoring with Silence Protocol (<85%)

### 3. Citation System
- Inline citation numbers [1], [2], [3]
- Click to highlight source passage
- Document preview panel

### 4. Privilege Toggle
- Binary mode: Open (grey) / Privileged (red)
- Screen border pulse when active
- Privileged documents hidden in normal mode

### 5. Veritas Audit Log
- Immutable, timestamped entries
- BigQuery storage (WORM-compatible)
- PDF export for regulators

## Common Commands

### Development
```bash
npm run dev              # Start dev server
npm run lint             # Run ESLint
npm run type-check       # TypeScript check
npm run test             # Run tests
npm run test:watch       # Watch mode
```

### Database
```bash
npx prisma generate      # Generate client
npx prisma migrate dev   # Run migrations
npx prisma studio        # Open Prisma Studio
```

### Deployment
```bash
npm run build            # Build for production
gcloud run deploy        # Deploy to Cloud Run
terraform apply          # Apply infrastructure
```

## Environment Variables

```bash
# GCP
GOOGLE_CLOUD_PROJECT=ragbox-prod
GCP_REGION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json

# Database
DATABASE_URL=postgresql://user:pass@host:5432/ragbox

# AI
VERTEX_AI_LOCATION=us-central1
VERTEX_AI_MODEL=gemini-1.5-pro

# Storage
GCS_BUCKET_NAME=ragbox-documents-prod

# Auth (Firebase)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...

# Encryption
KMS_KEY_RING=ragbox-keys
KMS_KEY_NAME=document-key

# App
NEXT_PUBLIC_APP_URL=https://ragbox.co
CONFIDENCE_THRESHOLD=0.85
```

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/upload` | POST | Upload document to vault |
| `/api/documents` | GET | List user documents |
| `/api/documents/[id]` | GET/DELETE | Get/delete document |
| `/api/documents/[id]/privilege` | PATCH | Toggle privilege |
| `/api/chat` | POST | RAG query (streaming) |
| `/api/audit` | GET | Get audit log entries |
| `/api/audit/export` | GET | Export audit PDF |
| `/api/export` | GET | Export all user data |

## Testing

```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# E2E tests (Playwright)
npm run test:e2e
```

## Debugging

### Common Issues

1. **Vertex AI not responding**
   - Check GOOGLE_APPLICATION_CREDENTIALS
   - Verify IAM permissions for Vertex AI
   - Check quotas in GCP Console

2. **Database connection failed**
   - Verify DATABASE_URL format
   - Check VPC connector for Cloud Run
   - Test connection with `npx prisma db push`

3. **File upload fails**
   - Check Cloud Storage bucket permissions
   - Verify CMEK key access
   - Check file size limits (50MB default)

### Logging
```typescript
import { logger } from '@/lib/logger';

logger.info('User uploaded document', { userId, filename });
logger.error('RAG query failed', { error, query });
```

## Security Checklist

- [ ] Environment variables in Secret Manager (not .env in production)
- [ ] CMEK encryption enabled on Cloud Storage
- [ ] VPC Service Controls configured
- [ ] IAM roles follow least-privilege
- [ ] Audit logging enabled for all sensitive operations
- [ ] Rate limiting on API routes
- [ ] CORS configured for allowed origins only

## Contributing

1. Create a feature branch: `git checkout -b feature/story-id`
2. Implement the story acceptance criteria
3. Write tests for new functionality
4. Run `npm run lint && npm run test`
5. Submit PR with story ID in title

---

**For Ralph Wiggum Agent:** This file provides context for autonomous code generation. Reference it when implementing stories.
