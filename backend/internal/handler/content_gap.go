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

// ContentGapDeps bundles dependencies for content gap handlers.
type ContentGapDeps struct {
	Svc *service.ContentGapService
}

// ListContentGaps returns a handler for GET /api/content-gaps.
// Supports query params: status, limit.
func ListContentGaps(deps ContentGapDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.UserIDFromContext(r.Context())
		if userID == "" {
			respondJSON(w, http.StatusUnauthorized, envelope{Success: false, Error: "unauthorized"})
			return
		}

		q := r.URL.Query()
		status := q.Get("status")
		limit, _ := strconv.Atoi(q.Get("limit"))
		if limit <= 0 {
			limit = 20
		}

		gaps, err := deps.Svc.ListGaps(r.Context(), userID, status, limit)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to list content gaps"})
			return
		}

		openCount, err := deps.Svc.GetGapCount(r.Context(), userID)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to count content gaps"})
			return
		}

		respondJSON(w, http.StatusOK, envelope{
			Success: true,
			Data: map[string]interface{}{
				"gaps":      gaps,
				"openCount": openCount,
			},
		})
	}
}

// UpdateContentGapStatus returns a handler for PATCH /api/content-gaps/{id}.
// Accepts body: {"status": "addressed"|"dismissed"}
func UpdateContentGapStatus(deps ContentGapDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.UserIDFromContext(r.Context())
		if userID == "" {
			respondJSON(w, http.StatusUnauthorized, envelope{Success: false, Error: "unauthorized"})
			return
		}

		gapID := chi.URLParam(r, "id")
		if gapID == "" {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "gap id is required"})
			return
		}

		var body struct {
			Status string `json:"status"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "invalid request body"})
			return
		}

		switch model.GapStatus(body.Status) {
		case model.GapStatusAddressed:
			if err := deps.Svc.AddressGap(r.Context(), gapID); err != nil {
				respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to update gap status"})
				return
			}
		case model.GapStatusDismissed:
			if err := deps.Svc.DismissGap(r.Context(), gapID); err != nil {
				respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to update gap status"})
				return
			}
		default:
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "status must be 'addressed' or 'dismissed'"})
			return
		}

		respondJSON(w, http.StatusOK, envelope{Success: true})
	}
}

// ContentGapSummary returns a handler for GET /api/content-gaps/summary.
func ContentGapSummary(deps ContentGapDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.UserIDFromContext(r.Context())
		if userID == "" {
			respondJSON(w, http.StatusUnauthorized, envelope{Success: false, Error: "unauthorized"})
			return
		}

		count, err := deps.Svc.GetGapCount(r.Context(), userID)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to count content gaps"})
			return
		}

		respondJSON(w, http.StatusOK, envelope{
			Success: true,
			Data: map[string]interface{}{
				"openGaps": count,
			},
		})
	}
}
