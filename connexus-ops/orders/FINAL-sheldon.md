# FINAL Orders — Sheldon (Backend Engineering)

**From:** Zane (PM) — on behalf of David Pierce (CPO)
**Date:** 2026-03-08
**Objective:** Close KMS activation, then stand by for EPIC planning. After this, only EPICs remain.

**Your sprint is 10/10 COMPLETE. Perfect sprint.**

---

## 1. KMS Key Activation Verification (AFTER Adam provisions key)

Adam is creating: `ragbox-keys/email-token-key` in `us-east4`

Once he confirms key exists:

- [ ] Verify encrypt path: new Gmail OAuth tokens get `kms-email:` prefix
- [ ] Verify decrypt path: `kms-email:` tokens decrypt correctly via Cloud KMS
- [ ] Verify legacy path: existing `aes:` tokens still decrypt via NEXTAUTH_SECRET
- [ ] Verify stub path: `kms-stub-email:` prefix works for test/dev
- [ ] Report end-to-end encrypt/decrypt results from Cloud Run

**Do NOT run admin migration endpoint (`/api/admin/migrate-email-tokens`) until David gives explicit go-ahead.** This is a crypto operation affecting production email tokens.

**Deliver:** Verification report — all 4 paths work.

---

## 2. EPIC Readiness — Study Both Approved EPICs

Read and be ready to discuss technical approach when David opens planning:

### EPIC-V2 VERDICT — Adaptive Sovereign Retrieval
- **File:** `connexus-ops/epics/EPIC-V2-VERDICT.md`
- **Scope:** 3 phases, 6 months
- **Your likely ownership:** Phase 1 — Enhanced Retrieval (multi-strategy search, query expansion, contextual re-ranking)
- **Key question:** How does this integrate with the current RetrieverService + VectorSearcher?

### EPIC-029 VERITAS CAST — Vault to Voice
- **File:** `connexus-ops/epics/EPIC-029-VERITAS-CAST.md`
- **Scope:** 15 stories, 106 points, 5 tracks
- **Your likely ownership:** Track 1 — cast-service Go microservice, FFmpeg pipeline
- **Key question:** Reuse ragbox-backend patterns or standalone service?

**Deliver:** Technical feasibility notes for both EPICs — dependencies, risks, recommended phase order.

---

## Completion Criteria

KMS verification DONE + EPIC notes delivered = Sheldon's sprint is fully closed.
