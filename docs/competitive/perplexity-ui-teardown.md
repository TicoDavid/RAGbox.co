# Competitive UI Teardown: Perplexity vs. RAGbox

**Date:** 2026-02-20
**Author:** Sheldon, Chief Engineer -- RAGbox.co
**Purpose:** Inform landing page copy, investor deck positioning, and v1.1 UI roadmap
**Classification:** Internal -- Do Not Distribute

---

## Executive Summary

Perplexity has evolved from a search-replacement into a full productivity platform (Comet browser, Spaces, Memory, Finance, multi-model Council). Their UI is polished, citation-forward, and optimized for *open-web research*. RAGbox operates in a fundamentally different lane -- sovereign, vault-only document intelligence with compliance-grade controls. This teardown identifies what to borrow, what to reject, and where RAGbox already has an insurmountable moat.

---

## Perplexity's Current UI (February 2026): What We Observed

### 1. Tab / Thread Structure
- Perplexity's web app uses a single-thread-at-a-time model with a **Library** sidebar listing past threads.
- The **Comet browser** (launched July 2025, Chromium-based) adds true browser tabs with an `@tab` command that lets the AI reference content in open tabs. Cross-tab synthesis is a headline feature.
- Threads are persistent conversations that remember full context (initial question, follow-ups, all responses, all sources).

### 2. Input Bar Design
- Central search bar with a **Focus mode** dropdown (Web, Academic, Social, Writing, YouTube, Reddit, Wolfram, Finance).
- Focus modes act as "context filters" that route retrieval to specific source domains.
- Attachment/upload support for PDFs and research materials (Pro tier).
- Model picker for Pro users: GPT-4, Claude 3, GPT-5.2, and specialized models for coding, reasoning, creative writing.
- Voice input via Comet browser's Voice Mode.

### 3. Thread History Sidebar
- Left sidebar with **Library** (all past threads), **Spaces** (project-based organization), and **Discover** (trending topics).
- Threads are searchable and filterable.
- Library was recently promoted to the top of the sidebar menu based on user demand.

### 4. Incognito / Private Mode
- Toggle via profile icon in bottom-left corner.
- Conversations in incognito are not saved to Library and expire after 24 hours.
- History is temporarily hidden from sidebar while active.
- Comet browser has its own incognito mode that blocks browsing data collection.

### 5. Source Citations Display
- Numbered inline citations `[1]`, `[2]`, `[3]` embedded in response text.
- Sources panel with title, favicon, and URL metadata below or beside the response.
- Side-by-side citation view on desktop for academic/technical work.
- Resizable panes for output.
- Note: Independent testing found a ~37% error rate in cited claims -- transparent but not always accurate.

### 6. Image / Video Integration
- Image grid results for visual queries.
- Video summaries from YouTube sources.
- Seedream 4.5 image generation for Pro/Max users.
- "Virtual Try On" feature (consumer/retail).

### 7. Collections -> Spaces
- Collections were deprecated and automatically migrated to **Spaces** (late 2024).
- Spaces = dedicated workspaces per project/topic with custom AI instructions, preferred model settings, and file uploads (50 files for Pro, 500 for Enterprise).
- Collaborative: invite others as viewers or "research partners."
- Dual search: uploaded files + web sources within a Space.

### 8. Pro Search vs. Quick Search
- Quick Search: fast, shallow, citation-light.
- Pro Search (Deep Research): multi-step, clarifying questions, deeper web crawl, richer citations.
- Labs: data visualization and report-like outputs.
- Finance mode: live charts, watchlist briefing, patents page.

### 9. Memory & Personalization
- Perplexity Memory: stores user preferences and context across sessions.
- Conversational UI improvements (more natural, less "search engine").
- Snapshot widget: session-level privacy toggles.

### 10. Pricing Structure (February 2026)
| Tier | Price | Key Features |
|------|-------|--------------|
| Free | $0 | Limited queries, basic models |
| Pro | $20/mo | Multi-model, Deep Research, file uploads, Spaces |
| Max | $200/mo | Highest limits, priority access |
| Education | Free (12 mo) | Pro features for students |
| Enterprise | $40-$325/seat | Admin controls, SSO, data retention policies |

---

