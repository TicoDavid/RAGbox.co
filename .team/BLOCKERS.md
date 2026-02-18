# RAGböx — Blockers
## Active blockers that need resolution before launch

---

## Format
`[PRIORITY] BLOCKER — OWNER — STATUS — DETAILS`

---

## ACTIVE

[P0] BETA CODES NOT YET SEEDED — ADAM — BLOCKED (deploy in progress) — Seed endpoint created and deploying. 50 codes must exist before demo. Cannot test beta gate flow without codes.

[P0] VERTEX AI 429 HANDLING — ADAM — NOT STARTED — Transient rate limit hit during WhatsApp E2E test. Must implement retry with backoff before demo. Spec: 3 retries, 500→1000→2000ms, 4s ceiling, clean fallback message "System experiencing high demand."

[P1] APP.RAGBOX.CO DNS — DAVID — IN PROGRESS — DNS propagating. Must resolve before Day 3 demo. Fallback: demo on Cloud Run URL directly.

[P1] GOOGLE OAUTH TESTING MODE — DAVID — OPEN — Gmail refresh tokens expire every 7 days. Weekly re-auth required until Google verifies the app (4-6 week process). Not a demo blocker but a production blocker.

---

## RESOLVED (Feb 18)

[RESOLVED] C-04 Email subject encoding — SARAH — Fixed (a2f61f4)
[RESOLVED] C-05 Session polling — ADAM — Fixed (e6bcce0)
[RESOLVED] H-04 OpenRouter key client-side — ADAM — Fixed (94d8ff8)
[RESOLVED] H-02 Duplicate Cloud Build — ADAM — Fixed (254e9a1)
[RESOLVED] Legal Starter Vault empty — SARAH — 8 docs ingested, 28 chunks embedded
[RESOLVED] Agent page missing — JORDAN — Built with skeletons + empty states (92559de)
[RESOLVED] Voice "Connecting..." — JORDAN — Replaced with "Voice coming soon"
