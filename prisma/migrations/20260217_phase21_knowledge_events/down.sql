-- Down migration for 20260217_phase21_knowledge_events
-- WARNING: Drops knowledge_events table and all ingestion event history.

ALTER TABLE "knowledge_events" DROP CONSTRAINT IF EXISTS "knowledge_events_user_id_fkey";
ALTER TABLE "knowledge_events" DROP CONSTRAINT IF EXISTS "knowledge_events_tenant_id_event_id_key";
DROP TABLE IF EXISTS "knowledge_events";
DROP TYPE IF EXISTS "knowledge_event_status";
