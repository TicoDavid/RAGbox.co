# RAGböx.co® Comprehensive Build Plan
## Version 2.0 - Ralph Wiggum Agent Methodology

**Document Owner:** David Pierce, CPO - ConnexUS AI  
**Created:** January 26, 2026  
**Target:** MVP Launch in 12 weeks

---

## Executive Summary

This build plan transforms the existing RAGböx UI foundation into a production-ready, GCP-powered document intelligence platform. Using the Ralph Wiggum Agent methodology, we break the build into 40 discrete, testable user stories across 12 epics.

### What We Have (✅ Done)
- Landing page with "Document Interrogation in a Sovereign Environment"
- TheBox drop zone with animations
- Mercury chat interface
- Vault document list (mock data)
- Cyber-Noir design system
- OpenRouter LLM integration (working)
- Audio feedback system

### What We're Building (🔨 This Plan)
- 5-Tier Security Architecture (Drop Zone → Fort Knox)
- Mercury Reasoning Display (show AI thought process)
- FORGE Template System (branded document generation)
- Drop Zone File Explorer (folder hierarchy)
- Full GCP backend (Vertex AI, AlloyDB, Cloud Storage)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           RAGböx.co® Architecture                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     PRESENTATION LAYER                          │   │
│  │  Landing Page │ Dashboard │ Vault │ Mercury │ FORGE │ Settings  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     APPLICATION LAYER                            │   │
│  │  Next.js 14 │ React 18 │ TypeScript │ Tailwind + Framer Motion  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                       API LAYER (Cloud Run)                      │   │
│  │                                                                  │   │
│  │  /api/chat      → RAG Pipeline + Reasoning                       │   │
│  │  /api/upload    → Cloud Storage + Document AI                    │   │
│  │  /api/documents → CRUD + Tier Management                         │   │
│  │  /api/forge     → Template Analysis + Generation                 │   │
│  │  /api/audit     → Veritas Logging + Export                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    INTELLIGENCE LAYER (Vertex AI)                │   │
│  │                                                                  │   │
│  │  Gemini 1.5 Pro  │  text-embedding-004  │  DeepSeek-OCR (FORGE) │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      DATA LAYER (GCP)                            │   │
│  │                                                                  │   │
│  │  AlloyDB + pgvector │ Cloud Storage (CMEK) │ BigQuery (Audit)   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5-Tier Security Model

| Tier | Name | Color | Behavior |
|------|------|-------|----------|
| **0** | Drop Zone | Pulsing Cyan | Staging area, 24hr TTL, not queryable |
| **1** | Working | White/Blue | Standard access, folder hierarchy, auto-promoted from Tier 0 |
| **2** | Sensitive | Amber | Enhanced audit logging, folder hierarchy |
| **3** | Locked Vault | Red | No folders, restricted access, Partner approval to demote |
| **4** | Fort Knox | Red + Glow | Only visible with Privilege Toggle ON, one-way promotion |

### Tier Transitions
```
         ┌─────────────────────────────────────────────────────────┐
         │                                                         │
         │  DROP ZONE ──auto──► WORKING ──manual──► SENSITIVE     │
         │    (Tier 0)         (Tier 1)            (Tier 2)       │
         │                                              │          │
         │                                    ┌─────────▼────────┐ │
         │                                    │  LOCKED VAULT    │ │
         │                                    │    (Tier 3)      │ │
         │                                    └─────────┬────────┘ │
         │                                              │          │
         │                                    ┌─────────▼────────┐ │
         │                                    │   FORT KNOX      │ │
         │                                    │    (Tier 4)      │ │
         │                                    │  (one-way only)  │ │
         │                                    └──────────────────┘ │
         └─────────────────────────────────────────────────────────┘
```

---

## Sprint Plan (12 Weeks)

### Sprint 1: Foundation (Weeks 1-2)
**Goal:** GCP infrastructure + Firebase Auth + Basic upload

