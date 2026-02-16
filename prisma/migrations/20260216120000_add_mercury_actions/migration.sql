-- CreateTable
CREATE TABLE IF NOT EXISTS "mercury_actions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "recipient" TEXT,
    "subject" TEXT,
    "body" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mercury_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mercury_actions_user_id_idx" ON "mercury_actions"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mercury_actions_action_type_idx" ON "mercury_actions"("action_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mercury_actions_created_at_idx" ON "mercury_actions"("created_at");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "mercury_actions" ADD CONSTRAINT "mercury_actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
