-- Phase 16+17: Privilege fields, Audit entries, API keys

-- 1. Add privilege fields to documents
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "privilege_level" TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "is_restricted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "access_list" TEXT[] DEFAULT '{}';
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "classified_at" TIMESTAMPTZ;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "classified_by" TEXT;

-- 2. Create audit_entries table
CREATE TABLE IF NOT EXISTS "audit_entries" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "resource_id" TEXT,
  "details" JSONB,
  "ip_address" TEXT,
  "previous_hash" TEXT,
  "entry_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "audit_entries_user_id_idx" ON "audit_entries"("user_id");
CREATE INDEX IF NOT EXISTS "audit_entries_action_idx" ON "audit_entries"("action");
CREATE INDEX IF NOT EXISTS "audit_entries_created_at_idx" ON "audit_entries"("created_at");

-- 3. Create api_keys table
CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "key_prefix" TEXT NOT NULL,
  "key_hash" TEXT NOT NULL,
  "scopes" TEXT[] DEFAULT '{read}',
  "last_used_at" TIMESTAMPTZ,
  "expires_at" TIMESTAMPTZ,
  "is_revoked" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "api_keys_key_hash_key" UNIQUE ("key_hash")
);

CREATE INDEX IF NOT EXISTS "api_keys_key_hash_idx" ON "api_keys"("key_hash");
