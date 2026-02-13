package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/connexus-ai/ragbox-backend/internal/middleware"
	"github.com/connexus-ai/ragbox-backend/internal/model"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// withChiParam adds chi URL params to the request context.
func withChiParam(r *http.Request, key, value string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add(key, value)
	return r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, rctx))
}

// mockStorage implements service.StorageClient
type mockStorage struct {
	url string
	err error
}

func (m *mockStorage) SignedURL(bucket, object string, opts *service.SignedURLOptions) (string, error) {
	if m.err != nil {
		return "", m.err
	}
	return m.url, nil
}

// mockDocRepo implements service.DocumentRepository
type mockDocRepo struct {
	created *model.Document
}

func (m *mockDocRepo) Create(ctx context.Context, doc *model.Document) error {
	m.created = doc
	return nil
}

func (m *mockDocRepo) GetByID(ctx context.Context, id string) (*model.Document, error) {
	return nil, fmt.Errorf("not found")
}

func (m *mockDocRepo) ListByUser(ctx context.Context, userID string, opts service.ListOpts) ([]model.Document, int, error) {
	return nil, 0, nil
}

func (m *mockDocRepo) UpdateStatus(ctx context.Context, id string, status model.IndexStatus) error {
	return nil
}

func (m *mockDocRepo) UpdateText(ctx context.Context, id string, text string, pageCount int) error {
	return nil
}

func (m *mockDocRepo) UpdateChunkCount(ctx context.Context, id string, count int) error {
	return nil
}

func (m *mockDocRepo) SoftDelete(ctx context.Context, id string) error    { return nil }
func (m *mockDocRepo) Recover(ctx context.Context, id string) error      { return nil }
func (m *mockDocRepo) UpdateTier(ctx context.Context, id string, tier int) error { return nil }
func (m *mockDocRepo) TogglePrivilege(ctx context.Context, id string, privileged bool) error {
	return nil
}
func (m *mockDocRepo) ToggleStar(ctx context.Context, id string, starred bool) error {
	return nil
}
func (m *mockDocRepo) Update(ctx context.Context, id string, name string) error { return nil }
func (m *mockDocRepo) UpdateFolder(ctx context.Context, id string, folderID *string) error {
	return nil
}

func TestUploadDocument_Success(t *testing.T) {
	storage := &mockStorage{url: "https://storage.googleapis.com/signed"}
	repo := &mockDocRepo{}
	docSvc := service.NewDocumentService(storage, repo, "bucket", 15*time.Minute)
	handler := UploadDocument(docSvc)

	body := `{"filename":"report.pdf","contentType":"application/pdf","sizeBytes":1048576}`
	req := httptest.NewRequest(http.MethodPost, "/api/documents/extract", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-123"))

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want %d. body: %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			URL        string `json:"url"`
			DocumentID string `json:"documentId"`
			ObjectName string `json:"objectName"`
		} `json:"data"`
	}
	json.Unmarshal(rec.Body.Bytes(), &resp)

	if !resp.Success {
		t.Error("expected success=true")
	}
	if resp.Data.URL == "" {
		t.Error("expected non-empty URL")
	}
	if resp.Data.DocumentID == "" {
		t.Error("expected non-empty DocumentID")
	}
}

