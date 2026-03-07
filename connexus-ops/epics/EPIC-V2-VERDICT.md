# EPIC: RAGbox V2 — Project VERDICT

> **V**erified **E**vidence **R**etrieval through **D**ynamic **I**ntelligent **C**ontextualization and **T**racing

**Author:** Zane (PM), approved by David Pierce (CPO)
**Date:** 2026-03-07
**Timeline:** 3 Phases, 6 months
**Team:** Sheldon (Backend), Jordan (UI), Sarah (Test), Adam (DevOps), Dr. Insane (QA)
**Methodology:** Build → Test → Analyze → Validate at every step. All agents in parallel.

---

## Vision Statement

Mercury delivers the VERDICT. Every answer is a verified judgment backed by an evidence chain that would survive cross-examination.

In 6 months, RAGbox will:
1. **Replace File Explorer** — Sovereign file system with version control, search-as-you-type, metadata intelligence
2. **Replace chat providers** — Mercury is the communication hub (text, voice, email, WhatsApp, ROAM — all channels unified)
3. **Lead on LLM security** — Data never leaves the perimeter. Sovereign model hosting. Zero-trust retrieval.
4. **Generate verifiable documents autonomously** — Mercury creates reports, briefs, battle cards with full citation chains
5. **Turn historical data into gold** — CyGraph knowledge extraction + VERDICT adaptive retrieval transforms dead archives into queryable intelligence
6. **Mercury replaces any human assistant** — Fully autonomous agent with certifiable, measurable performance that exceeds human capability

---

## What Exists Today (V1 Inventory)

| Component | Status | Key Limitation |
|-----------|--------|----------------|
| Retriever (Go) | Single-pass vector + BM25 hybrid, top-20 → rerank → top-5 | No iterative retrieval, no query decomposition |
| Generator (Go) | Single LLM call with persona injection, streaming SSE | No intermediate feedback, no claim verification |
| Self-RAG (Go) | 3-iteration reflection loop (relevance/support/completeness) | No contradiction detection, no reasoning trace output |
| CyGraph (Prisma + Frontend) | 5 models, 88 tests, 5 extraction files | NOT wired into chat pipeline |
| Mercury Store | 14 tool patterns, SSE parsing, citation blocks | Single tool per query, no multi-step planning |
| Mercury Voice | Intent classification, 20-turn memory, Go backend SSE | No streaming to voice, no interrupt/refine |
| Silence Protocol | Confidence < 0.85 → refuse | No adaptive thresholds, no stop-reason reporting |
| Audit | Hash-chain, BigQuery, immutable | No search trace granularity |
| Vault | Upload, parse, chunk, embed, privilege mode | Not a file system — no versions, no folders, no desktop mount |
| Thread Memory | Spec only (S-P1-04) | Not implemented |
| BYOLLM | Next.js proxy working | Go backend adapter not built |

---

## PHASE 1: Adaptive Sovereign Retrieval Engine (Sprints 1-4, ~8 weeks)

*The core VERDICT pipeline. Mercury learns to search like an expert.*

### 1.1 — Search Behavior Router
**Owner:** Sheldon (backend) + Jordan (frontend)
**What:** Classify incoming queries into 6 retrieval modes before execution.

| Mode | Example Query | Search Strategy |
|------|--------------|-----------------|
| `constraint_entity` | "Find all vendor contracts with auto-renewal and liability > $50k" | Metadata filter + vector + entity extraction |
| `cross_document` | "Summarize indemnification changes across all contract versions" | Multi-doc retrieval + comparison + synthesis |
| `deep_traversal` | "Find the termination clause in a 120-page agreement" | Long-document chunked traversal + section targeting |
| `exhaustive` | "Show every mention of Project Atlas across all docs" | Full-vault sweep + dedup + aggregation |
| `procedural` | "What's the process to handle a compliance exception?" | Step extraction + ordering + dependency resolution |
| `fact_aggregation` | "What do our internal notes say about this account over time?" | Timeline construction + source triangulation |

