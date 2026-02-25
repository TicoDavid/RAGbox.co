-- Down migration for 20260218_add_audit_entry_fields
ALTER TABLE "audit_entries" DROP COLUMN IF EXISTS "user_agent";
ALTER TABLE "audit_entries" DROP COLUMN IF EXISTS "severity";
