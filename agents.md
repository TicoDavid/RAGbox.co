# RAGbox.co - Agent Memory (agents.md)

## Project Overview

RAGbox is a secure, compliance-ready RAG platform for SMBs in legal, financial, and healthcare sectors. Built on GCP infrastructure with a "Digital Fort Knox" security model.

## Key Decisions

### Architecture Decisions
- **Framework:** Next.js 14 with App Router (RSC for SEO, client components for interactivity)
- **Styling:** Tailwind CSS with custom design tokens (Cyber-Noir theme)
- **Database:** AlloyDB with pgvector (Cloud SQL PostgreSQL acceptable for MVP)
- **LLM:** Vertex AI Gemini 1.5 Pro (fallback to Claude via OpenRouter)
- **Embeddings:** Vertex AI text-embedding-004 (768 dimensions)
- **Auth:** Firebase Authentication (Google, Microsoft OAuth)
- **Storage:** Cloud Storage with CMEK encryption
- **Deployment:** Cloud Run (auto-scaling, managed)

### Design Decisions
- **Color Palette:**
  - Background: #050505 (OLED Black)
  - Primary: #00F0FF (Electric Cyan)
  - Warning: #FFAB00 (Amber)
  - Danger/Privilege: #FF3D00 (Neon Red)
  - Border: #333333
  
- **Typography:**
  - Headers: Space Grotesk
  - Body: Inter
  - Code/Citations: JetBrains Mono

- **Layout:** Trinity Command Center (Sidebar | Vault | Mercury)

### Security Decisions
- Zero data retention after deletion
- AES-256 encryption with customer-managed keys
- Immutable audit logging to BigQuery (WORM-compatible)
- Binary privilege mode (no partial access)
- Confidence threshold: 85% (Silence Protocol)

## Coding Standards

### File Organization
```
src/
├── app/                 # Next.js App Router pages
│   ├── api/            # API routes
│   ├── dashboard/      # Protected dashboard pages
│   └── (public)/       # Public pages (landing, login)
├── components/
│   ├── ui/             # Reusable UI primitives
│   ├── landing/        # Landing page components
│   ├── vault/          # Document management components
│   ├── mercury/        # Chat interface components
│   ├── privilege/      # Privilege system components
│   └── audit/          # Audit log components
├── lib/
│   ├── gcp/            # GCP service clients
│   ├── rag/            # RAG pipeline logic
│   └── audit/          # Audit logging utilities
├── hooks/              # Custom React hooks
├── contexts/           # React contexts
└── types/              # TypeScript type definitions
```

### Naming Conventions
- Components: PascalCase (e.g., `DocumentList.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useDocuments.ts`)
- Utilities: camelCase (e.g., `formatDate.ts`)
- Types: PascalCase with descriptive names (e.g., `DocumentMetadata`)
- API routes: kebab-case folders (e.g., `/api/documents/[id]/privilege`)

### Component Patterns
- Use TypeScript strict mode
- Props interfaces named `{ComponentName}Props`
- Default exports for pages, named exports for components
- Co-locate styles with components (Tailwind classes)
- Extract reusable logic to custom hooks

## GCP Configuration

### Required Services
- Cloud Run
- Cloud Storage
- Cloud SQL / AlloyDB
- Vertex AI
- Document AI
- Cloud KMS
- Secret Manager
- Cloud Logging
- BigQuery
- Identity Platform

### Environment Variables
```
# GCP
GOOGLE_CLOUD_PROJECT=ragbox-prod
GCP_REGION=us-central1

# Database
DATABASE_URL=postgresql://...

# AI
VERTEX_AI_LOCATION=us-central1

# Storage
GCS_BUCKET_NAME=ragbox-documents

# Auth
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...

# Encryption
KMS_KEY_RING=ragbox-keys
KMS_KEY_NAME=document-key
```

## Common Patterns

### Audit Logging
```typescript
await auditLog({
  action: 'DOCUMENT_UPLOAD',
  userId: user.id,
  details: { filename, size },
  ip: request.ip
});
```

### RAG Query
```typescript
const response = await ragPipeline({
  query: userQuery,
  userId: user.id,
  privilegeMode: isPrivileged,
  confidenceThreshold: 0.85
});
```

### Error Handling
```typescript
try {
  // operation
} catch (error) {
  await auditLog({ action: 'ERROR', details: error.message });
  throw new AppError('User-friendly message', 500);
}
```

## Known Issues & Workarounds

- **pgvector in Cloud SQL:** Use `pg` client with manual vector operations if Prisma pgvector support is flaky
- **Vertex AI streaming:** Use server-sent events (SSE) for response streaming, not WebSockets
- **Document AI latency:** Process documents asynchronously with Cloud Tasks, notify user when ready

## Links

- [GCP Vertex AI Docs](https://cloud.google.com/vertex-ai/docs)
- [Document AI Docs](https://cloud.google.com/document-ai/docs)
- [pgvector Extension](https://github.com/pgvector/pgvector)
- [Next.js App Router](https://nextjs.org/docs/app)

---
*Last updated: January 2026*