**Acceptance Criteria:**
- [ ] Go backend: `ClassifySearchBehavior(query) → SearchMode` using LLM classification
- [ ] Frontend: Mercury shows search mode badge ("Mercury used Cross-Document Search")
- [ ] Fallback: defaults to current single-pass if classification fails
- [ ] Tests: 50+ query classification tests (Sarah)
- [ ] Audit: search mode logged in every query trace

**Files to modify:**
- `backend/internal/service/retriever.go` — add SearchMode routing
- `backend/internal/handler/chat.go` — pass mode in SSE events
- `src/stores/mercuryStore.ts` — display mode in UI

---

### 1.2 — Multi-Step Retrieval Loop (Mercury Search Loop)
**Owner:** Sheldon (backend)
**What:** Replace single-pass retrieval with an iterative search agent.

**Current:** `query → embed → search → rerank → answer`
**VERDICT:** `query → plan → retrieve → verify → expand/refine → compress → conclude/refuse`

**Loop States:**
```
PLAN       → decompose query into sub-queries, select search mode
RETRIEVE   → execute vector/BM25/metadata search for current sub-query
VERIFY     → check if retrieved evidence answers the sub-query
EXPAND     → if evidence insufficient, reformulate query and search again
COMPRESS   → if context window filling, summarize evidence bundles
CONCLUDE   → sufficient evidence → generate answer with citations
REFUSE     → insufficient evidence → Silence Protocol with stop reason
```

**Guardrails:**
- Max 10 retrieval steps per query (configurable)
- Privilege check at EVERY retrieval step
- Each step logged to audit trace
- Cost-aware: stop if search is saturating (same results returning)
- Step budget scales with query complexity (simple lookup = 1-2, cross-doc synthesis = 5-10)

**Acceptance Criteria:**
- [ ] Go backend: `VERDICTLoop` orchestrator with state machine
- [ ] Each state implemented as interface (testable independently)
- [ ] SSE events: `search_step` emitted per iteration (frontend shows progress)
- [ ] Integration tests: multi-step queries that require 3+ retrieval rounds (Sarah)
- [ ] Performance: p95 latency < 15s for 5-step queries

**Files to create:**
- `backend/internal/service/verdict_loop.go` — orchestrator
- `backend/internal/service/verdict_planner.go` — query decomposition
- `backend/internal/service/verdict_compressor.go` — evidence compression

---

### 1.3 — Query Decomposition & Reformulation
**Owner:** Sheldon (backend)
**What:** Break complex queries into searchable sub-queries with synonym expansion.

**Example:**
```
User: "What did we commit to around data retention and deletion across customer agreements?"

Decomposition:
  Sub-query 1: "data retention clause" (constraint_entity)
  Sub-query 2: "data deletion obligations" (constraint_entity)
  Sub-query 3: "retention vs deletion comparison" (cross_document)
  Expansion: "data purge", "record keeping", "GDPR Article 17"
  Metadata: filter by document_type = 'agreement'
```

**Acceptance Criteria:**
- [ ] LLM-powered decomposition with structured JSON output
- [ ] Synonym/expansion generation
- [ ] Metadata filter extraction from natural language
- [ ] Tests: 30+ decomposition accuracy tests (Sarah)

---

### 1.4 — Evidence Verification & Contradiction Detection
**Owner:** Sheldon (backend)
**What:** After retrieval, verify claims against sources and detect conflicts.

**Claim Verification Pipeline:**
```
Answer text → extract claims → for each claim:
  → find supporting citations
  → score support strength (strong/partial/unsupported)
  → flag unsupported claims
  → if conflicting sources found → mark contradiction
```

**Contradiction Handling (product advantage over KARL):**
- Do NOT smooth over discrepancies
- Present both interpretations with citations
- Mark contradiction explicitly in UI (amber state)
- Recommend follow-up refinement

