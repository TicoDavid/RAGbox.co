# ConnexUS Ops Ledger

> Single source of truth. All orders, status, decisions.

## Active Sprint

**Sprint 2026-03-08** — 29 items (3 P0, 9 P1, 9 P2, 8 P3) — 23/29 DONE — FINAL ORDERS DISPATCHED
See: `connexus-ops/sprints/SPRINT-2026-03-08.md`

### FINAL Orders (close sprint + bugs — only EPICs remain after)

| Agent | Order File | Items |
|-------|-----------|-------|
| Adam | `connexus-ops/orders/FINAL-adam.md` | Deploy 57, KMS key, BUG-D56-03, BUG-D56-05, S-P2-08, S-P2-09 |
| Dr. Insane | `connexus-ops/orders/FINAL-drinsane.md` | Deploy 56 cert (7-point), Deploy 57 cert (10-point) |
| Jordan | `connexus-ops/orders/FINAL-jordan.md` | S-P1-01, S-P1-05, S-P1-08, S-P2-03, S-P2-05 |
| Sarah | `connexus-ops/orders/FINAL-sarah.md` | Deploy 57 regression, Jordan sprint verification |
| Sheldon | `connexus-ops/orders/FINAL-sheldon.md` | KMS activation verification, EPIC readiness study |

## Epic Roadmap

| Epic | Name | Status | Ref |
|------|------|--------|-----|
| EPIC-V2 | VERDICT — Adaptive Sovereign Retrieval | Approved, not started | `connexus-ops/epics/EPIC-V2-VERDICT.md` |
| EPIC-029 | VERITAS CAST — Vault to Voice | Approved, not started | `connexus-ops/epics/EPIC-029-VERITAS-CAST.md` |

## Current Deploy

| Key | Value |
|-----|-------|
| Deploy | 56 |
| Commit | d57fd29 |
| Revision | ragbox-app-00756-bcg |
| Health | 200 — DB ok (12ms), Backend ok (75ms) |
| Certified | ⏳ Pending Dr. Insane |

## Pending Deploy

| Key | Value |
|-----|-------|
| Deploy | 57 |
| Commits | 46fe6fc, ab0283e, 9ffb69c, e4a9141, 44b6175, 0e5c5f3, 53ad10d, 5ee6509 |
| Content | Thread-to-Vault RAG (7 channels), file extractions, 80% test coverage, Matrix Rain fix, Mercury Voice section removal, TTS logging, KMS migration, EPIC-029 recorded, team orders |
| Status | Waiting for Adam |

## Active Bugs

| ID | Issue | Status | Owner |
|----|-------|--------|-------|
| BUG-D56-03 | Voice preview 500 for Sophia/David voices | Logging added, Adam to diagnose after Deploy 57 | Adam |
| BUG-D56-05 | Mercury voice agent can't hear/be heard | Infra investigation ordered | Adam |

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
