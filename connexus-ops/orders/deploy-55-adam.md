# ORDER — Adam (DevOps) — Deploy 55

**From:** Zane (PM)
**Date:** 2026-03-07
**Priority:** P0

## Deploy commit 769185d to ragbox-app

Two commits since Deploy 54:
- `3850fc2` — Jordan: Settings architecture restructure (deleted 3 route pages, consolidated MercurySettingsModal, tier gate hook, upgrade card)
- `769185d` — Zane: Pre-deploy cleanup (stale TODO removed, ops files, scripts)

```bash
# Commit is on origin/main
# Build and deploy
gcloud builds submit --tag gcr.io/ragbox-prod/ragbox-app:769185d
gcloud run deploy ragbox-app --image gcr.io/ragbox-prod/ragbox-app:769185d --region us-east4
```

**Verify:** Health 200 on https://app.ragbox.co/api/health

## Deliverable
Revision name, image tag, health status. Report when green.
