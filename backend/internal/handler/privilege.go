package handler

import (
	"context"
	"log/slog"
	"net/http"
	"sync"

	"github.com/connexus-ai/ragbox-backend/internal/middleware"
	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// PrivilegeStore abstracts DB read/write for privilege mode (STORY-S04).
type PrivilegeStore interface {
	GetPrivilegeMode(ctx context.Context, userID string) (bool, error)
	SetPrivilegeMode(ctx context.Context, userID string, enabled bool) error
}

// PrivilegeState tracks privilege mode per user.
// In-memory map is a read cache — DB is the source of truth (STORY-S04).
type PrivilegeState struct {
	mu    sync.RWMutex
	modes map[string]bool // userID → privilegeMode (cache)
	store PrivilegeStore  // nil = in-memory only (tests)
}

// NewPrivilegeState creates a PrivilegeState (in-memory only, for tests).
func NewPrivilegeState() *PrivilegeState {
	return &PrivilegeState{modes: make(map[string]bool)}
}

// NewPrivilegeStateWithStore creates a DB-backed PrivilegeState (STORY-S04).
func NewPrivilegeStateWithStore(store PrivilegeStore) *PrivilegeState {
	return &PrivilegeState{modes: make(map[string]bool), store: store}
}

// IsPrivileged returns the privilege state for a user (thread-safe).
// Reads from cache first; on cache miss, reads from DB and populates cache.
// Used by the chat handler to derive privilege from server state (STORY-S01 Gap 3).
func (ps *PrivilegeState) IsPrivileged(userID string) bool {
	ps.mu.RLock()
	mode, cached := ps.modes[userID]
	ps.mu.RUnlock()
	if cached {
		return mode
	}

	// Cache miss — read from DB (STORY-S04)
	if ps.store != nil {
		dbMode, err := ps.store.GetPrivilegeMode(context.Background(), userID)
		if err != nil {
			slog.Error("[Privilege] DB read failed, defaulting to false", "user_id", userID, "error", err)
			return false
		}
		ps.mu.Lock()
		ps.modes[userID] = dbMode
		ps.mu.Unlock()
		return dbMode
	}

	return false
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

		mode := state.IsPrivileged(userID)

		respondJSON(w, http.StatusOK, envelope{Success: true, Data: map[string]bool{
			"privilegeMode": mode,
		}})
	}
}

// TogglePrivilege handles POST /api/privilege.
// STORY-S01: RBAC enforced (Partner/admin only) + audit logging on every toggle.
// STORY-S04: Persists state to DB, updates in-memory cache.
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

		// Read current state, toggle, and persist
		currentMode := deps.State.IsPrivileged(userID)
		newMode := !currentMode

		// STORY-S04: Write to DB first (source of truth)
		if deps.State.store != nil {
			if err := deps.State.store.SetPrivilegeMode(r.Context(), userID, newMode); err != nil {
				slog.Error("[Privilege] DB write failed", "user_id", userID, "error", err)
				respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to persist privilege state"})
				return
			}
		}

		// Update cache
		deps.State.mu.Lock()
		deps.State.modes[userID] = newMode
		deps.State.mu.Unlock()

		// STORY-S01 Gap 2: Audit logging on every privilege toggle.
		if deps.AuditLogger != nil {
			action := "privilege_deactivated"
			if newMode {
				action = "privilege_activated"
			}
			details := map[string]interface{}{
				"userId":    userID,
				"tenantId":  userID, // tenant = user in single-tenant mode
				"newState":  newMode,
				"ipAddress": r.RemoteAddr,
			}
			if err := deps.AuditLogger.LogWithDetails(r.Context(), action, userID, "", "privilege", details); err != nil {
				slog.Error("[Privilege] audit log failed", "user_id", userID, "action", action, "error", err)
				// Don't fail the request on audit error — log and continue
			}
		}

		respondJSON(w, http.StatusOK, envelope{Success: true, Data: map[string]bool{
			"privilegeMode": newMode,
		}})
	}
}
