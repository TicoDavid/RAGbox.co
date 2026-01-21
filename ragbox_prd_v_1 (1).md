# RAGbox.co Product Requirements Document (PRD)

## Version
- **PRD Version:** v1.0 (Living Document)
- **Status:** Draft – Section 1 Complete

---

## 1. Problem Frame & User Truth

### 1.1 Target User
RAGbox is built for **small-to-mid sized legal and financial professionals** operating in high-trust, high-liability environments.

Primary users:
- Attorneys (solo, small firm, mid-market)
- Legal associates / paralegals
- Financial analysts, compliance officers, auditors

Secondary users:
- Managing partners
- IT/security-conscious firm owners

These users are not "AI hobbyists." They are **risk managers first**.

---

### 1.2 Core User Anxiety
The dominant emotional driver is **fear of loss of control**.

Specifically:
- Fear that confidential documents are being retained, reused, or leaked
- Fear that AI outputs are hallucinated, unverifiable, or non-auditable
- Fear that adopting AI creates professional liability
- Fear that "black box" tools will fail silently

Current RAG tools force users to *trust promises* instead of *verifiable systems*.

---

### 1.3 Current Failure State (Before RAGbox)
Today, users experience one or more of the following:

- Uploading sensitive documents into opaque SaaS platforms
- No clarity on where data is stored, logged, or reused
- AI answers that sound confident but cannot be cited or audited
- No meaningful distinction between exploratory questions and high-stakes queries
- Overly complex tooling that requires technical setup or consultants

The result:
> **AI is experimented with — but never fully trusted.**

---

### 1.4 Desired End State (After RAGbox)
With RAGbox, the user feels:

- In control of their data at all times
- Confident that nothing leaves their sovereign environment
- Certain that every answer is grounded in their documents
- Reassured that the system will refuse to answer rather than hallucinate
- Empowered to interrogate documents as if conducting a deposition

The emotional shift:
> **From “Can I trust this?” → “I can rely on this.”**

---

### 1.5 Product Philosophy (Non-Negotiable)
RAGbox is not a chat app.

It is:
- A **Digital Fort Knox** for private knowledge
- A system that prioritizes *restraint over verbosity*
- A tool that values *refusal* as a feature, not a failure

If the system cannot answer with ≥ 0.85 confidence, it must:
- Decline to answer
- Communicate uncertainty clearly
- Leave a verifiable audit trail

Silence is safer than speculation.

---

### 1.6 Success Definition (Section-Level)
This section is successful if:
- A new engineer or agent can clearly articulate who the product is for
- The emotional problem is unambiguous
- No feature decisions contradict this frame

If a future feature violates user trust or increases ambiguity, it is out of scope by default.

---

**End of Section 1**

---

## 2. System Boundaries & Trust Guarantees

### 2.1 System Definition
RAGbox is a **sovereign, single-tenant Retrieval-Augmented Generation appliance**.

It is designed to operate as a *closed system* with explicit boundaries around data ingress, processing, and egress.

At all times, the system must be able to answer the question:
> **“Where did this answer come from, and who can see it?”**

---

### 2.2 What the System Does (In Scope)
RAGbox explicitly supports the following behaviors:

- Accepts user-uploaded documents via controlled UI flows
- Stores documents in customer-controlled cloud storage (CMEK enforced)
- Indexes documents into a private vector database scoped to the tenant
- Answers user questions **only** using retrieved document context
- Produces citations that map answers back to source documents
- Logs every query, retrieval set, and response decision immutably
- Calculates a confidence score for every response
- Refuses to answer when confidence < 0.85

These behaviors are **guaranteed** by design, not configuration.

---

### 2.3 What the System Explicitly Does NOT Do (Out of Scope)
RAGbox will **never**:

- Train or fine-tune models on customer data
- Share embeddings, documents, or prompts across tenants
- Send customer data to third-party SaaS endpoints
- Retain chat history outside the customer’s environment
- Answer questions without document grounding
- Generate speculative or creative content
- Provide legal, financial, or professional advice beyond document interrogation