**Acceptance Criteria:**
- [ ] Claim extraction from generated answers
- [ ] Per-claim citation mapping
- [ ] Contradiction detection across sources
- [ ] UI: side-by-side evidence compare (Jordan)
- [ ] Tests: 20+ contradiction detection tests (Sarah)

---

### 1.5 — Evidence Compression
**Owner:** Sheldon (backend)
**What:** When retrieval chains get long, compress evidence while preserving citations.

**V1 (Phase 1):** Rule-based compression
- Summarize evidence bundles by source document
- Keep citation anchors intact (page, paragraph, section)
- Preserve conflicting excerpts separately (never merge conflicts)

**V2 (Phase 2):** Model-based compression
- Learned evidence summarizer
- Optimized for legal/compliance material

**Hard Rule:** Compression MUST NEVER sever citation traceability.

**Acceptance Criteria:**
- [ ] Evidence bundle summarization
- [ ] Citation anchor preservation verified by tests
- [ ] Context window utilization metric (target: 80% useful, 20% overhead)

---

### 1.6 — Expanded Audit Trace (Search Trace Ledger)
**Owner:** Sheldon (backend) + Adam (BigQuery schema)
**What:** Log every VERDICT step in the audit chain.

**New audit fields per query:**
```
retrieval_mode_selected    → "cross_document"
retrieval_steps_count      → 4
sub_queries_issued         → ["retention clause", "deletion obligations", ...]
docs_searched              → 47
docs_excluded_privilege    → 12
compression_events         → 1
contradiction_flags        → true
refusal_reason             → null | "insufficient evidence after 6 steps"
step_confidence_trajectory → [0.42, 0.61, 0.78, 0.89]
total_retrieval_time_ms    → 3200
```

**Acceptance Criteria:**
- [ ] BigQuery schema updated (Adam)
- [ ] Go audit service extended with VERDICT fields
- [ ] Frontend: expandable "Mercury searched in N steps" trace (Jordan)
- [ ] Audit export includes search traces
- [ ] Tests: trace integrity tests (Sarah)

---

### 1.7 — CyGraph Integration into Chat Pipeline
**Owner:** Sheldon (backend) + Jordan (frontend)
**What:** Wire existing CyGraph knowledge graph into VERDICT retrieval.

**CyGraph already has:** 5 Prisma models (KgEntity, KgEdge, KgClaim, KgProvenance, KgMention), entity extraction (5 frontend files), 88 tests.

**Integration points:**
- During RETRIEVE step: query CyGraph entities + relationships alongside vector search
- Entity-aware query expansion: "Acme Corp" → also search related entities
- Relationship traversal: "Who signed the contract?" → follow KgEdge connections
- Fact aggregation: collect KgClaim entries across time

**Acceptance Criteria:**
- [ ] CyGraph entities returned alongside vector results in retriever
- [ ] Entity-aware query expansion in decomposition step
- [ ] Relationship traversal for entity queries
- [ ] Tests: CyGraph integration tests (Sarah)

---

### 1.8 — Stop-Reason Reporting
**Owner:** Sheldon (backend) + Jordan (frontend)
**What:** When Mercury stops or refuses, explain WHY.

**Stop reasons:**
- `evidence_insufficient` — searched N documents, confidence below threshold
- `search_saturated` — same results returning on reformulation
- `privilege_blocked` — relevant documents exist but are privilege-restricted
- `query_ambiguous` — multiple valid interpretations, needs clarification
- `step_limit_reached` — max retrieval steps exhausted

**UI (Jordan):**
```
"I found 3 partial references but not enough grounded evidence to answer safely.
 Searched: 47 documents across 4 retrieval steps.
 Suggestion: Try narrowing your query to a specific contract or date range."
```