## RAGbox's Current UI (from Codebase)

### Architecture
- **CenterChat** (main chat panel): EmptyState watermark, message list, input bar, auto-scroll.
- **CenterInputBar**: Plus menu (upload, connectors [coming soon], deep research [new]), Safety Mode toggle, model dropdown (AEGIS native vs. BYOLLM), mic button, send/stop.
- **CenterHeader**: Thread title, query counter, New Chat button, document scope chip, incognito badge.
- **CenterMessage**: Three-tab response view (Answer, Sources, Evidence), markdown rendering, confidence badge, citation badges `[1]`, `[2]`, hover actions (copy, thumbs up/down).
- **MercuryPanel**: Multi-channel assistant (dashboard, voice, email, SMS), 10 persona lenses, tool routing, whistleblower mode with amber theme shift.
- **chatStore**: `safetyMode`, `documentScope`, `incognitoMode`, `selectedModel`, `privilegeMode` integration, SSE streaming from Go backend.

### Key UI Patterns Already Implemented
- Document scoping ("Chat with this File") via `startDocumentChat()`
- Incognito mode (no persistence, `X-Incognito` header, skip auto-title)
- Safety Mode (vault-only vs. URL-fetching toggle)
- Model picker (AEGIS sovereign pipeline vs. BYOLLM)
- Evidence panel with confidence score, retrieval pipeline stats, latency, model used
- Citation cards with document name, page number, excerpt, relevance bar
- Streaming with SSE (token, citations, confidence, silence events)

---

## SECTION 1: What Perplexity Does That We Should Copy

| Perplexity Pattern | RAGbox Gap | Priority | Effort |
|---|---|---|---|
| **Thread History Sidebar** -- Library of past conversations, searchable and filterable | RAGbox currently has a single active thread in `chatStore` with `persist`. No thread list, no history browser. Clearing a thread loses it. | **P0 -- Critical** | Medium |
| **Multi-Thread Tabs** -- Work on multiple research threads simultaneously | Single-thread only. No tab bar, no thread switching. Users lose context when starting a new chat. | **P1 -- High** | Medium-High |
| **Spaces / Project Organization** -- Group threads by project with custom instructions | No concept of project workspaces. Documents live in the vault but threads are unorganized. | **P2 -- Medium** | High |
| **Input Bar Focus Modes** -- Contextual filtering (Academic, Finance, etc.) | RAGbox has Safety Mode (vault vs. URL) and document scope, but no domain-specific retrieval lenses. The 10 Mercury personas are adjacent but live in a different panel. | **P1 -- High** | Medium |
| **Side-by-Side Citation View** -- Resizable panes for answer + sources | Sources are in a separate tab (CenterMessage), not side-by-side. Users must click between Answer and Sources tabs. | **P1 -- High** | Medium |
| **Keyboard Shortcuts / Power User UX** -- Quick navigation, search history | No keyboard shortcut system. No Cmd+K palette. | **P2 -- Medium** | Low |
| **Thread Auto-Naming Quality** -- Perplexity auto-names threads meaningfully | RAGbox has `generateTitle()` but it falls back to truncated query. Quality and reliability unknown. | **P3 -- Low** | Low |
| **Session Privacy Toggle (Snapshot Widget)** -- Granular control over what is stored | RAGbox has incognito mode (binary on/off) but no granular session-level privacy controls. | **P3 -- Low** | Medium |

### Detailed Recommendations

**Thread History Sidebar (P0)**
This is the single biggest UX gap. Perplexity's Library is the backbone of their retention loop -- users return to past research. RAGbox users currently lose their conversation when they click "New Chat." We need:
- A `threads[]` array in the store (or AlloyDB-backed)
- A collapsible sidebar or drawer listing past threads with title, timestamp, document scope indicator
- Search/filter within thread history
- This directly feeds the enterprise value proposition: "searchable institutional memory"

**Multi-Thread Tabs (P1)**
Perplexity's Comet browser lets users reference multiple tabs. For an enterprise document platform, this maps to: "Compare Contract A in Tab 1 with Contract B in Tab 2." Implementation:
- Tab bar above `CenterChat` with thread tabs
- Each tab maintains its own `chatStore` state (messages, scope, model)
- Limit to 5-8 tabs to avoid memory bloat

