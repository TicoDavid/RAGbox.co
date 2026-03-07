# FINAL Orders — Sarah (QA/Testing)

**From:** Zane (PM) — on behalf of David Pierce (CPO)
**Date:** 2026-03-08
**Objective:** Regression test Deploy 57, then verify Jordan's sprint items. After this, only EPICs remain.

**Your sprint items (S-P0-02, S-P2-06, S-P3-03) are ALL DONE — 3/3. Outstanding work on 80.1% coverage.**

---

## 1. Deploy 57 Regression (AFTER Adam ships)

### Core Flows
- [ ] Dashboard loads without console errors
- [ ] Mercury chat: send query → streamed response with citations
- [ ] Document upload: drag-and-drop → ingestion completes
- [ ] Vault listing: documents appear with correct metadata
- [ ] Settings: all tabs render (General, Mercury, Integrations)
- [ ] Matrix Rain: visible animation in Mercury panel (more visible than before — opacity 0.6)

### New Feature: Thread-to-Vault RAG (commit 46fe6fc)
- [ ] Send message in Mercury chat
- [ ] Query about a topic from that chat message → RAG should find embedded messages
- [ ] Verify across channels if accessible (dashboard chat, email, SMS)

### File Extractions (commit ab0283e)
- [ ] SovereignStudio renders correctly
- [ ] DashboardLayout panels work
- [ ] MercurySettingsModal opens/closes
- [ ] IntegrationsSettings functions — "Mercury Voice" section is GONE (intentional)
- [ ] mercuryStore operations (send, receive, tool routing)

### Removed Feature Verification
- [ ] "Mercury Voice" section gone from Integrations tab
- [ ] WhatsApp auto-reply toggle still works
- [ ] No broken imports or dead references

### Test Suite
- [ ] `npm test` — all 3153+ tests pass
- [ ] `npx tsc --noEmit` — zero errors

**Deliver:** PASS/FAIL regression report.

---

## 2. Jordan Sprint Verification (AFTER Jordan reports done)

When Jordan completes his 5 items, verify:

### S-P1-01 (GlobalHeader extraction)
- [ ] GlobalHeader.tsx < 400 lines
- [ ] Header renders identically — no visual regression
- [ ] All sub-components function (nav, user menu, search, notifications, logo)

### S-P1-05 (Agent identity page)
- [ ] `/dashboard/agents` loads with agent card
- [ ] Nav link present and works
- [ ] Page is read-only (no edit functionality)

### S-P1-08 (Dynamic AI models)
- [ ] Settings model selector populates dynamically
- [ ] Gemini 2.0 Flash appears in list
- [ ] Fallback works if API is down

### S-P2-03 (Accessibility)
- [ ] Tab through dashboard — all interactive elements reachable
- [ ] Screen reader can navigate core flows
- [ ] Modals trap focus and return on close

### S-P2-05 (Tier gating)
- [ ] Upgrade nudges appear for gated features
- [ ] No hard blocks during beta
- [ ] Feature preview cards display correctly

**Deliver:** PASS/FAIL verification report for each of Jordan's 5 items.

---

## Completion Criteria

Both reports DONE = Sarah's sprint is closed.
