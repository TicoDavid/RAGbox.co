package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"time"
)

// DBPinger is the interface for checking database connectivity.
type DBPinger interface {
	Ping(ctx context.Context) error
}

var startedAt = time.Now()

// Health returns a handler that reports server and database health.
// GET /api/health — returns {"status":"ok","version":"..."} without auth.
func Health(db DBPinger, version ...string) http.HandlerFunc {
	ver := "0.0.0"
	if len(version) > 0 && version[0] != "" {
		ver = version[0]
	}
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()

		status := "ok"
		dbStatus := "connected"
		httpStatus := http.StatusOK

		dbStart := time.Now()
		if db != nil {
			if err := db.Ping(ctx); err != nil {
				status = "degraded"
				dbStatus = "disconnected"
				httpStatus = http.StatusServiceUnavailable
			}
		}
		dbLatencyMs := time.Since(dbStart).Milliseconds()

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(httpStatus)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":      status,
			"version":     ver,
			"database":    dbStatus,
			"dbLatencyMs": dbLatencyMs,
			"uptimeS":     int(time.Since(startedAt).Seconds()),
			"timestamp":   time.Now().UTC().Format(time.RFC3339),
		})
	}
}