**Focus Modes in Input Bar (P1)**
Perplexity's Focus modes map cleanly to our persona system. Instead of requiring users to open Mercury and select a persona, surface a "Lens" dropdown directly in the CenterInputBar:
- Default: General (all documents, no persona filter)
- Legal Lens, Financial Lens, Compliance Lens, etc.
- This collapses the Mercury persona selector into the main chat experience

**Side-by-Side Citations (P1)**
The current tab-based approach (Answer | Sources | Evidence) forces context-switching. For document intelligence, citations are the product. Consider:
- A collapsible right panel showing sources in real-time as the answer streams
- Click a `[1]` badge to highlight the source card and scroll to the excerpt
- This is where we beat Perplexity -- their citations link to *web URLs*; ours link to *vault documents with page numbers*

---

## SECTION 2: What Perplexity Does That We Should NOT Copy

| Perplexity Feature | Why It Does Not Fit RAGbox |
|---|---|
| **Web Search as Primary Function** | RAGbox is vault-only by design. Our entire value proposition is "your documents, interrogated." Adding open web search would dilute the sovereign positioning, introduce data leakage risk, and confuse the compliance narrative. Safety Mode already has a URL-fetching escape hatch for power users. |
| **Image Grid Results / Visual Search** | Perplexity shows image carousels for visual queries. RAGbox analyzes *documents* -- PDFs, contracts, filings. Image generation (Seedream) and "Virtual Try On" are consumer features with zero enterprise relevance. |
| **Social Sharing / Public Threads** | Perplexity lets users share threads publicly and invite "research partners." Enterprise document intelligence demands privacy by default. Sharing should be audit-logged and admin-controlled, not social-media-style. |
| **Discover Feed / Trending Topics** | A curated news/trending section makes sense for a search engine. It is antithetical to a vault-only platform. Our users do not want to discover what the internet is talking about -- they want to interrogate their own documents. |
| **Consumer Pricing ($20/mo Pro)** | Perplexity's $20/month price point targets individual knowledge workers. RAGbox targets enterprise teams at $99/mo+ with compliance guarantees. Matching their pricing would undermine our positioning as a premium, sovereign platform. |
| **Finance Charts / Stock Watchlists** | Niche vertical feature for Perplexity's consumer audience. RAGbox can serve financial document analysis (10-K filings, audits) but should not become a Bloomberg terminal. |
| **Multi-Model "Council"** | Perplexity routes queries across GPT-4, Claude, etc. simultaneously. RAGbox has AEGIS (sovereign pipeline) + BYOLLM (bring your own). The "Council" pattern introduces model-mixing complexity that conflicts with our audit trail requirements -- every response must trace to a single model for VERITAS compliance. |
| **Browser (Comet)** | Building a browser is a massive capital and engineering bet. RAGbox should integrate *with* browsers (Chrome extension for vault upload), not become one. |

---

## SECTION 3: What RAGbox Does That Perplexity Cannot

