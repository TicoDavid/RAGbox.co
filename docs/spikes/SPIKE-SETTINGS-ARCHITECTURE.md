# Jordan — SPIKE: Settings Architecture Restructure

**Agent:** Jordan (UI Junior Engineer)
**Date:** 2026-03-07
**Status:** SPIKE (no code — architecture decision needed)
**Trigger:** David's direction: "SETTINGS should all be for the overall platform. MERCURY SETTINGS and INTEGRATIONS should be only for MERCURY purchasers."

---

## 1. Current State (What Exists Today)

### Two Parallel Settings UIs

| UI | Location | Access | Used? |
|----|----------|--------|-------|
| **Settings Modal** | `GlobalHeader.tsx:585` | Gear icon in header | PRIMARY — all users use this |
| **Route Pages** | `/dashboard/settings/*` | SettingsSidebar nav | SECONDARY — rarely navigated directly |

The Settings Modal is the de facto settings interface. It opens via the gear icon and has sidebar categories: General, Intelligence, Interface, System, Support.

### Settings Modal Sections (GlobalHeader.tsx:540-580)

| Category | Sections | Currently Contains |
|----------|----------|-------------------|
| **General** | Profile, Language, Billing | User profile, locale, plan & usage |
| **Intelligence** | Connections, AI Model, Integrations | API keys, model picker, 3rd-party integrations |
| **Interface** | Appearance | Theme picker (cobalt/noir/forest/obsidian) |
| **System** | Alerts, Security | Notification prefs, security settings |
| **Support** | Documentation, Report Issue | Links/forms |

### Mercury Settings (3 Locations)

| Location | Component | What It Controls |
|----------|-----------|-----------------|
| Mercury panel gear icon | `MercurySettingsModal.tsx` | Agent identity, voice, persona, silence protocol |
| Route page | `/dashboard/settings/mercury` | Mercury user profile (display name, role, priorities, comms style) |
| Route page | `/dashboard/settings/personas` | Persona management |
| Route page | `/dashboard/settings/integrations` | 3rd-party integrations |

### Tier Gating Infrastructure (Exists But Not Enforced)

| Component | File | Status |
|-----------|------|--------|
| `useSubscriptionTier` hook | `hooks/useSubscriptionTier.ts` | Returns `tier`, `hasVoice`, `hasAllChannels` |
| `getEntitlements(tier)` | `lib/billing/entitlements.ts` | Returns `mercury_voice`, `mercury_channels[]` |
| `isMercuryEnabled()` | `lib/features.ts` | Defaults `true` (beta) — **no real gating** |
| `tierCheck()` server-side | `lib/auth/tierCheck.ts` | Middleware for API routes — **not used on settings** |

**Entitlements that matter:**

| Tier | `mercury_voice` | `mercury_channels` |
|------|-----------------|-------------------|
| free | `false` | `[]` |
| starter | `true` | `['voice', 'chat']` |
| professional | `true` | `['voice', 'chat']` |
| enterprise | `true` | `['voice', 'chat', 'whatsapp', 'email', 'sms']` |
| sovereign | `false` | `[]` |

---

## 2. Proposed Split

### Platform Settings (All Tiers)

These stay in the Settings Modal, accessible to every user regardless of tier:

| Section | Current Location | Notes |
|---------|-----------------|-------|
| Profile | Modal → General | Display name, avatar, work profile |
| Language | Modal → General | Locale |
| Billing | Modal → General | Plan & usage, invoices |
| Appearance | Modal → Interface | Theme picker |
| Security | Modal → System | Password, 2FA, sessions |
| Alerts | Modal → System | Notification preferences |
| Vault Config | NEW — add to Modal | Vault-specific settings (retention, defaults) |
| Data Export | Modal → Support OR System | Export user data |
| Documentation | Modal → Support | Docs links |
| Report Issue | Modal → Support | Bug report form |

**Remove from Settings Modal:** Connections (API Keys), AI Model, Integrations — these are Mercury/Intelligence features.