If a requested behavior requires breaking these constraints, the system must refuse.

---

### 2.4 Confidence, Refusal, and Silence Protocol
Every system response must pass through a **Confidence Gate**.

The gate evaluates:
- Retrieval coverage
- Source agreement / contradiction
- Model uncertainty signals

If confidence ≥ 0.85:
- Answer is returned
- Citations are attached
- Audit log is written

If confidence < 0.85:
- No answer is returned
- A refusal message is shown to the user
- The refusal itself is logged

Refusal is considered a **successful outcome**, not an error.

---

### 2.5 Auditability & Veritas Protocol
All system actions are logged under the **Veritas Protocol**.

Immutable audit records include:
- User identity and role
- Timestamp
- Query text (hashed where required)
- Document IDs retrieved
- Confidence score
- Answer or refusal state

Audit logs are:
- Append-only
- Queryable by authorized roles
- Never editable or deletable via the UI

---

### 2.6 Responsibility Boundary
RAGbox is responsible for:
- Secure storage and retrieval
- Faithful representation of document content
- Accurate citation and confidence signaling

The user remains responsible for:
- Interpretation of outputs
- Professional judgment
- Final decision-making

RAGbox **augments cognition** — it does not replace accountability.

---

### 2.7 Success Definition (Section-Level)
This section is successful if:
- An agent cannot invent features outside these boundaries
- Security posture is unambiguous
- Refusal behavior is clearly justified and normalized

Any future feature proposal must explicitly state whether it:
- Preserves these guarantees
- Weakens them (and is therefore rejected)

---

**End of Section 2**

---

## 3. User Roles, Permissions & Trust Levels

### 3.1 Role Philosophy
RAGbox operates in **zero-trust by default**.

Permissions are:
- Explicit (never implied)
- Enforced at every API boundary
- Logged under the Veritas Protocol

There is no concept of a "super chat." Every action is scoped to a role.

---

### 3.2 Core User Roles

#### 3.2.1 Partner (Owner / Managing Role)
Represents firm ownership and ultimate accountability.

**Capabilities:**
- Upload and delete documents
- Query all documents within the tenant
- View citations and confidence scores
- Access full audit logs
- Manage user roles and permissions
- Configure security settings (where applicable)

**Restrictions:**
- Cannot bypass confidence gate
- Cannot disable audit logging

---

#### 3.2.2 Associate (Standard User)
Represents day-to-day knowledge workers.

**Capabilities:**
- Upload documents (if permitted)
- Query documents they are authorized to access
- View citations and confidence scores

**Restrictions:**
- Cannot view full audit logs
- Cannot manage users or roles
- Cannot alter system security settings

---

#### 3.2.3 Auditor (Read-Only Oversight)
Represents compliance, review, or external audit functions.

**Capabilities:**
- View audit logs
- Review queries, responses, refusals, and citations
- Export audit data (where permitted)

**Restrictions:**
- Cannot upload documents
- Cannot issue queries
- Cannot modify any system state

---

### 3.3 Permission Enforcement Model
Permissions are enforced:
- Server-side only (never trusted to the client)
- At every request (no session-wide assumptions)

Each request must validate:
- User identity
- Role
- Action being attempted
- Resource scope

If any validation fails, the request is rejected and logged.

---

### 3.4 Privilege Visibility in the UI
The UI must:
- Clearly indicate the user’s current role
- Disable or hide actions the role cannot perform
- Never present UI affordances that will fail silently

Security feedback should be **explicit and calm**, not alarming.

---

### 3.5 Role-Based Audit Trails
All actions are logged with:
- User ID
- Role at time of action
- Action type
- Resource identifiers

Role changes themselves are also audited.

---

### 3.6 Success Definition (Section-Level)
This section is successful if:
- No feature can be implemented without an explicit role decision
- Privilege escalation is structurally impossible via the UI
- Audit logs clearly reflect *who did what, and as whom*

---

**End of Section 3**

---

## 4. Core User Flows (End-to-End)

This section defines the **canonical user flows** supported by RAGbox. These flows are normative: future features must compose from them rather than invent parallel paths.

