-- EPIC-016 P01: Align subscription_tier enum to CPO pricing model
-- Canonical tiers: free | starter | professional | enterprise | sovereign
-- Legacy tiers (mercury, syndicate) remain in enum (PG can't remove values)

-- Step 1: Add new enum values (idempotent)
ALTER TYPE "subscription_tier" ADD VALUE IF NOT EXISTS 'starter';
ALTER TYPE "subscription_tier" ADD VALUE IF NOT EXISTS 'professional';
ALTER TYPE "subscription_tier" ADD VALUE IF NOT EXISTS 'enterprise';

-- Step 2: Migrate existing user data from legacy → canonical names
-- mercury → starter, syndicate → enterprise
-- free and sovereign stay as-is
UPDATE "users" SET "subscription_tier" = 'starter' WHERE "subscription_tier" = 'mercury';
UPDATE "users" SET "subscription_tier" = 'enterprise' WHERE "subscription_tier" = 'syndicate';

-- Note: Old enum values ('mercury', 'syndicate') cannot be removed from PostgreSQL
-- enum types without recreating the type. They will be unused but harmless.
-- The application code normalizes legacy values via normalizeTier().
