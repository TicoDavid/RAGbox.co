-- Down migration for 20260225_align_subscription_tiers
-- WARNING: Reverses data migration — maps canonical tiers back to legacy names.
-- NOTE: Cannot remove enum values ('starter', 'professional', 'enterprise')
-- from subscription_tier in PostgreSQL. Manual enum recreation required.

-- Reverse data migration: canonical → legacy
UPDATE "users" SET "subscription_tier" = 'mercury' WHERE "subscription_tier" = 'starter';
UPDATE "users" SET "subscription_tier" = 'syndicate' WHERE "subscription_tier" = 'enterprise';
