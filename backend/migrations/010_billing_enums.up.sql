-- 010_billing_enums.up.sql
-- Add billing tier values to subscription_tier enum and create subscription_status enum.
-- Required for STORY-067 Stripe billing pipeline.
-- NOTE: ALTER TYPE ADD VALUE cannot be used in the same transaction as an UPDATE
-- that references the new values. The UPDATE is split to migration 011.

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
