-- EPIC-031: Stripe Billing — subscription enum expansion + user_subscriptions table

-- Add new tier values
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'business';
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'vrep';
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'aiteam';

-- Add new status values
ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'trialing';
ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'incomplete';

-- UserSubscription table
CREATE TABLE IF NOT EXISTS "user_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "stripe_customer_id" TEXT NOT NULL,
    "stripe_subscription_id" TEXT,
    "stripe_price_id" TEXT,
    "tier" subscription_tier NOT NULL DEFAULT 'free',
    "status" subscription_status NOT NULL DEFAULT 'active',
    "current_period_start" TIMESTAMPTZ,
    "current_period_end" TIMESTAMPTZ,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "trial_ends_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "user_subscriptions_user_id_key" ON "user_subscriptions"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "user_subscriptions_stripe_customer_id_key" ON "user_subscriptions"("stripe_customer_id");
CREATE UNIQUE INDEX IF NOT EXISTS "user_subscriptions_stripe_subscription_id_key" ON "user_subscriptions"("stripe_subscription_id");

-- Lookup indexes
CREATE INDEX IF NOT EXISTS "user_subscriptions_stripe_customer_id_idx" ON "user_subscriptions"("stripe_customer_id");
CREATE INDEX IF NOT EXISTS "user_subscriptions_tier_idx" ON "user_subscriptions"("tier");

-- Foreign key
DO $$ BEGIN
    ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
