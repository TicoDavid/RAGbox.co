-- CreateTable: llm_configs (BYOLLM tenant-scoped LLM configuration)
CREATE TABLE "llm_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'openrouter',
    "api_key_encrypted" TEXT NOT NULL,
    "base_url" TEXT,
    "default_model" TEXT,
    "policy" TEXT NOT NULL DEFAULT 'choice',
    "last_tested_at" TIMESTAMP(3),
    "last_test_result" TEXT,
    "last_test_latency" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique tenant constraint (one config per tenant)
CREATE UNIQUE INDEX "llm_configs_tenant_id_key" ON "llm_configs"("tenant_id");
