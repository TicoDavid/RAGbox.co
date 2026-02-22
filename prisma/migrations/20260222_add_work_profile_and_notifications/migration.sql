-- STORY-010: Add work profile fields to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company_name" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "job_title" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "industry" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company_size" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "use_case" TEXT;

-- STORY-017: Create notification_settings table
CREATE TABLE IF NOT EXISTS "notification_settings" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "email" BOOLEAN NOT NULL DEFAULT true,
  "push" BOOLEAN NOT NULL DEFAULT false,
  "audit" BOOLEAN NOT NULL DEFAULT true,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on user_id
CREATE UNIQUE INDEX IF NOT EXISTS "notification_settings_user_id_key" ON "notification_settings"("user_id");

-- Foreign key
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