| Story | Title | Points | Priority |
|-------|-------|--------|----------|
| S002 | Set Up GCP Project and Enable APIs | 3 | CRITICAL |
| S003 | Create Terraform Infrastructure | 5 | HIGH |
| S004 | Configure Cloud Build CI/CD | 3 | HIGH |
| S005 | Implement Firebase Authentication | 5 | CRITICAL |

**Total: 16 points**

**Deliverables:**
- GCP project `ragbox-prod` with all APIs enabled
- Service account with correct IAM roles
- Firebase Auth with Google/Microsoft OAuth
- Working sign-in flow in existing UI

---

### Sprint 2: Document Pipeline (Weeks 3-4)
**Goal:** Real file upload + text extraction + embeddings

| Story | Title | Points | Priority |
|-------|-------|--------|----------|
| S006 | Implement Cloud Storage File Upload | 4 | CRITICAL |
| S007 | Implement Document AI Text Extraction | 5 | CRITICAL |
| S008 | Set Up AlloyDB with pgvector | 5 | CRITICAL |
| S009 | Implement Vertex AI Embeddings | 4 | CRITICAL |

**Total: 18 points**

**Deliverables:**
- Files upload to Cloud Storage with CMEK
- Document AI extracts text and chunks
- Embeddings stored in AlloyDB with pgvector
- TheBox shows real upload progress

---

### Sprint 3: RAG Engine (Weeks 5-6)
**Goal:** Working RAG pipeline with citations

| Story | Title | Points | Priority |
|-------|-------|--------|----------|
| S010 | Migrate LLM from OpenRouter to Vertex AI | 5 | CRITICAL |
| S011 | Implement Full RAG Pipeline with Citations | 8 | CRITICAL |
| S012 | Implement Silence Protocol | 3 | CRITICAL |
| S018 | Update Vault to Show Real Documents | 3 | HIGH |

**Total: 19 points**

**Deliverables:**
- Vertex AI Gemini generating responses
- Citations linked to source documents
- Silence Protocol at 85% confidence
- Vault shows real files from database

---

### Sprint 4: 5-Tier Security (Weeks 7-8)
**Goal:** Full security tier system

| Story | Title | Points | Priority |
|-------|-------|--------|----------|
| S021 | Define 5-Tier Security Data Model | 5 | CRITICAL |
| S022 | Implement Drop Zone Auto-Promotion | 3 | CRITICAL |
| S023 | Implement Tier Promotion UI Flow | 4 | HIGH |
| S024 | Implement Tier-Based Query Filtering | 4 | CRITICAL |
| S025 | Implement Tier Visual Indicators | 3 | HIGH |

**Total: 19 points**

**Deliverables:**
- 5-tier schema in database
- Auto-promotion from Drop Zone to Working
- Manual promotion with confirmations
- Queries respect tier access
- Tier badges throughout UI

---

### Sprint 5: Mercury Reasoning + FORGE (Weeks 9-10)
**Goal:** Show AI thought process + template system

| Story | Title | Points | Priority |
|-------|-------|--------|----------|
| S026 | Implement Mercury Reasoning Panel Structure | 5 | CRITICAL |
| S027 | Implement Reasoning Data Collection | 4 | CRITICAL |
| S028 | Implement Enhanced Citation Display | 3 | HIGH |
| S029 | Implement Confidence Badge with Silence Protocol | 3 | CRITICAL |
| S033 | Implement DeepSeek-OCR Integration | 5 | CRITICAL |
| S034 | Implement Template Upload and Analysis Flow | 5 | CRITICAL |

**Total: 25 points**

**Deliverables:**
- Reasoning panel with 5-step breakdown
- Interactive citations with highlighting
- Confidence badges (white/amber)
- FORGE template learning via DeepSeek-OCR
- Template upload and preview UI

---

### Sprint 6: Polish + Audit (Weeks 11-12)
**Goal:** Audit system + Settings + Data export

| Story | Title | Points | Priority |
|-------|-------|--------|----------|
| S015 | Implement Veritas Audit Logging | 5 | CRITICAL |
| S016 | Build Audit Log Viewer Page | 4 | HIGH |
| S017 | Implement Audit Report PDF Export | 3 | MEDIUM |
| S035 | Implement Template Library UI | 3 | HIGH |
| S036 | Implement FORGE Document Generation | 8 | CRITICAL |
| S037 | Implement Settings Page Layout | 4 | HIGH |
| S040 | Implement Data Export Section | 3 | MEDIUM |

