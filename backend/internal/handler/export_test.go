package handler

import (
	"archive/zip"
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/connexus-ai/ragbox-backend/internal/middleware"
	"github.com/connexus-ai/ragbox-backend/internal/model"
	"github.com/connexus-ai/ragbox-backend/internal/repository"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// stubDocLister implements ExportDocLister for testing.
type stubDocLister struct {
	docs  []model.Document
	total int
	err   error
}

func (s *stubDocLister) ListByUser(ctx context.Context, userID string, opts service.ListOpts) ([]model.Document, int, error) {
	if s.err != nil {
		return nil, 0, s.err
	}
	return s.docs, s.total, nil
}

// stubExportAuditLister implements AuditLister for testing.
type stubExportAuditLister struct {
	entries []model.AuditLog
	total   int
	err     error
}

func (s *stubExportAuditLister) List(ctx context.Context, f repository.ListFilter) ([]model.AuditLog, int, error) {
	if s.err != nil {
		return nil, 0, s.err
	}
	return s.entries, s.total, nil
}

func testDocuments() []model.Document {
	return []model.Document{
		{
			ID: "doc-1", UserID: "test-user", Filename: "contract.pdf",
			OriginalName: "contract.pdf", MimeType: "application/pdf",
			IndexStatus: model.IndexIndexed, DeletionStatus: model.DeletionActive,
			CreatedAt: time.Now(), UpdatedAt: time.Now(),
		},
	}
}

func exportRequest() *http.Request {
	req := httptest.NewRequest(http.MethodGet, "/api/export", nil)
	ctx := middleware.WithUserID(req.Context(), "test-user")
	return req.WithContext(ctx)
}

func TestExportData_Success(t *testing.T) {
	deps := ExportDeps{
		DocRepo: &stubDocLister{docs: testDocuments(), total: 1},
		AuditLister: &stubExportAuditLister{
			entries: testAuditEntries(),
			total:   2,
		},
	}

	handler := ExportData(deps)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, exportRequest())

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}

	contentType := w.Header().Get("Content-Type")
	if contentType != "application/zip" {
		t.Errorf("Content-Type = %q, want application/zip", contentType)
	}

	disposition := w.Header().Get("Content-Disposition")
	if !strings.Contains(disposition, "ragbox-export") {
		t.Errorf("Content-Disposition = %q, want to contain 'ragbox-export'", disposition)
	}

	// Verify ZIP contents
	reader := bytes.NewReader(w.Body.Bytes())
	zr, err := zip.NewReader(reader, int64(w.Body.Len()))
	if err != nil {
		t.Fatalf("failed to read ZIP: %v", err)
	}

	expectedFiles := map[string]bool{
		"documents.json":  false,
		"audit_logs.json": false,
		"manifest.json":   false,
	}

	for _, f := range zr.File {
		if _, ok := expectedFiles[f.Name]; ok {
			expectedFiles[f.Name] = true
		}
	}

	for name, found := range expectedFiles {
		if !found {
			t.Errorf("ZIP missing file: %s", name)
		}
	}
}

func TestExportData_Unauthorized(t *testing.T) {
	deps := ExportDeps{}
	handler := ExportData(deps)

	req := httptest.NewRequest(http.MethodGet, "/api/export", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", w.Code)
	}
}

func TestExportData_DocFetchError(t *testing.T) {
	deps := ExportDeps{
		DocRepo:     &stubDocLister{err: fmt.Errorf("db error")},
		AuditLister: &stubExportAuditLister{},
	}

	handler := ExportData(deps)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, exportRequest())

	if w.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500", w.Code)
	}
}

func TestExportData_AuditFetchError(t *testing.T) {
	deps := ExportDeps{
		DocRepo:     &stubDocLister{docs: nil, total: 0},
		AuditLister: &stubExportAuditLister{err: fmt.Errorf("db error")},
	}

	handler := ExportData(deps)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, exportRequest())

	if w.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500", w.Code)
	}
}

func TestExportData_EmptyData(t *testing.T) {
	deps := ExportDeps{
		DocRepo:     &stubDocLister{docs: nil, total: 0},
		AuditLister: &stubExportAuditLister{entries: nil, total: 0},
	}

	handler := ExportData(deps)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, exportRequest())

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 even with empty data", w.Code)
	}

	// Should still be a valid ZIP
	reader := bytes.NewReader(w.Body.Bytes())
	zr, err := zip.NewReader(reader, int64(w.Body.Len()))
	if err != nil {
		t.Fatalf("empty export should produce valid ZIP: %v", err)
	}
	if len(zr.File) != 3 {
		t.Errorf("expected 3 files in ZIP, got %d", len(zr.File))
	}
}
