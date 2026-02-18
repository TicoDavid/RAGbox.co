# RAGböx — Blockers
## Active blockers that need resolution before launch

---

## Format
`[PRIORITY] BLOCKER — OWNER — STATUS — DETAILS`

---

## ACTIVE

[RESOLVED] BETA CODES SEEDED — ADAM — 50 codes seeded (20 batch1_david, 20 batch2_inbound, 10 batch3_investor). Confirmed via STANDUP.md Day 3.

[RESOLVED] SARAH NEEDS A BETA CODE FOR E2E — ADAM — RESOLVED — Provided 3 unused codes from seed response: RBX-LEGAL-BSDPGU, RBX-LEGAL-Y6Y66A, RBX-LEGAL-ETRCZK. All validated `{"valid":true}` in prod. Sarah unblocked.

[RESOLVED] VERTEX AI 429 HANDLING — ADAM — IMPLEMENTED — 3 retries, 500→1000→2000ms backoff, 4s ceiling. Covers GenAI (generateContent SDK+REST) and Embedding (embedWithTaskType). Chat handler surfaces clean fallback: "The system is experiencing high demand. Please try again in a few seconds." 6 unit tests pass.

[P1] APP.RAGBOX.CO DNS — DAVID — IN PROGRESS — DNS propagating. Must resolve before Day 3 demo. Fallback: demo on Cloud Run URL directly.

[P1] GOOGLE OAUTH TESTING MODE — DAVID — OPEN — Gmail refresh tokens expire every 7 days. Weekly re-auth required until Google verifies the app (4-6 week process). Not a demo blocker but a production blocker.

[P1] AGENT ROUTES MISSING TENANT AUTHORIZATION — ADAM — SPECCED — All 6 agent email routes check session but do NOT verify user owns the agent. Any authenticated user can manage any agent's email by guessing agentId. Spec: .team/SPEC_EVELYN_PRODUCTION.md Workstream 1. Auth change — requires Sheldon review.

---

## RESOLVED (Feb 18)

[RESOLVED] C-04 Email subject encoding — SARAH — Fixed (a2f61f4)
[RESOLVED] C-05 Session polling — ADAM — Fixed (e6bcce0)
[RESOLVED] H-04 OpenRouter key client-side — ADAM — Fixed (94d8ff8)
[RESOLVED] H-02 Duplicate Cloud Build — ADAM — Fixed (254e9a1)
[RESOLVED] Legal Starter Vault empty — SARAH — 8 docs ingested, 28 chunks embedded
[RESOLVED] Agent page missing — JORDAN — Built with skeletons + empty states (92559de)
[RESOLVED] Voice "Connecting..." — JORDAN — Replaced with "Voice coming soon"
