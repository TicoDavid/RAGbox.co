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
)

// MigrationRunner executes a raw SQL string against the database.
type MigrationRunner func(ctx context.Context, sql string) error

// AdminMigrateDeps holds dependencies for the admin migration handler.
type AdminMigrateDeps struct {
	RunSQL        MigrationRunner
	MigrationsDir string
}

// AdminMigrate runs all *.up.sql migrations in order from the migrations directory.
// Protected by internal auth (x-internal-auth header checked in middleware).
func AdminMigrate(deps AdminMigrateDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 120*time.Second)
		defer cancel()

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

			if err := deps.RunSQL(ctx, string(sqlBytes)); err != nil {
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
