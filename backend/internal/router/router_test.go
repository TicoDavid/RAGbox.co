package router

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"firebase.google.com/go/v4/auth"
	"github.com/connexus-ai/ragbox-backend/internal/handler"
	"github.com/connexus-ai/ragbox-backend/internal/model"
	"github.com/connexus-ai/ragbox-backend/internal/repository"
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

// mockDocRepo implements service.DocumentRepository for testing.
type mockDocRepo struct{}

func (m *mockDocRepo) Create(ctx context.Context, doc *model.Document) error                { return nil }
func (m *mockDocRepo) GetByID(ctx context.Context, id string) (*model.Document, error)      { return nil, fmt.Errorf("not found") }
func (m *mockDocRepo) ListByUser(ctx context.Context, userID string, opts service.ListOpts) ([]model.Document, int, error) {
	return []model.Document{}, 0, nil
}
func (m *mockDocRepo) UpdateStatus(ctx context.Context, id string, status model.IndexStatus) error { return nil }
func (m *mockDocRepo) UpdateText(ctx context.Context, id string, text string, pageCount int) error  { return nil }
func (m *mockDocRepo) UpdateChunkCount(ctx context.Context, id string, count int) error             { return nil }
func (m *mockDocRepo) SoftDelete(ctx context.Context, id string) error                              { return nil }
func (m *mockDocRepo) Recover(ctx context.Context, id string) error                                 { return nil }
func (m *mockDocRepo) UpdateTier(ctx context.Context, id string, tier int) error                    { return nil }
func (m *mockDocRepo) TogglePrivilege(ctx context.Context, id string, privileged bool) error        { return nil }
func (m *mockDocRepo) ToggleStar(ctx context.Context, id string, starred bool) error               { return nil }
func (m *mockDocRepo) Update(ctx context.Context, id string, name string) error                    { return nil }
func (m *mockDocRepo) UpdateFolder(ctx context.Context, id string, folderID *string) error         { return nil }

// mockFolderRepo implements service.FolderRepository for testing.
type mockFolderRepo struct{}

func (m *mockFolderRepo) Create(ctx context.Context, folder *model.Folder) error              { return nil }
func (m *mockFolderRepo) ListByUser(ctx context.Context, userID string) ([]model.Folder, error) { return nil, nil }
func (m *mockFolderRepo) GetByID(ctx context.Context, id string) (*model.Folder, error)       { return &model.Folder{ID: id, UserID: "test-user"}, nil }
func (m *mockFolderRepo) Delete(ctx context.Context, id string) error                          { return nil }

// mockAuditLister implements handler.AuditLister for testing.
type mockAuditLister struct{}

func (m *mockAuditLister) List(ctx context.Context, f repository.ListFilter) ([]model.AuditLog, int, error) {
	return nil, 0, nil
}

func newTestRouter(authErr error) http.Handler {
	client := &mockAuthClient{uid: "test-user", err: authErr}
	deps := &Dependencies{
		DB:             &mockDB{},
		AuthService:    service.NewAuthService(client),
		FrontendURL:    "http://localhost:3000",
		Version:        "0.2.0",
		DocRepo:        &mockDocRepo{},
		FolderRepo:     &mockFolderRepo{},
		PrivilegeState: handler.NewPrivilegeState(),
		AuditDeps: handler.AuditDeps{
			Lister: &mockAuditLister{},
		},
		ExportDeps: handler.ExportDeps{
			DocRepo:     &mockDocRepo{},
			AuditLister: &mockAuditLister{},
		},
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
	if body["version"] != "0.2.0" {
		t.Errorf("version = %q, want %q", body["version"], "0.2.0")
	}
}

func TestHealth_DBDown(t *testing.T) {
	client := &mockAuthClient{uid: "test-user"}
	deps := &Dependencies{
		DB:             &mockDB{err: fmt.Errorf("connection refused")},
		AuthService:    service.NewAuthService(client),
		FrontendURL:    "http://localhost:3000",
		DocRepo:        &mockDocRepo{},
		FolderRepo:     &mockFolderRepo{},
		PrivilegeState: handler.NewPrivilegeState(),
		AuditDeps:      handler.AuditDeps{Lister: &mockAuditLister{}},
		ExportDeps:     handler.ExportDeps{DocRepo: &mockDocRepo{}, AuditLister: &mockAuditLister{}},
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

	// Should get 200 (real handler now, returns empty list)
	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusOK)
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

func TestInternalAuth_Bypasses_Firebase(t *testing.T) {
	client := &mockAuthClient{uid: "test-user", err: fmt.Errorf("firebase should not be called")}
	deps := &Dependencies{
		DB:                 &mockDB{},
		AuthService:        service.NewAuthService(client),
		FrontendURL:        "http://localhost:3000",
		InternalAuthSecret: "test-secret-123",
		DocRepo:            &mockDocRepo{},
		FolderRepo:         &mockFolderRepo{},
		PrivilegeState:     handler.NewPrivilegeState(),
		AuditDeps:          handler.AuditDeps{Lister: &mockAuditLister{}},
		ExportDeps:         handler.ExportDeps{DocRepo: &mockDocRepo{}, AuditLister: &mockAuditLister{}},
	}
	r := New(deps)

	req := httptest.NewRequest(http.MethodGet, "/api/documents", nil)
	req.Header.Set("X-Internal-Auth", "test-secret-123")
	req.Header.Set("X-User-ID", "internal-user-42")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusOK)
	}
}

func TestInternalAuth_BadSecret_Returns401(t *testing.T) {
	client := &mockAuthClient{uid: "test-user", err: fmt.Errorf("firebase should not be called")}
	deps := &Dependencies{
		DB:                 &mockDB{},
		AuthService:        service.NewAuthService(client),
		FrontendURL:        "http://localhost:3000",
		InternalAuthSecret: "correct-secret",
		DocRepo:            &mockDocRepo{},
		FolderRepo:         &mockFolderRepo{},
		PrivilegeState:     handler.NewPrivilegeState(),
		AuditDeps:          handler.AuditDeps{Lister: &mockAuditLister{}},
		ExportDeps:         handler.ExportDeps{DocRepo: &mockDocRepo{}, AuditLister: &mockAuditLister{}},
	}
	r := New(deps)

	req := httptest.NewRequest(http.MethodGet, "/api/documents", nil)
	req.Header.Set("X-Internal-Auth", "wrong-secret")
	req.Header.Set("X-User-ID", "internal-user-42")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
}
