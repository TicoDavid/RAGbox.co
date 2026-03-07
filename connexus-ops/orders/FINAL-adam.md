# FINAL Orders — Adam (DevOps/Deploy)

**From:** Zane (PM) — on behalf of David Pierce (CPO)
**Date:** 2026-03-08
**Objective:** Close sprint + resolve all active bugs. After this, only EPICs remain.

---

## 1. Deploy 57 — SHIP NOW (P0)

All commits on `main`, pushed to `origin/main`.

```bash
git pull origin main
npm run build
gcloud builds submit --substitutions=SHORT_SHA="$(git rev-parse --short HEAD)"
```

**Commits included:**

| Commit | Content |
|--------|---------|
| 46fe6fc | S-P1-04 Thread-to-Vault RAG (7 channels) |
| ab0283e | S-P1-02 file extractions |
| 9ffb69c | S-P0-02 test coverage 80.1% + CI smoke |
| e4a9141 | OPS ledger update |
| 44b6175 | Matrix Rain fix, Mercury Voice removal, TTS logging |
| 0e5c5f3 | S-P0-01 KMS encryption migration |
| 53ad10d | EPIC-029 recorded |
| 5ee6509 | Team orders |

**Deliver:** Revision name, health check (200, DB ok, Backend ok).

---

## 2. KMS Key Provisioning (P0)

```bash
gcloud kms keyrings create ragbox-keys --location=us-east4
gcloud kms keys create email-token-key --keyring=ragbox-keys --location=us-east4 --purpose=encryption
gcloud kms keys add-iam-policy-binding email-token-key \
  --keyring=ragbox-keys --location=us-east4 \
  --member=serviceAccount:ragbox-prod-cloudrun@ragbox-sovereign-prod.iam.gserviceaccount.com \
  --role=roles/cloudkms.cryptoKeyEncrypterDecrypter
```

**Do NOT run migration endpoint.** Key provisioning only. David gives separate go-ahead for migration.

**Deliver:** Confirm key ring + key created, IAM binding set.

---

## 3. BUG-D56-03 — Voice Preview 500 for Sophia/David (P1)

Sophia and David voices return 500 on `/api/voice/synthesize`. All other 8 voices work.

Logging added in commit `44b6175` — after Deploy 57:

1. Trigger voice preview for Sophia and David in the UI
2. Pull logs:
   ```bash
   gcloud logging read 'resource.type="cloud_run_revision" AND textPayload=~"VOICE-TTS"' --limit=20 --format=json
   ```
3. Check if Sophia/David are valid Inworld TTS-1.5-max voice IDs
4. If Inworld rejects them: remove from `VOICE_CATALOG` in `src/app/api/voice/list/route.ts`
5. If Inworld accepts them but errors: escalate with Inworld API error details

**Deliver:** Root cause + fix. Close the bug.

---

## 4. BUG-D56-05 — Mercury Voice Agent Can't Hear/Be Heard (P1)

WebSocket connects but no audio flows in either direction.

1. Check mercury-voice Cloud Run:
   ```bash
   gcloud run services describe mercury-voice --region=us-east4
   ```
2. Verify `--session-affinity` and `--timeout=3600` are set
3. Check mercury-voice logs for WebSocket upgrade errors or Inworld runtime errors
4. Verify JWT secret matches between `ragbox-app` and `mercury-voice` services
5. Test WebSocket handshake + audio stream manually if possible
6. Fix or escalate with specific error details

**Deliver:** Root cause + fix. Close the bug.

---

## 5. S-P2-08 — Go Backend min-instances=1 (P2)

Kill cold start latency on the Go backend.

```bash
gcloud run services update ragbox-backend --region=us-east4 --min-instances=1
```

Verify health check returns fast after setting (should be <100ms vs previous 2-5s cold start).

**Deliver:** Confirm min-instances set, verify latency improvement.

---

## 6. S-P2-09 — VPC Service Controls for Cloud SQL (P2)

Harden the Cloud SQL perimeter.

1. Create VPC Service Controls perimeter for `ragbox-sovereign-prod`
2. Add Cloud SQL API to restricted services
3. Add Cloud Run SA as access level member
4. Test: Cloud Run can still reach DB, external access is blocked

**Deliver:** Confirm perimeter created, connectivity verified.

---

## Completion Criteria

All 6 items above DONE = Adam's sprint is closed. Report back with:
- Deploy 57 revision + health
- KMS key status
- BUG-D56-03 root cause + resolution
- BUG-D56-05 root cause + resolution
- S-P2-08 confirmation
- S-P2-09 confirmation
