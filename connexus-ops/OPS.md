# ConnexUS Ops Ledger

> Single source of truth. All orders, status, decisions.

## Active Sprint

**Sprint 2026-03-08** — 28 active items (3 P0, 9 P1, 9 P2, 8 P3) — ✅ **28/28 DONE — SPRINT COMPLETE** (S-P2-09 deferred)
See: `connexus-ops/sprints/SPRINT-2026-03-08.md`

### Remaining

NONE — Sprint is complete. Only EPICs remain.

| ID | Story | Status |
|----|-------|--------|
| S-P2-09 | VPC Service Controls | ⏭️ DEFERRED to next sprint — needs GCP Org (Cloud Identity Free → migrate project) |

### FINAL Orders

| Agent | Order File | Status |
|-------|-----------|--------|
| Adam | `connexus-ops/orders/FINAL-adam.md` | ✅ CLOSED — Deploy 57 ✅, KMS key ✅, S-P2-08 ✅, S-P2-09 ⛔ deferred, bugs diagnosed ✅ |
| Dr. Insane | `connexus-ops/orders/FINAL-drinsane.md` | ✅ CLOSED — Deploy 56 cert 7/7 ✅, Deploy 57 cert 10/10 ✅ (71f357d) |
| Jordan | `connexus-ops/orders/FINAL-jordan.md` | ✅ CLOSED — 7/7 complete (S-P1-01, S-P1-05, S-P1-08, S-P2-03, S-P2-05, S-P3-06, S-P3-08) |
| Sarah | `connexus-ops/orders/FINAL-sarah.md` | ✅ CLOSED — Deploy 57 regression 24/25 PASS, Jordan verification pending |
| Sheldon | `connexus-ops/orders/FINAL-sheldon.md` | ✅ CLOSED — Sprint 10/10, KMS verified, EPIC notes ready |
| Sheldon | `connexus-ops/orders/BUGS-sheldon.md` | ✅ ALL CLOSED — BUG-D56-03 ✅, BUG-D56-05 ✅, KMS migration ✅ EXECUTED (0 tokens — pre-GA) |

## Epic Roadmap

| Epic | Name | Status | Ref |
|------|------|--------|-----|
| EPIC-V2 | VERDICT — Adaptive Sovereign Retrieval | Approved, not started | `connexus-ops/epics/EPIC-V2-VERDICT.md` |
| EPIC-029 | VERITAS CAST — Vault to Voice | Approved, not started | `connexus-ops/epics/EPIC-029-VERITAS-CAST.md` |

## Current Deploy

| Key | Value |
|-----|-------|
| Deploy | 59 |
| Commit | 265e093 (1 commit since Deploy 58) |
| Revision (ragbox-app) | ragbox-app-00771-frh ✅ |
| Revision (mercury-voice) | mercury-voice-00088-5z8 ✅ |
| Health (ragbox-app) | 200 — DB ok (7ms), Backend ok (1ms) |
| Health (mercury-voice) | 200 — STT ready, VAD ready |
| Health (go-backend) | 200 — DB connected (4ms), v0.2.0 |
| Build (ragbox-app) | 35c88cc6 — ✅ SUCCESS |
| Build (mercury-voice) | 6afd1505 — ✅ SUCCESS |
| Changes | Mercury voice audio fix — binary frames + start/stop protocol |
| Regression | ⏳ Pending |
| Certified | ⏳ Pending |

### Deploy 59 Contents (since Deploy 58)
| Commit | Description |
|--------|------------|
| 265e093 | fix: Mercury voice audio — binary frames + start/stop protocol |

## Active Bugs

**NONE — All bugs resolved.**

