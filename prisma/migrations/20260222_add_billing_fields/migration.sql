-- STORY-067: Add billing subscription fields to users table

-- Expand subscription_tier enum with new values
ALTER TYPE "subscription_tier" ADD VALUE IF NOT EXISTS 'free';
ALTER TYPE "subscription_tier" ADD VALUE IF NOT EXISTS 'sovereign';
ALTER TYPE "subscription_tier" ADD VALUE IF NOT EXISTS 'mercury';
ALTER TYPE "subscription_tier" ADD VALUE IF NOT EXISTS 'syndicate';

-- Create subscription_status enum
DO $$ BEGIN CREATE TYPE "subscription_status" AS ENUM ('inactive', 'active', 'past_due', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add billing columns to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_status" "subscription_status" NOT NULL DEFAULT 'inactive';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_customer_id" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "entitlements" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_started_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_ends_at" TIMESTAMP(3);

-- Unique index on stripe_customer_id
CREATE UNIQUE INDEX IF NOT EXISTS "users_stripe_customer_id_key" ON "users"("stripe_customer_id");