---

### 4.1 Document Ingestion Flow (Upload → Ready)

**Actors:** Partner, Associate (if permitted)

**Goal:** Securely ingest documents and signal readiness without ambiguity.

**Flow:**
1. User initiates upload via explicit action (drag-and-drop or file picker).
2. UI enters "ingest pending" state with clear visual feedback.
3. System validates file type, size, and permissions.
4. Document is encrypted at rest using CMEK and stored in tenant-scoped storage.
5. Document is indexed into the private vector database.
6. System confirms document readiness.

**Acceptance Criteria:**
- Upload does not begin without explicit user intent.
- UI provides immediate, non-alarming feedback during ingestion.
- No document is queryable until indexing completes.
- Failures are surfaced clearly with actionable guidance.

**Out of Scope:**
- Automatic summarization on upload
- Cross-document linking

---

### 4.2 Query & Interrogation Flow (Ask → Retrieve → Answer/Refusal)

**Actors:** Partner, Associate

**Goal:** Answer questions strictly grounded in uploaded documents.

**Flow:**
1. User submits a query.
2. System validates role and permissions.
3. Retrieval selects relevant document passages.
4. Model generates a candidate answer.
5. Confidence Gate evaluates the response.
6. System returns an answer with citations **or** a refusal.

**Acceptance Criteria:**
- Every answer includes citations.
- Confidence score is computed for every query.
- Refusals are calm, explicit, and non-technical.
- No partial or speculative answers are shown.

**Out of Scope:**
- Free-form brainstorming
- Creative writing

---

### 4.3 Refusal & Silence Flow

**Actors:** All querying users

**Goal:** Preserve trust by refusing unsafe answers.

**Flow:**
1. Query is evaluated.
2. Confidence score < 0.85.
3. System declines to answer.
4. UI explains refusal succinctly.
5. Refusal is logged under Veritas Protocol.

**Acceptance Criteria:**
- Refusal is visually distinct from an error.
- User is never shown a low-confidence answer.
- Refusal messaging reinforces safety, not failure.

---

### 4.4 Audit Review Flow

**Actors:** Partner, Auditor

**Goal:** Provide transparent oversight of system behavior.

**Flow:**
1. Authorized user accesses audit view.
2. Logs are filtered by time, user, or action.
3. Individual entries can be inspected.
4. Exports are generated if permitted.

**Acceptance Criteria:**
- Audit data is read-only.
- Role context is always visible.
- Refusals are first-class audit events.

**Out of Scope:**
- Editing or deleting logs

---

### 4.5 Mobile Interaction Flow

**Actors:** All users

**Goal:** Maintain clarity and control on small screens.

**Flow:**
- Drag-and-drop is replaced with tap-to-upload.
- Core actions remain reachable without gesture ambiguity.
- Audit views are read-only and simplified.

**Acceptance Criteria:**
- No hidden critical actions behind gestures.
- Upload and query flows are fully functional.
- Performance remains acceptable on mobile devices.

---

### 4.6 Success Definition (Section-Level)
This section is successful if:
- Every major interaction maps to a defined flow
- No UI behavior is undefined or implicit
- Flows can be decomposed into atomic user stories

---

**End of Section 4**

---

## 5A. Data Model & Core Entities

This section defines the **canonical data entities** used throughout RAGbox. These entities are the source of truth for backend services, audit logging, and frontend contracts.

All entities must be:
- Explicitly typed
- Versionable
- Auditable where applicable

---

### 5A.1 User

Represents an authenticated human actor.

**Fields:**
- `user_id` (immutable, UUID)
- `email` (immutable)
- `role` (Partner | Associate | Auditor)
- `status` (Active | Suspended)
- `created_at`
- `last_login_at`

**Notes:**
- Role changes are audit events.
- Users are tenant-scoped.

---

### 5A.2 Document

Represents an uploaded source file.

**Fields:**
- `document_id` (immutable)
- `filename`
- `mime_type`
- `size_bytes`
- `uploaded_by` (user_id)
- `uploaded_at`
- `storage_uri` (opaque to UI)
- `index_status` (Pending | Indexed | Failed)
- `checksum`

