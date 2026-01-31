#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# RAGbox No-Gcloud Deploy Script
# Deploys to Cloud Run via REST APIs using SA key for auth.
# ============================================================

PROJECT_ID="ragbox-sovereign-prod"
REGION="us-east4"
SERVICE="ragbox"

ROOT_DIR="$HOME/RAGbox.co"
KEY_FILE="$HOME/ragbox-sa-key.json"

AR_REPO="ragbox-repo"
IMAGE_NAME="ragbox"
TAG="$(cd "$ROOT_DIR" && git rev-parse --short HEAD)"
IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/${IMAGE_NAME}:${TAG}"

SOURCE_BUCKET="${PROJECT_ID}-cloudbuild-src"
OBJ="source/$(date -u +%Y%m%dT%H%M%SZ)-ragbox-src.tgz"

WORK_DIR="$HOME/_atomic_build"
LOG_FILE="$HOME/overnight_run_$(date -u +%Y%m%dT%H%M%SZ).log"

mkdir -p "$WORK_DIR"

log() { echo "[$(date -u +%H:%M:%S)] $*" | tee -a "$LOG_FILE"; }

# --- Prerequisites ---
for cmd in python3 curl openssl gsutil tar; do
  command -v "$cmd" >/dev/null 2>&1 || { log "FATAL: Missing $cmd"; exit 1; }
done
[[ -f "$KEY_FILE" ]] || { log "FATAL: Missing $KEY_FILE"; exit 1; }
[[ -d "$ROOT_DIR" ]] || { log "FATAL: Missing $ROOT_DIR"; exit 1; }

# --- Phase 1: Repo sanity ---
log "==> Phase 1: Repo sanity"
cd "$ROOT_DIR"
git fetch --all --prune 2>&1 | tee -a "$LOG_FILE"
git checkout main 2>&1 | tee -a "$LOG_FILE"
git pull origin main 2>&1 | tee -a "$LOG_FILE"
HEAD_SHA="$(git rev-parse HEAD)"
log "HEAD is $HEAD_SHA (short: $TAG)"
# cdc4486 is the fixes commit; we accept it or anything newer on main
if ! git log --oneline | head -20 | grep -q "cdc4486\|847c0ec"; then
  log "WARNING: cdc4486 not in recent history, proceeding with HEAD anyway"
fi

# --- Mint OAuth token ---
log "==> Minting OAuth token"
ACCESS_TOKEN="$(python3 << 'PY'
import json, time, base64, subprocess, urllib.request, urllib.parse

def b64url(b):
    return base64.urlsafe_b64encode(b).decode().rstrip("=")

key = json.loads(open(__import__("os").path.expanduser("~/ragbox-sa-key.json")).read())
sa_email = key["client_email"]
private_key_pem = key["private_key"]

now = int(time.time())
header = b64url(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
payload = b64url(json.dumps({
    "iss": sa_email,
    "scope": "https://www.googleapis.com/auth/cloud-platform",
    "aud": "https://oauth2.googleapis.com/token",
    "iat": now,
    "exp": now + 3600,
}).encode())

signing_input = f"{header}.{payload}".encode()

# Write key to temp file for openssl
import tempfile, os
with tempfile.NamedTemporaryFile(mode="w", suffix=".pem", delete=False) as f:
    f.write(private_key_pem)
    key_path = f.name

try:
    sig = subprocess.check_output(
        ["openssl", "dgst", "-sha256", "-sign", key_path],
        input=signing_input
    )
finally:
    os.unlink(key_path)

jwt_token = f"{header}.{payload}.{b64url(sig)}"

data = urllib.parse.urlencode({
    "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
    "assertion": jwt_token,
}).encode()

req = urllib.request.Request("https://oauth2.googleapis.com/token", data=data)
resp = json.loads(urllib.request.urlopen(req).read())
print(resp["access_token"])
PY
)"

[[ -n "$ACCESS_TOKEN" ]] || { log "FATAL: Failed to mint token"; exit 1; }
log "Token OK (${#ACCESS_TOKEN} chars)"

