-- 012_provision_customer_zero.up.sql
-- Provision David Pierce as Customer Zero with Sovereign + Mercury entitlements.
-- Email: david@theconnexus.ai

UPDATE "users"
SET
  "subscription_tier" = 'mercury',
  "subscription_status" = 'active',
  "stripe_customer_id" = 'cus_customer_zero_david',
  "stripe_subscription_id" = 'sub_customer_zero_david',
  "entitlements" = '{"documents_limit":50,"queries_per_month":500,"byollm_enabled":false,"api_keys_enabled":false,"mercury_voice":true,"mercury_channels":["voice","chat"]}',
  "subscription_started_at" = NOW()
WHERE "email" = 'david@theconnexus.ai';
