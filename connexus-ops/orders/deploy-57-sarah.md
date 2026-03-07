# Orders — Sarah (QA/Testing)

**From:** Zane (PM) — on behalf of David Pierce (CPO)
**Date:** 2026-03-08
**Priority:** P1

---

## Deploy 57 Regression Testing

Your sprint items (S-P0-02, S-P2-06, S-P3-03) are ALL DONE. Outstanding work on the 80.1% coverage milestone.

**Next task:** Regression testing for Deploy 57 after Adam ships it.

---

### Deploy 57 Content (7 commits):

| Commit | What Changed |
|--------|-------------|
| 46fe6fc | Thread-to-Vault RAG — 7 channel embedding pipeline, new Go endpoints |
| ab0283e | File extractions — 7 oversized files split into sub-components |
| 9ffb69c | Your test coverage + CI smoke tests |
| e4a9141 | OPS ledger updates |
| 44b6175 | Matrix Rain opacity fix, Mercury Voice section removed, TTS logging |
| 0e5c5f3 | KMS email token encryption (crypto change — test carefully) |
| 53ad10d | EPIC-029 recorded (ops files only, no code change) |

### Regression Checklist:

**Core Flows:**
- [ ] Dashboard loads without console errors
- [ ] Mercury chat: send query, receive streamed response with citations
- [ ] Document upload: drag-and-drop, verify ingestion completes
- [ ] Vault listing: documents appear with correct metadata
- [ ] Settings page: all tabs render (General, Mercury, Integrations)
- [ ] Matrix Rain: visible animation in Mercury panel background

**New Feature Verification (S-P1-04 Thread-to-Vault RAG):**
- [ ] Send a message in Mercury chat
- [ ] Verify message appears in vault/thread embeddings
- [ ] Query about a topic discussed in chat — should find embedded messages
- [ ] Test multiple channels if accessible (dashboard chat, email, SMS)

**File Extraction Verification (S-P1-02):**
- [ ] SovereignStudio renders correctly
- [ ] DashboardLayout panels work
- [ ] MercurySettingsModal opens/closes properly
- [ ] IntegrationsSettings tab functions (note: Mercury Voice section REMOVED — this is intentional)
- [ ] Mercury store operations (send message, receive response)

**Removed Feature Verification:**
- [ ] Confirm "Mercury Voice" section is gone from Integrations tab
- [ ] Confirm WhatsApp auto-reply toggle still works in Integrations tab
- [ ] No dead references or broken imports

**Test Suite:**
- [ ] `npm test` — all 3153 tests pass
- [ ] `npx tsc --noEmit` — zero errors
- [ ] CI smoke test runs in build pipeline

---

### Known Issues (expected):
- Voice preview: Sophia/David return 500 (BUG-D56-03 — Adam investigating)
- Mercury voice agent: audio not flowing (BUG-D56-05 — infra investigation)

---

**Delivery:** Regression report with PASS/FAIL for each item. Flag any new issues discovered.
