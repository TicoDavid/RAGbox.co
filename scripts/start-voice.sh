#!/usr/bin/env bash
# Start the RAGbox Voice Server (standalone)
# Usage: ./scripts/start-voice.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

# Load env from .env.local if it exists
if [ -f .env.local ]; then
  set -a
  source .env.local
  set +a
fi

echo "Starting RAGbox Voice Server..."
npx ts-node --project tsconfig.json server/index.ts