| RAGbox Capability | Why Perplexity Cannot Match It |
|---|---|
| **Document Scoping ("Chat with this File")** | `startDocumentChat(docId, docName)` scopes retrieval to a single document. Perplexity searches the open web -- it cannot guarantee answers come exclusively from one uploaded file. Our `documentScope` filter in the RAG pipeline is a hard constraint, not a suggestion. |
| **Attorney-Client Privilege Controls** | `usePrivilegeStore` with binary toggle, amber UI shift, and audit-logged state changes. Perplexity has no concept of legal privilege. Enterprise legal teams cannot use Perplexity for privileged document review -- full stop. |
| **10 Expert Persona Lenses** | Mercury's persona system (CEO, CFO, Legal, Compliance, Risk, Ops, Whistleblower, Auditor, Research, Custom) changes the entire response framing. Perplexity's Focus modes filter *sources*, not *analytical perspective*. A "Whistleblower" lens that surfaces irregularities has no equivalent. |
| **Whistleblower Mode** | Amber theme shift (`isWhistleblowerMode`), brand color override to `#F59E0B`, ring indicator. A dedicated, visually distinct mode for anonymous reporting within the platform. Perplexity has nothing comparable. |
| **Sovereign Studio** | Generate reports (.docx), decks (.pptx), evidence timelines (.xlsx), audit PDFs -- all cited from vault documents. Perplexity's "Labs" does data visualization but cannot produce compliance-grade deliverables from private documents. |
| **Mercury Multi-Channel Assistant** | Voice, email, SMS, and dashboard chat unified in a single thread with `MercuryPanel`. Channel-aware message routing (`channel: 'voice' | 'email' | 'sms' | 'dashboard'`). Perplexity has voice in Comet but no email or SMS channels. |
| **AES-256-GCM Encryption + Zero Retention** | Documents encrypted at rest with CMEK. Zero data retention policy. Perplexity explicitly stores user data and conversation history (their enterprise tier has retention controls, but their default is persistent storage). |
| **VERITAS Audit Trail** | Immutable, timestamped, BigQuery-backed (WORM-compatible) audit log of every query, response, privilege toggle, and document access. Exportable PDF for regulators. Perplexity has no equivalent for SEC 17a-4 or HIPAA audit requirements. |
| **Evidence Panel** | `CenterMessage`'s Evidence tab shows confidence score, retrieval pipeline stats (documents searched, chunks evaluated), model used, latency, and citation count in a structured dashboard. Perplexity shows sources but not the *retrieval provenance* -- users cannot see how many documents were searched or what confidence the system has. |
| **Safety Mode (Vault Boundary Enforcement)** | Binary toggle: vault-only (default) vs. URL-fetching. This is a security control, not a feature -- it prevents accidental data exfiltration. Perplexity's entire product is web-connected; there is no "vault-only" mode. |
| **Incognito with `X-Incognito` Header** | RAGbox's incognito mode skips persistence, auto-titling, and audit trail entries via a dedicated HTTP header. Combined with zero-retention encryption, this is true ephemeral querying. Perplexity's incognito expires threads after 24 hours but does not guarantee zero server-side retention. |
| **Enterprise Tenant Isolation** | Per-tenant vault, per-tenant encryption keys, per-tenant AlloyDB schema. Perplexity's enterprise tier has admin controls but shares infrastructure across tenants. |
| **SOC2 / HIPAA Compliance Posture** | Architecture designed for SOC2 Type II and HIPAA from day one. VPC-isolated database, CMEK encryption, IAM least-privilege. Perplexity's compliance story is evolving but not their core positioning. |

---

## SECTION 4: UI Recommendations for RAGbox v1.1

### Priority 0: Thread History (Must Ship)

**What:** Add a collapsible left sidebar to the CenterChat panel showing past conversation threads.

**Implementation sketch:**
- Extend `chatStore` with `threads: Thread[]` and `activeThreadId: string`
- Each `Thread` has: `id`, `title`, `createdAt`, `updatedAt`, `documentScope?`, `messageCount`, `preview` (first 100 chars of first query)
- Persist to AlloyDB via `/api/chat/threads` endpoint
- Sidebar shows threads grouped by date (Today, Yesterday, Last 7 Days, Older)
- Click to load thread; current thread auto-saves
- Search bar at top of sidebar
- "New Chat" button at top

**Why:** Without thread history, RAGbox feels like a calculator -- use once, result gone. Perplexity's Library is their #1 retention mechanism. Enterprise users need searchable conversation history for institutional memory.

### Priority 1A: Tab Bar for Multi-Thread

**What:** Horizontal tab bar above the chat area allowing 2-5 simultaneous threads.

**Implementation sketch:**
- Tab bar component with thread title, close button, "+" for new tab
- Each tab maps to a `Thread` from the store
- Active tab renders in the CenterChat panel
- Inactive tabs preserve scroll position and state
- Optional: "Compare" mode that splits the view into two threads side-by-side

**Why:** Enterprise users frequently need to cross-reference documents. "Open Contract A in one tab, Contract B in another, ask questions across both" is a killer workflow.

### Priority 1B: Inline Source Sidebar (Replace Tab-Based Citations)

**What:** Replace the Answer | Sources | Evidence tab system with a persistent right sidebar that shows sources in real-time.

