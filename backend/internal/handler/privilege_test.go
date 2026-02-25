package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/connexus-ai/ragbox-backend/internal/middleware"
)

// stubAuditLogger captures audit log calls for testing.
type stubAuditLogger struct {
	calls []map[string]interface{}
}

func (s *stubAuditLogger) LogWithDetails(_ context.Context, action, userID, resourceID, resourceType string, details map[string]interface{}) error {
	s.calls = append(s.calls, map[string]interface{}{
		"action":       action,
		"userID":       userID,
		"resourceID":   resourceID,
		"resourceType": resourceType,
		"details":      details,
	})
	return nil
}

// stubPrivilegeStore simulates DB persistence for testing (STORY-S04).
type stubPrivilegeStore struct {
	modes map[string]bool
}

func (s *stubPrivilegeStore) GetPrivilegeMode(_ context.Context, userID string) (bool, error) {
	return s.modes[userID], nil
}

func (s *stubPrivilegeStore) SetPrivilegeMode(_ context.Context, userID string, enabled bool) error {
	s.modes[userID] = enabled
	return nil
}

func partnerRoleChecker(_ context.Context, _ string) (string, error) {
	return "Partner", nil
}

func associateRoleChecker(_ context.Context, _ string) (string, error) {
	return "Associate", nil
}

func TestGetPrivilege_Default(t *testing.T) {
	state := NewPrivilegeState()
	handler := GetPrivilege(state)

	req := httptest.NewRequest(http.MethodGet, "/api/privilege", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}

	var resp envelope
	json.Unmarshal(rec.Body.Bytes(), &resp)

	data, ok := resp.Data.(map[string]interface{})
	if !ok {
		t.Fatal("expected data to be a map")
	}
	if mode, ok := data["privilegeMode"].(bool); !ok || mode {
		t.Errorf("default privilege mode should be false, got %v", data["privilegeMode"])
	}
}

func TestTogglePrivilege_PartnerAllowed(t *testing.T) {
	state := NewPrivilegeState()
	audit := &stubAuditLogger{}
	deps := PrivilegeDeps{
		State:       state,
		RoleChecker: partnerRoleChecker,
		AuditLogger: audit,
	}
	toggleHandler := TogglePrivilege(deps)
	getHandler := GetPrivilege(state)

	// Toggle ON (Partner role — should succeed)
	req := httptest.NewRequest(http.MethodPost, "/api/privilege", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	rec := httptest.NewRecorder()
	toggleHandler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("toggle status = %d, want 200", rec.Code)
	}

	// Verify it's ON
	req = httptest.NewRequest(http.MethodGet, "/api/privilege", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	rec = httptest.NewRecorder()
	getHandler.ServeHTTP(rec, req)

	var resp envelope
	json.Unmarshal(rec.Body.Bytes(), &resp)
	data := resp.Data.(map[string]interface{})
	if !data["privilegeMode"].(bool) {
		t.Error("privilege should be ON after toggle")
	}

	// Verify audit logged
	if len(audit.calls) != 1 {
		t.Fatalf("expected 1 audit call, got %d", len(audit.calls))
	}
	if audit.calls[0]["action"] != "privilege_activated" {
		t.Errorf("expected action=privilege_activated, got %s", audit.calls[0]["action"])
	}

	// Toggle OFF
	req = httptest.NewRequest(http.MethodPost, "/api/privilege", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	rec = httptest.NewRecorder()
	toggleHandler.ServeHTTP(rec, req)

	if len(audit.calls) != 2 {
		t.Fatalf("expected 2 audit calls, got %d", len(audit.calls))
	}
	if audit.calls[1]["action"] != "privilege_deactivated" {
		t.Errorf("expected action=privilege_deactivated, got %s", audit.calls[1]["action"])
	}
}

func TestTogglePrivilege_AssociateDenied(t *testing.T) {
	state := NewPrivilegeState()
	deps := PrivilegeDeps{
		State:       state,
		RoleChecker: associateRoleChecker,
	}
	toggleHandler := TogglePrivilege(deps)

	req := httptest.NewRequest(http.MethodPost, "/api/privilege", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-associate"))
	rec := httptest.NewRecorder()
	toggleHandler.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403 for Associate role", rec.Code)
	}

	// Verify privilege was NOT toggled
	if state.IsPrivileged("user-associate") {
		t.Error("privilege should remain OFF for denied user")
	}
}

func TestGetPrivilege_Unauthorized(t *testing.T) {
	state := NewPrivilegeState()
	handler := GetPrivilege(state)

	req := httptest.NewRequest(http.MethodGet, "/api/privilege", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rec.Code)
	}
}

func TestTogglePrivilege_Unauthorized(t *testing.T) {
	state := NewPrivilegeState()
	deps := PrivilegeDeps{State: state, RoleChecker: partnerRoleChecker}
	handler := TogglePrivilege(deps)

	req := httptest.NewRequest(http.MethodPost, "/api/privilege", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rec.Code)
	}
}

