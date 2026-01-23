# RAGbox.co - Product Requirements Document (PRD)

## Executive Summary

RAGbox is a secure, compliance-ready Retrieval-Augmented Generation (RAG) platform targeting SMBs in legal, financial, and healthcare sectors. The platform transforms unstructured documents into an intelligent, queryable knowledge base with verified citations, attorney-client privilege protection, and immutable audit logging.

**Tagline:** "Your Files Speak. We Make Them Testify."

## Vision

Build a "Digital Fort Knox" for document intelligence that:
- Keeps all data within customer-controlled GCP infrastructure
- Provides enterprise-grade security with SMB-friendly simplicity
- Delivers verified, cited answers with confidence scoring
- Maintains SEC 17a-4 / HIPAA-ready audit trails

## Target Users

1. **Attorneys** - Trial prep, contract review, compliance research
2. **CFOs** - Vendor contract analysis, financial document review
3. **Compliance Officers** - Policy verification, audit preparation
4. **Healthcare Admins** - HIPAA compliance, patient record queries

## GCP Architecture

### Core Services
| Component | GCP Service | Purpose |
|-----------|-------------|---------|
| Frontend | Cloud Run + Firebase Hosting | Next.js 14 app serving |
| API Backend | Cloud Run | Express/Fastify API |
| LLM Engine | Vertex AI | Gemini 1.5 Pro for queries |
| Embeddings | Vertex AI Embeddings | text-embedding-004 |
| Vector DB | AlloyDB + pgvector | Vector similarity search |
| Document Processing | Document AI | PDF/image extraction |
| Object Storage | Cloud Storage | Document vault |
| Auth | Identity Platform | SSO, MFA support |
| Encryption | Cloud KMS | Customer-managed keys |
| Audit Logs | Cloud Logging → BigQuery | WORM-compatible logging |
| Background Jobs | Cloud Tasks | Async processing |
| Secrets | Secret Manager | API keys, credentials |

### Data Flow
```
[User Upload] → Cloud Storage → Document AI → Embeddings → AlloyDB (vectors)
                     ↓
              [User Query] → Vertex AI → Vector Search → LLM Generation
                     ↓
              [Response + Citations] → Audit Log → BigQuery
```

## Design System

### Visual Identity: "Cyber-Noir"
- **Background:** OLED Black (#050505)
- **Primary Accent:** Electric Cyan (#00F0FF)
- **Secondary Accent:** Warning Amber (#FFAB00) for low-confidence
- **Privilege Mode:** Neon Red (#FF3D00)
- **Typography:**
  - Headers: Space Grotesk (technical, authoritative)
  - Body: Inter (readable)
  - Code/Citations: JetBrains Mono

## Core Features

### 1. The Vault (Document Upload)
- Drag-and-drop upload zone ("Feed the Box")
- Supported formats: PDF, DOCX, TXT, images
- Real-time ingestion visualization (terminal log aesthetic)
- AES-256 encryption at rest with CMK

### 2. The Interrogation (Query Interface)
- Natural language query input
- Quick action pills: [Summarize Risks] [Find Inconsistencies] [Compare Versions]
- Streaming response with confidence scoring
- "Silence Protocol" - refuses to answer below 85% confidence

### 3. The Citation System
- Inline citation numbers [1], [2], [3]
- Click-to-highlight source passage
- Document preview with exact location

### 4. The Privilege Toggle
- Binary toggle switch (Grey=Open, Red=Privileged)
- Visual confirmation (red border pulse)
- Privileged documents hidden from non-privileged queries

### 5. The Veritas Audit Log
- Immutable, timestamped activity log
- Query hash verification
- Export to watermarked PDF for regulators

## Success Metrics

| Metric | Target |
|--------|--------|
| Query Confidence Threshold | 85% minimum |
| Time to First Token | < 2 seconds |
| Document Ingestion | < 30 seconds per PDF |
| Audit Log Integrity | 100% immutable |
| Beta Users at Launch | 5,000 Pioneers |
| Year 1 ARR Target | $2.4M |

## Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Phase 1: The Sovereign Build | Weeks 1-8 | Core vault, ingestion, basic query |
| Phase 2: Symphony Integration | Weeks 5-8 | ConnexUS AI integration, Self-RAG |
| Phase 3: Pioneer Campaign | Weeks 1-12 | 5,000 beta users acquisition |

## Out of Scope (v1)

- Multi-tenant architecture (single-tenant MVP)
- Custom MCP server support
- Voice interface
- Mobile native apps (responsive web only)
- Self-hosted deployment option

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Data sovereignty concerns | One-click compliance audit PDF export |
| AI hallucination | Silence Protocol at <85% confidence |
| Unauthorized access | Binary privilege toggle, no partial access |
| Vendor lock-in | One-click data export, no proprietary formats |

---

**Document Version:** 1.0  
**Last Updated:** January 2026  
**Author:** RAGbox Product Team