**Implementation sketch:**
- Split CenterChat into a 70/30 layout: chat left, sources right
- As the answer streams, citation cards populate the right panel in real-time
- Clicking an inline `[1]` badge scrolls the source panel to that citation and highlights it
- Evidence metadata (confidence, pipeline stats) moves to a collapsible section at the top of the source panel
- The right panel collapses to a thin rail when no citations exist

**Why:** This is where RAGbox can visually surpass Perplexity. Their citations link to web URLs; ours link to vault documents with page numbers, relevance scores, and excerpts. Making this visible *alongside* the answer -- not hidden behind a tab -- makes the citation system the hero of the UI.

### Priority 1C: Lens Selector in Input Bar

**What:** Add a "Lens" dropdown to CenterInputBar that maps to Mercury's persona system.

**Implementation sketch:**
- Pill-shaped dropdown between the Safety toggle and Model dropdown
- Options: General (default), Legal, Financial, Compliance, Risk, Executive, Auditor, Research
- Selecting a Lens sends `persona` field in the `/api/chat` request body
- The Go backend adjusts system prompt and retrieval weighting based on persona
- Visual indicator: lens icon + label in the input bar, thread header shows active lens

**Why:** Perplexity's Focus modes are one of their most praised UX patterns. RAGbox already has the persona engine in Mercury -- this just surfaces it in the main chat for frictionless access.

### Priority 2: Keyboard Shortcuts

**What:** Cmd/Ctrl+K command palette, Cmd+N for new chat, Cmd+Shift+S for toggle safety, Cmd+/ for shortcuts help.

**Why:** Power users (lawyers, analysts) live in keyboard shortcuts. Low effort, high perceived polish.

### Priority 3: Thread Pinning & Favorites

**What:** Pin important threads to the top of the sidebar. Star threads for quick access.

**Why:** Maps to Perplexity's Spaces concept but simpler. Enterprise users need to bookmark critical research threads (e.g., "Q4 Audit Analysis" stays pinned for weeks).

---

## Competitive Positioning Summary

```
+---------------------------+-------------------+-------------------+
| Dimension                 | Perplexity        | RAGbox            |
+---------------------------+-------------------+-------------------+
| Primary Function          | Web search +      | Vault-only        |
|                           | answer engine      | document intel    |
+---------------------------+-------------------+-------------------+
| Data Source               | Open web           | Encrypted vault   |
+---------------------------+-------------------+-------------------+
| Citation Target           | Web URLs           | Vault docs + page |
+---------------------------+-------------------+-------------------+
| Privacy Model             | Opt-in incognito   | Zero-retention    |
|                           | (24hr expiry)      | default           |
+---------------------------+-------------------+-------------------+
| Compliance                | Evolving           | SOC2/HIPAA native |
+---------------------------+-------------------+-------------------+
| Legal Privilege            | None              | Built-in toggle   |
+---------------------------+-------------------+-------------------+
| Audit Trail               | None              | VERITAS (WORM)    |
+---------------------------+-------------------+-------------------+
| Multi-Channel             | Web + Comet       | Chat + Voice +    |
|                           | browser            | Email + SMS       |
+---------------------------+-------------------+-------------------+
| Persona System            | Focus modes       | 10 expert lenses  |
|                           | (source filter)    | (analytical frame)|
+---------------------------+-------------------+-------------------+
| Document Scoping          | File upload to     | Hard-scoped RAG   |
|                           | Space (soft)       | per document      |
+---------------------------+-------------------+-------------------+
| Thread History            | Library sidebar    | MISSING (P0 gap)  |
+---------------------------+-------------------+-------------------+
| Multi-Thread              | Comet tabs         | MISSING (P1 gap)  |
+---------------------------+-------------------+-------------------+
| Deliverable Generation    | Labs (basic)       | Studio (docx,     |
|                           |                    | pptx, xlsx, pdf)  |
+---------------------------+-------------------+-------------------+
| Target Buyer              | Individual /       | Enterprise legal, |
|                           | SMB knowledge      | finance, health   |
|                           | workers            | compliance teams  |
+---------------------------+-------------------+-------------------+
| Price Point               | $20/mo Pro         | $99/mo Starter    |
+---------------------------+-------------------+-------------------+
```

---

## Investor Deck Talking Points

