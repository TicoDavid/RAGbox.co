-- Revert: canonical → legacy tier names
UPDATE "users" SET "subscription_tier" = 'mercury' WHERE "subscription_tier" = 'starter';
UPDATE "users" SET "subscription_tier" = 'syndicate' WHERE "subscription_tier" = 'enterprise';
-- Note: Cannot remove enum values in PostgreSQL
