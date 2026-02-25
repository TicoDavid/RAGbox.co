-- Down migration for 20260217_phase18_multi_tenant
-- WARNING: Removes tenant isolation. All tenant_id columns and the tenants table will be dropped.

-- Drop tenant_id columns and indexes
DROP INDEX IF EXISTS "api_keys_tenant_id_idx";
ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "tenant_id";

DROP INDEX IF EXISTS "audit_entries_tenant_id_idx";
ALTER TABLE "audit_entries" DROP COLUMN IF EXISTS "tenant_id";

DROP INDEX IF EXISTS "mercury_threads_tenant_id_idx";
ALTER TABLE "mercury_threads" DROP COLUMN IF EXISTS "tenant_id";

DROP INDEX IF EXISTS "documents_tenant_id_idx";
ALTER TABLE "documents" DROP COLUMN IF EXISTS "tenant_id";

-- Drop tenants table
DROP TABLE IF EXISTS "tenants";
