# Bug Fix Orders — Sheldon

**From:** Zane (PM) — on behalf of David Pierce (CPO)
**Date:** 2026-03-08
**Priority:** P1 — fix both, close both

**Context:** Adam diagnosed root causes for both active bugs. These are now yours to fix.

---

## BUG-D56-03 — Voice Preview 500 for Sophia & David

**Root cause:** Inworld TTS returns 404 — `Unknown voice: Sophia not found!` / `Unknown voice: David not found!`. These display names are NOT valid Inworld API voice IDs. The other 8 voices in `VOICE_CATALOG` happen to match Inworld's actual IDs.

**File:** `src/app/api/voice/list/route.ts` — `VOICE_CATALOG` array (line 27)

**Fix options (pick one):**
1. **Map to real Inworld IDs** — If Inworld has equivalent voices under different IDs, map `Sophia` → real ID, `David` → real ID
2. **Remove from catalog** — If no equivalent exists, remove the 2 entries from `VOICE_CATALOG` (reduces to 8 voices)
3. **Mark unavailable** — Add an `available: boolean` field, set false for Sophia/David, filter in UI

**Verification:** After fix, voice preview for ALL voices in the catalog returns audio (no 500s).

---

## BUG-D56-05 — Mercury Voice Agent No Audio

**Root cause:** `message_handler.ts:60` calls `JSON.parse(data.toString())` on ALL incoming WebSocket messages, including binary audio frames. Every audio packet throws `SyntaxError` and is silently swallowed.

**File:** `server/mercury-voice/` — `message_handler.ts` line 60

**Fix:** Add binary message detection BEFORE `JSON.parse`. WebSocket messages have a type:
```typescript
// Check if message is binary (audio frame) before parsing as JSON
if (Buffer.isBuffer(data) || data instanceof ArrayBuffer) {
  // Handle as audio frame — forward to audio pipeline
  return;
}
// Only then try JSON.parse for control messages
const parsed = JSON.parse(data.toString());
```

**Verification:** After fix:
- WebSocket connects (already works)
- User speaks → audio frames flow to Inworld runtime
- Inworld responds → audio frames flow back to user
- Both directions produce audible audio

---

## Also: KMS Activation Verification

Adam confirmed KMS key provisioned:
- Key ring `ragbox-keys` ✅
- Key `email-token-key` ✅ (ENCRYPT_DECRYPT)
- IAM binding for Cloud Run SA ✅

**Now verify on Cloud Run:**
- [ ] New Gmail OAuth tokens encrypt with `kms-email:` prefix
- [ ] `kms-email:` tokens decrypt correctly
- [ ] Legacy `aes:` tokens still decrypt
- [ ] `kms-stub-email:` prefix works for dev/test

**Do NOT run migration endpoint** — David gives separate go-ahead.

---

## Delivery

Report back with:
1. BUG-D56-03: fix applied, all voices verified
2. BUG-D56-05: fix applied, audio flowing both directions
3. KMS: verification results for all 4 paths
