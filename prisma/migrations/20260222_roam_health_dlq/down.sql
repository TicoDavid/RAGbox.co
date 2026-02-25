-- Down migration for 20260222_roam_health_dlq
-- WARNING: Drops roam_dead_letters table and all DLQ entries.

-- Drop roam_dead_letters table
DROP TABLE IF EXISTS "roam_dead_letters";

-- Remove health fields from roam_integrations
-- NOTE: last_health_check_at and error_reason may have been added by 20260222_add_roam_integration too.
-- These columns are idempotent (IF EXISTS) so safe to drop here.
ALTER TABLE "roam_integrations" DROP COLUMN IF EXISTS "error_reason";
ALTER TABLE "roam_integrations" DROP COLUMN IF EXISTS "last_health_check_at";
