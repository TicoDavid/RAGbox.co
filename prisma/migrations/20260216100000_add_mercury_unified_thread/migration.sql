-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "mercury_role" AS ENUM ('user', 'assistant');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "mercury_channel" AS ENUM ('dashboard', 'whatsapp', 'voice');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "mercury_threads" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mercury_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "mercury_thread_messages" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "role" "mercury_role" NOT NULL,
    "channel" "mercury_channel" NOT NULL,
    "content" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "citations" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mercury_thread_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mercury_threads_user_id_updated_at_idx" ON "mercury_threads"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mercury_thread_messages_thread_id_created_at_idx" ON "mercury_thread_messages"("thread_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mercury_thread_messages_thread_id_channel_idx" ON "mercury_thread_messages"("thread_id", "channel");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "mercury_threads" ADD CONSTRAINT "mercury_threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "mercury_thread_messages" ADD CONSTRAINT "mercury_thread_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "mercury_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
