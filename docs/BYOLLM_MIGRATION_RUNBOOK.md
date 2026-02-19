# BYOLLM Migration Runbook

**Table:** `llm_configs` | **Story:** STORY-020 | **Author:** Sarah (Junior Eng)
**Target:** AlloyDB (`ragbox-sovereign-prod:us-east4:ragbox-db`)

---

## 1. Pre-flight Checks

- [ ] Prisma schema includes `LLMConfig` model (`prisma/schema.prisma`)
- [ ] Migration SQL verified: `prisma/migrations/20260219_add_llm_config/migration.sql`
- [ ] `npx prisma generate` passes locally (confirms schema is valid)
- [ ] API routes exist: `src/app/api/settings/llm/route.ts`, `src/app/api/settings/llm/test/route.ts`
- [ ] No breaking changes to existing tables (this is an additive-only migration)
- [ ] Confirm the table does NOT already exist:
  ```sql
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_name = 'llm_configs'
  );
  ```

---

## 2. Option A: Via Cloud Build (Preferred)

This is the standard deployment path. The existing Cloud Build pipeline (Step 9: `run-migrations`) calls `POST /api/admin/migrate` automatically.

### Step 1: Add migration SQL to admin/migrate endpoint

Add the following block to `src/app/api/admin/migrate/route.ts` **before** the `return NextResponse.json(...)` line (after the last existing migration block):

```typescript
// ========================================
// BYOLLM: llm_configs table (STORY-020)
// ========================================
await prisma.$executeRawUnsafe(`
  CREATE TABLE IF NOT EXISTS "llm_configs" (
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
  )
`)
await prisma.$executeRawUnsafe(`
  CREATE UNIQUE INDEX IF NOT EXISTS "llm_configs_tenant_id_key"
  ON "llm_configs"("tenant_id")
`)
results.push('llm_configs (BYOLLM): OK')
```

### Step 2: Commit and push to `main`

```bash
git add src/app/api/admin/migrate/route.ts
git commit -m "feat: add llm_configs migration to admin/migrate endpoint (STORY-020)"
git push origin main
```

### Step 3: Cloud Build runs automatically

The pipeline will:
1. Build and deploy the new image to Cloud Run
2. Step 9 (`run-migrations`) calls `POST /api/admin/migrate`
3. The new `CREATE TABLE IF NOT EXISTS` executes idempotently
4. Step 10 (`smoke-test`) verifies the deployment

### Step 4: Verify in Cloud Build logs

Check the `run-migrations` step output for:
```
Migration result: {"success":true,"results":[..."llm_configs (BYOLLM): OK"]}
```

---

## 3. Option B: Via Cloud SQL Proxy (Manual)

Use this only if Cloud Build is unavailable or you need to apply the migration independently.

### Step 1: Start Cloud SQL Proxy

```bash
cloud-sql-proxy ragbox-sovereign-prod:us-east4:ragbox-db \
  --port 5433
```

### Step 2: Connect with psql

```bash
psql "postgresql://ragbox_user:<PASSWORD>@127.0.0.1:5433/ragbox"
```

> Password is stored in Secret Manager: `projects/ragbox-sovereign-prod/secrets/database-password`

### Step 3: Run migration SQL

Copy-paste the contents of `prisma/migrations/20260219_add_llm_config/migration.sql`:

```sql
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

CREATE UNIQUE INDEX "llm_configs_tenant_id_key" ON "llm_configs"("tenant_id");
```

### Step 4: Verify

```sql
\d llm_configs
SELECT count(*) FROM llm_configs;  -- Should be 0
```

---

## 4. Rollback

If the migration needs to be reverted:

```sql
DROP INDEX IF EXISTS "llm_configs_tenant_id_key";
DROP TABLE IF EXISTS "llm_configs";
```

> This is safe because `llm_configs` is a new table with no foreign keys and no existing data at deploy time.

If rolled back, also remove the migration block from `src/app/api/admin/migrate/route.ts` and redeploy.

---

## 5. Post-Migration Verification

Run these checks after the migration completes (via either option):

### 5a. Table exists

```sql
SELECT table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'llm_configs'
ORDER BY ordinal_position;
```

Expected: 12 columns (`id`, `tenant_id`, `provider`, `api_key_encrypted`, `base_url`, `default_model`, `policy`, `last_tested_at`, `last_test_result`, `last_test_latency`, `created_at`, `updated_at`)

### 5b. Unique index exists

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'llm_configs';
```

Expected: `llm_configs_pkey` (primary key) + `llm_configs_tenant_id_key` (unique)

### 5c. API endpoint responds

```bash
curl -s https://app.ragbox.co/api/settings/llm \
  -H "Authorization: Bearer <JWT>" | jq .
```

Expected response:
```json
{
  "success": true,
  "data": { "configured": false, "policy": "choice" }
}
```

### 5d. Prisma client works

Verify the Prisma client can access the table (no runtime type mismatch):

```bash
curl -s -X PUT https://app.ragbox.co/api/settings/llm \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"provider":"openrouter","apiKey":"sk-test-key-for-validation-only"}' | jq .
```

Expected: `{ "success": true, "data": { "configured": true, ... } }`

Then clean up the test row:
```bash
curl -s -X DELETE https://app.ragbox.co/api/settings/llm \
  -H "Authorization: Bearer <JWT>" | jq .
```

---

**Estimated time:** < 10 minutes (Option A) | < 15 minutes (Option B)
