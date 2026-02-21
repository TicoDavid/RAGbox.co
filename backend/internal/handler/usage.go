package handler

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/connexus-ai/ragbox-backend/internal/middleware"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// UsageDeps holds dependencies for the usage handler.
type UsageDeps struct {
	UsageSvc     *service.UsageService
	UserTierFunc func(ctx context.Context, userID string) string
}

// GetUsage returns the current usage report for the authenticated user.
// GET /api/v1/usage
func GetUsage(deps UsageDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.UserIDFromContext(r.Context())
		if userID == "" {
			respondJSON(w, http.StatusUnauthorized, envelope{Success: false, Error: "unauthorized"})
			return
		}

		tier := "free"
		if deps.UserTierFunc != nil {
			tier = deps.UserTierFunc(r.Context(), userID)
		}

		report, err := deps.UsageSvc.GetUsageReport(r.Context(), userID, tier)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to get usage"})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(report)
	}
}