**Total: 30 points**

**Deliverables:**
- Veritas audit logging to BigQuery
- Audit viewer with timeline
- PDF export with watermarks
- FORGE generates branded documents
- Settings page with categories
- One-click data export

---

## Story Details by Epic

### Epic E1: Infrastructure Setup (11 points)

**S002: Set Up GCP Project and Enable APIs**
```bash
# Create project
gcloud projects create ragbox-prod --name="RAGbox Production"

# Enable APIs
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

# Create service account
gcloud iam service-accounts create ragbox-app
```

**Files to Create:**
- `scripts/setup-gcp.sh`
- `.env.local.example`

---

### Epic E7: 5-Tier Security Architecture (19 points)

**S021: Database Schema Update**
```sql
-- Add security tier to documents
ALTER TABLE documents 
ADD COLUMN security_tier INTEGER DEFAULT 1 CHECK (security_tier BETWEEN 0 AND 4);

-- Add tier change tracking
CREATE TABLE tier_changes (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id),
  from_tier INTEGER,
  to_tier INTEGER,
  changed_by UUID REFERENCES users(id),
  reason TEXT,
  changed_at TIMESTAMP DEFAULT NOW()
);
```

**Files to Create:**
- `prisma/migrations/add_security_tiers.sql`
- `src/lib/security/tiers.ts`
- `src/types/security.ts`

---

### Epic E8: Mercury Reasoning Display (15 points)

**Reasoning Panel Structure:**
```typescript
interface ReasoningTrace {
  steps: ReasoningStep[];
  totalDuration: number;
  finalConfidence: number;
}

interface ReasoningStep {
  id: 'query_analysis' | 'document_retrieval' | 'source_analysis' | 'confidence_scoring' | 'response_generation';
  label: string;
  description: string;
  duration: number;
  metadata: Record<string, any>;
}
```

**UI Collapsed:** `▸ 5 steps | Confidence: 92%`  
**UI Expanded:**
```
▾ 5 steps | Confidence: 92%

  ✓ Query Analysis                    12ms
    Interpreted as: liability exposure in vendor contracts
  
  ✓ Document Retrieval               234ms
    Searched 47 documents, retrieved 12 chunks
  
  ✓ Source Analysis                  156ms
    Agreement score: 0.94, No contradictions
  
  ✓ Confidence Scoring                 8ms
    Retrieval: 0.38 | Sources: 0.38 | Model: 0.16
  
  ✓ Response Generation              892ms
    Generated with Gemini 1.5 Pro
```

---

### Epic E10: FORGE Template System (21 points)

**Template Learning Flow:**
1. User uploads sample document (PDF/DOCX)
2. DeepSeek-OCR analyzes layout
3. Extracts: headers, fonts, colors, logo placement, margins
4. Saves as reusable template
5. Future documents can use this template

**Generation Flow:**
1. User clicks "Forge Document" on Mercury response
2. Selects template from library
3. RAGbox generates DOCX with:
   - Content from Mercury response
   - Citations formatted as footnotes
   - User's template styling applied
   - Audit watermark
4. Download or save to Tier 1

---

## Ralph Wiggum Agent Workflow

### How to Use

```bash
# 1. See current status
node ralph.js --dry-run

# 2. Get next story prompt
node ralph.js

# 3. Copy prompt to Claude Code or Claude.ai

# 4. Implement acceptance criteria

# 5. Mark story done
# Edit stories.json: "status": "done"

# 6. Commit and push
git add -A
git commit -m "✅ S002: Set Up GCP Project"
git push

# 7. Repeat
```

### Critical Path

```
S002 → S003 → S005 → S006 → S007 → S008 → S009 → S010 → S011 → S021 → S024 → S026 → S033 → S036 → S015
 GCP    Terraform  Auth    Upload   DocAI   DB     Embed   LLM    RAG    Tiers   Filter  Reason  OCR    FORGE   Audit
```

