# ORDER — Dr. Insane (QA) — Deploy 55 Certification

**From:** Zane (PM)
**Date:** 2026-03-07
**Priority:** P0
**Blocked by:** Adam confirming Deploy 55 live

## Test Checklist on app.ragbox.co

| # | Test | Expected |
|---|------|----------|
| 1 | Open Settings (gear icon) | Shows ONLY: Profile, Security, Vault, Billing, Export. NO Mercury/Integrations/Personas entries. |
| 2 | Mercury gear icon (inside Mercury panel) | Opens MercurySettingsModal with 6 tabs: Identity, Voice, Persona, Neural Shift, Silence Protocol, Integrations |
| 3 | Navigate to /dashboard/settings/mercury | Should redirect or 404 (route deleted) |
| 4 | Navigate to /dashboard/settings/integrations | Should redirect or 404 (route deleted) |
| 5 | Navigate to /dashboard/settings/personas | Should redirect or 404 (route deleted) |
| 6 | Voice preview in Voice Library tab | Audio plays (INWORLD_API_KEY wired) |
| 7 | All existing features still work (resize, voice, matrix rain) | No regressions from Deploy 54 |

**Pass criteria:** 7/7 PASS. Report as table.
