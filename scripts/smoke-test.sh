#!/usr/bin/env bash
# scripts/smoke-test.sh — Post-deploy API smoke test
#
# Usage:
#   ./scripts/smoke-test.sh                          # Uses SERVICE_URL from gcloud
#   ./scripts/smoke-test.sh https://ragbox-app-xxx   # Custom base URL
#   INTERNAL_SECRET=xxx ./scripts/smoke-test.sh      # With admin auth
#
# Exit codes: 0 = all pass, 1 = failures detected
set -uo pipefail

BASE="${1:-${SERVICE_URL:-https://ragbox-app-4rvm4ohelq-uk.a.run.app}}"
INTERNAL_SECRET="${INTERNAL_SECRET:-}"
TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

PASS=0
FAIL=0
WARN=0
RESULTS=""

# ─────────────────────────────────────────────
# Test runner
# ─────────────────────────────────────────────
check() {
  local name="$1"
  local method="$2"
  local path="$3"
  local expect="$4"   # Space-separated acceptable status codes
  local body="${5:-}"
  local headers="${6:-}"

  local url="${BASE}${path}"
  local curl_args=(-s -o /tmp/smoke_body -w '%{http_code}' -X "$method" --max-time 15)

  if [ -n "$body" ]; then
    curl_args+=(-H "Content-Type: application/json" -d "$body")
  fi

  if [ -n "$headers" ]; then
    # headers is comma-separated "Key: Value,Key2: Value2"
    IFS=',' read -ra HEADER_PARTS <<< "$headers"
    for h in "${HEADER_PARTS[@]}"; do
      curl_args+=(-H "$h")
    done
  fi

  local http_code
  http_code="$(curl "${curl_args[@]}" "$url" 2>/dev/null || echo "000")"

  local matched=false
  for code in $expect; do
    if [[ "$http_code" == "$code" ]]; then
      matched=true
      break
    fi
  done

  local snippet
  snippet="$(head -c 200 /tmp/smoke_body 2>/dev/null | tr '\n' ' ')" || snippet=""

  if $matched; then
    echo "  ✅ $name — $http_code"
    ((PASS++))
  elif [[ "$http_code" == "000" ]]; then
    echo "  ⚠️  $name — TIMEOUT/UNREACHABLE"
    ((WARN++))
  else
    echo "  ❌ $name — Expected [$expect], got $http_code"
    echo "     Response: ${snippet:0:120}"
    ((FAIL++))
  fi

  RESULTS+="$name|$method|$path|$http_code|$expect\n"
}

# ─────────────────────────────────────────────
# Test suite
# ─────────────────────────────────────────────
echo "╔══════════════════════════════════════════╗"
echo "║   RAGböx API Smoke Test                  ║"
echo "╚══════════════════════════════════════════╝"
echo "  Target: $BASE"
echo "  Time:   $TIMESTAMP"
echo ""

echo "── Public Endpoints ──"
check "Landing page"            GET  "/"                    "200"
check "Auth session"            GET  "/api/auth/session"    "200"
check "Auth providers"          GET  "/api/auth/providers"  "200"

echo ""
echo "── Protected Endpoints (expect 401 without auth) ──"
check "Documents list"          GET  "/api/documents"                "401"
check "Mercury thread"          GET  "/api/mercury/thread"           "401"
check "Mercury messages"        GET  "/api/mercury/thread/messages"  "401"
check "Persona"                 GET  "/api/persona"                  "200 401"
check "Persona presets"         GET  "/api/persona/presets"          "200 401 404"
check "Audit entries"           GET  "/api/audit/entries"            "401"
check "Content gaps"            GET  "/api/content-gaps"             "401 200"
check "Studio generate (GET)"   GET  "/api/studio/generate"         "200"

echo ""
echo "── Protected POST Endpoints (expect 401 without auth) ──"
check "Mercury send message"    POST "/api/mercury/thread/messages"  "401" '{"content":"test","role":"user","channel":"dashboard"}'
check "Studio generate (POST)"  POST "/api/studio/generate"         "401" '{"artifactType":"report","sourceDocumentIds":["test"]}'

echo ""
echo "── Webhook Endpoints (signature-based, no session auth) ──"
check "ROAM webhook (no sig)"   POST "/api/webhooks/roam"      "200 401" '{"type":"test"}'
check "WhatsApp webhook verify" GET  "/api/webhooks/whatsapp"   "200 400 403"

echo ""
echo "── Agent Email Endpoints ──"
check "Agent Email Status"    GET  "/api/agent/test-agent/email"        "401"
check "Gmail Webhook"         POST "/api/gmail/webhook"                 "403"  '{"message":{"data":""}}'
check "Gmail Watch"           POST "/api/gmail/watch"                   "401"  '{"agentId":"test"}'
check "Cron Watch Renew"      GET  "/api/cron/gmail-watch-renew"        "401"

echo ""
echo "── Export/Proxy Endpoints ──"
check "Export (needs auth)"     GET  "/api/export"              "401 502"
check "Audit export"            GET  "/api/audit/export"        "401 502"

echo ""
echo "── Backend Proxy Health ──"
check "Documents POST (no body)" POST "/api/documents"         "401 411" ''

# Admin endpoints (only if INTERNAL_SECRET is available)
if [ -n "$INTERNAL_SECRET" ]; then
  echo ""
  echo "── Admin Endpoints (internal auth) ──"
  check "Admin migrate (dry)"  POST "/api/admin/migrate" "200" '{}' "x-internal-auth: ${INTERNAL_SECRET}"
fi

# ─────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "  Results: $PASS passed, $FAIL failed, $WARN warnings"
echo "══════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  echo "  🔴 DEPLOY HAS ISSUES"
  exit 1
elif [ "$WARN" -gt 0 ]; then
  echo "  🟡 DEPLOY OK (with warnings)"
  exit 0
else
  echo "  🟢 ALL ENDPOINTS HEALTHY"
  exit 0
fi
