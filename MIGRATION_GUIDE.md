# RAGbox.co - GCP Migration Guide

## Executive Summary

Your existing RAGbox.co codebase has excellent UI foundations. This guide shows exactly how to wire the existing components to GCP services, minimizing new code and maximizing reuse.

## 📊 Current State Analysis

### ✅ Keep As-Is (UI Components)
These components are production-ready and just need backend connections:

| Component | File | Status | GCP Integration Needed |
|-----------|------|--------|------------------------|
| TheBox | `src/components/TheBox.tsx` | Done | Connect to Cloud Storage upload |
| Vault | `src/components/Vault.tsx` | Done | Connect to /api/documents |
| Mercury | `src/components/Mercury.tsx` | Done | Update to use Vertex AI citations |
| Sidebar | `src/components/Sidebar.tsx` | Done | Add Truth & Audit link |
| PrivilegeCards | `src/components/PrivilegeCards.tsx` | Done | None |
| Navbar | `src/components/Navbar.tsx` | Done | None |
| useRagSounds | `src/hooks/useRagSounds.ts` | Done | None |

### 🔄 Modify (LLM Layer)
Your existing LLM abstraction can be extended:

```
src/lib/llm/
├── index.ts        # Add Vertex AI to factory
├── provider.ts     # Keep interface (already good!)
├── openrouter.ts   # Keep as fallback
└── vertexai.ts     # NEW: Add Vertex AI provider
```

### 🆕 Create (GCP Services)
New files needed for GCP integration:

```
src/lib/gcp/
├── storage.ts      # Cloud Storage client
├── documentai.ts   # Document AI client
├── vertexai.ts     # Vertex AI client
└── bigquery.ts     # BigQuery for audit logs

src/lib/rag/
├── pipeline.ts     # Orchestrates retrieval + generation
├── retrieval.ts    # Vector search in AlloyDB
├── generation.ts   # Prompt building + LLM call
├── citations.ts    # Citation extraction
└── silenceProtocol.ts  # Confidence gating

src/lib/audit/
├── logger.ts       # Audit event logging
└── types.ts        # Audit event types
```

---

## 🔧 Step-by-Step Migration

### Phase 1: GCP Project Setup (1-2 hours)

```bash
# 1. Create GCP project
gcloud projects create ragbox-prod --name="RAGbox Production"
gcloud config set project ragbox-prod

# 2. Enable billing
gcloud billing accounts list
gcloud billing projects link ragbox-prod --billing-account=BILLING_ACCOUNT_ID

# 3. Enable required APIs
gcloud services enable \
  aiplatform.googleapis.com \
  documentai.googleapis.com \
  run.googleapis.com \
  storage.googleapis.com \
  sqladmin.googleapis.com \
  bigquery.googleapis.com \
  secretmanager.googleapis.com \
  cloudkms.googleapis.com \
  identitytoolkit.googleapis.com

# 4. Create service account
gcloud iam service-accounts create ragbox-app \
  --display-name="RAGbox Application"

# 5. Grant roles
gcloud projects add-iam-policy-binding ragbox-prod \
  --member="serviceAccount:ragbox-app@ragbox-prod.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
# ... (repeat for other roles)

# 6. Download key for local dev
gcloud iam service-accounts keys create ./service-account.json \
  --iam-account=ragbox-app@ragbox-prod.iam.gserviceaccount.com
```

### Phase 2: Update Environment Variables

Create `.env.local` in your existing repo:

```bash
# Existing (keep)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# GCP (add)
GOOGLE_CLOUD_PROJECT=ragbox-prod
GCP_REGION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json

# Database (add)
DATABASE_URL=postgresql://ragbox:password@localhost:5432/ragbox

# Vertex AI (add)
VERTEX_AI_LOCATION=us-central1
VERTEX_AI_MODEL=gemini-1.5-pro
VERTEX_AI_EMBEDDING_MODEL=text-embedding-004

# Cloud Storage (add)
GCS_BUCKET_NAME=ragbox-documents-dev

# Firebase (add)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ragbox-prod.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ragbox-prod

# OpenRouter (keep as fallback)
OPENROUTER_API_KEY=...

# RAG Config (add)
CONFIDENCE_THRESHOLD=0.85
RAG_TOP_K=10
```

### Phase 3: Add GCP Dependencies

Update `package.json`:

```json
{
  "dependencies": {
    // ... existing deps ...
    
    // ADD these GCP packages:
    "@google-cloud/aiplatform": "^3.10.0",
    "@google-cloud/bigquery": "^7.3.0",
    "@google-cloud/documentai": "^8.0.0",
    "@google-cloud/storage": "^7.7.0",
    "@prisma/client": "^5.8.0",
    "firebase": "^10.7.1",
    "pgvector": "^0.1.8"
  },
  "devDependencies": {
    // ADD:
    "prisma": "^5.8.0"
  }
}
```

