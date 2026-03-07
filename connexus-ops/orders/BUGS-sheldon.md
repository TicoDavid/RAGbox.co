# Bug Fix Orders — Sheldon (CLOSED — Both bugs fixed)

**From:** Zane (PM) — on behalf of David Pierce (CPO)
**Date:** 2026-03-08
**Status:** ✅ BOTH BUGS FIXED

---

## BUG-D56-03 — Voice Preview 500 for Sophia & David — ✅ FIXED

**Fix applied:** Removed Sophia & David from `VOICE_CATALOG` (route.ts) and `MERCURY_VOICES` (VoiceSection.tsx). Catalog reduced 10 → 8 voices. All remaining voices (Ashley, Elizabeth, Olivia, Luna, Dennis, Mark, James, Brian) are valid Inworld IDs.

**Files changed:**
- `src/app/api/voice/list/route.ts` — Removed Sophia and David entries
- `src/components/dashboard/mercury/VoiceSection.tsx` — Removed Sophia and David entries

---

## BUG-D56-05 — Mercury Voice Agent No Audio — ✅ FIXED

**Fix applied:** Added `isBinary` parameter to message handler. Binary audio frames now bypass `JSON.parse` and route directly to Int16 PCM → VAD pipeline.

**Files changed:**
- `server/mercury-voice/src/message_handler.ts` — isBinary param, binary → PCM → VAD pipeline
- `server/mercury-voice/src/index.ts` — Pass isBinary flag from WebSocket event

**Note:** `server/mercury-voice/` is a separate Cloud Run service (mercury-voice on mercury-voice-100739220279.us-east4.run.app). It was NOT deleted by S-P3-05 — that removed `server/voice-pipeline.ts` (v1), not the standalone mercury-voice service.

---

## KMS Migration — ⏳ EXECUTE NOW

All 4 verification paths confirmed ✅:
- kms-email: encrypt ✅ (crypto.ts:58-63)
- kms-email: decrypt ✅ (crypto.ts:85-94)
- aes: legacy decrypt ✅ (crypto.ts:102-104)
- kms-stub-email: dev ✅ (crypto.ts:53-56, 97-99)
- Fallback: KMS unreachable → falls back to aes: (crypto.ts:64-68) ✅

**GREEN LIGHT WAS ALREADY GIVEN.** David approved. Run the migration NOW:

```
POST /api/admin/migrate-email-tokens
Header: x-internal-auth: <admin secret>
```

Report after migration:
- [ ] All tokens now have `kms-email:` prefix
- [ ] Gmail OAuth flows still work (send/receive)
- [ ] Count of tokens migrated vs skipped

---

## Build Verification — ✅ ALL PASS

| Check | Result |
|-------|--------|
| npx tsc --noEmit (main) | PASS |
| npx tsc --noEmit (mercury-voice) | PASS |
| go build ./... (backend) | PASS |
