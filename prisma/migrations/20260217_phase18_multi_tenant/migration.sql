-- Phase 18: Multi-Tenant Isolation
-- Adds tenants table and tenant_id columns to all data tables

-- 1. Create tenants table
CREATE TABLE IF NOT EXISTS "tenants" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenants_slug_key" ON "tenants"("slug");

-- 2. Insert default tenant (idempotent)
INSERT INTO "tenants" ("id", "name", "slug", "updated_at")
VALUES ('default', 'Default', 'default', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- 3. Add tenant_id to documents (if not exists)
DO $$ BEGIN
    ALTER TABLE "documents" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT 'default';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "documents_tenant_id_idx" ON "documents"("tenant_id");

-- 4. Add tenant_id to mercury_threads (if not exists)
DO $$ BEGIN
    ALTER TABLE "mercury_threads" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT 'default';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "mercury_threads_tenant_id_idx" ON "mercury_threads"("tenant_id");

-- 5. Add tenant_id to audit_entries (if not exists)
DO $$ BEGIN
    ALTER TABLE "audit_entries" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT 'default';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "audit_entries_tenant_id_idx" ON "audit_entries"("tenant_id");

-- 6. Add tenant_id to api_keys (if not exists)
DO $$ BEGIN
    ALTER TABLE "api_keys" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT 'default';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "api_keys_tenant_id_idx" ON "api_keys"("tenant_id");
