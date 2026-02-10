package router

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"firebase.google.com/go/v4/auth"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// mockDB implements handler.DBPinger for testing.
type mockDB struct {
	err error
}

func (m *mockDB) Ping(ctx context.Context) error {
	return m.err
}

// mockAuthClient implements service.AuthClient for testing.
type mockAuthClient struct {
	uid string
	err error
}

func (m *mockAuthClient) VerifyIDToken(ctx context.Context, idToken string) (*auth.Token, error) {
	if m.err != nil {
		return nil, m.err
	}
	return &auth.Token{UID: m.uid}, nil
}

func newTestRouter(authErr error) http.Handler {
	client := &mockAuthClient{uid: "test-user", err: authErr}
	deps := &Dependencies{
		DB:          &mockDB{},
		AuthService: service.NewAuthService(client),
		FrontendURL: "http://localhost:3000",
	}
	return New(deps)
}

func TestHealth_IsPublic(t *testing.T) {
	r := newTestRouter(nil)

	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusOK)
	}

	var body map[string]string
	json.Unmarshal(rec.Body.Bytes(), &body)
	if body["status"] != "ok" {
		t.Errorf("status = %q, want %q", body["status"], "ok")
	}
	if body["version"] != "1.0.0" {
		t.Errorf("version = %q, want %q", body["version"], "1.0.0")
	}
}

func TestHealth_DBDown(t *testing.T) {
	client := &mockAuthClient{uid: "test-user"}
	deps := &Dependencies{
		DB:          &mockDB{err: fmt.Errorf("connection refused")},
		AuthService: service.NewAuthService(client),
		FrontendURL: "http://localhost:3000",
	}
	r := New(deps)

	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
	}

	var body map[string]string
	json.Unmarshal(rec.Body.Bytes(), &body)
	if body["database"] != "disconnected" {
		t.Errorf("database = %q, want %q", body["database"], "disconnected")
	}
}

func TestDocuments_RequiresAuth(t *testing.T) {
	r := newTestRouter(fmt.Errorf("invalid token"))

	req := httptest.NewRequest(http.MethodGet, "/api/documents", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestDocuments_WithAuth(t *testing.T) {
	r := newTestRouter(nil)

	req := httptest.NewRequest(http.MethodGet, "/api/documents", nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	// Should get 501 (placeholder) not 401
	if rec.Code != http.StatusNotImplemented {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusNotImplemented)
	}
}

func TestChat_RequiresAuth(t *testing.T) {
	r := newTestRouter(fmt.Errorf("invalid token"))

	req := httptest.NewRequest(http.MethodPost, "/api/chat", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestUnknownRoute_Returns404(t *testing.T) {
	r := newTestRouter(nil)

	req := httptest.NewRequest(http.MethodGet, "/api/nonexistent", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusNotFound)
	}

	var body map[string]interface{}
	json.Unmarshal(rec.Body.Bytes(), &body)
	if body["success"] != false {
		t.Error("expected success=false for 404")
	}
}

func TestAudit_RequiresAuth(t *testing.T) {
	r := newTestRouter(fmt.Errorf("invalid token"))

	req := httptest.NewRequest(http.MethodGet, "/api/audit", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestPrivilege_RequiresAuth(t *testing.T) {
	r := newTestRouter(fmt.Errorf("invalid token"))

	req := httptest.NewRequest(http.MethodGet, "/api/privilege", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
}
