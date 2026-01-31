#!/usr/bin/env bash
# scripts/run_local.sh — Build and start the app locally in production mode
# Waits for /api/health to return 200 before exiting.
# Usage: scripts/run_local.sh [start|stop]
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

PORT="${PORT:-3000}"
PID_FILE="artifacts/.server.pid"
mkdir -p artifacts

stop_server() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE")"
    if kill -0 "$pid" 2>/dev/null; then
      echo "Stopping server (PID $pid)..."
      kill "$pid" 2>/dev/null || true
      # Wait up to 5 seconds for graceful shutdown
      for i in $(seq 1 10); do
        kill -0 "$pid" 2>/dev/null || break
        sleep 0.5
      done
      # Force kill if still running
      kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null
      echo "Server stopped."
    else
      echo "Server not running (stale PID file)."
    fi
    rm -f "$PID_FILE"
  else
    echo "No PID file found."
  fi
}

if [[ "${1:-start}" == "stop" ]]; then
  stop_server
  exit 0
fi

# Stop any existing server first
stop_server

echo "==> Starting server on port $PORT..."
PORT="$PORT" npm run start:prod > artifacts/server.log 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > "$PID_FILE"
echo "Server PID: $SERVER_PID"

# Wait for health endpoint
echo -n "Waiting for /api/health"
MAX_WAIT=60
for i in $(seq 1 $MAX_WAIT); do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo ""
    echo "FATAL: Server process died. Check artifacts/server.log"
    tail -20 artifacts/server.log 2>/dev/null
    rm -f "$PID_FILE"
    exit 1
  fi
  HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${PORT}/api/health" 2>/dev/null || echo "000")"
  if [[ "$HTTP_CODE" == "200" ]]; then
    echo ""
    echo "Server ready at http://localhost:${PORT} (health: 200)"
    exit 0
  fi
  echo -n "."
  sleep 2
done

echo ""
echo "WARNING: Server started but /api/health did not return 200 within ${MAX_WAIT}s"
echo "Last status: $HTTP_CODE"
echo "Server is still running (PID $SERVER_PID). Check artifacts/server.log"
exit 1