### Mercury Settings (Gated — Purchasers Only)

These move into the Mercury panel's gear icon modal (`MercurySettingsModal`):

| Section | Current Location | Move To |
|---------|-----------------|---------|
| Agent Identity | MercurySettingsModal | Stays (gear icon modal) |
| Voice Library | MercurySettingsModal | Stays (gear icon modal) |
| Persona | `/dashboard/settings/personas` | Mercury gear icon modal |
| Integrations | `/dashboard/settings/integrations` + Modal | Mercury gear icon modal |
| Connections (API Keys) | Modal → Intelligence | Mercury gear icon modal |
| AI Model | Modal → Intelligence | Mercury gear icon modal |
| Mercury Profile | `/dashboard/settings/mercury` | Mercury gear icon modal |
| Silence Protocol | MercurySettingsModal | Stays (gear icon modal) |

---

## 3. Where Do Mercury Settings Live?

### Recommendation: **Option A — Inside Mercury panel (gear icon modal/drawer)**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A) Mercury gear icon modal** | Expand MercurySettingsModal to hold all Mercury settings | Natural location, already exists, no routing needed, gating is implicit (panel only shows for purchasers) | Modal could get large |
| B) `/dashboard/settings/mercury/*` routes with tier gate | Keep route pages, add middleware | Clean URL structure | Requires explicit route guards, duplicates nav, settings split across two UIs |
| C) `/dashboard/mercury-settings/*` separate route | New top-level route | Clean separation | Yet another nav destination, confusing UX, still needs gating |

**Why Option A wins:**

1. **Gating is free.** The Mercury panel only renders for users with Mercury access (`isMercuryEnabled()` / `mercury_voice` entitlement). If you can see the panel, you can see the gear. No extra tier-check middleware needed.
2. **Users expect it.** Mercury settings next to Mercury panel = muscle memory. Slack, Discord, Teams all put channel/bot settings in the channel itself, not in global settings.
3. **Already partially built.** `MercurySettingsModal` already has Identity, Voice, Persona, Silence Protocol sections. Just add Integrations, Connections, AI Model, and Mercury Profile tabs.
4. **Eliminates the 3-location problem.** Today Mercury settings live in 3 places. Option A consolidates to 1.

**Section layout for expanded MercurySettingsModal:**

```
IDENTITY
  - Agent Identity (name, title, greeting)
  - Voice Library (voice selection, tuning)

PERSONA
  - Persona (personality, prompt)
  - Mercury Profile (display name, role, priorities, comms style)

INTELLIGENCE
  - AI Model (model picker, temperature)
  - Silence Protocol (confidence threshold)

CONNECTIONS
  - API Keys (OpenAI, Anthropic, etc.)
  - Integrations (Slack, email, WhatsApp — gated by mercury_channels)
```

---

## 4. Tier Gate Mechanism

### Recommended: Entitlements-based check (already built)

```
                  ┌─────────────────────┐
                  │  User Profile API    │
                  │  /api/user/profile   │
                  │  → subscriptionTier  │
                  └────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │  getEntitlements(tier)   │
              │  → mercury_voice: bool  │
              │  → mercury_channels: [] │
              └────────────┬────────────┘
                           │
          ┌────────────────▼──────────────────┐
          │                                   │
    mercury_voice = true              mercury_voice = false
          │                                   │
    Show Mercury panel              Hide Mercury panel
    Show gear icon                  Show upgrade CTA
    All Mercury settings            No Mercury settings
          │
          │  Additional per-section gating:
          │  mercury_channels includes 'whatsapp'
          │     → Show WhatsApp integration
          │  mercury_channels includes 'email'
          │     → Show Email integration
          │  etc.
```

**Client-side check (already exists):**
```typescript
// hooks/useSubscriptionTier.ts — line 20
const hasVoice = tier === 'professional' || tier === 'enterprise' || tier === 'sovereign'
```

**Needs update:** `hasVoice` check is wrong — sovereign has `mercury_voice: false`. Should use entitlements directly:

