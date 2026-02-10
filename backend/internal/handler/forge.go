package handler

import (
	"encoding/json"
	"net/http"

	"github.com/connexus-ai/ragbox-backend/internal/middleware"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// ForgeHandler returns a handler for POST /api/forge.
func ForgeHandler(forgeSvc *service.ForgeService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.UserIDFromContext(r.Context())
		if userID == "" {
			respondJSON(w, http.StatusUnauthorized, envelope{Success: false, Error: "unauthorized"})
			return
		}

		var req service.ForgeRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "invalid request body"})
			return
		}

		result, err := forgeSvc.Generate(r.Context(), req)
		if err != nil {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: err.Error()})
			return
		}

		respondJSON(w, http.StatusOK, envelope{Success: true, Data: result})
	}
}