func TestUploadDocument_MissingFields(t *testing.T) {
	storage := &mockStorage{url: "https://example.com"}
	repo := &mockDocRepo{}
	docSvc := service.NewDocumentService(storage, repo, "bucket", 15*time.Minute)
	handler := UploadDocument(docSvc)

	body := `{"filename":"report.pdf"}`
	req := httptest.NewRequest(http.MethodPost, "/api/documents/extract", bytes.NewBufferString(body))
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-123"))

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestUploadDocument_InvalidJSON(t *testing.T) {
	storage := &mockStorage{url: "https://example.com"}
	repo := &mockDocRepo{}
	docSvc := service.NewDocumentService(storage, repo, "bucket", 15*time.Minute)
	handler := UploadDocument(docSvc)

	req := httptest.NewRequest(http.MethodPost, "/api/documents/extract", bytes.NewBufferString("{bad json"))
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-123"))

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestUploadDocument_NoAuth(t *testing.T) {
	storage := &mockStorage{url: "https://example.com"}
	repo := &mockDocRepo{}
	docSvc := service.NewDocumentService(storage, repo, "bucket", 15*time.Minute)
	handler := UploadDocument(docSvc)

	body := `{"filename":"report.pdf","contentType":"application/pdf","sizeBytes":1024}`
	req := httptest.NewRequest(http.MethodPost, "/api/documents/extract", bytes.NewBufferString(body))
	// No user context

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestUploadDocument_UnsupportedType(t *testing.T) {
	storage := &mockStorage{url: "https://example.com"}
	repo := &mockDocRepo{}
	docSvc := service.NewDocumentService(storage, repo, "bucket", 15*time.Minute)
	handler := UploadDocument(docSvc)

	body := `{"filename":"virus.exe","contentType":"application/x-msdownload","sizeBytes":1024}`
	req := httptest.NewRequest(http.MethodPost, "/api/documents/extract", bytes.NewBufferString(body))
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-123"))

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

// --- CRUD handler tests ---

// crudDocRepo extends mockDocRepo with more realistic behavior for CRUD tests.
type crudDocRepo struct {
	docs      []model.Document
	total     int
	singleDoc *model.Document
	getErr    error
	listErr   error
	deleteErr error
	updateErr error
}

func (m *crudDocRepo) Create(ctx context.Context, doc *model.Document) error { return nil }
func (m *crudDocRepo) GetByID(ctx context.Context, id string) (*model.Document, error) {
	if m.getErr != nil {
		return nil, m.getErr
	}
	return m.singleDoc, nil
}
func (m *crudDocRepo) ListByUser(ctx context.Context, userID string, opts service.ListOpts) ([]model.Document, int, error) {
	if m.listErr != nil {
		return nil, 0, m.listErr
	}
	return m.docs, m.total, nil
}
func (m *crudDocRepo) UpdateStatus(ctx context.Context, id string, status model.IndexStatus) error {
	return nil
}
func (m *crudDocRepo) UpdateText(ctx context.Context, id string, text string, pageCount int) error {
	return nil
}
func (m *crudDocRepo) UpdateChunkCount(ctx context.Context, id string, count int) error { return nil }
func (m *crudDocRepo) SoftDelete(ctx context.Context, id string) error {
	return m.deleteErr
}
func (m *crudDocRepo) Recover(ctx context.Context, id string) error      { return nil }
func (m *crudDocRepo) UpdateTier(ctx context.Context, id string, tier int) error { return nil }
func (m *crudDocRepo) TogglePrivilege(ctx context.Context, id string, privileged bool) error {
	return nil
}
func (m *crudDocRepo) ToggleStar(ctx context.Context, id string, starred bool) error {
	return nil
}
func (m *crudDocRepo) Update(ctx context.Context, id string, name string) error {
	return m.updateErr
}
func (m *crudDocRepo) UpdateFolder(ctx context.Context, id string, folderID *string) error {
	return nil
}

func TestListDocuments_Success(t *testing.T) {
	repo := &crudDocRepo{
		docs:  []model.Document{{ID: "d1", UserID: "user-1", Filename: "test.pdf"}},
		total: 1,
	}
	deps := DocCRUDDeps{DocRepo: repo}
	handler := ListDocuments(deps)

	req := httptest.NewRequest(http.MethodGet, "/api/documents?limit=10", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}

	var resp envelope
	json.Unmarshal(rec.Body.Bytes(), &resp)
	if !resp.Success {
		t.Error("expected success=true")
	}
}

func TestListDocuments_Unauthorized(t *testing.T) {
	deps := DocCRUDDeps{}
	handler := ListDocuments(deps)

	req := httptest.NewRequest(http.MethodGet, "/api/documents", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rec.Code)
	}
}

func TestGetDocument_NotFound(t *testing.T) {
	repo := &crudDocRepo{getErr: fmt.Errorf("not found")}
	deps := DocCRUDDeps{DocRepo: repo}
	handler := GetDocument(deps)

	req := httptest.NewRequest(http.MethodGet, "/api/documents/20000000-0000-0000-0000-000000000002", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	req = withChiParam(req, "id", "20000000-0000-0000-0000-000000000002")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestDeleteDocument_Success(t *testing.T) {
	repo := &crudDocRepo{singleDoc: &model.Document{ID: "10000000-0000-0000-0000-000000000001", UserID: "user-1"}}
	deps := DocCRUDDeps{DocRepo: repo}
	handler := DeleteDocument(deps)

	req := httptest.NewRequest(http.MethodDelete, "/api/documents/10000000-0000-0000-0000-000000000001", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	req = withChiParam(req, "id", "10000000-0000-0000-0000-000000000001")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
}

func TestGetDocument_Success(t *testing.T) {
	repo := &crudDocRepo{singleDoc: &model.Document{ID: "10000000-0000-0000-0000-000000000001", UserID: "user-1", Filename: "test.pdf"}}
	deps := DocCRUDDeps{DocRepo: repo}
	handler := GetDocument(deps)

	req := httptest.NewRequest(http.MethodGet, "/api/documents/10000000-0000-0000-0000-000000000001", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	req = withChiParam(req, "id", "10000000-0000-0000-0000-000000000001")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
}

func TestGetDocument_Forbidden(t *testing.T) {
	repo := &crudDocRepo{singleDoc: &model.Document{ID: "10000000-0000-0000-0000-000000000001", UserID: "other-user"}}
	deps := DocCRUDDeps{DocRepo: repo}
	handler := GetDocument(deps)

	req := httptest.NewRequest(http.MethodGet, "/api/documents/10000000-0000-0000-0000-000000000001", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	req = withChiParam(req, "id", "10000000-0000-0000-0000-000000000001")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Errorf("status = %d, want 403", rec.Code)
	}
}

func TestRecoverDocument_Success(t *testing.T) {
	repo := &crudDocRepo{singleDoc: &model.Document{ID: "10000000-0000-0000-0000-000000000001", UserID: "user-1"}}
	deps := DocCRUDDeps{DocRepo: repo}
	handler := RecoverDocument(deps)

	req := httptest.NewRequest(http.MethodPost, "/api/documents/10000000-0000-0000-0000-000000000001/recover", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	req = withChiParam(req, "id", "10000000-0000-0000-0000-000000000001")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
}

func TestRecoverDocument_Unauthorized(t *testing.T) {
	deps := DocCRUDDeps{}
	handler := RecoverDocument(deps)

	req := httptest.NewRequest(http.MethodPost, "/api/documents/d1/recover", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rec.Code)
	}
}

func TestUpdateDocumentTier_Success(t *testing.T) {
	repo := &crudDocRepo{singleDoc: &model.Document{ID: "10000000-0000-0000-0000-000000000001", UserID: "user-1"}}
	deps := DocCRUDDeps{DocRepo: repo}
	handler := UpdateDocumentTier(deps)

	body, _ := json.Marshal(UpdateTierRequest{Tier: 2})
	req := httptest.NewRequest(http.MethodPatch, "/api/documents/10000000-0000-0000-0000-000000000001/tier", bytes.NewReader(body))
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	req = withChiParam(req, "id", "10000000-0000-0000-0000-000000000001")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
}

func TestUpdateDocumentTier_Unauthorized(t *testing.T) {
	deps := DocCRUDDeps{}
	handler := UpdateDocumentTier(deps)

	req := httptest.NewRequest(http.MethodPatch, "/api/documents/d1/tier", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rec.Code)
	}
}

func TestToggleDocPrivilege_Success(t *testing.T) {
	repo := &crudDocRepo{singleDoc: &model.Document{ID: "10000000-0000-0000-0000-000000000001", UserID: "user-1"}}
	deps := DocCRUDDeps{DocRepo: repo}
	handler := ToggleDocPrivilege(deps)

	body, _ := json.Marshal(ToggleDocPrivilegeRequest{Privileged: true})
	req := httptest.NewRequest(http.MethodPatch, "/api/documents/10000000-0000-0000-0000-000000000001/privilege", bytes.NewReader(body))
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	req = withChiParam(req, "id", "10000000-0000-0000-0000-000000000001")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
}

func TestToggleDocPrivilege_Unauthorized(t *testing.T) {
	deps := DocCRUDDeps{}
	handler := ToggleDocPrivilege(deps)

	req := httptest.NewRequest(http.MethodPatch, "/api/documents/d1/privilege", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rec.Code)
	}
}

func TestDeleteDocument_Unauthorized(t *testing.T) {
	deps := DocCRUDDeps{}
	handler := DeleteDocument(deps)

	req := httptest.NewRequest(http.MethodDelete, "/api/documents/d1", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rec.Code)
	}
}

func TestDeleteDocument_NotFound(t *testing.T) {
	repo := &crudDocRepo{getErr: fmt.Errorf("not found")}
	deps := DocCRUDDeps{DocRepo: repo}
	handler := DeleteDocument(deps)

	req := httptest.NewRequest(http.MethodDelete, "/api/documents/20000000-0000-0000-0000-000000000002", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	req = withChiParam(req, "id", "20000000-0000-0000-0000-000000000002")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestDeleteDocument_RepoError(t *testing.T) {
	repo := &crudDocRepo{
		singleDoc: &model.Document{ID: "10000000-0000-0000-0000-000000000001", UserID: "user-1"},
		deleteErr: fmt.Errorf("db error"),
	}
	deps := DocCRUDDeps{DocRepo: repo}
	handler := DeleteDocument(deps)

	req := httptest.NewRequest(http.MethodDelete, "/api/documents/10000000-0000-0000-0000-000000000001", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	req = withChiParam(req, "id", "10000000-0000-0000-0000-000000000001")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500", rec.Code)
	}
}

func TestGetDocument_Unauthorized(t *testing.T) {
	deps := DocCRUDDeps{}
	handler := GetDocument(deps)

	req := httptest.NewRequest(http.MethodGet, "/api/documents/d1", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rec.Code)
	}
}

func TestListDocuments_RepoError(t *testing.T) {
	repo := &crudDocRepo{listErr: fmt.Errorf("db error")}
	deps := DocCRUDDeps{DocRepo: repo}
	handler := ListDocuments(deps)

	req := httptest.NewRequest(http.MethodGet, "/api/documents", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500", rec.Code)
	}
}

func TestRecoverDocument_NotFound(t *testing.T) {
	repo := &crudDocRepo{getErr: fmt.Errorf("not found")}
	deps := DocCRUDDeps{DocRepo: repo}
	handler := RecoverDocument(deps)

	req := httptest.NewRequest(http.MethodPost, "/api/documents/20000000-0000-0000-0000-000000000002/recover", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	req = withChiParam(req, "id", "20000000-0000-0000-0000-000000000002")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestUpdateDocumentTier_NotFound(t *testing.T) {
	repo := &crudDocRepo{getErr: fmt.Errorf("not found")}
	deps := DocCRUDDeps{DocRepo: repo}
	handler := UpdateDocumentTier(deps)

	body, _ := json.Marshal(UpdateTierRequest{Tier: 1})
	req := httptest.NewRequest(http.MethodPatch, "/api/documents/20000000-0000-0000-0000-000000000002/tier", bytes.NewReader(body))
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	req = withChiParam(req, "id", "20000000-0000-0000-0000-000000000002")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestToggleDocPrivilege_NotFound(t *testing.T) {
	repo := &crudDocRepo{getErr: fmt.Errorf("not found")}
	deps := DocCRUDDeps{DocRepo: repo}
	handler := ToggleDocPrivilege(deps)

	body, _ := json.Marshal(ToggleDocPrivilegeRequest{Privileged: true})
	req := httptest.NewRequest(http.MethodPatch, "/api/documents/20000000-0000-0000-0000-000000000002/privilege", bytes.NewReader(body))
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	req = withChiParam(req, "id", "20000000-0000-0000-0000-000000000002")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}
