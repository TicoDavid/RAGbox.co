-- Down migration for 20260222_add_work_profile_and_notifications
-- WARNING: Drops notification_settings table and work profile fields.

-- Drop notification_settings table
ALTER TABLE "notification_settings" DROP CONSTRAINT IF EXISTS "notification_settings_user_id_fkey";
DROP TABLE IF EXISTS "notification_settings";

-- Remove work profile columns from users
ALTER TABLE "users" DROP COLUMN IF EXISTS "use_case";
ALTER TABLE "users" DROP COLUMN IF EXISTS "company_size";
ALTER TABLE "users" DROP COLUMN IF EXISTS "industry";
ALTER TABLE "users" DROP COLUMN IF EXISTS "job_title";
ALTER TABLE "users" DROP COLUMN IF EXISTS "company_name";