1. **"Perplexity searches the web. RAGbox interrogates YOUR documents."** -- The fundamental positioning difference. Perplexity is a search engine replacement; RAGbox is a compliance-grade document intelligence platform.

2. **"Every answer comes with a VERITAS-grade evidence chain."** -- Our Evidence panel (confidence score, retrieval stats, model provenance) has no equivalent in Perplexity. This is the compliance buyer's decision-maker.

3. **"Attorney-client privilege is a toggle, not a prayer."** -- Perplexity cannot offer legal privilege controls. Our `privilegeMode` with amber UI, audit logging, and document-level access control is a regulatory requirement for enterprise legal.

4. **"10 expert lenses, not 6 search filters."** -- Perplexity's Focus modes choose *where* to search. RAGbox's personas choose *how to think*. A Whistleblower lens surfaces irregularities. A CFO lens quantifies financial exposure. Same vault, different intelligence.

5. **"Mercury speaks every channel."** -- Voice, email, SMS, dashboard chat in a unified thread. Perplexity has voice in their browser. We meet the enterprise where they work.

---

## Landing Page Copy Implications

The current landing-v2 hero ("Your Documents. Interrogated.") is strong. Based on this teardown, consider adding a comparison section:

> **Why not just use Perplexity?**
> Perplexity searches the open web. RAGbox interrogates your encrypted vault. Every answer is cited to your documents -- with page numbers, confidence scores, and an immutable audit trail. No web data. No data retention. No compromise.

Feature comparison table for the landing page should emphasize:
- Vault-only retrieval (vs. web search)
- VERITAS audit trail (vs. none)
- Attorney-client privilege (vs. none)
- AES-256-GCM + zero retention (vs. stored by default)
- 10 expert personas (vs. source filters)
- Mercury multi-channel (vs. web-only)

---

## Sources

- [Perplexity Changelog](https://www.perplexity.ai/changelog)
- [Perplexity AI Features 2026 -- Index.dev](https://www.index.dev/blog/perplexity-statistics)
- [Perplexity AI Review 2025 -- Collabnix](https://collabnix.com/perplexity-ai-review-2025-the-complete-guide-to-pros-cons-and-user-experience/)
- [Perplexity Updates Late 2025 -- DataStudios](https://www.datastudios.org/post/perplexity-ai-updates-in-late-2025-feature-expansions-service-behavior-and-platform-direction)
- [Perplexity Focus Modes Guide -- Global GPT](https://www.glbgpt.com/hub/what-are-the-different-focus-modes-in-perplexity-ai-full-guide-2025/)
- [What are Spaces? -- Perplexity Help Center](https://www.perplexity.ai/help-center/en/articles/10352961-what-are-spaces)
- [Perplexity Spaces Explained -- AIRespo](https://airespo.com/resources/perplexity-spaces-explained-in-depth/)
- [How AI Engines Cite Sources -- Geolyze / Medium](https://medium.com/@shuimuzhisou/how-ai-engines-cite-sources-patterns-across-chatgpt-claude-perplexity-and-sge-8c317777c71d)
- [Perplexity Citation Design -- Unusual.ai](https://www.unusual.ai/blog/perplexity-platform-guide-design-for-citation-forward-answers)
- [Perplexity Comet Review -- Cybernews](https://cybernews.com/ai-tools/perplexity-comet-review/)
- [Is Perplexity Pro Worth It 2026 -- Brytesoft](https://brytesoft.com/blog/is-perplexity-pro-worth-it.html)
- [Perplexity Incognito Mode -- Storylane](https://www.storylane.io/tutorials/how-to-use-incognito-mode-in-perplexity-ai)
- [Perplexity Data Retention -- Help Center](https://www.perplexity.ai/help-center/en/articles/11187708-data-retention-and-privacy-for-enterprise-organizations-and-users)
- [Perplexity Desktop vs. Mobile -- DataStudios](https://www.datastudios.org/post/perplexity-mobile-app-vs-desktop-interface-features-integrations-and-usability)
- [Perplexity Pricing 2026 -- Global GPT](https://www.glbgpt.com/hub/perplexity-price-in-2025/)

---

*Prepared by Sheldon, Chief Engineer -- RAGbox.co*
*For internal use by the RAGbox.co executive team*
