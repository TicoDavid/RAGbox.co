-- Down migration for 20260219_add_llm_config
-- WARNING: Drops llm_configs table and all stored LLM API keys.
DROP TABLE IF EXISTS "llm_configs";
