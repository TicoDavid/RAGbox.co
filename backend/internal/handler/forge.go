package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

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

		// Validate template
		switch req.Template {
		case service.TemplateExecutiveBrief, service.TemplateRiskAssessment, service.TemplateComplianceSummary:
			// valid
		case "":
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "template is required"})
			return
		default:
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "template must be one of: executive_brief, risk_assessment, compliance_summary"})
			return
		}

		// Validate query
		if req.Query == "" {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "query is required"})
			return
		}
		if len(req.Query) > 5000 {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "query exceeds 5000 character limit"})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
		defer cancel()

		result, err := forgeSvc.Generate(ctx, req)
		if err != nil {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: err.Error()})
			return
		}

		respondJSON(w, http.StatusOK, envelope{Success: true, Data: result})
	}
}
