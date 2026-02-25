-- Down migration for 20260216100000_add_mercury_unified_thread
-- WARNING: Drops mercury thread tables and all conversation history.

-- Drop foreign keys
ALTER TABLE "mercury_thread_messages" DROP CONSTRAINT IF EXISTS "mercury_thread_messages_thread_id_fkey";
ALTER TABLE "mercury_threads" DROP CONSTRAINT IF EXISTS "mercury_threads_user_id_fkey";

-- Drop tables
DROP TABLE IF EXISTS "mercury_thread_messages";
DROP TABLE IF EXISTS "mercury_threads";

-- Drop enums
DROP TYPE IF EXISTS "mercury_channel";
DROP TYPE IF EXISTS "mercury_role";
