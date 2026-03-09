-- 017_align_enum_types.down.sql
-- Reverse: re-create the snake_case enum types that were dropped.
-- These are duplicates and will re-introduce the casting bug,
-- so only use this if you need to rollback for debugging.

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('Partner', 'Associate', 'Auditor');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('Active', 'Suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE vault_status AS ENUM ('open', 'closed', 'secure');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE index_status AS ENUM ('Pending', 'Processing', 'Indexed', 'Failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE deletion_status AS ENUM ('Active', 'SoftDeleted', 'HardDeleted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE query_outcome AS ENUM ('Answered', 'Refused');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
