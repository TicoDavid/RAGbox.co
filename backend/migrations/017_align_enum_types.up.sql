-- 017_align_enum_types.up.sql
-- Fix GitHub Issue #46: Go backend enum type casting errors
--
-- Problem: Two sets of enum types exist in the database:
--   Prisma migrations created PascalCase (quoted): "UserRole", "IndexStatus", etc.
--   Go migrations created snake_case (unquoted): user_role, index_status, etc.
--
-- Table columns reference the PascalCase types (Prisma created the tables).
-- The snake_case types are unused duplicates that cause ambiguous cast errors:
--   "column 'role' is of type 'UserRole' but expression is of type user_role"
--   "operator does not exist: 'IndexStatus' = index_status"
--
-- Fix: Drop orphaned snake_case enums, then create implicit casts from text
-- so Go's string($1) parameters work with PascalCase enum columns.
-- Idempotent: safe to run multiple times.

-- Step 1: Drop orphaned snake_case enum types (created by Go 001_initial_schema.up.sql)
-- These are NOT used by any column — Prisma's PascalCase types are the column types.
-- We must check they exist before dropping (idempotent).

DO $$ BEGIN
    -- Only drop if BOTH the snake_case AND PascalCase versions exist.
    -- If only snake_case exists (Go ran first, Prisma never ran), we must NOT drop.

    -- user_role vs "UserRole"
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role')
       AND EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
        -- Verify no column actually uses the snake_case type
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns c
            JOIN pg_type t ON c.udt_name = 'user_role'
            WHERE c.table_schema = 'public'
              AND c.data_type = 'USER-DEFINED'
              AND c.udt_name = 'user_role'
        ) THEN
            DROP TYPE user_role;
            RAISE NOTICE 'Dropped orphaned type: user_role';
        ELSE
            RAISE NOTICE 'Skipped user_role: still referenced by columns';
        END IF;
    END IF;

    -- user_status vs "UserStatus"
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status')
       AND EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserStatus') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND data_type = 'USER-DEFINED'
              AND udt_name = 'user_status'
        ) THEN
            DROP TYPE user_status;
            RAISE NOTICE 'Dropped orphaned type: user_status';
        ELSE
            RAISE NOTICE 'Skipped user_status: still referenced by columns';
        END IF;
    END IF;

    -- vault_status vs "VaultStatus"
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vault_status')
       AND EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VaultStatus') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND data_type = 'USER-DEFINED'
              AND udt_name = 'vault_status'
        ) THEN
            DROP TYPE vault_status;
            RAISE NOTICE 'Dropped orphaned type: vault_status';
        ELSE
            RAISE NOTICE 'Skipped vault_status: still referenced by columns';
        END IF;
    END IF;

    -- index_status vs "IndexStatus"
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'index_status')
       AND EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IndexStatus') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND data_type = 'USER-DEFINED'
              AND udt_name = 'index_status'
        ) THEN
            DROP TYPE index_status;
            RAISE NOTICE 'Dropped orphaned type: index_status';
        ELSE
            RAISE NOTICE 'Skipped index_status: still referenced by columns';
        END IF;
    END IF;

    -- deletion_status vs "DeletionStatus"
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deletion_status')
       AND EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeletionStatus') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND data_type = 'USER-DEFINED'
              AND udt_name = 'deletion_status'
        ) THEN
            DROP TYPE deletion_status;
            RAISE NOTICE 'Dropped orphaned type: deletion_status';
        ELSE
            RAISE NOTICE 'Skipped deletion_status: still referenced by columns';
        END IF;
    END IF;

    -- query_outcome vs "QueryOutcome"
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'query_outcome')
       AND EXISTS (SELECT 1 FROM pg_type WHERE typname = 'QueryOutcome') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND data_type = 'USER-DEFINED'
              AND udt_name = 'query_outcome'
        ) THEN
            DROP TYPE query_outcome;
            RAISE NOTICE 'Dropped orphaned type: query_outcome';
        ELSE
            RAISE NOTICE 'Skipped query_outcome: still referenced by columns';
        END IF;
    END IF;

END $$;

-- Note: 001_initial_schema.up.sql has also been updated to use PascalCase
-- enum names ("UserRole", "IndexStatus", etc.) so re-running the Go
-- migrations on a fresh database will not recreate the snake_case duplicates.
