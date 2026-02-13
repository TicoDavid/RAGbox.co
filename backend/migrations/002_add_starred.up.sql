-- Add is_starred column to documents table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'documents' AND column_name = 'is_starred'
    ) THEN
        ALTER TABLE documents ADD COLUMN is_starred BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;
