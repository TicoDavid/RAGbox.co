#!/bin/bash
# Check RAGbox.co deployment status

PROJECT="ragbox-sovereign-prod"
REGION="us-east4"

echo "=== Recent Builds ==="
gcloud builds list --limit=5 --region=$REGION --project=$PROJECT \
  --format="table(id,status,createTime,duration,source.repoSource.commitSha)"

echo ""
echo "=== Current Revisions ==="
echo "Frontend:"
gcloud run services describe ragbox-app --region=$REGION --project=$PROJECT \
  --format="value(status.latestReadyRevisionName)"

echo "Backend:"
gcloud run services describe ragbox-backend --region=$REGION --project=$PROJECT \
  --format="value(status.latestReadyRevisionName)"

echo ""
echo "=== Service URLs ==="
echo "Frontend: $(gcloud run services describe ragbox-app --region=$REGION --project=$PROJECT --format='value(status.url)')"
echo "Backend:  $(gcloud run services describe ragbox-backend --region=$REGION --project=$PROJECT --format='value(status.url)')"