AUTH="Authorization: Bearer $ACCESS_TOKEN"

# --- Helper: REST call ---
rest() {
  local method="$1" url="$2" body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -s -X "$method" "$url" \
      -H "$AUTH" \
      -H "Content-Type: application/json" \
      -d "$body"
  else
    curl -s -X "$method" "$url" -H "$AUTH"
  fi
}

# --- Phase 3: Ensure Artifact Registry repo exists ---
log "==> Phase 3: Check Artifact Registry repo"
AR_URL="https://artifactregistry.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/repositories/${AR_REPO}"
AR_CHECK="$(rest GET "$AR_URL" 2>&1)" || true
if echo "$AR_CHECK" | grep -q '"name"'; then
  log "AR repo exists"
else
  log "Creating AR repo ${AR_REPO}..."
  AR_CREATE="$(rest POST \
    "https://artifactregistry.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/repositories?repositoryId=${AR_REPO}" \
    '{"format":"DOCKER","description":"RAGbox container images"}')"
  log "AR create response: $(echo "$AR_CREATE" | head -c 500)"
  sleep 5
fi

# --- Configure gsutil with SA key ---
log "==> Configure gsutil"
export GOOGLE_APPLICATION_CREDENTIALS="$KEY_FILE"

# --- Ensure source bucket ---
log "==> Ensure bucket gs://${SOURCE_BUCKET}"
if ! gsutil ls "gs://${SOURCE_BUCKET}" >/dev/null 2>&1; then
  gsutil mb -l "$REGION" "gs://${SOURCE_BUCKET}" 2>&1 | tee -a "$LOG_FILE"
fi

# --- Create source tarball ---
log "==> Create source tarball"
cd "$ROOT_DIR"
tar czf "$WORK_DIR/src.tgz" \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='dist' \
  --exclude='coverage' \
  --exclude='ragbox-co/node_modules' \
  --exclude='ragbox-co/.next' \
  .
log "Tarball: $(du -h "$WORK_DIR/src.tgz" | cut -f1)"

# --- Upload source ---
log "==> Upload source to gs://${SOURCE_BUCKET}/${OBJ}"
gsutil cp "$WORK_DIR/src.tgz" "gs://${SOURCE_BUCKET}/${OBJ}" 2>&1 | tee -a "$LOG_FILE"

# --- Start Cloud Build ---
log "==> Start Cloud Build (image: $IMAGE_URI)"
BUILD_BODY="$(cat <<ENDJSON
{
  "source": {
    "storageSource": {
      "bucket": "${SOURCE_BUCKET}",
      "object": "${OBJ}"
    }
  },
  "steps": [
    {
      "name": "gcr.io/cloud-builders/docker",
      "args": ["build", "-t", "${IMAGE_URI}", "."]
    },
    {
      "name": "gcr.io/cloud-builders/docker",
      "args": ["push", "${IMAGE_URI}"]
    }
  ],
  "images": ["${IMAGE_URI}"],
  "options": {
    "logging": "CLOUD_LOGGING_ONLY",
    "machineType": "E2_HIGHCPU_8"
  },
  "timeout": "1800s"
}
ENDJSON
)"

BUILD_RESP="$(rest POST \
  "https://cloudbuild.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/builds" \
  "$BUILD_BODY")"
echo "$BUILD_RESP" > "$WORK_DIR/build_resp.json"

BUILD_ID="$(echo "$BUILD_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('metadata',{}).get('build',{}).get('id', d.get('name','').split('/')[-1]))" 2>/dev/null || true)"
if [[ -z "$BUILD_ID" ]]; then
  log "FATAL: Could not extract build ID. Response:"
  log "$(echo "$BUILD_RESP" | head -c 2000)"
  exit 1
fi
log "Build ID: $BUILD_ID"
log "Console: https://console.cloud.google.com/cloud-build/builds;region=${REGION}/${BUILD_ID}?project=${PROJECT_ID}"

