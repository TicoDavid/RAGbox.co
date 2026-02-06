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

Design tokens defined in `src/styles/design-tokens.css`. Uses Tailwind's Slate color palette.

### Colors (Slate Professional Theme)

#### Brand Colors
```css
--brand-blue: #3b82f6;        /* Blue 500 - Primary actions */
--brand-blue-hover: #2563eb;  /* Blue 600 - Hover state */
--brand-blue-dim: #1d4ed8;    /* Blue 700 - Active/pressed */
```

#### Dark Mode (Default)
```css
--bg-primary: #0f172a;        /* Slate 900 - Main background */
--bg-secondary: #1e293b;      /* Slate 800 - Cards, panels */
--bg-tertiary: #334155;       /* Slate 700 - Elevated surfaces */
--bg-elevated: #475569;       /* Slate 600 - Highest elevation */
--bg-hover: #3b4a5e;          /* Hover states */

--text-primary: #f8fafc;      /* Slate 50 - Headlines */
--text-secondary: #94a3b8;    /* Slate 400 - Body text */
--text-tertiary: #64748b;     /* Slate 500 - Muted text */

--border-default: #334155;    /* Slate 700 */
--border-subtle: #1e293b;     /* Slate 800 */
--border-strong: #475569;     /* Slate 600 */
```

#### Light Mode
```css
--bg-primary: #f8fafc;        /* Slate 50 */
--bg-secondary: #f1f5f9;      /* Slate 100 */
--bg-tertiary: #e2e8f0;       /* Slate 200 */
--bg-elevated: #ffffff;       /* White */

--text-primary: #0f172a;      /* Slate 900 */
--text-secondary: #475569;    /* Slate 600 */
--text-tertiary: #64748b;     /* Slate 500 */

--border-default: #e2e8f0;    /* Slate 200 */
--border-subtle: #f1f5f9;     /* Slate 100 */
--border-strong: #cbd5e1;     /* Slate 300 */
```

#### Status Colors
```css
--success: #10b981;           /* Emerald 500 */
--success-bg: #d1fae5;        /* Emerald 100 */
--danger: #ef4444;            /* Red 500 */
--danger-bg: #fee2e2;         /* Red 100 */
--warning: #f59e0b;           /* Amber 500 */
--warning-bg: #fef3c7;        /* Amber 100 */
```

#### Privilege Mode (Amber Accent)
```css
--privilege-color: #f59e0b;   /* Amber 500 - Badge/indicator */
--privilege-bg: #451a03;      /* Amber 950 - Dark mode bg */
--privilege-border: #b45309;  /* Amber 700 - Border */
/* Light mode: --privilege-bg: #fffbeb (Amber 50) */
```

### Typography
Fonts loaded in `src/app/layout.tsx`:
- **Headers:** Space Grotesk (`--font-space`) - Authority, headlines
- **Body/Dashboard:** Plus Jakarta Sans (`--font-jakarta`) - Primary body text
- **Fallback Body:** Inter (`--font-inter`) - High readability
- **Code/Citations:** JetBrains Mono (`--font-jetbrains`) - Monospace for data

### Spacing Scale
```css
--space-xs: 4px;    --space-sm: 8px;    --space-md: 16px;
--space-lg: 24px;   --space-xl: 32px;   --space-2xl: 48px;
```

### Border Radius
```css
--radius-sm: 4px;   --radius-md: 8px;
--radius-lg: 12px;  --radius-xl: 16px;
```

### Layout Dimensions
```css
--header-height: 56px;
--rail-width: 56px;
--vault-expanded-width: 400px;
```

### Component Patterns
- Use Tailwind CSS with CSS custom properties from design-tokens.css
- Cards: `bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10`
- Elevated surfaces: `shadow-sm` or `shadow-lg` for depth
- Hover states: Use `hover:bg-slate-100 dark:hover:bg-white/10`
- Focus rings: `focus:outline-none focus:ring-2 focus:ring-blue-500`
- Animations via Framer Motion (motion.div with AnimatePresence)
- Transitions: `transition-all` or `transition-colors duration-300`

### Landing Page (Special Cases)
- Navbar: Always dark (`bg-[#0a0a0a]`) regardless of theme
- Auth Modal: Always white background (`bg-white`)
- Hero glow effects: Yellow pulsating behind shield logo

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
- Binary mode: Open (grey) / Privileged (amber)
- Amber accent with pulse animation when active
- Privileged documents hidden in normal mode
- Uses `--privilege-color: #f59e0b` (Amber 500)

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
