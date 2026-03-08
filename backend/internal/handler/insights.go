package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/connexus-ai/ragbox-backend/internal/middleware"
	"github.com/connexus-ai/ragbox-backend/internal/model"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// InsightDeps holds dependencies for insight handlers.
type InsightDeps struct {
	Scanner *service.InsightScannerService
}

// ListInsights returns active insights for the authenticated user.
// GET /api/v1/insights?limit=10
func ListInsights(deps InsightDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.UserIDFromContext(r.Context())
		if userID == "" {
			respondJSON(w, http.StatusUnauthorized, envelope{Success: false, Error: "unauthorized"})
			return
		}

		limit := 10
		if l := r.URL.Query().Get("limit"); l != "" {
			if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 50 {
				limit = parsed
			}
		}

		insights, err := deps.Scanner.GetActiveInsights(r.Context(), userID, limit)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to fetch insights"})
			return
		}

		if insights == nil {
			insights = []model.ProactiveInsight{}
		}

		respondJSON(w, http.StatusOK, envelope{Success: true, Data: insights})
	}
}

// AcknowledgeInsight marks an insight as seen/dismissed.
// PATCH /api/v1/insights/{id}/acknowledge
func AcknowledgeInsight(deps InsightDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.UserIDFromContext(r.Context())
		if userID == "" {
			respondJSON(w, http.StatusUnauthorized, envelope{Success: false, Error: "unauthorized"})
			return
		}

		insightID := chi.URLParam(r, "id")
		if insightID == "" {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "insight ID required"})
			return
		}

		if err := deps.Scanner.AcknowledgeInsight(r.Context(), insightID); err != nil {
			respondJSON(w, http.StatusNotFound, envelope{Success: false, Error: "insight not found"})
			return
		}

		respondJSON(w, http.StatusOK, envelope{Success: true})
	}
}

// ScanVault triggers a vault scan for the authenticated user.
// POST /api/v1/insights/scan
// Rate limited: 1 per 5 min per user (applied at router level).
func ScanVault(deps InsightDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.UserIDFromContext(r.Context())
		if userID == "" {
			respondJSON(w, http.StatusUnauthorized, envelope{Success: false, Error: "unauthorized"})
			return
		}

		// Extract tenant from request body or default
		var body struct {
			TenantID string `json:"tenantId"`
		}
		if r.Body != nil {
			json.NewDecoder(r.Body).Decode(&body)
		}
		tenantID := body.TenantID
		if tenantID == "" {
			tenantID = "default"
		}

		insights, err := deps.Scanner.ScanVaultForInsights(r.Context(), userID, tenantID)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "scan failed"})
			return
		}

		respondJSON(w, http.StatusOK, envelope{Success: true, Data: map[string]interface{}{
			"newInsights": len(insights),
			"insights":    insights,
		}})
	}
}
