#!/usr/bin/env bash
# ============================================================================
# Unified Thread Backend — End-to-End Verification
# ============================================================================
#
# Tests the Mercury thread API: POST messages with different channel tags,
# then GET to verify storage and filtering.
#
# Usage:
#   ./unified-thread-test.sh                    # localhost:3000 (dev)
#   ./unified-thread-test.sh https://app.ragbox.co  # production
#
# Requirements:
#   - curl, jq
#   - A valid session cookie or JWT token (set AUTH_COOKIE or AUTH_TOKEN env var)
#
# ============================================================================

set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
API="${BASE_URL}/api/mercury/thread"

# Auth: prefer token, fall back to cookie
AUTH_HEADER=""
if [[ -n "${AUTH_TOKEN:-}" ]]; then
  AUTH_HEADER="Authorization: Bearer ${AUTH_TOKEN}"
elif [[ -n "${AUTH_COOKIE:-}" ]]; then
  AUTH_HEADER="Cookie: ${AUTH_COOKIE}"
else
  echo "WARNING: No AUTH_TOKEN or AUTH_COOKIE set — requests may 401"
fi

PASS=0
FAIL=0
ERRORS=""

# ─── Helpers ───────────────────────────────────────────────────────────────

post_json() {
  local url="$1"
  local body="$2"
  curl -s -X POST "$url" \
    -H "Content-Type: application/json" \
    ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
    -d "$body"
}

get_json() {
  local url="$1"
  curl -s -X GET "$url" \
    ${AUTH_HEADER:+-H "$AUTH_HEADER"}
}

assert_eq() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo "  ✓ $label"
    ((PASS++))
  else
    echo "  ✗ $label (expected: $expected, got: $actual)"
    ERRORS="${ERRORS}\n  - ${label}: expected=${expected} actual=${actual}"
    ((FAIL++))
  fi
}

assert_contains() {
  local label="$1"
  local needle="$2"
  local haystack="$3"
  if echo "$haystack" | grep -q "$needle"; then
    echo "  ✓ $label"
    ((PASS++))
  else
    echo "  ✗ $label (expected to contain: $needle)"
    ERRORS="${ERRORS}\n  - ${label}: missing '${needle}'"
    ((FAIL++))
  fi
}

# ─── Setup: Get or create thread ──────────────────────────────────────────

echo "============================================"
echo "Unified Thread Backend — E2E Test"
echo "Base URL: ${BASE_URL}"
echo "============================================"
echo ""

echo "▸ Step 0: Get or create thread"
THREAD_RESP=$(get_json "${API}")
THREAD_ID=$(echo "$THREAD_RESP" | jq -r '.data.id // .id // empty' 2>/dev/null || echo "")

if [[ -z "$THREAD_ID" ]]; then
  echo "  Creating new thread..."
  THREAD_RESP=$(post_json "${API}" '{}')
  THREAD_ID=$(echo "$THREAD_RESP" | jq -r '.data.id // .id // empty' 2>/dev/null || echo "")
fi

if [[ -z "$THREAD_ID" ]]; then
  echo "  ✗ FATAL: Could not get/create thread. Response:"
  echo "  $THREAD_RESP"
  echo ""
  echo "  Check AUTH_TOKEN or AUTH_COOKIE is set correctly."
  exit 1
fi

echo "  Thread ID: ${THREAD_ID}"
echo ""

# ─── Clear existing messages ─────────────────────────────────────────────

echo "▸ Step 0b: Clear existing messages"
DELETE_RESP=$(curl -s -X DELETE "${API}/messages" \
  -H "Content-Type: application/json" \
  ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
  -d "{\"threadId\": \"${THREAD_ID}\"}")
DELETED=$(echo "$DELETE_RESP" | jq -r '.data.deleted // 0' 2>/dev/null || echo "0")
echo "  Cleared ${DELETED} existing messages"
echo ""

# ─── Test 1: POST dashboard message ──────────────────────────────────────

echo "▸ Test 1: POST message with channel=dashboard"
T1_RESP=$(post_json "${API}/messages" "{
  \"threadId\": \"${THREAD_ID}\",
  \"role\": \"user\",
  \"channel\": \"dashboard\",
  \"content\": \"What is our revenue forecast for Q3?\"
}")
T1_SUCCESS=$(echo "$T1_RESP" | jq -r '.success' 2>/dev/null || echo "false")
T1_CHANNEL=$(echo "$T1_RESP" | jq -r '.data.channel' 2>/dev/null || echo "")
T1_ROLE=$(echo "$T1_RESP" | jq -r '.data.role' 2>/dev/null || echo "")
assert_eq "POST success" "true" "$T1_SUCCESS"
assert_eq "channel = dashboard" "dashboard" "$T1_CHANNEL"
assert_eq "role = user" "user" "$T1_ROLE"
echo ""

# ─── Test 2: POST whatsapp message ───────────────────────────────────────

echo "▸ Test 2: POST message with channel=whatsapp"
T2_RESP=$(post_json "${API}/messages" "{
  \"threadId\": \"${THREAD_ID}\",
  \"role\": \"user\",
  \"channel\": \"whatsapp\",
  \"content\": \"Send me the compliance report\",
  \"channelMessageId\": \"vonage-msg-abc123\",
  \"direction\": \"inbound\"
}")
T2_SUCCESS=$(echo "$T2_RESP" | jq -r '.success' 2>/dev/null || echo "false")
T2_CHANNEL=$(echo "$T2_RESP" | jq -r '.data.channel' 2>/dev/null || echo "")
assert_eq "POST success" "true" "$T2_SUCCESS"
assert_eq "channel = whatsapp" "whatsapp" "$T2_CHANNEL"
echo ""

# ─── Test 3: POST voice message ──────────────────────────────────────────

