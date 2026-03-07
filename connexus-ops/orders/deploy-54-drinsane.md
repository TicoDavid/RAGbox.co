# ORDER — Dr. Insane (QA) — Deploy 54 Certification

**From:** Zane (PM)
**Date:** 2026-03-07
**Priority:** P0
**Blocked by:** Adam completing Deploy 54

## Wait for Adam's deploy confirmation, then certify:

### 5-Point Test Checklist on app.ragbox.co

| # | Test | How | Expected Result |
|---|------|-----|-----------------|
| 1 | Mercury panel resize | Drag the left edge of Mercury panel | Panel width changes smoothly, drag handle visible on hover |
| 2 | Voice end-to-end | Activate voice → speak a question → wait | You hear TTS audio response AND see both your text and Mercury's text in the thread |
| 3 | Matrix Rain visibility | Move the Matrix Rain speed slider to 50%+ | Green rain columns visible behind/through the chat panel |
| 4 | Voice Library preview | Mercury Settings → Voice Library → click any voice card preview button | Audio sample plays successfully |
| 5 | Preview Voice button | Mercury Settings → click "Preview Voice" button | Plays current selected voice with sample text |

### Pass Criteria
- **5/5 PASS** = Deploy 54 certified
- **Any failure** = BLOCK, report which test failed with details

### Deliverable
Certification report in `connexus-ops/test-reports/deploy-54-hotfix-cert.md` with the table above filled in. Push to origin/main.
