# FINAL Orders — Dr. Insane (QA/Certification)

**From:** Zane (PM) — on behalf of David Pierce (CPO)
**Date:** 2026-03-08
**Objective:** Certify Deploy 56, then certify Deploy 57 when Adam ships. After this, only EPICs remain.

---

## 1. Deploy 56 Certification (NOW)

**Deploy:** 56
**Commit:** d57fd29
**Revision:** ragbox-app-00756-bcg
**URL:** https://ragbox.co

| # | Check | Expected |
|---|-------|----------|
| 1 | Health endpoint `/api/health` | 200 — DB ok, Backend ok |
| 2 | Dashboard loads (`/dashboard`) | Clean render, no console errors |
| 3 | Mercury chat | Send query → streamed response with citations |
| 4 | Voice preview | Test Ashley voice — returns audio (skip Sophia/David — known BUG-D56-03) |
| 5 | Matrix Rain effect | Canvas animation visible behind Mercury panel |
| 6 | Vault document upload | Upload test PDF → ingestion pipeline triggers |
| 7 | Settings page | All tabs render (General, Mercury, Integrations), no Mercury Voice section in Integrations |

**Known issues (do NOT fail cert for these):**
- BUG-D56-03: Sophia/David voice preview 500 — Adam investigating
- BUG-D56-05: Mercury voice agent audio not flowing — Adam investigating

**Deliver:** 7-point PASS/FAIL report.

---

## 2. Deploy 57 Certification (AFTER Adam ships)

Wait for Adam to report Deploy 57 revision name, then run the same 7-point checklist PLUS these additions:

| # | Check | Expected |
|---|-------|----------|
| 8 | Matrix Rain opacity | Noticeably more visible than Deploy 56 (opacity increased 0.15 → 0.6) |
| 9 | Integrations tab | "Mercury Voice" section completely removed — no trace |
| 10 | Thread-to-Vault RAG | Send Mercury chat message → query about it → RAG finds embedded message |

**Deliver:** 10-point PASS/FAIL report.

---

## Completion Criteria

Both certifications DONE = Dr. Insane's sprint is closed.