### Phase 4: Create Vertex AI Provider

Create `src/lib/llm/vertexai.ts`:

```typescript
import { VertexAI } from '@google-cloud/aiplatform';
import { LLMProvider, LLMResponse } from './provider';

export class VertexAIProvider implements LLMProvider {
  private client: VertexAI;
  private model: string;

  constructor() {
    this.client = new VertexAI({
      project: process.env.GOOGLE_CLOUD_PROJECT!,
      location: process.env.VERTEX_AI_LOCATION || 'us-central1',
    });
    this.model = process.env.VERTEX_AI_MODEL || 'gemini-1.5-pro';
  }

  async generate(prompt: string, context?: string): Promise<LLMResponse> {
    const generativeModel = this.client.getGenerativeModel({
      model: this.model,
    });

    const fullPrompt = context 
      ? `${RAGBOX_SYSTEM_PROMPT}\n\nContext:\n${context}\n\nQuery: ${prompt}`
      : `${RAGBOX_SYSTEM_PROMPT}\n\nQuery: ${prompt}`;

    const result = await generativeModel.generateContent(fullPrompt);
    const response = result.response;

    return {
      text: response.text(),
      citations: this.extractCitations(response.text()),
      confidence: this.calculateConfidence(response),
    };
  }

  async *stream(prompt: string, context?: string): AsyncIterable<string> {
    const generativeModel = this.client.getGenerativeModel({
      model: this.model,
    });

    const fullPrompt = context 
      ? `${RAGBOX_SYSTEM_PROMPT}\n\nContext:\n${context}\n\nQuery: ${prompt}`
      : prompt;

    const streamingResult = await generativeModel.generateContentStream(fullPrompt);

    for await (const chunk of streamingResult.stream) {
      yield chunk.text();
    }
  }

  private extractCitations(text: string): Citation[] {
    // Extract [1], [2], etc. and map to sources
    const citationRegex = /\[(\d+)\]/g;
    // ... implementation
  }

  private calculateConfidence(response: any): number {
    // Use existing formula: 
    // retrieval_coverage (40%) + source_agreement (40%) + model_certainty (20%)
    // ... implementation
  }
}
```

Update `src/lib/llm/index.ts`:

```typescript
import { OpenRouterProvider } from './openrouter';
import { VertexAIProvider } from './vertexai';
import { LLMProvider } from './provider';

export function getLLMProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER || 'vertexai';
  
  switch (provider) {
    case 'vertexai':
      return new VertexAIProvider();
    case 'openrouter':
      return new OpenRouterProvider();
    default:
      return new VertexAIProvider();
  }
}
```

### Phase 5: Connect TheBox to Cloud Storage

Update `src/components/TheBox.tsx`:

```typescript
// Add to existing component

import { uploadToCloudStorage } from '@/lib/gcp/storage';
import { useRagSounds } from '@/hooks/useRagSounds';

// In the onDrop handler:
const handleFileDrop = async (files: File[]) => {
  const { playDrop } = useRagSounds();
  
  for (const file of files) {
    try {
      // Upload to Cloud Storage
      const result = await uploadToCloudStorage(file, userId);
      
      // Play success sound
      playDrop();
      
      // Update UI
      onFileUploaded(result);
      
    } catch (error) {
      console.error('Upload failed:', error);
    }
  }
};
```

Create `src/lib/gcp/storage.ts`:

```typescript
import { Storage } from '@google-cloud/storage';

const storage = new Storage();
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME!);

export async function uploadToCloudStorage(
  file: File, 
  userId: string
): Promise<UploadResult> {
  const path = `${userId}/documents/${Date.now()}-${file.name}`;
  const blob = bucket.file(path);
  
  const buffer = await file.arrayBuffer();
  await blob.save(Buffer.from(buffer), {
    contentType: file.type,
    metadata: {
      originalName: file.name,
      uploadedAt: new Date().toISOString(),
      userId,
    },
  });
  
  // Generate signed URL for access
  const [signedUrl] = await blob.getSignedUrl({
    action: 'read',
    expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  });
  
  return {
    id: generateId(),
    path,
    signedUrl,
    filename: file.name,
    size: file.size,
    type: file.type,
  };
}
```

### Phase 6: Set Up AlloyDB/Cloud SQL

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector(map: "vector")]
}

model User {
  id            String     @id @default(cuid())
  email         String     @unique
  name          String?
  privilegeMode Boolean    @default(false)
  documents     Document[]
  queries       Query[]
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
}

