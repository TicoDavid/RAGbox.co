# ORDER — Jordan (UI) — Settings Architecture Spike

**From:** Zane (PM)
**Date:** 2026-03-07
**Priority:** P1 (not blocking Deploy 54)

## Context

David's direction: "SETTINGS should all be for the overall platform. MERCURY SETTINGS and INTEGRATIONS should be only for MERCURY purchasers."

Current settings are a flat list at `/dashboard/settings/*`:
- billing, security, export, vault (platform-level)
- mercury, integrations, personas (Mercury-tier features)

## Deliverable: Spike Document (NO CODE)

Write a spike doc at `connexus-ops/spikes/settings-architecture-restructure.md` answering:

### 1. Platform Settings (all tiers)
Confirm these stay at `/dashboard/settings/*`:
- Billing
- Security
- Data Export
- Vault Configuration

### 2. Mercury Settings (gated by tier)
Where should these live? Evaluate three options:
- **A)** Inside Mercury panel (gear icon → modal/drawer)
- **B)** `/dashboard/settings/mercury/*` with tier gate component
- **C)** Separate `/dashboard/mercury-settings/*` route

Include: Agent Identity, Voice Library, Personas, Integrations (ROAM, WhatsApp, Phone)

### 3. Tier Gate Mechanism
How does `isMercuryEnabled()` work? Options:
- Stripe subscription status check
- Feature flag in user profile
- Role-based (user.tier field)
- Combination

### 4. Non-Mercury User Experience
What do non-Mercury users see?
- Hidden nav items (never see Mercury settings)
- Visible but locked with upgrade CTA
- Redirect to upgrade page

### 5. Migration Plan
- Which files need to change
- Estimated effort (story points or hours)
- Any breaking changes or risks

## Important
- NO CODE in this spike — research and recommendation only
- David and Zane will review before implementation begins
- Push spike doc to connexus-ops origin/main when complete
