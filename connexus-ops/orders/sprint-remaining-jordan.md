# Orders — Jordan (Frontend Engineering)

**From:** Zane (PM) — on behalf of David Pierce (CPO)
**Date:** 2026-03-08
**Priority:** P1

---

## Sprint 2026-03-08 — Remaining Items (5)

You have 5 items remaining in this sprint. S-P1-01 is the highest priority — that GlobalHeader is the largest file in the codebase.

---

### 1. S-P1-01 — Extract GlobalHeader.tsx (2,251 lines)

**Priority:** P1 — HIGHEST
**File:** `src/components/layout/GlobalHeader.tsx`

This is the single largest file in the frontend. Break it into focused sub-components following the same pattern you used for S-P1-02.

**Target structure:**
```
src/components/layout/
├── GlobalHeader.tsx          (orchestrator — <400 lines)
├── header/
│   ├── NavigationRail.tsx    (nav items, active state)
│   ├── UserMenu.tsx          (avatar, dropdown, logout)
│   ├── SearchBar.tsx         (search input, results)
│   ├── NotificationBell.tsx  (bell icon, count badge, dropdown)
│   ├── BrandLogo.tsx         (logo + "M.E.R.C.U.R.Y." text logic)
│   └── HeaderActions.tsx     (right-side action buttons)
```

**Acceptance criteria:**
- [ ] GlobalHeader.tsx reduced to <400 lines
- [ ] All extracted components have proper TypeScript interfaces
- [ ] `npm run build` passes clean (zero TSC errors)
- [ ] Visual regression: zero — header must look/behave identically

---

### 2. S-P1-05 — Agent Identity Page

**Priority:** P1
**Route:** `/dashboard/agents`

Build the UI home for Mercury agent identity. This is a **placeholder page** for now — the full agent system comes in EPIC-029 VERITAS CAST.

**Requirements:**
- [ ] New page at `src/app/dashboard/agents/page.tsx`
- [ ] Show current Mercury agent name, voice, personality summary
- [ ] Read-only for now (editing comes in future EPIC)
- [ ] Design: Card layout on Midnight Cobalt background, consistent with dashboard
- [ ] Add nav link in sidebar/rail

---

### 3. S-P1-08 — Dynamic AI Model Lists

**Priority:** P1

Remove hardcoded AI model arrays from settings UI. Fetch available models from API or env config.

**Requirements:**
- [ ] Create `/api/models/list` endpoint (or use env var `AVAILABLE_MODELS`)
- [ ] Settings UI fetches model list dynamically
- [ ] Fallback to current hardcoded list if API fails
- [ ] Add Gemini 2.0 Flash to the list (it's our current production model)

---

### 4. S-P2-03 — Accessibility Audit + Remediation

**Priority:** P2

Audit the dashboard for WCAG 2.1 AA compliance.

**Requirements:**
- [ ] Add `aria-label` to all interactive elements (buttons, inputs, toggles)
- [ ] Add `role` attributes where semantic HTML isn't used
- [ ] Ensure keyboard navigation works (tab order, focus management)
- [ ] Test with screen reader (VoiceOver or NVDA)
- [ ] Fix any contrast ratio issues (our Midnight Cobalt palette should be fine but verify)

---

### 5. S-P2-05 — Tier Gating

**Priority:** P2

Activate entitlements check at GA boundary. Per David's decision: "Beta stays open, gate at GA."

**Requirements:**
- [ ] Create `useEntitlements()` hook that checks user's subscription tier
- [ ] Gate Mercury voice, advanced RAG features behind appropriate tier ($149/$399/$999)
- [ ] Show upgrade CTA as "feature preview card" (David's decision 03-07)
- [ ] Implement as feature flags — no hard blocks during beta, just upgrade nudges
- [ ] Wire to pricing tiers: Sovereign ($149), Enterprise ($399), Ultimate ($999)

---

## Build Verification

After ALL items are complete:
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run build` — clean production build
- [ ] Report: line counts before/after for S-P1-01, list of new files created

---

**Delivery:** Report with file table (before/after line counts), TSC verification, and screenshots of new UI (agents page, tier gating cards).
