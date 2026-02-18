-- Add beta launch features: waitlist fields, beta codes, subscription tiers

-- 1. WaitlistEntry: add profile fields
ALTER TABLE "waitlist_entries" ADD COLUMN IF NOT EXISTS "full_name" TEXT;
ALTER TABLE "waitlist_entries" ADD COLUMN IF NOT EXISTS "company" TEXT;
ALTER TABLE "waitlist_entries" ADD COLUMN IF NOT EXISTS "role" TEXT;
ALTER TABLE "waitlist_entries" ADD COLUMN IF NOT EXISTS "company_size" TEXT;

-- 2. Subscription tier enum
DO $$ BEGIN
  CREATE TYPE "subscription_tier" AS ENUM ('starter', 'professional', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. User: add subscription_tier column
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_tier" "subscription_tier" NOT NULL DEFAULT 'professional';

-- 4. Beta codes table
CREATE TABLE IF NOT EXISTS "beta_codes" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "batch" INTEGER NOT NULL,
  "used" BOOLEAN NOT NULL DEFAULT false,
  "used_by" TEXT,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "beta_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "beta_codes_code_key" ON "beta_codes"("code");
