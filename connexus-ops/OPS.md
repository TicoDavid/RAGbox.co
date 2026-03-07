# ConnexUS Ops Ledger

> Single source of truth. All orders, status, decisions.

## Active Sprint

**Sprint 2026-03-08** — 29 items (3 P0, 9 P1, 9 P2, 8 P3) — 25/29 DONE (3 remaining + 1 blocked)
See: `connexus-ops/sprints/SPRINT-2026-03-08.md`

### Remaining

| ID | Story | Owner |
|----|-------|-------|
| S-P1-05 | Agent identity page | Jordan |
| S-P1-08 | Dynamic AI model lists | Jordan |
| S-P2-03 | Accessibility audit | Jordan |
| S-P2-05 | Tier gating | Jordan |
| S-P2-09 | VPC Service Controls | Adam — ⛔ BLOCKED (no GCP org) |

### FINAL Orders

| Agent | Order File | Status |
|-------|-----------|--------|
| Adam | `connexus-ops/orders/FINAL-adam.md` | Deploy 57 ✅, KMS key ✅, S-P2-08 ✅, S-P2-09 ⛔, bugs diagnosed ✅ |
| Dr. Insane | `connexus-ops/orders/FINAL-drinsane.md` | Deploy 56 cert ✅ (7/7), Deploy 57 cert pending |
| Jordan | `connexus-ops/orders/FINAL-jordan.md` | S-P1-01 ✅, 4 remaining |
| Sarah | `connexus-ops/orders/FINAL-sarah.md` | Deploy 57 regression ✅ (24/25 PASS) |
| Sheldon | `connexus-ops/orders/FINAL-sheldon.md` | Sprint 10/10 ✅, KMS key ready |
| Sheldon | `connexus-ops/orders/BUGS-sheldon.md` | BUG-D56-03 + BUG-D56-05 + KMS verify |

## Epic Roadmap

| Epic | Name | Status | Ref |
|------|------|--------|-----|
| EPIC-V2 | VERDICT — Adaptive Sovereign Retrieval | Approved, not started | `connexus-ops/epics/EPIC-V2-VERDICT.md` |
| EPIC-029 | VERITAS CAST — Vault to Voice | Approved, not started | `connexus-ops/epics/EPIC-029-VERITAS-CAST.md` |

## Current Deploy

| Key | Value |
|-----|-------|
| Deploy | 57 |
| Commit | 9e6126b (11 commits since Deploy 56) |
| Revision | ragbox-app-00760-hkw |
| Health | 200 — DB ok (44ms), Backend ok (1ms) |
| Build | 12b2f0fe — 10m 16s, 2 attempts |
| Regression | ✅ PASS — Sarah 24/25 (1 advisory) |
| Certified | ⏳ Pending Dr. Insane (10-point) |

## Active Bugs

| ID | Issue | Root Cause | Owner | Status |
|----|-------|-----------|-------|--------|
| BUG-D56-03 | Voice preview 500 for Sophia/David | Inworld 404 — voice IDs don't exist in catalog | Sheldon | Fix ordered |
| BUG-D56-05 | Mercury voice agent no audio | message_handler.ts JSON.parse on binary audio frames | Sheldon | Fix ordered |

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

## Completed Deploys

| # | Commit | Date | Key Changes |
|---|--------|------|-------------|
| 53 | c1f91f0 | 03-07 | Ferrari voice, Phase 2 memory, intent detection |
| 54 | 9d49df1 | 03-07 | Resize fix, voice protocol fix, Matrix Rain transparency |
| 55 | 769185d | 03-07 | Settings restructure, pre-deploy cleanup |
| 56 | d57fd29 | 03-08 | CSP blob: fix, WhatsApp ffmpeg, AuditEntry rename, structured logging, centralized backend URL, dead code cleanup |
