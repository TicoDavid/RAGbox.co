# Sheldon — S-P0-01 Spike: Email Token Encryption KMS Migration

**Date:** 2026-03-07
**Status:** SPIKE COMPLETE — Awaiting David's review before implementation
**Risk Level:** HIGH (auth/crypto, data migration)

---

## Finding Summary

Two separate encryption systems exist in the codebase:

| System | File | Key Source | Algorithm | Used By |
|--------|------|-----------|-----------|---------|
| Email Tokens | `src/lib/gmail/crypto.ts` | `NEXTAUTH_SECRET` (SHA-256 derived) | AES-256-GCM | Agent email OAuth refresh tokens |
| BYOLLM Keys | `src/lib/utils/kms.ts` | GCP Cloud KMS (`ragbox-keys/llm-key`) | Cloud KMS symmetric | LLM API keys in chat route |

**The problem:** `crypto.ts` derives a 32-byte AES key from `NEXTAUTH_SECRET` via `createHash('sha256').update(secret).digest()`. This means:
1. **Key rotation breaks all encrypted tokens.** Changing `NEXTAUTH_SECRET` invalidates every stored refresh token.
2. **No key separation.** Session signing and token encryption share the same secret.
3. **No HSM protection.** The key exists in plaintext in the process memory.

## Files Affected

| File | Usage |
|------|-------|
| `src/lib/gmail/crypto.ts` | `encryptToken()`, `decryptToken()`, `isEncrypted()` |
| `src/app/api/agent/email/oauth/callback/route.ts` | Encrypts refresh token at line 62 |
| `src/app/api/agent/[agentId]/email/disconnect/route.ts` | Decrypts for revocation at line 29 |

## Proposed Migration Plan

### Phase 1: Add KMS encryption path (non-breaking)
1. Create `src/lib/gmail/crypto-kms.ts` that uses Cloud KMS (same pattern as `kms.ts`)
2. Use a **separate KMS key**: `ragbox-keys/email-token-key` (not `llm-key`)
3. New encrypted values prefixed with `kms-email:` (distinct from `aes:` prefix)
4. `decryptToken()` still handles both `aes:` (legacy) and `kms-email:` (new)

### Phase 2: Migrate existing tokens
1. Add migration endpoint or script: decrypt with old key → re-encrypt with KMS → update DB
2. Can be done in a batch migration on `agent_email_credentials.refreshToken`
3. Count of affected rows: `SELECT COUNT(*) FROM agent_email_credentials WHERE refresh_token LIKE 'aes:%'`

### Phase 3: Remove legacy path
1. After all tokens migrated, remove `aes:` handling from `decryptToken()`
2. Remove `NEXTAUTH_SECRET` dependency from `crypto.ts`

## KMS Key Setup Required

```bash
# Create the email token encryption key
gcloud kms keys create email-token-key \
  --keyring=ragbox-keys \
  --location=us-east4 \
  --purpose=encryption \
  --rotation-period=90d \
  --project=ragbox-sovereign-prod
```

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Token loss during migration | HIGH | Keep dual-read (aes: + kms-email:) until 100% migrated |
| KMS key not provisioned | MEDIUM | Fail-open to legacy path if key missing (dev only) |
| Latency increase (KMS roundtrip) | LOW | ~5ms per encrypt/decrypt — acceptable for OAuth flow |
| NEXTAUTH_SECRET rotation | N/A | After migration, rotation no longer breaks tokens |

## Recommendation

**Do NOT push code yet.** This requires:
1. David to approve KMS key provisioning
2. Coordinated deploy: create KMS key → deploy new code → run migration → remove legacy
3. Test with a single credential before batch migration

---

**Flagged to David for review — Sheldon**
