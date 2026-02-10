package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"

	"github.com/connexus-ai/ragbox-backend/internal/middleware"
	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// stubFolderRepo implements service.FolderRepository for testing.
type stubFolderRepo struct {
	folders   []model.Folder
	created   *model.Folder
	createErr error
	listErr   error
	deleteErr error
}

func (s *stubFolderRepo) Create(ctx context.Context, folder *model.Folder) error {
	if s.createErr != nil {
		return s.createErr
	}
	s.created = folder
	return nil
}

func (s *stubFolderRepo) ListByUser(ctx context.Context, userID string) ([]model.Folder, error) {
	if s.listErr != nil {
		return nil, s.listErr
	}
	return s.folders, nil
}

func (s *stubFolderRepo) Delete(ctx context.Context, id string) error {
	return s.deleteErr
}

func TestListFolders_Success(t *testing.T) {
	repo := &stubFolderRepo{folders: []model.Folder{
		{ID: "f1", Name: "Contracts", UserID: "user-1"},
	}}
	deps := FolderDeps{FolderRepo: repo}
	handler := ListFolders(deps)

	req := httptest.NewRequest(http.MethodGet, "/api/documents/folders", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
}

func TestListFolders_Unauthorized(t *testing.T) {
	deps := FolderDeps{}
	handler := ListFolders(deps)

	req := httptest.NewRequest(http.MethodGet, "/api/documents/folders", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rec.Code)
	}
}

func TestCreateFolder_Success(t *testing.T) {
	repo := &stubFolderRepo{}
	deps := FolderDeps{FolderRepo: repo}
	handler := CreateFolder(deps)

	body, _ := json.Marshal(CreateFolderRequest{Name: "New Folder"})
	req := httptest.NewRequest(http.MethodPost, "/api/documents/folders", bytes.NewReader(body))
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201", rec.Code)
	}

	if repo.created == nil {
		t.Fatal("folder should be created")
	}
	if repo.created.Name != "New Folder" {
		t.Errorf("Name = %q, want %q", repo.created.Name, "New Folder")
	}
}

func TestCreateFolder_MissingName(t *testing.T) {
	repo := &stubFolderRepo{}
	deps := FolderDeps{FolderRepo: repo}
	handler := CreateFolder(deps)

	body, _ := json.Marshal(CreateFolderRequest{Name: ""})
	req := httptest.NewRequest(http.MethodPost, "/api/documents/folders", bytes.NewReader(body))
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
}

func TestCreateFolder_RepoError(t *testing.T) {
	repo := &stubFolderRepo{createErr: fmt.Errorf("duplicate name")}
	deps := FolderDeps{FolderRepo: repo}
	handler := CreateFolder(deps)

	body, _ := json.Marshal(CreateFolderRequest{Name: "Test"})
	req := httptest.NewRequest(http.MethodPost, "/api/documents/folders", bytes.NewReader(body))
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500", rec.Code)
	}
}

func withFolderChiParam(r *http.Request, key, value string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add(key, value)
	return r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, rctx))
}

func TestDeleteFolder_Success(t *testing.T) {
	repo := &stubFolderRepo{}
	deps := FolderDeps{FolderRepo: repo}
	handler := DeleteFolder(deps)

	req := httptest.NewRequest(http.MethodDelete, "/api/documents/folders/f1", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	req = withFolderChiParam(req, "id", "f1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
}

func TestDeleteFolder_Unauthorized(t *testing.T) {
	deps := FolderDeps{}
	handler := DeleteFolder(deps)

	req := httptest.NewRequest(http.MethodDelete, "/api/documents/folders/f1", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rec.Code)
	}
}

func TestDeleteFolder_RepoError(t *testing.T) {
	repo := &stubFolderRepo{deleteErr: fmt.Errorf("foreign key constraint")}
	deps := FolderDeps{FolderRepo: repo}
	handler := DeleteFolder(deps)

	req := httptest.NewRequest(http.MethodDelete, "/api/documents/folders/f1", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	req = withFolderChiParam(req, "id", "f1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500", rec.Code)
	}
}

func TestCreateFolder_Unauthorized(t *testing.T) {
	deps := FolderDeps{}
	handler := CreateFolder(deps)

	req := httptest.NewRequest(http.MethodPost, "/api/documents/folders", bytes.NewBufferString(`{"name":"Test"}`))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rec.Code)
	}
}

func TestCreateFolder_InvalidBody(t *testing.T) {
	repo := &stubFolderRepo{}
	deps := FolderDeps{FolderRepo: repo}
	handler := CreateFolder(deps)

	req := httptest.NewRequest(http.MethodPost, "/api/documents/folders", bytes.NewBufferString("{bad"))
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
}

func TestListFolders_RepoError(t *testing.T) {
	repo := &stubFolderRepo{listErr: fmt.Errorf("db error")}
	deps := FolderDeps{FolderRepo: repo}
	handler := ListFolders(deps)

	req := httptest.NewRequest(http.MethodGet, "/api/documents/folders", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500", rec.Code)
	}
}
