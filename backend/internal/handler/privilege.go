package handler

import (
	"net/http"

	"github.com/connexus-ai/ragbox-backend/internal/middleware"
)

// PrivilegeState tracks global privilege mode per user (in-memory for now).
// In production this would be backed by a user preferences table.
type PrivilegeState struct {
	modes map[string]bool // userID → privilegeMode
}

// NewPrivilegeState creates a new PrivilegeState.
func NewPrivilegeState() *PrivilegeState {
	return &PrivilegeState{modes: make(map[string]bool)}
}

// GetPrivilege handles GET /api/privilege.
func GetPrivilege(state *PrivilegeState) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.UserIDFromContext(r.Context())
		if userID == "" {
			respondJSON(w, http.StatusUnauthorized, envelope{Success: false, Error: "unauthorized"})
			return
		}

		mode := state.modes[userID]
		respondJSON(w, http.StatusOK, envelope{Success: true, Data: map[string]bool{
			"privilegeMode": mode,
		}})
	}
}

// TogglePrivilege handles POST /api/privilege.
func TogglePrivilege(state *PrivilegeState) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.UserIDFromContext(r.Context())
		if userID == "" {
			respondJSON(w, http.StatusUnauthorized, envelope{Success: false, Error: "unauthorized"})
			return
		}

		state.modes[userID] = !state.modes[userID]
		respondJSON(w, http.StatusOK, envelope{Success: true, Data: map[string]bool{
			"privilegeMode": state.modes[userID],
		}})
	}
}
