package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/connexus-ai/ragbox-backend/internal/middleware"
	"github.com/connexus-ai/ragbox-backend/internal/model"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// mockRelatedSearcher implements service.RelatedDocSearcher for testing.
type mockRelatedSearcher struct {
	results []service.RelatedDocument
	err     error
}

func (m *mockRelatedSearcher) FindRelatedDocuments(ctx context.Context, documentID, userID string, limit int) ([]service.RelatedDocument, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.results, nil
}

func relatedDeps(doc *model.Document, getErr error, results []service.RelatedDocument, searchErr error) RelatedDocsDeps {
	return RelatedDocsDeps{
		DocRepo: &crudDocRepo{
			singleDoc: doc,
			getErr:    getErr,
		},
		Searcher: &mockRelatedSearcher{
			results: results,
			err:     searchErr,
		},
	}
}

func TestRelatedDocuments_Success(t *testing.T) {
	sourceDoc := &model.Document{ID: "10000000-0000-0000-0000-000000000001", UserID: "user-1"}
	related := []service.RelatedDocument{
		{
			Document:   model.Document{ID: "20000000-0000-0000-0000-000000000002", UserID: "user-1", OriginalName: "contract.pdf", CreatedAt: time.Now().UTC()},
			Similarity: 0.85,
		},
		{
			Document:   model.Document{ID: "30000000-0000-0000-0000-000000000003", UserID: "user-1", OriginalName: "amendment.docx", CreatedAt: time.Now().UTC()},
			Similarity: 0.72,
		},
	}

	deps := relatedDeps(sourceDoc, nil, related, nil)
	h := RelatedDocuments(deps)

	req := httptest.NewRequest(http.MethodGet, "/api/documents/10000000-0000-0000-0000-000000000001/related", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	req = withChiParam(req, "id", "10000000-0000-0000-0000-000000000001")

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200. body: %s", rec.Code, rec.Body.String())
	}

	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			Related []service.RelatedDocument `json:"related"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if !resp.Success {
		t.Error("expected success=true")
	}
	if len(resp.Data.Related) != 2 {
		t.Errorf("related count = %d, want 2", len(resp.Data.Related))
	}
	if resp.Data.Related[0].Similarity != 0.85 {
		t.Errorf("first similarity = %f, want 0.85", resp.Data.Related[0].Similarity)
	}
}

func TestRelatedDocuments_EmptyResults(t *testing.T) {
	sourceDoc := &model.Document{ID: "10000000-0000-0000-0000-000000000001", UserID: "user-1"}
	deps := relatedDeps(sourceDoc, nil, nil, nil)
	h := RelatedDocuments(deps)

	req := httptest.NewRequest(http.MethodGet, "/api/documents/10000000-0000-0000-0000-000000000001/related", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	req = withChiParam(req, "id", "10000000-0000-0000-0000-000000000001")

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}

	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			Related []service.RelatedDocument `json:"related"`
		} `json:"data"`
	}
	json.Unmarshal(rec.Body.Bytes(), &resp)

	if !resp.Success {
		t.Error("expected success=true")
	}
	if resp.Data.Related == nil {
		t.Error("expected empty array, not null")
	}
	if len(resp.Data.Related) != 0 {
		t.Errorf("related count = %d, want 0", len(resp.Data.Related))
	}
}

func TestRelatedDocuments_Unauthorized(t *testing.T) {
	deps := RelatedDocsDeps{}
	h := RelatedDocuments(deps)

	req := httptest.NewRequest(http.MethodGet, "/api/documents/d1/related", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rec.Code)
	}
}

func TestRelatedDocuments_InvalidID(t *testing.T) {
	deps := RelatedDocsDeps{}
	h := RelatedDocuments(deps)

	req := httptest.NewRequest(http.MethodGet, "/api/documents/not-a-uuid/related", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	req = withChiParam(req, "id", "not-a-uuid")

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
}

func TestRelatedDocuments_NotFound(t *testing.T) {
	deps := relatedDeps(nil, fmt.Errorf("not found"), nil, nil)
	h := RelatedDocuments(deps)

	req := httptest.NewRequest(http.MethodGet, "/api/documents/20000000-0000-0000-0000-000000000002/related", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	req = withChiParam(req, "id", "20000000-0000-0000-0000-000000000002")

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestRelatedDocuments_ForbiddenOtherUser(t *testing.T) {
	sourceDoc := &model.Document{ID: "10000000-0000-0000-0000-000000000001", UserID: "other-user"}
	deps := relatedDeps(sourceDoc, nil, nil, nil)
	h := RelatedDocuments(deps)

	req := httptest.NewRequest(http.MethodGet, "/api/documents/10000000-0000-0000-0000-000000000001/related", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	req = withChiParam(req, "id", "10000000-0000-0000-0000-000000000001")

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404 (forbidden treated as not found)", rec.Code)
	}
}

func TestRelatedDocuments_SearchError(t *testing.T) {
	sourceDoc := &model.Document{ID: "10000000-0000-0000-0000-000000000001", UserID: "user-1"}
	deps := relatedDeps(sourceDoc, nil, nil, fmt.Errorf("db error"))
	h := RelatedDocuments(deps)

	req := httptest.NewRequest(http.MethodGet, "/api/documents/10000000-0000-0000-0000-000000000001/related", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	req = withChiParam(req, "id", "10000000-0000-0000-0000-000000000001")

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500", rec.Code)
	}
}

func TestRelatedDocuments_CustomLimit(t *testing.T) {
	sourceDoc := &model.Document{ID: "10000000-0000-0000-0000-000000000001", UserID: "user-1"}
	searcher := &mockRelatedSearcher{results: []service.RelatedDocument{}}
	deps := RelatedDocsDeps{
		DocRepo:  &crudDocRepo{singleDoc: sourceDoc},
		Searcher: searcher,
	}
	h := RelatedDocuments(deps)

	req := httptest.NewRequest(http.MethodGet, "/api/documents/10000000-0000-0000-0000-000000000001/related?limit=3", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	req = withChiParam(req, "id", "10000000-0000-0000-0000-000000000001")

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
}
