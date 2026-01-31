#!/usr/bin/env bash
# scripts/doctor.sh — Pre-flight check for RAGbox local development
set -uo pipefail

PASS=0
WARN=0
FAIL=0

check() {
  local label="$1" cmd="$2" required="${3:-true}"
  if eval "$cmd" >/dev/null 2>&1; then
    echo "  [OK]   $label"
    ((PASS++))
  elif [[ "$required" == "true" ]]; then
    echo "  [FAIL] $label"
    ((FAIL++))
  else
    echo "  [WARN] $label (optional)"
    ((WARN++))
  fi
}

echo "=== RAGbox Doctor ==="
echo ""
echo "--- Runtime ---"
check "Node.js >= 18"        "node -v | grep -qE 'v(1[89]|[2-9][0-9])'"
check "npm"                  "npm --version"
check "npx"                  "npx --version"
check "python3 (optional)"  "python3 --version" false
check "Docker (optional)"   "docker --version"  false
check "curl"                "curl --version"
check "git"                 "git --version"

echo ""
echo "--- Project ---"
check "package.json exists"    "test -f package.json"
check "node_modules exists"    "test -d node_modules"
check "prisma schema exists"   "test -f prisma/schema.prisma"
check "tsconfig.json exists"   "test -f tsconfig.json"
check "eslint.config.mjs"     "test -f eslint.config.mjs"
check "Dockerfile (optional)" "test -f Dockerfile" false

echo ""
echo "--- Dependencies ---"
check "sharp installed"        "node -e \"require('sharp')\"" false
check "@prisma/client"         "node -e \"require('@prisma/client')\""
check "next"                   "node -e \"require('next')\""

echo ""
echo "--- Environment Variables ---"
for var in DATABASE_URL GOOGLE_CLOUD_PROJECT; do
  if [[ -n "${!var:-}" ]]; then
    echo "  [OK]   $var is set"
    ((PASS++))
  else
    echo "  [WARN] $var is not set (needed for production features)"
    ((WARN++))
  fi
done

echo ""
echo "=== Summary: $PASS passed, $WARN warnings, $FAIL failures ==="
if [[ $FAIL -gt 0 ]]; then
  echo "Fix failures above before running ci_local.sh"
  exit 1
fi
exit 0