---

## Design System Reference

### Colors (Cyber-Noir)
| Token | Hex | Usage |
|-------|-----|-------|
| Background | `#050505` | OLED Black, all surfaces |
| Primary | `#0000FF` | Electric Blue, brand, CTAs |
| Accent | `#00F0FF` | Electric Cyan, highlights, active states |
| Warning | `#FFAB00` | Amber, low confidence, caution |
| Danger | `#FF3D00` | Neon Red, privilege mode, Tier 3-4 |
| Border | `#333333` | Subtle separation |

### Typography
| Font | Usage |
|------|-------|
| Space Grotesk | Headers, technical authority |
| Inter | Body text, UI labels |
| JetBrains Mono | Code, citations, reasoning panel |

### Animations
| Name | Duration | Easing | Usage |
|------|----------|--------|-------|
| glow-pulse | 2s | ease-in-out | Privilege toggle, Tier 4 documents |
| border-pulse | 1.5s | ease | Privilege mode active border |
| breathe | 3s | ease-in-out | Drop zone idle state |
| expand | 200ms | ease | Reasoning panel collapse/expand |

---

## Files Changed Summary

### Existing Files to Modify
- `src/components/Mercury.tsx` - Add reasoning panel, citations
- `src/components/Vault.tsx` - Add tier badges, real data
- `src/components/TheBox.tsx` - Add Cloud Storage upload
- `src/app/api/chat/route.ts` - Add RAG pipeline, reasoning
- `package.json` - Add GCP dependencies

### New Files to Create

**GCP Integration:**
- `src/lib/gcp/storage.ts`
- `src/lib/gcp/documentai.ts`
- `src/lib/gcp/vertexai.ts`
- `src/lib/gcp/bigquery.ts`

**RAG Pipeline:**
- `src/lib/rag/pipeline.ts`
- `src/lib/rag/retrieval.ts`
- `src/lib/rag/reasoningTrace.ts`
- `src/lib/rag/silenceProtocol.ts`

**Security:**
- `src/lib/security/tiers.ts`
- `src/lib/security/tierFilter.ts`
- `src/lib/security/autoPromotion.ts`

**FORGE:**
- `src/lib/forge/deepseekOcr.ts`
- `src/lib/forge/documentGenerator.ts`
- `src/components/forge/TemplateUpload.tsx`
- `src/components/forge/ForgeButton.tsx`

**UI Components:**
- `src/components/TierBadge.tsx`
- `src/components/mercury/ReasoningPanel.tsx`
- `src/components/mercury/CitationChip.tsx`
- `src/components/dropzone/FolderTree.tsx`
- `src/components/settings/SettingsSidebar.tsx`

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| RAG Response Time | < 3 seconds | P95 latency |
| Confidence Accuracy | > 90% correlation | Human evaluation |
| Silence Protocol Rate | 10-15% of queries | Audit log analysis |
| Template Learning | < 30 seconds | DeepSeek processing time |
| Document Generation | < 5 seconds | FORGE output time |
| Audit Log Integrity | 100% | Hash verification |

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Vertex AI latency | Slow responses | Keep OpenRouter fallback |
| DeepSeek-OCR quality | Poor templates | Manual template editor as backup |
| AlloyDB costs | Budget overrun | Cloud SQL PostgreSQL for MVP |
| Tier complexity | User confusion | Strong visual indicators, tutorials |

---

## Summary

**Total Stories:** 40  
**Total Story Points:** 161  
**Estimated Duration:** 12 weeks  
**Team Size:** 1-2 developers with Claude Code assistance

**Key Differentiators Built:**
1. ✅ 5-Tier Security (no competitor has this)
2. ✅ Mercury Reasoning Display (transparency)
3. ✅ Silence Protocol (liability protection)
4. ✅ FORGE Template System (branded outputs)
5. ✅ Veritas Audit Log (SEC 17a-4 ready)

---

**"Your Files Speak. We Make Them Testify."**

RAGböx.co®