```typescript
// Proposed: use entitlements instead of tier name matching
const entitlements = getEntitlements(tier)
const hasMercury = entitlements.mercury_voice
const mercuryChannels = entitlements.mercury_channels
```

**Server-side check (for API routes):** `tierCheck.ts` already returns entitlements. Mercury API routes (`/api/mercury/*`) should check `entitlements.mercury_voice === true`.

**Phase transition:**
1. **Now (beta):** `isMercuryEnabled()` returns `true` for everyone. Keep this during Customer Zero.
2. **GA launch:** Replace with `entitlements.mercury_voice` check. Delete `isMercuryEnabled()`.

---

## 5. Non-Mercury User Experience

### What non-Mercury users see:

| Element | Behavior |
|---------|----------|
| **Right rail Mercury icon** | Visible but shows locked state with upgrade CTA on click |
| **Mercury panel** | Does not render (currently gated by `isMercuryEnabled()`) |
| **Mercury gear icon** | Not visible (inside Mercury panel which is hidden) |
| **Settings Modal** | Platform sections only — no Intelligence/Connections categories |
| **Settings sidebar** (if route pages kept) | Mercury, Personas, Integrations nav items hidden |
| **Mobile bottom nav** | Mercury tab shows lock icon + "Upgrade" label |

### Upgrade CTA options:

| Location | CTA |
|----------|-----|
| Right rail Mercury icon (locked) | "Unlock Mercury AI — Upgrade to Starter" → opens Billing section |
| Settings Modal (no Intelligence category) | No CTA needed — category simply absent |
| `/dashboard/settings/mercury` (direct URL) | Redirect to Billing with "Mercury requires Starter plan or above" toast |

---

## 6. Migration Path (If Approved)

### Phase 1: Consolidate Mercury Settings into MercurySettingsModal
- Move Persona settings content from `/dashboard/settings/personas` into MercurySettingsModal
- Move Integrations settings content into MercurySettingsModal
- Move API Keys (Connections) into MercurySettingsModal
- Move AI Model settings into MercurySettingsModal
- Move Mercury Profile into MercurySettingsModal
- Remove Intelligence category from Settings Modal sidebar

### Phase 2: Clean Up Platform Settings Modal
- Remove Connections, AI Model, Integrations sections from Settings Modal
- Add Vault Config section to Settings Modal
- Verify all remaining sections are tier-agnostic

### Phase 3: Gate Mercury Panel
- Replace `isMercuryEnabled()` with `getEntitlements(tier).mercury_voice` check
- Add locked state to right rail Mercury icon for non-purchasers
- Add upgrade CTA component
- Gate `/api/mercury/*` routes with `tierCheck` middleware

### Phase 4: Deprecate Route Pages
- Remove `/dashboard/settings/mercury`, `/personas`, `/integrations` route pages
- Remove corresponding SettingsSidebar nav items
- Keep SettingsSidebar for remaining platform pages (Profile, Security, Billing, Vault, Export)
- OR remove SettingsSidebar entirely if Settings Modal is the sole UI

---

## 7. Open Questions for David

1. **Settings Modal vs Route Pages:** Should we keep the route-based settings pages at all, or fully consolidate into the Settings Modal? Currently both exist in parallel.

2. **Sovereign tier:** Sovereign has `mercury_voice: false` — is this intentional? Sovereign is positioned as a premium tier but doesn't include Mercury voice. Should Sovereign users see Mercury settings?

3. **API Keys placement:** API Keys (Connections) feel platform-level, but David's direction puts Intelligence features under Mercury. Confirm: API Keys move to Mercury settings only?

4. **Phase timing:** Gate Mercury behind entitlements now, or keep beta (everyone gets it) through Customer Zero and gate at GA?

5. **Upgrade CTA design:** Simple toast + redirect to billing, or richer "feature preview" card showing what Mercury includes?

---

*Jordan — Spike complete. Ready for David + team review before implementation begins.*
