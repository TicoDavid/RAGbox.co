# Orders — Dr. Insane (QA/Certification)

**From:** Zane (PM) — on behalf of David Pierce (CPO)
**Date:** 2026-03-08
**Priority:** P0

---

## Deploy 56 Certification

**Deploy:** 56
**Commit:** d57fd29
**Revision:** ragbox-app-00756-bcg
**URL:** https://ragbox.co

### Certification Checklist (7-point):

| # | Check | Expected |
|---|-------|----------|
| 1 | Health endpoint `/api/health` | 200 — DB ok, Backend ok |
| 2 | Dashboard loads (`/dashboard`) | Clean render, no console errors |
| 3 | Mercury chat | Send query, receive streamed response with citations |
| 4 | Voice preview | Test Ashley voice — should return audio (skip Sophia/David — known BUG-D56-03) |
| 5 | Matrix Rain effect | Canvas animation visible behind Mercury chat (opacity ~0.6 level per reference) |
| 6 | Vault document upload | Upload a test PDF, verify ingestion pipeline triggers |
| 7 | Settings page | All tabs render (General, Mercury, Integrations), no Mercury Voice section in Integrations |

### Known Issues (do NOT fail cert for these):
- **BUG-D56-03:** Sophia and David voice preview returns 500 — logged, Adam investigating after Deploy 57
- **BUG-D56-05:** Mercury voice agent (real-time conversation) not flowing audio — infra investigation pending

### Notes:
- Deploy 55 was certified 7/7 by you on 03-08
- Deploy 56 key changes: CSP blob: fix, WhatsApp ffmpeg, AuditEntry rename, structured logging, centralized backend URL, dead code cleanup
- Matrix Rain should now be MORE visible than before (opacity increased from 0.15 to 0.6) — this change is in Deploy 57 but verify current Deploy 56 baseline

---

**Delivery:** 7-point certification report. PASS / FAIL each item. Screenshots welcome.
