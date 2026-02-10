package migrations

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func getTestPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL not set, skipping migration integration test")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatalf("failed to connect: %v", err)
	}
	return pool
}

func runSQL(t *testing.T, pool *pgxpool.Pool, filename string) {
	t.Helper()
	sql, err := os.ReadFile(filename)
	if err != nil {
		t.Fatalf("failed to read %s: %v", filename, err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	_, err = pool.Exec(ctx, string(sql))
	if err != nil {
		t.Fatalf("failed to execute %s: %v", filename, err)
	}
}

func TestMigration_UpCreatesAllTables(t *testing.T) {
	pool := getTestPool(t)
	defer pool.Close()

	// Run up (idempotent — safe even if tables already exist)
	runSQL(t, pool, "001_initial_schema.up.sql")

	ctx := context.Background()

	expectedTables := []string{
		"users", "vaults", "documents", "document_chunks",
		"queries", "answers", "citations", "audit_logs",
		"folders", "templates", "waitlist_entries",
	}

	for _, table := range expectedTables {
		var exists bool
		err := pool.QueryRow(ctx,
			"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)", table,
		).Scan(&exists)
		if err != nil {
			t.Fatalf("failed to check table %s: %v", table, err)
		}
		if !exists {
			t.Errorf("table %s does not exist after up migration", table)
		}
	}
}

func TestMigration_UpIsIdempotent(t *testing.T) {
	pool := getTestPool(t)
	defer pool.Close()

	// Run up twice — second run should not error (idempotent)
	runSQL(t, pool, "001_initial_schema.up.sql")
	runSQL(t, pool, "001_initial_schema.up.sql")
}

func TestMigration_DownAndUpCycle(t *testing.T) {
	pool := getTestPool(t)
	defer pool.Close()

	// Verify down + up cycle executes without errors.
	// We don't check table absence between down/up because concurrent
	// test packages (repository) share this database and may recreate tables.
	runSQL(t, pool, "001_initial_schema.down.sql")
	runSQL(t, pool, "001_initial_schema.up.sql")

	// Verify tables exist after the restore
	ctx := context.Background()
	tables := []string{
		"users", "vaults", "documents", "document_chunks",
		"queries", "answers", "citations", "audit_logs",
		"folders", "templates", "waitlist_entries",
	}
	for _, table := range tables {
		var exists bool
		err := pool.QueryRow(ctx,
			"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)", table,
		).Scan(&exists)
		if err != nil {
			t.Fatalf("failed to check table %s: %v", table, err)
		}
		if !exists {
			t.Errorf("table %s does not exist after down+up cycle", table)
		}
	}
}

func TestMigration_VectorColumnExists(t *testing.T) {
	pool := getTestPool(t)
	defer pool.Close()

	// Ensure schema exists (idempotent)
	runSQL(t, pool, "001_initial_schema.up.sql")

	ctx := context.Background()
	var dataType string
	err := pool.QueryRow(ctx, `
		SELECT udt_name FROM information_schema.columns
		WHERE table_name = 'document_chunks' AND column_name = 'embedding'
	`).Scan(&dataType)
	if err != nil {
		t.Fatalf("failed to check embedding column: %v", err)
	}
	if dataType != "vector" {
		t.Errorf("embedding column type = %q, want %q", dataType, "vector")
	}
}
