# Orders — Sheldon (Backend Engineering)

**From:** Zane (PM) — on behalf of David Pierce (CPO)
**Date:** 2026-03-08
**Priority:** P1

---

## Sprint Status — YOU'RE DONE 🎯

**Sprint 2026-03-08 — Sheldon Scorecard: 10/10 COMPLETE**

| ID | Story | Status |
|----|-------|--------|
| S-P0-01 | KMS email token encryption | ✅ DONE — David approved, committed as 0e5c5f3 |
| S-P0-03 | WhatsApp ffmpeg OGG/Opus | ✅ DONE (ac5b584) |
| S-P1-04 | Thread-to-Vault RAG (7 channels) | ✅ DONE (46fe6fc) |
| S-P1-07 | Vonage delivery receipts | ✅ DONE (ac5b584) |
| S-P1-09 | AuditLog → AuditEntry migration | ✅ DONE (ac5b584) |
| S-P2-02 | Gmail inbound processing | ✅ DONE (verified) |
| S-P2-04 | ROAM webhook integration | ✅ DONE (verified) |
| S-P3-01 | Replace console.log with logger | ✅ DONE (ac5b584) |
| S-P3-02 | Centralize GO_BACKEND_URL | ✅ DONE (ac5b584) |
| S-P3-05 | Delete dead voice-pipeline v1 | ✅ DONE (ac5b584) |

**10/10 — Perfect sprint. Outstanding work.**

---

## Next Assignments

### Immediate: KMS Key Activation Support

Adam is provisioning the KMS key ring (`ragbox-keys/email-token-key`). Once he confirms the key exists:

- [ ] Verify the KMS encrypt/decrypt path works end-to-end on Cloud Run
- [ ] Test tri-prefix decryption: new tokens get `kms-email:` prefix, legacy `aes:` still decrypt
- [ ] Stand by for David's go-ahead to run the admin migration endpoint (`/api/admin/migrate-email-tokens`)
- [ ] Do NOT run migration until explicit approval — this is a crypto operation

### Backlog: EPIC Readiness

Two approved EPICs are now on the roadmap:

1. **EPIC-V2 VERDICT — Adaptive Sovereign Retrieval** (6 months, 3 phases)
   - You'll likely own Phase 1: Enhanced Retrieval (multi-strategy search, query expansion, contextual re-ranking)
   - Review: `connexus-ops/epics/EPIC-V2-VERDICT.md`

2. **EPIC-029 VERITAS CAST — Vault to Voice** (15 stories, 106 points)
   - Go microservice `cast-service`, FFmpeg video assembly, Cloud TTS
   - David said "needs to be renamed and studied" — review the PRD
   - Review: `connexus-ops/epics/EPIC-029-VERITAS-CAST.md`

**Action:** Read both EPICs. Be ready to discuss technical approach and phasing when David opens planning.

---

**Delivery:** Confirm KMS verification after Adam provisions the key. Share any notes on EPIC technical feasibility.
