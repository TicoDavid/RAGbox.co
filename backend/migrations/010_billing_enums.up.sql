-- 010_billing_enums.up.sql
-- Add billing tier values to subscription_tier enum and create subscription_status enum.
-- Required for STORY-067 Stripe billing pipeline.

-- Expand subscription_tier enum with RAGbox tier names
ALTER TYPE "subscription_tier" ADD VALUE IF NOT EXISTS 'free';
ALTER TYPE "subscription_tier" ADD VALUE IF NOT EXISTS 'sovereign';
ALTER TYPE "subscription_tier" ADD VALUE IF NOT EXISTS 'mercury';
ALTER TYPE "subscription_tier" ADD VALUE IF NOT EXISTS 'syndicate';

-- Create subscription_status enum (idempotent)
DO $$ BEGIN
    CREATE TYPE "subscription_status" AS ENUM ('inactive', 'active', 'past_due', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Migrate existing users from legacy tiers to free (inactive users only)
UPDATE "users"
SET "subscription_tier" = 'free'
WHERE "subscription_tier" IN ('starter', 'professional')
  AND "subscription_status" = 'inactive';
