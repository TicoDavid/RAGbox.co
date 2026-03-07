# ConnexUS Ops Ledger

> Single source of truth. All orders, status, decisions.

## Active Sprint

**Sprint 2026-03-08** — 29 items (3 P0, 9 P1, 9 P2, 8 P3)
See: `connexus-ops/sprints/SPRINT-2026-03-08.md`

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
| Commits | 46fe6fc (S-P1-04 Thread-to-Vault), ab0283e (S-P1-02 file extractions), 9ffb69c (S-P0-02 test coverage), bc95662 (V2 epic) |
| Content | Thread memory recall (7 channels), file extractions (5 files under limit), 80% test coverage (113 test files), CI smoke tests, server test fix |
| Status | Waiting for Adam |

## Held — Awaiting David Approval

| Item | Files | Reason |
|------|-------|--------|
| S-P0-01 KMS migration | src/lib/gmail/crypto.ts, src/app/api/admin/migrate-email-tokens/ | Auth/Crypto — must flag before push |

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

## Completed Deploys

| # | Commit | Date | Key Changes |
|---|--------|------|-------------|
| 53 | c1f91f0 | 03-07 | Ferrari voice, Phase 2 memory, intent detection |
| 54 | 9d49df1 | 03-07 | Resize fix, voice protocol fix, Matrix Rain transparency |
| 55 | 769185d | 03-07 | Settings restructure, pre-deploy cleanup |
| 56 | d57fd29 | 03-08 | CSP blob: fix, WhatsApp ffmpeg, AuditEntry rename, structured logging, centralized backend URL, dead code cleanup |