**Notes:**
- Documents are immutable after upload.
- Deletion is a privileged, audited action.

---

### 5A.3 DocumentChunk

Represents an indexed fragment of a document.

**Fields:**
- `chunk_id`
- `document_id`
- `content_hash`
- `embedding_vector` (never exposed)
- `chunk_index`

**Notes:**
- Chunks exist only for retrieval.
- UI never accesses chunk content directly.

---

### 5A.4 Query

Represents a user-issued question.

**Fields:**
- `query_id`
- `user_id`
- `query_text`
- `submitted_at`
- `confidence_score`
- `outcome` (Answered | Refused)

---

### 5A.5 Answer

Represents a successful system response.

**Fields:**
- `answer_id`
- `query_id`
- `answer_text`
- `generated_at`

---

### 5A.6 Citation

Maps an answer to its document sources.

**Fields:**
- `citation_id`
- `answer_id`
- `document_id`
- `chunk_id`
- `relevance_score`

---

### 5A.7 AuditEvent (Veritas Protocol)

Represents an immutable system log entry.

**Fields:**
- `event_id`
- `timestamp`
- `user_id`
- `role`
- `action_type`
- `resource_id`
- `metadata` (structured, append-only)

**Notes:**
- Audit events are never editable.
- Refusals generate audit events.

---

### 5A.8 Entity Integrity Rules

- No entity may reference another tenant.
- UI-facing entities must never expose:
  - embeddings
  - storage URIs
  - internal confidence heuristics

---

### 5A.9 Success Definition (Section-Level)
This section is successful if:
- Backend, frontend, and agents share a single data contract
- No entity ambiguity exists
- Future migrations can version entities safely

---

**End of Section 5A**

---

## 5B. Atomic User Stories (Ralph-Ready)

This section decomposes the core user flows into **atomic, testable user stories** designed for reset-based agent execution ("Ralph loop").

Each story:
- Is independently executable
- Has binary acceptance criteria (pass/fail)
- Avoids hidden dependencies
- Resets context cleanly after completion

---

### US-001: View Landing Page

**As a** user
**I want** to view the RAGbox landing page
**So that** I immediately understand the product’s purpose and trust posture

**Preconditions:**
- User is unauthenticated

**Acceptance Criteria:**
- Page loads in dark mode by default
- Headline and subhead are visible without scrolling
- Primary CTA “Feed the Box” is present
- No upload or query actions are available

**Out of Scope:**
- Authentication
- Upload behavior

---

### US-002: Initiate Document Upload (Desktop)

**As a** Partner or Associate
**I want** to drag a file onto the interface
**So that** I can intentionally begin document ingestion

**Preconditions:**
- User is authenticated
- User role permits upload

**Acceptance Criteria:**
- Drag-over triggers visual feedback within 50ms
- No upload begins until file drop
- Multiple drag-enter/leave events do not flicker UI

**Out of Scope:**
- File validation
- Indexing

---

### US-003: Upload Document Successfully

**As a** Partner or Associate
**I want** to upload a document
**So that** it becomes available for interrogation

**Preconditions:**
- US-002 completed

**Acceptance Criteria:**
- File is accepted and acknowledged
- Ingest status is shown (pending → complete)
- Document is not queryable until indexed

**Out of Scope:**
- Summarization
- Cross-document analysis

---

### US-004: Submit Query

**As a** Partner or Associate
**I want** to submit a question
**So that** the system can retrieve relevant information

**Preconditions:**
- At least one document indexed

**Acceptance Criteria:**
- Query input accepts plain text
- Submission is explicit (button or enter)
- Empty queries are rejected

**Out of Scope:**
- Voice input
- Auto-complete

---

### US-005: Receive Answer with Citations

**As a** Partner or Associate
**I want** to receive an answer with citations
**So that** I can verify the source

**Preconditions:**
- US-004 completed
- Confidence score ≥ 0.85

**Acceptance Criteria:**
- Answer text is displayed
- One or more citations are shown
- Confidence score is visible

