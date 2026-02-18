# RAGböx — Review Queue
## PRs and changes awaiting Sheldon's approval

---

## Format
`[STATUS] PR/CHANGE — AUTHOR — DETAILS`

---

## PENDING REVIEW

[PENDING] PR #29 Beta + DB Foundation — ADAM — Branch: feature/beta-db-day1, Commit: 6208d1f
- Migration: ADD columns to waitlist_entries, ADD subscription_tier enum to users, CREATE beta_codes table
- No destructive SQL confirmed
- UNIQUE constraint on beta_codes.code prevents double-redeem
- Rate limiting on all /api/beta/* at 30 req/min
- **Sheldon preliminary review: APPROVED conceptually. Merge authorized on relaunch after seed verification.**

---

## APPROVED & MERGED

[MERGED] PR #28 Day 2 UI — Jordan — Commit: 92559de → e55119e
- Sidebar, login beta gate, agent page, vault card, dashboard.css
- All 7 verification checks PASS
- Merged by TicoDavid

---

## REVIEW RULES (from Master PRD)

Changes requiring Sheldon review before merge:
- Auth, OAuth, session code
- Crypto, encryption code
- Database migrations
- Cloud Run config
- Secret Manager changes

All other changes (UI, non-auth API routes, styling): ADAM, Sarah, Jordan may push directly.