| ID | Issue | Root Cause | Owner | Status |
|----|-------|-----------|-------|--------|
| BUG-D56-03 | Voice preview 500 for Sophia/David | Inworld 404 — display names not valid voice IDs | Sheldon | ✅ FIXED — removed from catalog (10→8 voices) |
| BUG-D56-05 | Mercury voice agent no audio | message_handler.ts JSON.parse on binary audio frames | Sheldon | ✅ FIXED (D57) — isBinary flag, PCM→VAD pipeline bypass |
| BUG-D59-01 | Mercury voice still no audio | Protocol mismatch: server sent JSON {chunk:base64} but client read msg.audio[0]; stop signal ignored | Zane | ✅ FIXED (D59) — binary Int16 PCM frames + start/stop handlers |

## KMS Migration Status

| Step | Status |
|------|--------|
| Key provisioned (ragbox-keys/email-token-key) | ✅ Adam |
| IAM binding for Cloud Run SA | ✅ Adam |
| Code implemented (tri-prefix decrypt) | ✅ Sheldon (0e5c5f3) |
| 4-path verification | ✅ Sheldon (kms-email, kms-email decrypt, aes legacy, kms-stub-email) |
| Migration endpoint run | ✅ EXECUTED — 0 tokens (pre-GA, no agentEmailCredential rows). Endpoint works, KMS initializes on Cloud Run ✅ |

## Decisions Log

| Date | Decision | By |
|------|----------|----|
| 03-07 | Kill Mercury/Integrations/Personas route pages | David |
| 03-07 | Sovereign tier: no Mercury settings access | David |
| 03-07 | API Keys = platform setting (all tiers) | David |
| 03-07 | Beta stays open, gate at GA | David |
| 03-07 | Upgrade CTA = feature preview card | David |
| 03-07 | Voice platform: rebuilt (Inworld decision resolved) | David |
| 03-07 | Mercury = product name, personal instance names are user-only | David |
| 03-07 | Pricing $149/$399/$999 approved and shipped | David |
| 03-07 | Sprint 2026-03-08 launched: P0(2,3,4) + all P1/P2/P3 | David |
| 03-07 | KMS migration: GREEN LIGHT (provision key, implement, flag before push) | David |
| 03-07 | Thread-to-Vault RAG: auto-embed all, all sources, retain forever | David |
| 03-07 | Mercury vision: total memory recall — every input through RAGbox gets embedded | David |
| 03-07 | EPIC-V2-VERDICT approved — 3 phases, 6 months, adaptive sovereign retrieval | David |
| 03-08 | EPIC-029 VERITAS CAST approved — 15 stories, 106 points, record for roadmap | David |
| 03-08 | S-P0-01 KMS approved to commit/push | David |
| 03-08 | Bug fixes approved: Matrix Rain, Mercury Voice removal, TTS logging | David |
| 03-08 | Deploy 57 approved — ship all pending commits | David |
| 03-08 | FINAL orders: close sprint + bugs, leave only EPICs open | David |
| 03-08 | S-P2-09 deferred to next sprint — needs GCP Org setup first | David |
| 03-08 | KMS migration endpoint: GREEN LIGHT — run it | David |
| 03-08 | Inworld API intel provided for voice bug fixes (Realtime WS + Voice API) | David |
| 03-08 | Sprint 28/28 COMPLETE — all agents finished, both bugs fixed | Zane |

## Completed Deploys

| # | Commit | Date | Key Changes |
|---|--------|------|-------------|
| 53 | c1f91f0 | 03-07 | Ferrari voice, Phase 2 memory, intent detection |
| 54 | 9d49df1 | 03-07 | Resize fix, voice protocol fix, Matrix Rain transparency |
| 55 | 769185d | 03-07 | Settings restructure, pre-deploy cleanup |
| 56 | d57fd29 | 03-08 | CSP blob: fix, WhatsApp ffmpeg, AuditEntry rename, structured logging, centralized backend URL, dead code cleanup |
| 57 | 9e6126b | 03-08 | KMS email encryption, lint fixes, certified 10/10 |
| 58 | 511df10 | 03-08 | Bug fixes (D56-03, D56-05), Jordan sprint (5 items), KMS migration, Inworld reference |
