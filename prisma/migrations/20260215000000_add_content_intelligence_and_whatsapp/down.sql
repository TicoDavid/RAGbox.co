-- Down migration for 20260215000000_add_content_intelligence_and_whatsapp
-- WARNING: Drops all Content Intelligence + WhatsApp tables and data.

-- Drop foreign keys
ALTER TABLE "whatsapp_messages" DROP CONSTRAINT IF EXISTS "whatsapp_messages_conversation_id_fkey";
ALTER TABLE "whatsapp_conversations" DROP CONSTRAINT IF EXISTS "whatsapp_conversations_contact_id_fkey";
ALTER TABLE "whatsapp_conversations" DROP CONSTRAINT IF EXISTS "whatsapp_conversations_user_id_fkey";
ALTER TABLE "whatsapp_contacts" DROP CONSTRAINT IF EXISTS "whatsapp_contacts_user_id_fkey";
ALTER TABLE "kb_health_checks" DROP CONSTRAINT IF EXISTS "kb_health_checks_vault_id_fkey";
ALTER TABLE "content_gaps" DROP CONSTRAINT IF EXISTS "content_gaps_user_id_fkey";
ALTER TABLE "learning_sessions" DROP CONSTRAINT IF EXISTS "learning_sessions_vault_id_fkey";
ALTER TABLE "learning_sessions" DROP CONSTRAINT IF EXISTS "learning_sessions_user_id_fkey";

-- Drop tables (children first)
DROP TABLE IF EXISTS "whatsapp_messages";
DROP TABLE IF EXISTS "whatsapp_conversations";
DROP TABLE IF EXISTS "whatsapp_contacts";
DROP TABLE IF EXISTS "kb_health_checks";
DROP TABLE IF EXISTS "content_gaps";
DROP TABLE IF EXISTS "learning_sessions";

-- Drop enums
DROP TYPE IF EXISTS "wa_conversation_status";
DROP TYPE IF EXISTS "wa_message_status";
DROP TYPE IF EXISTS "wa_message_type";
DROP TYPE IF EXISTS "wa_direction";
DROP TYPE IF EXISTS "health_status";
DROP TYPE IF EXISTS "gap_status";
DROP TYPE IF EXISTS "session_status";
