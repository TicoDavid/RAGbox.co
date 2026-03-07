# ORDER — Adam (DevOps) — Deploy 54

**From:** Zane (PM)
**Date:** 2026-03-07
**Priority:** P0

## Task 1: Deploy ragbox-app with commit 9d49df1

Build and deploy commit `9d49df1` to ragbox-app Cloud Run service.

```bash
# The commit is already on origin/main
# Build image and deploy to Cloud Run
gcloud builds submit --tag gcr.io/ragbox-prod/ragbox-app:9d49df1
gcloud run deploy ragbox-app --image gcr.io/ragbox-prod/ragbox-app:9d49df1 --region us-east4
```

**What's in this commit (3 critical UI hotfixes):**
1. Mercury panel resize handle restored — added `isolate` CSS to fix z-index stacking
2. Voice WebSocket protocol aligned to agent-ws.ts — client was sending wrong message types (completely broken voice)
3. Matrix Rain visible through semi-transparent panel (70% opacity + backdrop blur)

**Verify:** `curl -s -o /dev/null -w "%{http_code}" https://app.ragbox.co/api/health` → 200

## Task 2: Delete stale branch

```bash
git push origin --delete claude/fervent-mestorf
git branch -d claude/fervent-mestorf
```

PR #31 is merged. Branch is no longer needed.

## Deliverable
Report back with: revision name, image tag, health check status, ops commit hash.