echo "▸ Test 3: POST message with channel=voice"
T3_RESP=$(post_json "${API}/messages" "{
  \"threadId\": \"${THREAD_ID}\",
  \"role\": \"assistant\",
  \"channel\": \"voice\",
  \"content\": \"Based on your documents, Q3 revenue is projected at 2.4M.\",
  \"direction\": \"outbound\",
  \"confidence\": 0.91
}")
T3_SUCCESS=$(echo "$T3_RESP" | jq -r '.success' 2>/dev/null || echo "false")
T3_CHANNEL=$(echo "$T3_RESP" | jq -r '.data.channel' 2>/dev/null || echo "")
T3_ROLE=$(echo "$T3_RESP" | jq -r '.data.role' 2>/dev/null || echo "")
assert_eq "POST success" "true" "$T3_SUCCESS"
assert_eq "channel = voice" "voice" "$T3_CHANNEL"
assert_eq "role = assistant" "assistant" "$T3_ROLE"
echo ""

# ─── Test 4: POST sms message ────────────────────────────────────────────

echo "▸ Test 4: POST message with channel=sms"
T4_RESP=$(post_json "${API}/messages" "{
  \"threadId\": \"${THREAD_ID}\",
  \"role\": \"user\",
  \"channel\": \"sms\",
  \"content\": \"Check vault for contract amendments\",
  \"channelMessageId\": \"vonage-sms-xyz789\",
  \"direction\": \"inbound\"
}")
T4_SUCCESS=$(echo "$T4_RESP" | jq -r '.success' 2>/dev/null || echo "false")
T4_CHANNEL=$(echo "$T4_RESP" | jq -r '.data.channel' 2>/dev/null || echo "")
assert_eq "POST success" "true" "$T4_SUCCESS"
assert_eq "channel = sms" "sms" "$T4_CHANNEL"
echo ""

# ─── Test 5: GET all messages — verify all 4 channels present ────────────

echo "▸ Test 5: GET all thread messages (no filter)"
T5_RESP=$(get_json "${API}/messages?threadId=${THREAD_ID}")
T5_SUCCESS=$(echo "$T5_RESP" | jq -r '.success' 2>/dev/null || echo "false")
T5_COUNT=$(echo "$T5_RESP" | jq -r '.data.messages | length' 2>/dev/null || echo "0")
T5_CHANNELS=$(echo "$T5_RESP" | jq -r '[.data.messages[].channel] | sort | unique | join(",")' 2>/dev/null || echo "")
assert_eq "GET success" "true" "$T5_SUCCESS"
assert_eq "message count = 4" "4" "$T5_COUNT"
assert_contains "all channels present" "dashboard" "$T5_CHANNELS"
assert_contains "all channels present" "voice" "$T5_CHANNELS"
assert_contains "all channels present" "whatsapp" "$T5_CHANNELS"
assert_contains "all channels present" "sms" "$T5_CHANNELS"
echo ""

# ─── Test 6: GET filtered by channel=whatsapp ────────────────────────────

echo "▸ Test 6: GET messages filtered by channel=whatsapp"
T6_RESP=$(get_json "${API}/messages?threadId=${THREAD_ID}&channel=whatsapp")
T6_COUNT=$(echo "$T6_RESP" | jq -r '.data.messages | length' 2>/dev/null || echo "0")
T6_ALL_WA=$(echo "$T6_RESP" | jq -r '[.data.messages[].channel] | unique | join(",")' 2>/dev/null || echo "")
assert_eq "filtered count = 1" "1" "$T6_COUNT"
assert_eq "only whatsapp" "whatsapp" "$T6_ALL_WA"
echo ""

# ─── Test 7: GET filtered by channel=voice ───────────────────────────────

echo "▸ Test 7: GET messages filtered by channel=voice"
T7_RESP=$(get_json "${API}/messages?threadId=${THREAD_ID}&channel=voice")
T7_COUNT=$(echo "$T7_RESP" | jq -r '.data.messages | length' 2>/dev/null || echo "0")
T7_ALL_VOICE=$(echo "$T7_RESP" | jq -r '[.data.messages[].channel] | unique | join(",")' 2>/dev/null || echo "")
assert_eq "filtered count = 1" "1" "$T7_COUNT"
assert_eq "only voice" "voice" "$T7_ALL_VOICE"
echo ""

# ─── Test 8: GET filtered by channel=dashboard ───────────────────────────

echo "▸ Test 8: GET messages filtered by channel=dashboard"
T8_RESP=$(get_json "${API}/messages?threadId=${THREAD_ID}&channel=dashboard")
T8_COUNT=$(echo "$T8_RESP" | jq -r '.data.messages | length' 2>/dev/null || echo "0")
assert_eq "filtered count = 1" "1" "$T8_COUNT"
echo ""

# ─── Test 9: Verify invalid channel is rejected ──────────────────────────

echo "▸ Test 9: POST with invalid channel rejected"
T9_RESP=$(post_json "${API}/messages" "{
  \"threadId\": \"${THREAD_ID}\",
  \"role\": \"user\",
  \"channel\": \"telegram\",
  \"content\": \"This should fail\"
}")
T9_SUCCESS=$(echo "$T9_RESP" | jq -r '.success' 2>/dev/null || echo "true")
assert_eq "invalid channel rejected" "false" "$T9_SUCCESS"
echo ""

# ─── Summary ─────────────────────────────────────────────────────────────

echo "============================================"
echo "RESULTS: ${PASS} passed, ${FAIL} failed"
echo "============================================"

if [[ $FAIL -gt 0 ]]; then
  echo ""
  echo "Failures:"
  echo -e "$ERRORS"
  echo ""
  exit 1
else
  echo "All tests passed."
  exit 0
fi
