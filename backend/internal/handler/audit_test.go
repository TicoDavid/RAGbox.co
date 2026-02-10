package handler

import (
	"context"
	"encoding/json"
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

// stubAuditLister implements AuditLister for testing.
type stubAuditLister struct {
	entries []model.AuditLog
	total   int
	err     error
}

func (s *stubAuditLister) List(ctx context.Context, f repository.ListFilter) ([]model.AuditLog, int, error) {
	if s.err != nil {
		return nil, 0, s.err
	}
	return s.entries, s.total, nil
}

// stubAuditRepo implements service.AuditRepository for wiring AuditService.
type stubAuditRepo struct {
	latestHash   string
	rangeEntries []model.AuditLog
}

func (s *stubAuditRepo) Create(ctx context.Context, entry *model.AuditLog) error { return nil }
func (s *stubAuditRepo) GetLatestHash(ctx context.Context) (string, error) {
	return s.latestHash, nil
}
func (s *stubAuditRepo) GetRange(ctx context.Context, startID, endID string) ([]model.AuditLog, error) {
	return s.rangeEntries, nil
}

func testAuditEntries() []model.AuditLog {
	userID := "test-user"
	docID := "doc-1"
	docType := "document"
	hash1 := "abc123"
	hash2 := "def456"

	return []model.AuditLog{
		{
			ID: "entry-1", UserID: &userID, Action: model.AuditDocumentUpload,
			ResourceID: &docID, ResourceType: &docType, Severity: "LOW",
			DetailsHash: &hash1, CreatedAt: time.Now().Add(-time.Hour),
		},
		{
			ID: "entry-2", UserID: &userID, Action: model.AuditQueryExecuted,
			Severity: "LOW", DetailsHash: &hash2, CreatedAt: time.Now(),
		},
	}
}

func auditRequest(path string) *http.Request {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	ctx := middleware.WithUserID(req.Context(), "test-user")
	return req.WithContext(ctx)
}

func makeAuditDeps(lister *stubAuditLister) AuditDeps {
	repo := &stubAuditRepo{rangeEntries: lister.entries}
	verifier, _ := service.NewAuditService(repo, nil)
	return AuditDeps{
		Lister:   lister,
		Verifier: verifier,
	}
}

func TestListAudit_Success(t *testing.T) {
	entries := testAuditEntries()
	lister := &stubAuditLister{entries: entries, total: 2}
	deps := makeAuditDeps(lister)

	handler := ListAudit(deps)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, auditRequest("/api/audit"))

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}

	var resp envelope
	json.NewDecoder(w.Body).Decode(&resp)
	if !resp.Success {
		t.Error("expected success=true")
	}

	data, ok := resp.Data.(map[string]interface{})
	if !ok {
		t.Fatal("expected data to be a map")
	}
	if total, ok := data["total"].(float64); !ok || int(total) != 2 {
		t.Errorf("total = %v, want 2", data["total"])
	}
}

func TestListAudit_WithFilters(t *testing.T) {
	lister := &stubAuditLister{entries: nil, total: 0}
	deps := makeAuditDeps(lister)

	handler := ListAudit(deps)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, auditRequest("/api/audit?action=DOCUMENT_UPLOAD&severity=LOW&limit=10&offset=5"))

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
}

func TestListAudit_Unauthorized(t *testing.T) {
	deps := AuditDeps{}
	handler := ListAudit(deps)

	req := httptest.NewRequest(http.MethodGet, "/api/audit", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", w.Code)
	}
}

func TestExportAudit_Success(t *testing.T) {
	entries := testAuditEntries()
	lister := &stubAuditLister{entries: entries, total: 2}
	deps := makeAuditDeps(lister)

	handler := ExportAudit(deps)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, auditRequest("/api/audit/export"))

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}

	contentType := w.Header().Get("Content-Type")
	if !strings.Contains(contentType, "text/plain") {
		t.Errorf("Content-Type = %q, want text/plain", contentType)
	}

	disposition := w.Header().Get("Content-Disposition")
	if !strings.Contains(disposition, "audit-report") {
		t.Errorf("Content-Disposition = %q, want to contain 'audit-report'", disposition)
	}

	body := w.Body.String()
	if !strings.Contains(body, "RAGbox.co Audit Report") {
		t.Error("export should contain report header")
	}
	if !strings.Contains(body, "Chain Integrity") {
		t.Error("export should contain chain integrity status")
	}
	if !strings.Contains(body, "entry-1") {
		t.Error("export should contain entry IDs")
	}
}

func TestExportAudit_EmptyEntries(t *testing.T) {
	lister := &stubAuditLister{entries: nil, total: 0}
	deps := makeAuditDeps(lister)

	handler := ExportAudit(deps)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, auditRequest("/api/audit/export"))

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}

	body := w.Body.String()
	if !strings.Contains(body, "NO ENTRIES") {
		t.Error("empty export should show NO ENTRIES for chain status")
	}
}

func TestExportAudit_Unauthorized(t *testing.T) {
	deps := AuditDeps{}
	handler := ExportAudit(deps)

	req := httptest.NewRequest(http.MethodGet, "/api/audit/export", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", w.Code)
	}
}