func TestPrivilege_UserIsolation(t *testing.T) {
	state := NewPrivilegeState()
	deps := PrivilegeDeps{State: state, RoleChecker: partnerRoleChecker}
	toggleHandler := TogglePrivilege(deps)
	getHandler := GetPrivilege(state)

	// Toggle user-1 ON
	req := httptest.NewRequest(http.MethodPost, "/api/privilege", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	rec := httptest.NewRecorder()
	toggleHandler.ServeHTTP(rec, req)

	// Check user-2 is still OFF
	req = httptest.NewRequest(http.MethodGet, "/api/privilege", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-2"))
	rec = httptest.NewRecorder()
	getHandler.ServeHTTP(rec, req)

	var resp envelope
	json.Unmarshal(rec.Body.Bytes(), &resp)
	data := resp.Data.(map[string]interface{})
	if data["privilegeMode"].(bool) {
		t.Error("user-2 privilege should be OFF (isolated from user-1)")
	}
}

func TestIsPrivileged_ServerSideState(t *testing.T) {
	state := NewPrivilegeState()

	// Default is false
	if state.IsPrivileged("user-1") {
		t.Fatal("expected false by default")
	}

	// Toggle via deps (partner)
	deps := PrivilegeDeps{State: state, RoleChecker: partnerRoleChecker}
	toggleHandler := TogglePrivilege(deps)
	req := httptest.NewRequest(http.MethodPost, "/api/privilege", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	rec := httptest.NewRecorder()
	toggleHandler.ServeHTTP(rec, req)

	// IsPrivileged should return true (server-side state for chat handler)
	if !state.IsPrivileged("user-1") {
		t.Fatal("expected true after toggle")
	}
}

// ─── STORY-S04: DB Persistence Tests ────────────────────────────────────

func TestTogglePrivilege_PersistsToStore(t *testing.T) {
	store := &stubPrivilegeStore{modes: make(map[string]bool)}
	state := NewPrivilegeStateWithStore(store)
	deps := PrivilegeDeps{State: state, RoleChecker: partnerRoleChecker}
	toggleHandler := TogglePrivilege(deps)

	// Toggle ON
	req := httptest.NewRequest(http.MethodPost, "/api/privilege", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-db"))
	rec := httptest.NewRecorder()
	toggleHandler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}

	// Verify DB store was updated
	if !store.modes["user-db"] {
		t.Error("expected store to have privilege=true after toggle ON")
	}

	// Toggle OFF
	req = httptest.NewRequest(http.MethodPost, "/api/privilege", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-db"))
	rec = httptest.NewRecorder()
	toggleHandler.ServeHTTP(rec, req)

	if store.modes["user-db"] {
		t.Error("expected store to have privilege=false after toggle OFF")
	}
}

func TestIsPrivileged_ReadsFromStoreOnCacheMiss(t *testing.T) {
	// Pre-populate DB with privilege=true (simulates restart)
	store := &stubPrivilegeStore{modes: map[string]bool{"user-restored": true}}
	state := NewPrivilegeStateWithStore(store)

	// Cache miss → should read from DB and return true
	if !state.IsPrivileged("user-restored") {
		t.Error("expected true from DB on cache miss (simulates restart recovery)")
	}

	// Second call should hit cache
	if !state.IsPrivileged("user-restored") {
		t.Error("expected true from cache on second call")
	}
}

func TestIsPrivileged_DefaultsFalseWhenNoStore(t *testing.T) {
	state := NewPrivilegeState() // no store

	if state.IsPrivileged("unknown-user") {
		t.Error("expected false for unknown user with no store")
	}
}