**Out of Scope:**
- Answer editing
- Exporting answers

---

### US-006: Experience Refusal

**As a** Partner or Associate
**I want** the system to refuse low-confidence queries
**So that** I am not misled

**Preconditions:**
- US-004 completed
- Confidence score < 0.85

**Acceptance Criteria:**
- No answer text is displayed
- Refusal message is shown
- UI does not indicate an error state

**Out of Scope:**
- Retry suggestions

---

### US-007: View Audit Log

**As a** Partner or Auditor
**I want** to review audit logs
**So that** I can understand system usage

**Preconditions:**
- User role permits audit access

**Acceptance Criteria:**
- Audit entries are visible
- Entries are read-only
- Role context is shown

**Out of Scope:**
- Editing logs

---

### US-008: Mobile Upload Flow

**As a** mobile user
**I want** to upload a document without drag-and-drop
**So that** mobile usage is fully supported

**Preconditions:**
- User is authenticated on mobile

**Acceptance Criteria:**
- Tap-to-upload is available
- Upload status is visible
- No drag-only interactions required

**Out of Scope:**
- Mobile-specific animations

---

### 5B.1 Story Execution Rules

- Only one user story may be executed per agent iteration
- Each story must be marked pass/fail explicitly
- Progress is recorded in `progress.txt`
- Long-term decisions are recorded in `agents.md`

---

### 5B.2 Success Definition (Section-Level)
This section is successful if:
- Ralph can execute stories without clarification
- Stories map cleanly to flows and entities
- No story contains hidden complexity

---

**End of Section 5B**

---

## 6. Non-Functional Requirements (NFRs)

This section defines the **non-negotiable system qualities** that govern performance, security, reliability, and user experience. These requirements apply to all features and user stories.

---

### 6.1 Security & Privacy

**Requirements:**
- All data must be tenant-isolated at rest and in transit
- Encryption at rest must use CMEK
- All external access must be protected by Identity-Aware Proxy (IAP)
- No customer data may be used for model training or fine-tuning
- Secrets must never be stored in source control

**Acceptance Criteria:**
- Independent security review can verify isolation boundaries
- Compromise of one tenant cannot expose another

---

### 6.2 Performance & Latency

**Requirements:**
- UI interactions (hover, drag-over, click) must respond within 50ms
- Document upload acknowledgment must occur within 500ms
- Query responses must return within 5 seconds for p95 cases
- Refusal responses must return within 2 seconds

**Acceptance Criteria:**
- Performance budgets are measurable and enforced
- Slow responses are logged and observable

---

### 6.3 Reliability & Availability

**Requirements:**
- Core query and audit systems must target 99.9% availability
- System must degrade gracefully under load
- Failures must never result in partial or speculative answers

**Acceptance Criteria:**
- Failure modes are explicit and safe
- Refusal is preferred over timeout-induced hallucination

---

### 6.4 Auditability & Observability

**Requirements:**
- All user and system actions generate audit events
- Logs must be immutable and queryable
- Observability must cover ingestion, retrieval, generation, and refusal

**Acceptance Criteria:**
- Auditors can reconstruct system behavior end-to-end
- Missing logs are treated as critical defects

---

### 6.5 UX & Accessibility

**Requirements:**
- Dark mode is default and always available
- Contrast ratios must meet WCAG AA standards
- Motion must respect reduced-motion preferences
- Critical actions must never rely solely on gesture

**Acceptance Criteria:**
- Accessibility audits pass WCAG AA
- Users can complete core flows without animation

---

### 6.6 Maintainability & Evolvability

**Requirements:**
- All services must be stateless where possible
- Data models must be versioned
- Breaking changes require explicit migration paths

**Acceptance Criteria:**
- New features can be added without refactoring core flows
- Migrations are auditable and reversible

---

### 6.7 Success Definition (Section-Level)

This section is successful if:
- Agents cannot optimize for speed at the expense of safety
- Performance and trust are treated as features
- Violations of NFRs are considered functional failures

---

**End of Section 6**

