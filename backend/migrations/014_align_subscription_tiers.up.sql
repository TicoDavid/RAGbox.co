-- EPIC-016 P01: Align subscription_tier enum to CPO pricing model
-- Add new canonical tier values (idempotent)
ALTER TYPE "subscription_tier" ADD VALUE IF NOT EXISTS 'starter';
ALTER TYPE "subscription_tier" ADD VALUE IF NOT EXISTS 'professional';
ALTER TYPE "subscription_tier" ADD VALUE IF NOT EXISTS 'enterprise';

-- Migrate legacy → canonical
UPDATE "users" SET "subscription_tier" = 'starter' WHERE "subscription_tier" = 'mercury';
UPDATE "users" SET "subscription_tier" = 'enterprise' WHERE "subscription_tier" = 'syndicate';
