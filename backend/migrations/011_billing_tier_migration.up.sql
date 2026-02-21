-- 011_billing_tier_migration.up.sql
-- Migrate existing users from legacy tiers to 'free'.
-- Must run AFTER 010 which adds 'free' to the subscription_tier enum.

UPDATE "users"
SET "subscription_tier" = 'free'
WHERE "subscription_tier" IN ('starter', 'professional')
  AND "subscription_status" = 'inactive';