**Acceptance Criteria:**
- [ ] Stop reason enum in Go backend
- [ ] SSE event: `silence` event includes reason + suggestions
- [ ] UI: contextual refusal with actionable suggestions
- [ ] Tests: all 5 stop reasons triggered and verified (Sarah)

---

## PHASE 2: Sovereign Intelligence Platform (Sprints 5-8, ~8 weeks)

*Mercury becomes the workspace. RAGbox replaces File Explorer and chat providers.*

### 2.1 — Sovereign Vault File System
**Owner:** Jordan (frontend) + Sheldon (backend)
**What:** Transform the Vault from document upload into a full file management system.

**Features:**
- Folder hierarchy with drag-drop organization
- Version history per document (diff view)
- Real-time search-as-you-type across all files
- Metadata tagging (auto-extracted + user-defined)
- Bulk operations (move, tag, privilege, delete)
- File preview panel (PDF, images, text, audio transcripts)
- Desktop integration: WebDAV mount OR browser extension for drag-drop from OS

**Acceptance Criteria:**
- [ ] Folder CRUD with nested hierarchy
- [ ] Version history with diff
- [ ] Sub-200ms search-as-you-type
- [ ] Metadata auto-extraction on upload
- [ ] Bulk operations UI
- [ ] Desktop integration spike (Adam)

---

### 2.2 — Multi-Modal RAG
**Owner:** Sheldon (backend)
**What:** Extend RAG beyond text to audio, video, and images.

**Pipeline per media type:**
- **Audio:** Upload → transcription (Deepgram/Whisper) → chunk → embed → searchable
- **Video:** Upload → frame extraction → scene description → transcript → chunk → embed
- **Images:** Upload → OCR + description → embed → searchable
- **All:** Metadata extraction (duration, speaker diarization, timestamps)

**Acceptance Criteria:**
- [ ] Audio files become queryable ("What was discussed in the meeting recording?")
- [ ] Image content searchable via OCR + description
- [ ] Video: at minimum transcript-based search
- [ ] Citation anchors include timestamps for audio/video

---

### 2.3 — Mercury Autonomous Actions
**Owner:** Sheldon (backend) + Jordan (frontend)
**What:** Mercury doesn't just answer — she ACTS. Every action audited and reversible.

**Action types:**
- `draft_document` — Create a document from vault evidence with citations
- `send_email` — Draft and send via Gmail (existing) with approval flow
- `schedule_followup` — Create calendar reminder for document review
- `file_document` — Auto-sort uploaded document into correct vault folder
- `create_report` — Generate compliance/audit report from vault data
- `notify_team` — Alert team members about document changes or findings
- `track_deadline` — Extract and monitor contractual deadlines

**Guardrails:**
- All actions require user confirmation (pendingConfirmation in mercuryStore)
- Every action logged to audit trail
- Undo capability for reversible actions
- Privilege mode restricts which actions can access which documents

**Acceptance Criteria:**
- [ ] Each action type implemented with confirmation flow
- [ ] Audit logging for every action
- [ ] Undo for reversible actions
- [ ] Tests: action execution + rollback tests (Sarah)

---

### 2.4 — Document Generation Engine (Mercury Forge V2)
**Owner:** Sheldon (backend) + Jordan (frontend)
**What:** Mercury creates verifiable documents autonomously.

**Document types:**
- Legal briefs with cited precedents from vault
- Compliance reports with evidence chains
- Battle cards from competitive intelligence
- Executive summaries from multi-document synthesis
- Contract comparison reports with clause-by-clause analysis

**Every generated document includes:**
- Full citation chain to source documents
- Confidence score per claim
- Contradiction flags where sources disagree
- Audit hash for verification
- Version history

**Acceptance Criteria:**
- [ ] Template-driven generation with VERDICT evidence chain
- [ ] PDF export with embedded citations
- [ ] Generated docs stored in vault as first-class documents
- [ ] Tests: generation accuracy + citation integrity (Sarah)

