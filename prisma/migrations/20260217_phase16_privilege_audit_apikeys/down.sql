-- Down migration for 20260217_phase16_privilege_audit_apikeys
-- WARNING: Drops audit_entries and api_keys tables. Removes privilege columns from documents.

-- Drop api_keys table
DROP TABLE IF EXISTS "api_keys";

-- Drop audit_entries table
DROP TABLE IF EXISTS "audit_entries";

-- Remove privilege columns from documents
ALTER TABLE "documents" DROP COLUMN IF EXISTS "classified_by";
ALTER TABLE "documents" DROP COLUMN IF EXISTS "classified_at";
ALTER TABLE "documents" DROP COLUMN IF EXISTS "access_list";
ALTER TABLE "documents" DROP COLUMN IF EXISTS "is_restricted";
ALTER TABLE "documents" DROP COLUMN IF EXISTS "privilege_level";
