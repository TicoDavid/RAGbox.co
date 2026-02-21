package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/connexus-ai/ragbox-backend/internal/middleware"
	"github.com/connexus-ai/ragbox-backend/internal/model"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// mockChunkReader implements ChunkWithNeighborsReader for testing.
type mockChunkReader struct {
	chunks []model.DocumentChunk
	err    error
}

func (m *mockChunkReader) GetChunkWithNeighbors(ctx context.Context, documentID, chunkID string) ([]model.DocumentChunk, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.chunks, nil
}

// mockDocRepoForPreview implements the subset of service.DocumentRepository
// used by the chunk preview handler (GetByID only).
type mockDocRepoForPreview struct {
	doc *model.Document
	err error
}

func (m *mockDocRepoForPreview) GetByID(ctx context.Context, id string) (*model.Document, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.doc, nil
}

// Stub the rest of DocumentRepository interface.
func (m *mockDocRepoForPreview) Create(ctx context.Context, doc *model.Document) error        { return nil }
func (m *mockDocRepoForPreview) ListByUser(ctx context.Context, userID string, opts service.ListOpts) ([]model.Document, int, error) {
	return nil, 0, nil
}
func (m *mockDocRepoForPreview) UpdateStatus(ctx context.Context, id string, status model.IndexStatus) error {
	return nil
}
func (m *mockDocRepoForPreview) UpdateText(ctx context.Context, id string, text string, pageCount int) error {
	return nil
}
func (m *mockDocRepoForPreview) UpdateChunkCount(ctx context.Context, id string, count int) error {
	return nil
}
func (m *mockDocRepoForPreview) SoftDelete(ctx context.Context, id string) error { return nil }
func (m *mockDocRepoForPreview) Recover(ctx context.Context, id string) error    { return nil }
func (m *mockDocRepoForPreview) UpdateTier(ctx context.Context, id string, tier int) error {
	return nil
}
func (m *mockDocRepoForPreview) TogglePrivilege(ctx context.Context, id string, privileged bool) error {
	return nil
}
func (m *mockDocRepoForPreview) Update(ctx context.Context, id string, name string) error { return nil }
func (m *mockDocRepoForPreview) UpdateFolder(ctx context.Context, id string, folderID *string) error {
	return nil
}
func (m *mockDocRepoForPreview) ToggleStar(ctx context.Context, id string, starred bool) error {
	return nil
}
func (m *mockDocRepoForPreview) UpdateChecksum(ctx context.Context, id string, checksum string) error {
	return nil
}

// chunkPreviewRequest builds a request with chi URL params for the chunk preview handler.
func chunkPreviewRequest(userID, docID, chunkID string) *http.Request {
	req := httptest.NewRequest(http.MethodGet, "/api/documents/"+docID+"/chunks/"+chunkID+"/preview", nil)
	ctx := middleware.WithUserID(req.Context(), userID)

	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", docID)
	rctx.URLParams.Add("chunkId", chunkID)
	ctx = context.WithValue(ctx, chi.RouteCtxKey, rctx)

	return req.WithContext(ctx)
}

func testDocForPreview(userID string) *model.Document {
	return &model.Document{
		ID:           "d0000000-0000-0000-0000-000000000001",
		UserID:       userID,
		OriginalName: "contract.pdf",
		CreatedAt:    time.Now().UTC(),
	}
}

func testChunksMiddle() []model.DocumentChunk {
	return []model.DocumentChunk{
		{ID: "c0000000-0000-0000-0000-000000000000", DocumentID: "d0000000-0000-0000-0000-000000000001", ChunkIndex: 0, Content: "Before chunk.", TokenCount: 5, CreatedAt: time.Now().UTC()},
		{ID: "c0000000-0000-0000-0000-000000000001", DocumentID: "d0000000-0000-0000-0000-000000000001", ChunkIndex: 1, Content: "Target chunk.", TokenCount: 6, CreatedAt: time.Now().UTC()},
		{ID: "c0000000-0000-0000-0000-000000000002", DocumentID: "d0000000-0000-0000-0000-000000000001", ChunkIndex: 2, Content: "After chunk.", TokenCount: 5, CreatedAt: time.Now().UTC()},
	}
}

func TestChunkPreview_Success(t *testing.T) {
	docID := "d0000000-0000-0000-0000-000000000001"
	chunkID := "c0000000-0000-0000-0000-000000000001"
	userID := "test-user"

	deps := ChunkPreviewDeps{
		DocRepo: &mockDocRepoForPreview{doc: testDocForPreview(userID)},
		ChunkReader: &mockChunkReader{chunks: testChunksMiddle()},
	}

	h := ChunkPreview(deps)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, chunkPreviewRequest(userID, docID, chunkID))

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", w.Code, w.Body.String())
	}

	body := w.Body.String()
	if !containsStr(body, `"success":true`) {
		t.Errorf("expected success:true in %s", body)
	}
	if !containsStr(body, `"content":"Target chunk."`) {
		t.Errorf("expected target chunk content in %s", body)
	}
	if !containsStr(body, `"content":"Before chunk."`) {
		t.Errorf("expected before chunk content in %s", body)
	}
	if !containsStr(body, `"content":"After chunk."`) {
		t.Errorf("expected after chunk content in %s", body)
	}
}