---

### 2.5 — Unified Communication Hub
**Owner:** Jordan (frontend) + Sheldon (backend)
**What:** Mercury is the single communication interface.

**Channels (already partially built):**
- Dashboard chat (done)
- WhatsApp (done — Vonage/Meta)
- Voice (done — Inworld/Deepgram)
- Email (Gmail send done, inbound in sprint)
- ROAM (webhook done, brain integration in sprint)

**New for V2:**
- Team threads (multiple users in same vault)
- Channel routing (Mercury decides response channel based on context)
- Cross-channel memory (conversation from WhatsApp continues in dashboard)
- Notification hub (all channel activity in one view)

**Acceptance Criteria:**
- [ ] Cross-channel conversation continuity
- [ ] Team thread support
- [ ] Unified notification view
- [ ] Channel preference per user

---

### 2.6 — Performance Benchmarking & Certification
**Owner:** Sarah (test) + Dr. Insane (QA)
**What:** Measurable, publishable performance metrics.

**Metrics:**
- `accuracy` — % of answers verified correct against ground truth
- `completeness` — % of relevant information included
- `citation_integrity` — % of claims properly sourced
- `response_time` — p50/p95/p99 latency
- `refusal_precision` — % of refusals that were correct to refuse
- `retrieval_efficiency` — average steps per query by mode
- `contradiction_detection_rate` — % of conflicts caught
- `human_comparison` — time to answer vs. human paralegal/analyst

**Certification dashboard:**
- Real-time performance metrics
- Publishable certification report ("Mercury scored 94.2% accuracy on legal Q&A")
- A/B comparison: Mercury vs. human baseline

---

## PHASE 3: Learned Intelligence & Market Leadership (Sprints 9-12, ~8 weeks)

*Mercury learns from usage. RAGbox becomes self-improving.*

### 3.1 — Learned Retrieval Policy (Rule-Based → RL)
**Owner:** Sheldon (backend)
**What:** Replace Phase 1's rule-based search routing with learned policies.

**Approach:**
1. Collect telemetry from Phase 1+2 (which modes worked, which failed, step counts, confidence trajectories)
2. Build synthetic benchmark suite (RAGboxBench — our KARLBench equivalent)
3. Train retrieval policy on reward signals:
   - `+reward` = high citation accuracy, fewer steps, correct refusals
   - `-reward` = hallucinations, unnecessary retrieval, missed evidence
4. Deploy as model adapter (not replacing base LLM, augmenting retrieval decisions)

**NOT in initial Phase 3 launch — roadmap for V3:**
- Full RL training pipeline
- Continuous learning from production usage
- Per-tenant model adaptation

---

### 3.2 — Sovereign Model Hosting
**Owner:** Adam (infra) + Sheldon (backend)
**What:** Option for data to never leave customer's perimeter.

**Tiers:**
- `cloud` (default): Vertex AI / OpenRouter managed models
- `dedicated`: Customer-specific GCP project with isolated model endpoint
- `on-prem`: Self-hosted model (Llama/Mistral) on customer hardware

**Acceptance Criteria:**
- [ ] Model adapter supports local inference endpoint
- [ ] Data residency guarantees verifiable in audit
- [ ] Performance parity testing (Sarah)

---

### 3.3 — Workspace Memory System
**Owner:** Sheldon (backend) + Jordan (frontend)
**What:** Three-tier memory model for Mercury.

| Layer | Persistence | Content | Example |
|-------|------------|---------|---------|
| **Conversation** | Session | What user asked this turn | "Find termination clauses" |
| **Working** | Cross-session | What Mercury learned during investigation | "Acme contracts use 30-day notice" |
| **Vault** | Permanent | Durable extracted facts, user-curated | "Standard indemnification cap is 2x" |

**Mercury can reference any layer:**
- "Based on our conversation last Tuesday..."
- "I recall from a previous investigation that Acme uses..."
- "Your vault knowledge base indicates..."

