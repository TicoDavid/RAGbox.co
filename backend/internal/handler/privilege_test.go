package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/connexus-ai/ragbox-backend/internal/middleware"
)

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

func TestTogglePrivilege(t *testing.T) {
	state := NewPrivilegeState()
	toggleHandler := TogglePrivilege(state)
	getHandler := GetPrivilege(state)

	// Toggle ON
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

	// Toggle OFF
	req = httptest.NewRequest(http.MethodPost, "/api/privilege", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	rec = httptest.NewRecorder()
	toggleHandler.ServeHTTP(rec, req)

	req = httptest.NewRequest(http.MethodGet, "/api/privilege", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	rec = httptest.NewRecorder()
	getHandler.ServeHTTP(rec, req)

	json.Unmarshal(rec.Body.Bytes(), &resp)
	data = resp.Data.(map[string]interface{})
	if data["privilegeMode"].(bool) {
		t.Error("privilege should be OFF after second toggle")
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
	handler := TogglePrivilege(state)

	req := httptest.NewRequest(http.MethodPost, "/api/privilege", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rec.Code)
	}
}

func TestPrivilege_UserIsolation(t *testing.T) {
	state := NewPrivilegeState()
	toggleHandler := TogglePrivilege(state)
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