# --- Poll build ---
log "==> Polling build status..."
BUILD_URL="https://cloudbuild.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/builds/${BUILD_ID}"
while true; do
  STATUS_RESP="$(rest GET "$BUILD_URL")"
  STATUS="$(echo "$STATUS_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','UNKNOWN'))")"
  log "  Build status: $STATUS"
  case "$STATUS" in
    SUCCESS) break ;;
    FAILURE|INTERNAL_ERROR|TIMEOUT|CANCELLED|EXPIRED)
      log "FATAL: Build ended with $STATUS"
      log "$(echo "$STATUS_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('failureInfo',d.get('statusDetail','')),indent=2))" 2>/dev/null | head -c 2000)"
      exit 1
      ;;
  esac
  sleep 15
done
log "Build SUCCESS"

# --- Patch Cloud Run ---
log "==> Patch Cloud Run service ($SERVICE) with image $IMAGE_URI"
CR_URL="https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/services/${SERVICE}"

# First GET the current service to preserve config
CR_CURRENT="$(rest GET "$CR_URL")"
echo "$CR_CURRENT" > "$WORK_DIR/cr_current.json"

# Patch just the image
PATCH_BODY="$(python3 << PYEOF
import json, sys
svc = json.loads(open("$WORK_DIR/cr_current.json").read())
tmpl = svc.get("template", {})
containers = tmpl.get("containers", [{}])
containers[0]["image"] = "$IMAGE_URI"
tmpl["containers"] = containers
svc["template"] = tmpl
# Remove read-only fields
for f in ["uid","generation","createTime","updateTime","deleteTime","expireTime","creator","lastModifier","etag","conditions","latestReadyRevision","latestCreatedRevision","observedGeneration","uri","satisfiesPzs","reconciling","terminalCondition","traffic","trafficStatuses"]:
    svc.pop(f, None)
print(json.dumps(svc))
PYEOF
)"

PATCH_RESP="$(curl -s -X PATCH \
  "${CR_URL}?updateMask=template.containers" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d "$PATCH_BODY")"
echo "$PATCH_RESP" > "$WORK_DIR/cr_patch_resp.json"

if echo "$PATCH_RESP" | grep -q '"error"'; then
  log "FATAL: Cloud Run patch failed:"
  log "$(echo "$PATCH_RESP" | head -c 2000)"
  exit 1
fi
log "Cloud Run patch submitted"

# --- Poll Cloud Run for new revision ---
log "==> Waiting for new revision..."
for i in $(seq 1 40); do
  sleep 10
  CR_STATUS="$(rest GET "$CR_URL")"
  CURRENT_IMAGE="$(echo "$CR_STATUS" | python3 -c "import sys,json; svc=json.load(sys.stdin); print(svc.get('template',{}).get('containers',[{}])[0].get('image',''))")"
  READY="$(echo "$CR_STATUS" | python3 -c "
import sys,json
svc=json.load(sys.stdin)
conds = svc.get('terminalCondition',{})
print(conds.get('state','UNKNOWN'))
" 2>/dev/null || echo "UNKNOWN")"
  log "  Image: $CURRENT_IMAGE | State: $READY"
  if [[ "$CURRENT_IMAGE" == "$IMAGE_URI" && "$READY" == "CONDITION_SUCCEEDED" ]]; then
    REVISION="$(echo "$CR_STATUS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('latestReadyRevision','unknown'))")"
    log "New revision ready: $REVISION"
    break
  fi
  if [[ $i -eq 40 ]]; then
    log "WARNING: Timed out waiting for revision. Current state: $READY"
  fi
done

# --- Smoke test ---
log "==> Smoke test"
APP_URL="https://ragbox-100739220279.us-east4.run.app"
HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' "${APP_URL}/api/health")"
log "/api/health => $HTTP_CODE"
if [[ "$HTTP_CODE" == "200" ]]; then
  log "DEPLOY SUCCESS"
else
  log "WARNING: Health check returned $HTTP_CODE (may need a moment to warm up)"
fi

log "==> Done. Image: $IMAGE_URI"
log "Log file: $LOG_FILE"
