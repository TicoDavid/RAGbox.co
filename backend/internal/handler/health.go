package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"time"
)

const version = "1.0.0"

// DBPinger is the interface for checking database connectivity.
type DBPinger interface {
	Ping(ctx context.Context) error
}

// Health returns a handler that reports server and database health.
// GET /api/health — returns {"status":"ok","version":"1.0.0"} without auth.
func Health(db DBPinger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()

		status := "ok"
		dbStatus := "connected"
		httpStatus := http.StatusOK

		if db != nil {
			if err := db.Ping(ctx); err != nil {
				status = "degraded"
				dbStatus = "disconnected"
				httpStatus = http.StatusServiceUnavailable
			}
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(httpStatus)
		json.NewEncoder(w).Encode(map[string]string{
			"status":   status,
			"version":  version,
			"database": dbStatus,
		})
	}
}
