# ORDER — Jordan (UI) — Settings Architecture Restructure

**From:** Zane (PM), approved by David (CPO)
**Date:** 2026-03-07
**Priority:** P1
**Depends on:** Deploy 54 certified (in progress)
**Reference:** docs/spikes/SPIKE-SETTINGS-ARCHITECTURE.md

## Decision Summary (All 5 Questions Answered)

| # | Decision |
|---|----------|
| 1 | **Kill route-based settings pages.** Delete `/dashboard/settings/mercury`, `/dashboard/settings/integrations`, `/dashboard/settings/personas`. One source of truth = MercurySettingsModal. |
| 2 | **Sovereign tier does NOT see Mercury settings.** Clean tier separation — Sovereign gets RAG + audit, not voice. |
| 3 | **API Keys = Platform setting.** Keep in global Settings Modal — API keys span the whole product (RAG API, webhooks, not just voice). |
| 4 | **Keep beta open.** No tier gating during beta. `isMercuryEnabled()` stays `true` for now. Wire the entitlements gate but don't flip it until GA. |
| 5 | **Feature preview card for upgrade CTA.** Non-Mercury users see a card showing what Mercury offers, with upgrade button → Billing page. |

## Implementation Plan

### Phase 1: Consolidate Mercury Settings into Modal

1. **MercurySettingsModal** — Add missing sections:
   - Integrations tab (ROAM, WhatsApp, Phone) — move from `/settings/integrations`
   - Personas tab — move from `/settings/personas`
   - Ensure all existing sections remain: Identity, Voice Library, Silence Protocol

2. **Delete route pages:**
   - `src/app/dashboard/settings/mercury/` (entire directory)
   - `src/app/dashboard/settings/integrations/` (entire directory)
   - `src/app/dashboard/settings/personas/` (entire directory)

3. **Update Settings Modal navigation:**
   - Remove Mercury, Integrations, Personas from global Settings Modal sidebar
   - Keep: Billing, Security, Appearance, Alerts, Vault Config, Export, API Keys

4. **Update any nav links** that point to deleted routes — redirect to MercurySettingsModal trigger

### Phase 2: Wire Tier Gate (Dormant for Beta)

1. **Create `useMercuryEntitlement()` hook:**
   - Calls `getEntitlements(tier).mercury_voice` from `lib/billing/entitlements.ts`
   - Returns `{ isMercuryEnabled: boolean, tier: string }`
   - During beta: always returns `true`
   - Add `MERCURY_GATE_ENABLED` env var (default `false`) — flip to `true` at GA

2. **Mercury panel visibility:**
   - Wrap Mercury panel render in `isMercuryEnabled` check
   - When disabled: show locked icon in right rail with upgrade CTA

3. **Feature preview card component:**
   - `src/components/ui/MercuryUpgradeCard.tsx`
   - Shows: Mercury logo, 3-4 feature bullets (voice agent, conversation memory, integrations, personas)
   - CTA button: "Upgrade to Mercury" → `/dashboard/settings` billing tab
   - Shown in right rail when Mercury is disabled

### Phase 3: Cleanup

1. Remove dead imports referencing deleted route pages
2. Update any tests that reference deleted routes
3. TSC clean check — 0 errors
4. Full regression: `npm test` — 0 failures

## Deliverables

1. All code changes committed to origin/main (conventional commits)
2. TSC: 0 errors
3. Tests: 0 failures
4. Report back with commit hashes and file change summary

## Design Constraints

- Follow RAGbox design system (Midnight Cobalt palette, design-tokens.css)
- MercurySettingsModal tabs: use existing tab pattern, don't reinvent
- Feature preview card: dark theme, brand-blue CTA button, subtle amber Mercury accent
- No breaking changes to existing Settings Modal functionality
- Immutable patterns only (per coding-style.md)