model Document {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  filename     String
  storagePath  String
  size         Int
  mimeType     String
  isPrivileged Boolean  @default(false)
  status       String   @default("processing") // processing, ready, error
  chunks       Chunk[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Chunk {
  id          String                   @id @default(cuid())
  documentId  String
  document    Document                 @relation(fields: [documentId], references: [id])
  content     String
  pageNumber  Int?
  chunkIndex  Int
  embedding   Unsupported("vector(768)")?
  createdAt   DateTime                 @default(now())
}

model Query {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  query      String
  response   String?
  confidence Float?
  citations  Json?
  createdAt  DateTime @default(now())
}
```

### Phase 7: Connect Mercury to RAG Pipeline

Update `src/app/api/chat/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { ragPipeline } from '@/lib/rag/pipeline';
import { auditLog } from '@/lib/audit/logger';

export async function POST(request: NextRequest) {
  const { query, userId, privilegeMode } = await request.json();
  
  // Log query to audit
  await auditLog({
    action: 'QUERY',
    userId,
    details: { query, privilegeMode },
    ip: request.ip,
  });

  // Execute RAG pipeline
  const result = await ragPipeline({
    query,
    userId,
    privilegeMode,
    confidenceThreshold: parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.85'),
  });

  // Check Silence Protocol
  if (result.confidence < 0.85) {
    await auditLog({
      action: 'SILENCE_PROTOCOL',
      userId,
      details: { query, confidence: result.confidence },
    });
    
    return NextResponse.json({
      text: "I cannot provide a confident answer based on your documents. Consider uploading more relevant materials or rephrasing your question.",
      confidence: result.confidence,
      silenceProtocol: true,
    });
  }

  // Log response to audit
  await auditLog({
    action: 'RESPONSE',
    userId,
    details: { 
      queryHash: hashString(query), 
      responseHash: hashString(result.text),
      confidence: result.confidence,
    },
  });

  return NextResponse.json(result);
}
```

---

## 🎯 Critical Path (Build Order)

```
Week 1:
S002 → GCP Project Setup
S005 → Firebase Auth (unblocks user sessions)
S008 → AlloyDB Setup (unblocks all data storage)

Week 2:
S006 → Cloud Storage Upload (TheBox integration)
S007 → Document AI (text extraction)
S009 → Vertex AI Embeddings

Week 3:
S010 → Vertex AI LLM Migration
S011 → Full RAG Pipeline
S012 → Silence Protocol

Week 4:
S013 → Privilege Toggle Backend
S015 → Veritas Audit Logging
S016 → Audit Log Viewer
```

---

## 🚀 Quick Win: Test Locally First

Before deploying to GCP, you can test the architecture locally:

1. **Local PostgreSQL with pgvector:**
   ```bash
   docker run -d --name ragbox-db \
     -e POSTGRES_PASSWORD=ragbox \
     -e POSTGRES_DB=ragbox \
     -p 5432:5432 \
     pgvector/pgvector:pg16
   ```

2. **Use OpenRouter for LLM (already working):**
   Keep using your existing OpenRouter integration while developing.

3. **Mock Cloud Storage:**
   Store files in `public/uploads/` for local testing.

4. **Migrate to GCP services one at a time:**
   - First: Database (AlloyDB)
   - Second: Storage (Cloud Storage)
   - Third: LLM (Vertex AI)
   - Fourth: Document processing (Document AI)

---

## 📋 Files Changed Summary

### Modified (your existing files):
- `src/components/TheBox.tsx` - Add Cloud Storage upload
- `src/components/Vault.tsx` - Connect to real data
- `src/components/Mercury.tsx` - Update citation handling
- `src/components/Sidebar.tsx` - Add audit link
- `src/lib/llm/index.ts` - Add Vertex AI factory
- `src/lib/llm/provider.ts` - No change (interface is good)
- `src/app/api/chat/route.ts` - Use new RAG pipeline
- `package.json` - Add GCP dependencies
- `.env.local` - Add GCP variables

### Created (new files):
- `src/lib/gcp/storage.ts`
- `src/lib/gcp/documentai.ts`
- `src/lib/gcp/vertexai.ts`
- `src/lib/gcp/bigquery.ts`
- `src/lib/llm/vertexai.ts`
- `src/lib/rag/pipeline.ts`
- `src/lib/rag/retrieval.ts`
- `src/lib/rag/citations.ts`
- `src/lib/rag/silenceProtocol.ts`
- `src/lib/audit/logger.ts`
- `src/lib/firebase.ts`
- `src/contexts/AuthContext.tsx`
- `src/contexts/PrivilegeContext.tsx`
- `prisma/schema.prisma`
- `terraform/*.tf`
- `cloudbuild.yaml`
- `Dockerfile`

---

**Your UI is 80% done. The GCP integration is just plumbing.**
