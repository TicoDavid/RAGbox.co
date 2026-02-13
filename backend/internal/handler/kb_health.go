package handler

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/connexus-ai/ragbox-backend/internal/middleware"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// KBHealthDeps bundles dependencies for KB health handlers.
type KBHealthDeps struct {
	Svc *service.KBHealthService
}

// RunHealthCheck returns a handler for POST /api/vaults/{id}/health-check.
// Runs both freshness and coverage checks for the specified vault.
func RunHealthCheck(deps KBHealthDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.UserIDFromContext(r.Context())
		if userID == "" {
			respondJSON(w, http.StatusUnauthorized, envelope{Success: false, Error: "unauthorized"})
			return
		}

		vaultID := chi.URLParam(r, "id")
		if vaultID == "" {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "vault id is required"})
			return
		}

		freshness, err := deps.Svc.RunFreshnessCheck(r.Context(), vaultID)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "freshness check failed"})
			return
		}

		coverage, err := deps.Svc.RunCoverageCheck(r.Context(), vaultID)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "coverage check failed"})
			return
		}

		respondJSON(w, http.StatusOK, envelope{
			Success: true,
			Data: map[string]interface{}{
				"freshness": freshness,
				"coverage":  coverage,
			},
		})
	}
}

// GetHealthHistory returns a handler for GET /api/vaults/{id}/health-checks.
func GetHealthHistory(deps KBHealthDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.UserIDFromContext(r.Context())
		if userID == "" {
			respondJSON(w, http.StatusUnauthorized, envelope{Success: false, Error: "unauthorized"})
			return
		}

		vaultID := chi.URLParam(r, "id")
		if vaultID == "" {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "vault id is required"})
			return
		}

		limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
		if limit <= 0 {
			limit = 10
		}

		checks, err := deps.Svc.GetLatestChecks(r.Context(), vaultID, limit)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to get health checks"})
			return
		}

		respondJSON(w, http.StatusOK, envelope{
			Success: true,
			Data: map[string]interface{}{
				"checks": checks,
			},
		})
	}
}