---

### 3.4 — Content Gap Intelligence
**Owner:** Sheldon (backend) + Jordan (frontend)
**What:** Failed VERDICT searches generate actionable intelligence.

**When Mercury can't answer after multi-step search:**
- Log which concept was missing
- Which search strategy failed
- Whether documents are absent vs. weakly indexed vs. ambiguous
- Suggested ingestion or policy actions

**Mercury proactively says:**
```
"I couldn't find information about data retention policies.
Your vault doesn't appear to contain any data retention documents.
Suggestion: Upload your data retention policy to improve future queries."
```

---

### 3.5 — RAGboxBench (Our KARLBench Equivalent)
**Owner:** Sarah (test)
**What:** Proprietary benchmark suite for VERDICT evaluation.

**6 task categories (matching KARL + our additions):**
1. Constraint entity search (legal clause finding)
2. Cross-document synthesis (contract comparison)
3. Long-document traversal (finding needles in 100+ page docs)
4. Exhaustive retrieval (complete mention enumeration)
5. Procedural reasoning (process extraction)
6. Fact aggregation (timeline construction)
7. **Privilege-aware search** (RAGbox-unique: correct filtering under privilege mode)
8. **Contradiction detection** (RAGbox-unique: identifying conflicting evidence)

**Acceptance Criteria:**
- [ ] 100+ test cases per category
- [ ] Automated scoring pipeline
- [ ] Publishable results format
- [ ] Baseline comparison with V1

---

## Team Assignment Summary

| Agent | Phase 1 | Phase 2 | Phase 3 |
|-------|---------|---------|---------|
| **Sheldon** | Search Router, VERDICT Loop, Query Decomposition, Evidence Verification, Compression, CyGraph Integration, Stop Reasons | Multi-Modal RAG, Autonomous Actions, Doc Generation, Comms Hub backend | Learned Retrieval, Sovereign Hosting, Workspace Memory, Gap Intelligence |
| **Jordan** | Search mode UI, Contradiction compare UI, Search trace UI, Stop reason UI | Vault File System, Action confirmation UI, Doc generation UI, Comms Hub frontend, Certification dashboard | Memory UI, Gap intelligence UI |
| **Sarah** | 50+ classification tests, multi-step integration tests, contradiction tests, stop reason tests, trace integrity tests | Action tests, generation accuracy tests, cross-channel tests | RAGboxBench (800+ test cases), performance parity tests |
| **Adam** | BigQuery schema update, audit infrastructure | Desktop integration spike, sovereign hosting infra | RL training infra, per-tenant isolation |
| **Dr. Insane** | Certify each deploy, validate VERDICT accuracy | Certify autonomous actions, validate doc generation | Certify benchmark results, validate sovereign mode |

---

## Success Criteria (6 Months)

| Metric | Target |
|--------|--------|
| VERDICT retrieval modes | 6 operational |
| Multi-step queries supported | Up to 10 steps |
| Citation accuracy | > 95% |
| Refusal precision | > 90% |
| Contradiction detection | > 85% |
| Response latency (p95) | < 15s for complex, < 3s for simple |
| File system operations | Folder CRUD, versions, search < 200ms |
| Autonomous actions | 7 action types with confirmation flow |
| Document generation | 5 template types with citation chains |
| Test coverage | > 80% across all V2 code |
| RAGboxBench score | Published baseline |
| Mercury uptime | 99.9% |

---

## The Category Move

KARL proves adaptive search is possible.
RAGbox proves sovereign compliance is required.
VERDICT combines both: **Adaptive Sovereign Retrieval.**

Mercury delivers the VERDICT.
Every answer is a verified judgment.
Every search step is audited.
Every refusal is explained.
Every contradiction is surfaced.
Every action is certified.

*"Mercury knows how to search like an expert, verify like an auditor, and refuse like a lawyer."*
