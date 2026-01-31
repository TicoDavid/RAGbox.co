#!/usr/bin/env bash
# scripts/overnight.sh — Atomic overnight CI + smoke loop
# Usage: scripts/overnight.sh [duration_hours] [interval_minutes]
#   Default: 8 hours, 5 minute intervals
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

DURATION_HOURS="${1:-8}"
INTERVAL_MINUTES="${2:-5}"
TOTAL_SECONDS=$((DURATION_HOURS * 3600))
INTERVAL_SECONDS=$((INTERVAL_MINUTES * 60))

START_TIME="$(date -u +%Y%m%dT%H%M%SZ)"
REPORT_FILE="artifacts/report_${START_TIME}.md"
mkdir -p artifacts

CONSECUTIVE_FAILURES=0
MAX_CONSECUTIVE_FAILURES=3
CYCLE=0
CYCLE_PASSES=0
CYCLE_FAILS=0

log() { echo "[$(date -u +%H:%M:%S)] $*"; }

write_report() {
  local final_status="${1:-IN PROGRESS}"
  cat > "$REPORT_FILE" << EOF
# RAGbox Overnight Report

- **Started:** $START_TIME
- **Finished:** $(date -u +%Y%m%dT%H%M%SZ)
- **Duration:** ${DURATION_HOURS}h (interval: ${INTERVAL_MINUTES}m)
- **Status:** $final_status
- **Cycles completed:** $CYCLE
- **Cycles passed:** $CYCLE_PASSES
- **Cycles failed:** $CYCLE_FAILS

## Configuration
- Branch: $(git branch --show-current 2>/dev/null || echo unknown)
- HEAD: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)
- Node: $(node -v 2>/dev/null || echo unknown)

## Cycle Results
$(cat artifacts/.overnight_cycles.tmp 2>/dev/null || echo "No cycles recorded")

## Notes
- Protected endpoints (documents, audit) may return 401 without auth — this is expected.
- Health and about endpoints must return 200.
EOF
  log "Report written to $REPORT_FILE"
}

cleanup() {
  log "Stopping server..."
  bash scripts/run_local.sh stop 2>/dev/null || true
  rm -f artifacts/.overnight_cycles.tmp
  write_report "${1:-INTERRUPTED}"
}

trap 'cleanup INTERRUPTED' INT TERM

# Initial header
echo "" > artifacts/.overnight_cycles.tmp

log "=== Overnight Harness ==="
log "Duration: ${DURATION_HOURS}h, Interval: ${INTERVAL_MINUTES}m"
log "Max consecutive failures before stop: $MAX_CONSECUTIVE_FAILURES"
echo ""

END_EPOCH=$(( $(date +%s) + TOTAL_SECONDS ))

while [[ $(date +%s) -lt $END_EPOCH ]]; do
  ((CYCLE++))
  CYCLE_TS="$(date -u +%Y%m%dT%H%M%SZ)"
  log "--- Cycle $CYCLE ($CYCLE_TS) ---"

  CYCLE_OK=true

  # Git sanity: check for unexpected dirty state
  DIRTY="$(git status --porcelain 2>/dev/null | grep -v '^?? artifacts/' | grep -v '^?? nul' | grep -v '^?? .env' | grep -v '^?? test-document' || true)"
  if [[ -n "$DIRTY" ]]; then
    log "WARNING: Unexpected dirty files (non-artifacts):"
    echo "$DIRTY" | head -5
  fi

  # CI pipeline
  log "Running CI..."
  if bash scripts/ci_local.sh; then
    log "CI passed"
  else
    log "CI failed"
    CYCLE_OK=false
  fi

  # Start server
  log "Starting server..."
  if bash scripts/run_local.sh start; then
    # Smoke tests
    log "Running smoke tests..."
    if bash scripts/smoke_local.sh; then
      log "Smoke tests passed"
    else
      log "Smoke tests had failures"
      CYCLE_OK=false
    fi

    # Stop server
    bash scripts/run_local.sh stop
  else
    log "Server failed to start"
    CYCLE_OK=false
  fi

  # Record cycle result
  if $CYCLE_OK; then
    echo "| $CYCLE | $CYCLE_TS | PASS |" >> artifacts/.overnight_cycles.tmp
    ((CYCLE_PASSES++))
    CONSECUTIVE_FAILURES=0
  else
    echo "| $CYCLE | $CYCLE_TS | FAIL |" >> artifacts/.overnight_cycles.tmp
    ((CYCLE_FAILS++))
    ((CONSECUTIVE_FAILURES++))
  fi

  # Check consecutive failure threshold
  if [[ $CONSECUTIVE_FAILURES -ge $MAX_CONSECUTIVE_FAILURES ]]; then
    log "FATAL: $MAX_CONSECUTIVE_FAILURES consecutive failures. Stopping."
    cleanup "STOPPED (consecutive failures)"
    exit 1
  fi

  # Sleep until next cycle (unless time is up)
  REMAINING=$(( END_EPOCH - $(date +%s) ))
  if [[ $REMAINING -le 0 ]]; then
    break
  fi
  SLEEP_TIME=$((INTERVAL_SECONDS < REMAINING ? INTERVAL_SECONDS : REMAINING))
  log "Sleeping ${SLEEP_TIME}s until next cycle..."
  sleep "$SLEEP_TIME"
done

cleanup "COMPLETED"
log "=== Overnight harness finished ==="
