# FINAL Orders — Jordan (Frontend Engineering)

**From:** Zane (PM) — on behalf of David Pierce (CPO)
**Date:** 2026-03-08
**Objective:** Close all 5 remaining sprint items. After this, only EPICs remain.

**Sprint ref:** `connexus-ops/sprints/SPRINT-2026-03-08.md`
**Design ref:** `CLAUDE.md` — Midnight Cobalt palette, Space Grotesk headers, Plus Jakarta Sans body

---

## 1. S-P1-01 — Extract GlobalHeader.tsx (P1 — HIGHEST)

**File:** `src/components/layout/GlobalHeader.tsx` — 2,251 lines
**Target:** < 400 lines (orchestrator only)

Break into focused sub-components following the same pattern used for S-P1-02:

```
src/components/layout/
├── GlobalHeader.tsx            (< 400 lines — imports + orchestrates)
├── header/
│   ├── NavigationRail.tsx      (nav items, active state, route matching)
│   ├── UserMenu.tsx            (avatar, dropdown, logout)
│   ├── SearchBar.tsx           (search input, results overlay)
│   ├── NotificationBell.tsx    (bell icon, count badge, dropdown)
│   ├── BrandLogo.tsx           (logo + "M.E.R.C.U.R.Y." / "Aegis" text)
│   └── HeaderActions.tsx       (right-side action buttons)
```

**Acceptance:**
- [ ] GlobalHeader.tsx < 400 lines
- [ ] Each sub-component has typed props interface
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run build` — clean
- [ ] Zero visual regression — header looks and behaves identically

---

## 2. S-P1-05 — Agent Identity Page (P1)

**Route:** `/dashboard/agents`

Placeholder page for Mercury agent identity. Full agent system comes in EPIC-029.

- [ ] New file: `src/app/dashboard/agents/page.tsx`
- [ ] Display: current Mercury agent name, selected voice, personality summary
- [ ] Read-only — no editing (future EPIC)
- [ ] Card layout on `--bg-primary` (#0A192F) background
- [ ] Add nav link in sidebar/navigation rail
- [ ] Responsive: works on desktop and tablet

---

## 3. S-P1-08 — Dynamic AI Model Lists (P1)

Remove hardcoded AI model arrays from settings.

- [ ] Create API endpoint `/api/models/list` OR use env var `AVAILABLE_MODELS`
- [ ] Settings UI fetches model list dynamically on mount
- [ ] Fallback to current hardcoded list if API unavailable
- [ ] Include `gemini-2.0-flash` (current production model)
- [ ] Show model display name + description in selector

---

## 4. S-P2-03 — Accessibility Audit + Remediation (P2)

WCAG 2.1 AA compliance pass on dashboard.

- [ ] Add `aria-label` to all buttons, inputs, toggles, links
- [ ] Add `role` attributes where semantic HTML isn't used (e.g. divs acting as buttons)
- [ ] Ensure full keyboard navigation: tab order, focus indicators, Escape closes modals
- [ ] Focus management: modals trap focus, return focus on close
- [ ] Verify color contrast ratios meet AA (4.5:1 text, 3:1 large text)
- [ ] Test with screen reader (VoiceOver or NVDA) — core flows must be navigable

---

## 5. S-P2-05 — Tier Gating (P2)

Activate entitlements check. Per David: "Beta stays open, gate at GA."

- [ ] Create `useEntitlements()` hook — checks user subscription tier
- [ ] Define tier gates: Sovereign ($149), Enterprise ($399), Ultimate ($999)
- [ ] Mercury voice = Enterprise+, Advanced RAG = Ultimate
- [ ] Show upgrade CTA as "feature preview card" (David's decision 03-07)
- [ ] Feature flags only — no hard blocks during beta, just upgrade nudges
- [ ] Wire to existing pricing from `src/` components

---

## Build Verification (MANDATORY before reporting)

```bash
npx tsc --noEmit       # zero errors
npm run build          # clean production build
npm test               # all tests pass
```

---

## Completion Criteria

All 5 items DONE + build clean = Jordan's sprint is closed. Report:
- Line counts before/after for S-P1-01 (same format as S-P1-02 report)
- List of all new files created
- Screenshots: agents page, tier gating cards
- TSC + build verification
