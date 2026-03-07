# Orders — Adam (DevOps/Deploy)

**From:** Zane (PM) — on behalf of David Pierce (CPO)
**Date:** 2026-03-08
**Priority:** P0

---

## 1. Deploy 57 — SHIP ALL PENDING COMMITS

**Status:** APPROVED by David — ship immediately.

### Commits to deploy:

| Commit | Content |
|--------|---------|
| 46fe6fc | S-P1-04 Thread-to-Vault RAG (7 channels) |
| ab0283e | S-P1-02 file extractions (7 targets) |
| 9ffb69c | S-P0-02 frontend test coverage 80.1% + CI smoke |
| e4a9141 | OPS ledger + sprint scorecard update |
| 44b6175 | Matrix Rain fix, Mercury Voice removal, TTS logging |
| 0e5c5f3 | S-P0-01 KMS email token encryption migration |
| 53ad10d | EPIC-029 VERITAS CAST recorded + OPS ledger |

### Deploy checklist:
- [ ] `git pull origin main` — all 7 commits above
- [ ] Verify `npm run build` passes clean
- [ ] `gcloud builds submit` with `SHORT_SHA` substitution
- [ ] Verify Cloud Run revision is healthy (200, DB ok, Backend ok)
- [ ] Report revision name and health check results

---

## 2. KMS Key Provisioning

**Context:** S-P0-01 KMS migration is now committed (0e5c5f3). The code expects Cloud KMS key ring and key to exist.

### Steps:
- [ ] Create key ring: `gcloud kms keyrings create ragbox-keys --location=us-east4`
- [ ] Create key: `gcloud kms keys create email-token-key --keyring=ragbox-keys --location=us-east4 --purpose=encryption`
- [ ] Grant Cloud Run SA access: `gcloud kms keys add-iam-policy-binding email-token-key --keyring=ragbox-keys --location=us-east4 --member=serviceAccount:ragbox-prod-cloudrun@ragbox-sovereign-prod.iam.gserviceaccount.com --role=roles/cloudkms.cryptoKeyEncrypterDecrypter`
- [ ] Verify key is accessible from Cloud Run (test encrypt/decrypt)

**IMPORTANT:** Do NOT run the migration endpoint until David gives explicit go-ahead. Key provisioning only for now.

---

## 3. Bug Investigation — BUG-D56-03: Voice Preview 500

**Issue:** Voice preview returns 500 for Sophia and David voices. All other voices (Ashley, Elizabeth, Olivia, Luna, Dennis, Mark, James, Brian) work perfectly.

**New logging deployed:** Commit 44b6175 added voiceId/modelId/textLength to `[VOICE-TTS]` error logs in `/api/voice/synthesize`.

### Steps:
- [ ] After Deploy 57 lands, trigger voice preview for Sophia and David
- [ ] Pull Cloud Run logs: `gcloud logging read 'resource.type="cloud_run_revision" AND textPayload=~"VOICE-TTS"' --limit=20 --format=json`
- [ ] Report: exact Inworld API error message, HTTP status, voiceId sent
- [ ] Check if Sophia/David are valid Inworld TTS-1.5-max voice IDs (may need API docs)

---

## 4. Bug Investigation — BUG-D56-05: Mercury Voice Agent

**Issue:** Mercury voice agent can't hear user / user can't hear agent. WebSocket connects but no audio flows.

### Steps:
- [ ] Check mercury-voice Cloud Run service health: `gcloud run services describe mercury-voice --region=us-east4`
- [ ] Verify session-affinity and 3600s timeout are set
- [ ] Check mercury-voice logs for WebSocket upgrade errors
- [ ] Verify JWT secret matches between ragbox-app and mercury-voice
- [ ] Test WebSocket handshake manually if possible
- [ ] Report findings — this may be an Inworld runtime issue

---

## 5. Sprint Items Remaining

| ID | Task | Priority |
|----|------|----------|
| S-P2-08 | Go backend Cloud Run `--min-instances=1` (kill cold start) | P2 |
| S-P2-09 | VPC Service Controls perimeter for Cloud SQL | P2 |

Execute after Deploy 57 is confirmed healthy. These are non-blocking enhancements.

---

**Delivery:** Report back with Deploy 57 revision name, health check, KMS key status, and bug investigation findings.
