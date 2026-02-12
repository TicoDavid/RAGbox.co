package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/connexus-ai/ragbox-backend/internal/middleware"
	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// mockIngester implements Ingester for testing.
type mockIngester struct {
	called bool
	docID  string
	err    error
}

func (m *mockIngester) ProcessDocument(ctx context.Context, docID string) error {
	m.called = true
	m.docID = docID
	return m.err
}

func TestIngestDocument_Success(t *testing.T) {
	repo := &crudDocRepo{
		singleDoc: &model.Document{
			ID:          "doc-1",
			UserID:      "user-1",
			IndexStatus: model.IndexPending,
		},
	}
	pipeline := &mockIngester{}
	deps := IngestDeps{DocRepo: repo, Pipeline: pipeline}
	h := IngestDocument(deps)

	req := httptest.NewRequest(http.MethodPost, "/api/documents/doc-1/ingest", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	req = withChiParam(req, "id", "doc-1")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusAccepted {
		t.Errorf("status = %d, want %d. body: %s", rec.Code, http.StatusAccepted, rec.Body.String())
	}

	var resp envelope
	json.Unmarshal(rec.Body.Bytes(), &resp)
	if !resp.Success {
		t.Error("expected success=true")
	}
}

func TestIngestDocument_Unauthorized(t *testing.T) {
	deps := IngestDeps{}
	h := IngestDocument(deps)

	req := httptest.NewRequest(http.MethodPost, "/api/documents/doc-1/ingest", nil)
	// No user context
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestIngestDocument_NotFound(t *testing.T) {
	repo := &crudDocRepo{getErr: fmt.Errorf("not found")}
	deps := IngestDeps{DocRepo: repo}
	h := IngestDocument(deps)

	req := httptest.NewRequest(http.MethodPost, "/api/documents/missing/ingest", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	req = withChiParam(req, "id", "missing")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}

func TestIngestDocument_Forbidden(t *testing.T) {
	repo := &crudDocRepo{
		singleDoc: &model.Document{
			ID:          "doc-1",
			UserID:      "other-user",
			IndexStatus: model.IndexPending,
		},
	}
	deps := IngestDeps{DocRepo: repo}
	h := IngestDocument(deps)

	req := httptest.NewRequest(http.MethodPost, "/api/documents/doc-1/ingest", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	req = withChiParam(req, "id", "doc-1")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusForbidden)
	}
}

func TestIngestDocument_NotPending(t *testing.T) {
	repo := &crudDocRepo{
		singleDoc: &model.Document{
			ID:          "doc-1",
			UserID:      "user-1",
			IndexStatus: model.IndexIndexed,
		},
	}
	deps := IngestDeps{DocRepo: repo}
	h := IngestDocument(deps)

	req := httptest.NewRequest(http.MethodPost, "/api/documents/doc-1/ingest", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	req = withChiParam(req, "id", "doc-1")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusConflict {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusConflict)
	}
}

func TestIngestDocument_MissingID(t *testing.T) {
	deps := IngestDeps{}
	h := IngestDocument(deps)

	req := httptest.NewRequest(http.MethodPost, "/api/documents//ingest", nil)
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	// No chi param set — simulates missing {id}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}
