#!/usr/bin/env bash
# scripts/smoke_local.sh — Smoke test endpoints against localhost
set -uo pipefail

PORT="${PORT:-3000}"
BASE="http://localhost:${PORT}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"

PASS=0
FAIL=0
RESULTS=""

smoke() {
  local method="$1" path="$2" expect="$3" desc="${4:-}"
  local url="${BASE}${path}"
  local start_ms end_ms elapsed_ms http_code body

  start_ms="$(date +%s%N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1e9))')"
  body="$(mktemp)"
  http_code="$(curl -s -o "$body" -w '%{http_code}' -X "$method" "$url" 2>/dev/null || echo "000")"
  end_ms="$(date +%s%N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1e9))')"
  elapsed_ms=$(( (end_ms - start_ms) / 1000000 ))

  # Check if status matches any expected code
  local matched=false
  for code in $expect; do
    if [[ "$http_code" == "$code" ]]; then
      matched=true
      break
    fi
  done

  local snippet
  snippet="$(head -c 200 "$body" 2>/dev/null | tr '\n' ' ')"
  rm -f "$body"

  local status_icon
  if $matched; then
    status_icon="PASS"
    ((PASS++))
  else
    status_icon="FAIL"
    ((FAIL++))
  fi

  local line="  [$status_icon] $method $path => $http_code (${elapsed_ms}ms) [expect: $expect]"
  echo "$line"
  RESULTS+="$line\n"
  if [[ "$status_icon" == "FAIL" ]]; then
    echo "         Response: ${snippet:0:150}"
  fi
}

echo "=== RAGbox Smoke Test — $TIMESTAMP ==="
echo "Target: $BASE"
echo ""

smoke GET  /api/health           "200"      "Health check"
smoke GET  /api/about            "200"      "About page"
smoke GET  /api/documents        "200 401"  "Documents list (may need auth)"
smoke GET  /api/documents/folders "200 401" "Document folders"
smoke GET  "/api/audit?limit=5"  "200 401"  "Audit log"

# Test document upload endpoint (expect 400 or 401 without proper payload/auth)
smoke POST /api/documents        "400 401 201" "Document upload (no body)"

echo ""
echo "=== Summary: $PASS passed, $FAIL failed ==="

# Write results to file
REPORT_DIR="$(cd "$(dirname "$0")/.." && pwd)/artifacts"
mkdir -p "$REPORT_DIR"
REPORT="$REPORT_DIR/smoke_${TIMESTAMP}.txt"
echo -e "$RESULTS" > "$REPORT"
echo "Report: $REPORT"

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
exit 0
