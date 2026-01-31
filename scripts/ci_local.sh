#!/usr/bin/env bash
# scripts/ci_local.sh — Local CI pipeline: install, lint, typecheck, test, build
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_DIR="artifacts/logs/${TIMESTAMP}"
mkdir -p "$LOG_DIR"

SUMMARY="$LOG_DIR/summary.txt"
OVERALL=0

step() {
  local name="$1"
  shift
  local logfile="$LOG_DIR/${name}.log"
  echo -n "  [$name] ... "
  if "$@" > "$logfile" 2>&1; then
    echo "OK"
    echo "$name: OK" >> "$SUMMARY"
  else
    local code=$?
    echo "FAIL (exit $code, see $logfile)"
    echo "$name: FAIL (exit $code)" >> "$SUMMARY"
    OVERALL=1
  fi
}

echo "=== RAGbox CI Local — $TIMESTAMP ==="
echo "Logs: $LOG_DIR/"
echo ""

step "install"   npm install
step "lint"      npm run lint
step "typecheck" npm run typecheck
step "test"      npm test -- --passWithNoTests --ci
step "build"     npm run build

echo ""
echo "=== Results ==="
cat "$SUMMARY"
echo ""

if [[ $OVERALL -eq 0 ]]; then
  echo "All steps passed."
else
  echo "Some steps failed. Check logs in $LOG_DIR/"
fi

exit $OVERALL