func TestChunkPreview_FirstChunk(t *testing.T) {
	docID := "d0000000-0000-0000-0000-000000000001"
	chunkID := "c0000000-0000-0000-0000-000000000000"
	userID := "test-user"

	// First chunk: only target + after
	chunks := []model.DocumentChunk{
		{ID: "c0000000-0000-0000-0000-000000000000", DocumentID: docID, ChunkIndex: 0, Content: "First chunk.", TokenCount: 5, CreatedAt: time.Now().UTC()},
		{ID: "c0000000-0000-0000-0000-000000000001", DocumentID: docID, ChunkIndex: 1, Content: "Second chunk.", TokenCount: 5, CreatedAt: time.Now().UTC()},
	}

	deps := ChunkPreviewDeps{
		DocRepo:     &mockDocRepoForPreview{doc: testDocForPreview(userID)},
		ChunkReader: &mockChunkReader{chunks: chunks},
	}

	h := ChunkPreview(deps)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, chunkPreviewRequest(userID, docID, chunkID))

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", w.Code, w.Body.String())
	}

	body := w.Body.String()
	if !containsStr(body, `"before":null`) {
		t.Errorf("expected before:null for first chunk in %s", body)
	}
	if !containsStr(body, `"content":"Second chunk."`) {
		t.Errorf("expected after chunk in %s", body)
	}
}

func TestChunkPreview_Unauthorized(t *testing.T) {
	deps := ChunkPreviewDeps{}

	h := ChunkPreview(deps)
	w := httptest.NewRecorder()

	// No userID in context
	req := httptest.NewRequest(http.MethodGet, "/api/documents/d0000000-0000-0000-0000-000000000001/chunks/c0000000-0000-0000-0000-000000000001/preview", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", "d0000000-0000-0000-0000-000000000001")
	rctx.URLParams.Add("chunkId", "c0000000-0000-0000-0000-000000000001")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	h.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", w.Code)
	}
}

func TestChunkPreview_InvalidDocID(t *testing.T) {
	deps := ChunkPreviewDeps{}

	h := ChunkPreview(deps)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, chunkPreviewRequest("test-user", "not-a-uuid", "c0000000-0000-0000-0000-000000000001"))

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", w.Code)
	}
}

func TestChunkPreview_InvalidChunkID(t *testing.T) {
	deps := ChunkPreviewDeps{}

	h := ChunkPreview(deps)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, chunkPreviewRequest("test-user", "d0000000-0000-0000-0000-000000000001", "bad-id"))

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", w.Code)
	}
}

func TestChunkPreview_DocNotFound(t *testing.T) {
	deps := ChunkPreviewDeps{
		DocRepo:     &mockDocRepoForPreview{doc: nil},
		ChunkReader: &mockChunkReader{},
	}

	h := ChunkPreview(deps)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, chunkPreviewRequest("test-user", "d0000000-0000-0000-0000-000000000001", "c0000000-0000-0000-0000-000000000001"))

	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", w.Code)
	}
}

func TestChunkPreview_ForbiddenOtherUser(t *testing.T) {
	// Doc belongs to a different user
	doc := &model.Document{
		ID:     "d0000000-0000-0000-0000-000000000001",
		UserID: "other-user",
	}

	deps := ChunkPreviewDeps{
		DocRepo:     &mockDocRepoForPreview{doc: doc},
		ChunkReader: &mockChunkReader{},
	}

	h := ChunkPreview(deps)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, chunkPreviewRequest("test-user", "d0000000-0000-0000-0000-000000000001", "c0000000-0000-0000-0000-000000000001"))

	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404 (forbidden returns 404 to avoid info leak)", w.Code)
	}
}

func TestChunkPreview_ChunkNotFound(t *testing.T) {
	userID := "test-user"

	deps := ChunkPreviewDeps{
		DocRepo:     &mockDocRepoForPreview{doc: testDocForPreview(userID)},
		ChunkReader: &mockChunkReader{chunks: []model.DocumentChunk{}},
	}

	h := ChunkPreview(deps)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, chunkPreviewRequest(userID, "d0000000-0000-0000-0000-000000000001", "c0000000-0000-0000-0000-000000000099"))

	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", w.Code)
	}
}

// containsStr is a small helper to avoid importing strings in tests.
func containsStr(haystack, needle string) bool {
	return len(haystack) >= len(needle) && (haystack == needle || len(needle) == 0 || findStr(haystack, needle))
}

func findStr(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
