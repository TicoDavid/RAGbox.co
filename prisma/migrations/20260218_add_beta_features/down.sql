-- Down migration for 20260218_add_beta_features
-- WARNING: Drops beta_codes table and removes subscription tier from users.

-- Drop beta_codes table
DROP TABLE IF EXISTS "beta_codes";

-- Remove subscription_tier from users
ALTER TABLE "users" DROP COLUMN IF EXISTS "subscription_tier";

-- Drop subscription_tier enum
DROP TYPE IF EXISTS "subscription_tier";

-- Remove waitlist profile fields
ALTER TABLE "waitlist_entries" DROP COLUMN IF EXISTS "company_size";
ALTER TABLE "waitlist_entries" DROP COLUMN IF EXISTS "role";
ALTER TABLE "waitlist_entries" DROP COLUMN IF EXISTS "company";
ALTER TABLE "waitlist_entries" DROP COLUMN IF EXISTS "full_name";
