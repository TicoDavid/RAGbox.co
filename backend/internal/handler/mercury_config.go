package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"regexp"
	"strings"

	"github.com/connexus-ai/ragbox-backend/internal/middleware"
	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// MercuryConfigReader reads Mercury config by user ID.
type MercuryConfigReader interface {
	GetByUserID(ctx context.Context, userID string) (*model.MercuryConfig, error)
}

// MercuryConfigWriter upserts Mercury config.
type MercuryConfigWriter interface {
	Upsert(ctx context.Context, userID string, cfg *model.MercuryConfig) (*model.MercuryConfig, error)
}

// MercuryConfigDeps bundles dependencies for Mercury config handlers.
type MercuryConfigDeps struct {
	Reader MercuryConfigReader
	Writer MercuryConfigWriter
}

// Allowed voice IDs for validation.
var allowedVoiceIDs = map[string]bool{
	"Ashley": true, "Dennis": true, "Luna": true, "Mark": true,
	"Alex": true, "Craig": true, "Deborah": true, "Edward": true,
	"Elizabeth": true, "Julia": true, "Olivia": true, "Priya": true,
	"Ronald": true, "Sarah": true, "Wendy": true, "Hades": true,
}

var namePattern = regexp.MustCompile(`^[a-zA-Z0-9 ]+$`)

// mercuryConfigRequest is the JSON body for POST.
type mercuryConfigRequest struct {
	Name              *string `json:"name"`
	VoiceID           *string `json:"voiceId"`
	Greeting          *string `json:"greeting"`
	PersonalityPrompt *string `json:"personalityPrompt"`
}

// mercuryConfigResponse is the JSON response shape.
type mercuryConfigResponse struct {
	Name              string  `json:"name"`
	VoiceID           string  `json:"voiceId"`
	Greeting          string  `json:"greeting"`
	PersonalityPrompt *string `json:"personalityPrompt"`
}

// GetMercuryConfig returns the user's Mercury config or defaults.
// GET /api/mercury/config
func GetMercuryConfig(deps MercuryConfigDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.UserIDFromContext(r.Context())
		if userID == "" {
			respondJSON(w, http.StatusUnauthorized, envelope{Success: false, Error: "unauthorized"})
			return
		}

		cfg, err := deps.Reader.GetByUserID(r.Context(), userID)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to fetch Mercury config"})
			return
		}

		if cfg == nil {
			// Return defaults
			defaults := model.DefaultMercuryConfig()
			respondJSON(w, http.StatusOK, envelope{
				Success: true,
				Data: mercuryConfigResponse{
					Name:              defaults.Name,
					VoiceID:           defaults.VoiceID,
					Greeting:          defaults.Greeting,
					PersonalityPrompt: nil,
				},
			})
			return
		}

		respondJSON(w, http.StatusOK, envelope{
			Success: true,
			Data: mercuryConfigResponse{
				Name:              cfg.Name,
				VoiceID:           cfg.VoiceID,
				Greeting:          cfg.Greeting,
				PersonalityPrompt: cfg.PersonalityPrompt,
			},
		})
	}
}

// SaveMercuryConfig creates or updates the user's Mercury config.
// POST /api/mercury/config
func SaveMercuryConfig(deps MercuryConfigDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.UserIDFromContext(r.Context())
		if userID == "" {
			respondJSON(w, http.StatusUnauthorized, envelope{Success: false, Error: "unauthorized"})
			return
		}

		var req mercuryConfigRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "invalid request body"})
			return
		}

		// Start with existing config or defaults
		existing, err := deps.Reader.GetByUserID(r.Context(), userID)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to fetch existing config"})
			return
		}

		merged := model.DefaultMercuryConfig()
		if existing != nil {
			merged = *existing
		}

		// Merge provided fields
		if req.Name != nil {
			name := strings.TrimSpace(*req.Name)
			if len(name) < 1 || len(name) > 50 {
				respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "name must be 1-50 characters"})
				return
			}
			if !namePattern.MatchString(name) {
				respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "name must be alphanumeric (letters, numbers, spaces)"})
				return
			}
			merged.Name = name
		}

		if req.VoiceID != nil {
			if !allowedVoiceIDs[*req.VoiceID] {
				respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "invalid voiceId"})
				return
			}
			merged.VoiceID = *req.VoiceID
		}

		if req.Greeting != nil {
			greeting := strings.TrimSpace(*req.Greeting)
			if len(greeting) < 1 || len(greeting) > 500 {
				respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "greeting must be 1-500 characters"})
				return
			}
			merged.Greeting = greeting
		}

		if req.PersonalityPrompt != nil {
			prompt := strings.TrimSpace(*req.PersonalityPrompt)
			if len(prompt) > 2000 {
				respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "personalityPrompt must be 0-2000 characters"})
				return
			}
			if prompt == "" {
				merged.PersonalityPrompt = nil
			} else {
				merged.PersonalityPrompt = &prompt
			}
		}

		saved, err := deps.Writer.Upsert(r.Context(), userID, &merged)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to save Mercury config"})
			return
		}

		respondJSON(w, http.StatusOK, envelope{
			Success: true,
			Data: mercuryConfigResponse{
				Name:              saved.Name,
				VoiceID:           saved.VoiceID,
				Greeting:          saved.Greeting,
				PersonalityPrompt: saved.PersonalityPrompt,
			},
		})
	}
}
