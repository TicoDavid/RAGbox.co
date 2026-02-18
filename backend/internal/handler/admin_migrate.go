package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// MigrationRunner executes a raw SQL string against the database.
type MigrationRunner func(ctx context.Context, sql string) error

// AdminMigrateDeps holds dependencies for the admin migration handler.
type AdminMigrateDeps struct {
	RunSQL        MigrationRunner
	MigrationsDir string
}

// AdminMigrate runs all *.up.sql migrations in order from the migrations directory.
// If ADMIN_DATABASE_URL is set, it connects as the admin user (postgres) to handle
// ownership-restricted ALTER TABLE operations. Otherwise falls back to RunSQL.
func AdminMigrate(deps AdminMigrateDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 120*time.Second)
		defer cancel()

		// Determine which SQL runner to use
		runSQL := deps.RunSQL

		// If ADMIN_DATABASE_URL is set, use postgres superuser to fix table ownership
		// so the ragbox user (deps.RunSQL) can run migrations with ALTER TABLE.
		adminURL := strings.TrimSpace(os.Getenv("ADMIN_DATABASE_URL"))
		if adminURL != "" {
			slog.Info("using ADMIN_DATABASE_URL to fix table ownership")
			adminPool, err := pgxpool.New(ctx, adminURL)
			if err != nil {
				slog.Warn("failed to connect with admin credentials (non-fatal)", "error", err)
			} else {
				defer adminPool.Close()

				// Transfer ownership of all public tables + enums to ragbox
				ownershipFix := `
					DO $$
					DECLARE obj RECORD;
					BEGIN
						FOR obj IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
						LOOP
							EXECUTE format('ALTER TABLE %I OWNER TO ragbox', obj.tablename);
						END LOOP;
						FOR obj IN SELECT typname FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typtype = 'e'
						LOOP
							EXECUTE format('ALTER TYPE %I OWNER TO ragbox', obj.typname);
						END LOOP;
					END $$;
				`
				if _, err := adminPool.Exec(ctx, ownershipFix); err != nil {
					slog.Warn("ownership fix failed (non-fatal)", "error", err)
				} else {
					slog.Info("table and enum ownership transferred to ragbox user")
				}
			}
			// Migrations still run as ragbox (deps.RunSQL) — now with proper ownership
		}

		migrationsDir := deps.MigrationsDir
		if migrationsDir == "" {
			migrationsDir = "/migrations"
		}

		// Find all *.up.sql files
		entries, err := os.ReadDir(migrationsDir)
		if err != nil {
			slog.Error("failed to read migrations directory", "dir", migrationsDir, "error", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   fmt.Sprintf("read migrations dir: %v", err),
			})
			return
		}

		var upFiles []string
		for _, e := range entries {
			if !e.IsDir() && strings.HasSuffix(e.Name(), ".up.sql") {
				upFiles = append(upFiles, e.Name())
			}
		}
		sort.Strings(upFiles) // lexicographic order ensures 001 < 002 < 003

		results := make([]map[string]interface{}, 0, len(upFiles))
		successCount := 0
		failCount := 0

		for _, filename := range upFiles {
			path := filepath.Join(migrationsDir, filename)
			sqlBytes, err := os.ReadFile(path)
			if err != nil {
				slog.Error("failed to read migration file", "file", filename, "error", err)
				results = append(results, map[string]interface{}{
					"file":   filename,
					"status": "error",
					"error":  fmt.Sprintf("read file: %v", err),
				})
				failCount++
				continue
			}

			if err := runSQL(ctx, string(sqlBytes)); err != nil {
				slog.Error("migration failed", "file", filename, "error", err)
				results = append(results, map[string]interface{}{
					"file":   filename,
					"status": "error",
					"error":  err.Error(),
				})
				failCount++
				continue
			}

			slog.Info("migration applied", "file", filename)
			results = append(results, map[string]interface{}{
				"file":   filename,
				"status": "ok",
			})
			successCount++
		}

		w.Header().Set("Content-Type", "application/json")
		if failCount > 0 {
			w.WriteHeader(http.StatusMultiStatus)
		} else {
			w.WriteHeader(http.StatusOK)
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":    failCount == 0,
			"total":      len(upFiles),
			"succeeded":  successCount,
			"failed":     failCount,
			"migrations": results,
		})
	}
}
