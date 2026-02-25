package handler

import (
	"context"
	"log/slog"
	"net/http"
	"sync"

	"github.com/connexus-ai/ragbox-backend/internal/middleware"
	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// PrivilegeState tracks global privilege mode per user (in-memory for now).
// In production this would be backed by a user preferences table.
type PrivilegeState struct {
	mu    sync.RWMutex
	modes map[string]bool // userID → privilegeMode
}

// NewPrivilegeState creates a new PrivilegeState.
func NewPrivilegeState() *PrivilegeState {
	return &PrivilegeState{modes: make(map[string]bool)}
}

// IsPrivileged returns the privilege state for a user (thread-safe).
// Used by the chat handler to derive privilege from server state, not request body (STORY-S01 Gap 3).
func (ps *PrivilegeState) IsPrivileged(userID string) bool {
	ps.mu.RLock()
	defer ps.mu.RUnlock()
	return ps.modes[userID]
}

// PrivilegeAuditLogger abstracts audit logging for the privilege handler.
type PrivilegeAuditLogger interface {
	LogWithDetails(ctx context.Context, action, userID, resourceID, resourceType string, details map[string]interface{}) error
}

// RoleChecker looks up a user's role from the database.
type RoleChecker func(ctx context.Context, userID string) (string, error)

// PrivilegeDeps bundles dependencies for privilege handlers (STORY-S01).
type PrivilegeDeps struct {
	State       *PrivilegeState
	RoleChecker RoleChecker          // required — returns user role from DB
	AuditLogger PrivilegeAuditLogger // optional — nil disables audit logging
}

// privilegeAllowedRoles lists roles that may activate Privileged Mode (STORY-S01 Gap 1).
var privilegeAllowedRoles = map[string]bool{
	string(model.UserRolePartner): true,
	"admin":                       true,
}

// GetPrivilege handles GET /api/privilege.
func GetPrivilege(state *PrivilegeState) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.UserIDFromContext(r.Context())
		if userID == "" {
			respondJSON(w, http.StatusUnauthorized, envelope{Success: false, Error: "unauthorized"})
			return
		}

		state.mu.RLock()
		mode := state.modes[userID]
		state.mu.RUnlock()

		respondJSON(w, http.StatusOK, envelope{Success: true, Data: map[string]bool{
			"privilegeMode": mode,
		}})
	}
}

// TogglePrivilege handles POST /api/privilege.
// STORY-S01: RBAC enforced (Partner/admin only) + audit logging on every toggle.
func TogglePrivilege(deps PrivilegeDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.UserIDFromContext(r.Context())
		if userID == "" {
			respondJSON(w, http.StatusUnauthorized, envelope{Success: false, Error: "unauthorized"})
			return
		}

		// STORY-S01 Gap 1: RBAC — only Partner or admin may toggle Privileged Mode.
		if deps.RoleChecker != nil {
			role, err := deps.RoleChecker(r.Context(), userID)
			if err != nil {
				slog.Error("[Privilege] role check failed", "user_id", userID, "error", err)
				respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to verify permissions"})
				return
			}
			if !privilegeAllowedRoles[role] {
				slog.Warn("[Privilege] RBAC denied — insufficient role",
					"user_id", userID, "role", role)
				respondJSON(w, http.StatusForbidden, envelope{Success: false, Error: "Insufficient permissions"})
				return
			}
		}

		deps.State.mu.Lock()
		deps.State.modes[userID] = !deps.State.modes[userID]
		mode := deps.State.modes[userID]
		deps.State.mu.Unlock()

		// STORY-S01 Gap 2: Audit logging on every privilege toggle.
		if deps.AuditLogger != nil {
			action := "privilege_deactivated"
			if mode {
				action = "privilege_activated"
			}
			details := map[string]interface{}{
				"userId":    userID,
				"tenantId":  userID, // tenant = user in single-tenant mode
				"newState":  mode,
				"ipAddress": r.RemoteAddr,
			}
			if err := deps.AuditLogger.LogWithDetails(r.Context(), action, userID, "", "privilege", details); err != nil {
				slog.Error("[Privilege] audit log failed", "user_id", userID, "action", action, "error", err)
				// Don't fail the request on audit error — log and continue
			}
		}

		respondJSON(w, http.StatusOK, envelope{Success: true, Data: map[string]bool{
			"privilegeMode": mode,
		}})
	}
}
