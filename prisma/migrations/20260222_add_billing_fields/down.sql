-- Down migration for 20260222_add_billing_fields
-- NOTE: Cannot remove enum values ('free', 'sovereign', 'mercury', 'syndicate')
-- from subscription_tier in PostgreSQL. Manual enum recreation required.
-- WARNING: Drops billing columns from users table.

-- Drop unique index
DROP INDEX IF EXISTS "users_stripe_customer_id_key";

-- Remove billing columns from users
ALTER TABLE "users" DROP COLUMN IF EXISTS "subscription_ends_at";
ALTER TABLE "users" DROP COLUMN IF EXISTS "subscription_started_at";
ALTER TABLE "users" DROP COLUMN IF EXISTS "entitlements";
ALTER TABLE "users" DROP COLUMN IF EXISTS "stripe_subscription_id";
ALTER TABLE "users" DROP COLUMN IF EXISTS "stripe_customer_id";
ALTER TABLE "users" DROP COLUMN IF EXISTS "subscription_status";

-- Drop subscription_status enum
DROP TYPE IF EXISTS "subscription_status";
