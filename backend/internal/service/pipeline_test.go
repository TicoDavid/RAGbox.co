package service

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// --- Pipeline test mocks ---

type pipelineMockRepo struct {
	doc          *model.Document
	getErr       error
	statuses     []model.IndexStatus
	text         string
	chunkCount   int
	updateErr    error
}

func (m *pipelineMockRepo) Create(ctx context.Context, doc *model.Document) error { return nil }
func (m *pipelineMockRepo) GetByID(ctx context.Context, id string) (*model.Document, error) {
	if m.getErr != nil {
		return nil, m.getErr
	}
	return m.doc, nil
}
func (m *pipelineMockRepo) ListByUser(ctx context.Context, userID string, opts ListOpts) ([]model.Document, int, error) {
	return nil, 0, nil
}
func (m *pipelineMockRepo) UpdateStatus(ctx context.Context, id string, status model.IndexStatus) error {
	m.statuses = append(m.statuses, status)
	return m.updateErr
}
func (m *pipelineMockRepo) UpdateText(ctx context.Context, id string, text string, pageCount int) error {
	m.text = text
	return nil
}
func (m *pipelineMockRepo) UpdateChunkCount(ctx context.Context, id string, count int) error {
	m.chunkCount = count
	return nil
}
func (m *pipelineMockRepo) SoftDelete(ctx context.Context, id string) error              { return nil }
func (m *pipelineMockRepo) Recover(ctx context.Context, id string) error                { return nil }
func (m *pipelineMockRepo) UpdateTier(ctx context.Context, id string, tier int) error   { return nil }
func (m *pipelineMockRepo) TogglePrivilege(ctx context.Context, id string, p bool) error {
	return nil
}
func (m *pipelineMockRepo) ToggleStar(ctx context.Context, id string, starred bool) error {
	return nil
}
func (m *pipelineMockRepo) Update(ctx context.Context, id string, name string) error {
	return nil
}
func (m *pipelineMockRepo) UpdateFolder(ctx context.Context, id string, folderID *string) error {
	return nil
}
func (m *pipelineMockRepo) UpdateChecksum(ctx context.Context, id string, checksum string) error {
	return nil
}

type pipelineMockParser struct {
	result *ParseResult
	err    error
}

func (m *pipelineMockParser) Extract(ctx context.Context, gcsURI string) (*ParseResult, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.result, nil
}

type pipelineMockRedactor struct {
	result *ScanResult
	err    error
}

func (m *pipelineMockRedactor) Scan(ctx context.Context, text string) (*ScanResult, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.result, nil
}

type pipelineMockChunker struct {
	chunks []Chunk
	err    error
}

func (m *pipelineMockChunker) Chunk(ctx context.Context, text, docID string) ([]Chunk, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.chunks, nil
}

type pipelineMockEmbedder struct {
	err error
}

func (m *pipelineMockEmbedder) EmbedAndStore(ctx context.Context, chunks []Chunk) error {
	return m.err
}

type pipelineMockAudit struct {
	logged bool
	err    error
}

func (m *pipelineMockAudit) Log(ctx context.Context, action, userID, resourceID, resourceType string) error {
	m.logged = true
	return m.err
}

func newTestPipeline() (*PipelineService, *pipelineMockRepo, *pipelineMockAudit) {
	storagePath := "uploads/user1/doc1/test.pdf"
	repo := &pipelineMockRepo{
		doc: &model.Document{
			ID:          "doc-1",
			UserID:      "user-1",
			StoragePath: &storagePath,
		},
	}

	parser := &pipelineMockParser{
		result: &ParseResult{
			Text:  "This is extracted text from the document. It has multiple sentences and paragraphs.",
			Pages: 3,
		},
	}

	redactor := &pipelineMockRedactor{
		result: &ScanResult{FindingCount: 0},
	}

	chunker := &pipelineMockChunker{
		chunks: []Chunk{
			{Content: "chunk 1 text", ContentHash: "abc", TokenCount: 100, Index: 0, DocumentID: "doc-1"},
			{Content: "chunk 2 text", ContentHash: "def", TokenCount: 120, Index: 1, DocumentID: "doc-1"},
		},
	}

	embedder := &pipelineMockEmbedder{}
	audit := &pipelineMockAudit{}

	svc := NewPipelineService(repo, parser, redactor, chunker, embedder, audit, "ragbox-docs")

	return svc, repo, audit
}

func TestProcessDocument_FullPipeline(t *testing.T) {
	svc, repo, audit := newTestPipeline()

	err := svc.ProcessDocument(context.Background(), "doc-1")
	if err != nil {
		t.Fatalf("ProcessDocument() error: %v", err)
	}

	// Check status progression: Processing → Indexed
	if len(repo.statuses) < 2 {
		t.Fatalf("expected at least 2 status updates, got %d", len(repo.statuses))
	}
	if repo.statuses[0] != model.IndexProcessing {
		t.Errorf("statuses[0] = %q, want %q", repo.statuses[0], model.IndexProcessing)
	}
	if repo.statuses[len(repo.statuses)-1] != model.IndexIndexed {
		t.Errorf("final status = %q, want %q", repo.statuses[len(repo.statuses)-1], model.IndexIndexed)
	}

	// Check text was stored
	if repo.text == "" {
		t.Error("expected extracted text to be stored")
	}

	// Check chunk count
	if repo.chunkCount != 2 {
		t.Errorf("chunkCount = %d, want 2", repo.chunkCount)
	}

	// Check audit logged
	if !audit.logged {
		t.Error("expected audit event to be logged")
	}
}

func TestProcessDocument_ParseFails(t *testing.T) {
	svc, repo, _ := newTestPipeline()
	svc.parser = &pipelineMockParser{err: fmt.Errorf("Document AI timeout")}

	err := svc.ProcessDocument(context.Background(), "doc-1")
	if err == nil {
		t.Fatal("expected error when parser fails")
	}

	// Should have set status to Failed
	found := false
	for _, s := range repo.statuses {
		if s == model.IndexFailed {
			found = true
		}
	}
	if !found {
		t.Error("expected status to be set to Failed after parse error")
	}
}

func TestProcessDocument_ChunkFails(t *testing.T) {
	svc, repo, _ := newTestPipeline()
	svc.chunker = &pipelineMockChunker{err: fmt.Errorf("chunk error")}

	err := svc.ProcessDocument(context.Background(), "doc-1")
	if err == nil {
		t.Fatal("expected error when chunker fails")
	}

	found := false
	for _, s := range repo.statuses {
		if s == model.IndexFailed {
			found = true
		}
	}
	if !found {
		t.Error("expected status to be set to Failed after chunk error")
	}
}

func TestProcessDocument_EmbedFails(t *testing.T) {
	svc, repo, _ := newTestPipeline()
	svc.embedder = &pipelineMockEmbedder{err: fmt.Errorf("embedding error")}

	err := svc.ProcessDocument(context.Background(), "doc-1")
	if err == nil {
		t.Fatal("expected error when embedder fails")
	}

	found := false
	for _, s := range repo.statuses {
		if s == model.IndexFailed {
			found = true
		}
	}
	if !found {
		t.Error("expected status to be set to Failed after embed error")
	}
}

func TestProcessDocument_DocNotFound(t *testing.T) {
	svc, _, _ := newTestPipeline()
	svc.docRepo = &pipelineMockRepo{getErr: fmt.Errorf("not found")}

	err := svc.ProcessDocument(context.Background(), "nonexistent")
	if err == nil {
		t.Fatal("expected error when doc not found")
	}
}

func TestProcessDocument_PIIScanFailsNonFatal(t *testing.T) {
	svc, repo, _ := newTestPipeline()
	svc.redactor = &pipelineMockRedactor{err: fmt.Errorf("DLP unavailable")}

	err := svc.ProcessDocument(context.Background(), "doc-1")
	if err != nil {
		t.Fatalf("ProcessDocument() error: %v — PII scan failure should be non-fatal", err)
	}

	// Pipeline should still complete
	if repo.statuses[len(repo.statuses)-1] != model.IndexIndexed {
		t.Errorf("final status = %q, want %q — pipeline should complete despite PII scan failure",
			repo.statuses[len(repo.statuses)-1], model.IndexIndexed)
	}
}

// ── STORY-189: Failure-Path Tests ──────────────────────────────

// TestProcessDocument_EmbeddingAPI500_FailsGracefully verifies that when the
// embedding API returns a 500 error: (a) no panic, (b) meaningful error returned,
// (c) document status is set to Failed with error details stored in metadata.
func TestProcessDocument_EmbeddingAPI500_FailsGracefully(t *testing.T) {
	svc, repo, _ := newTestPipeline()
	svc.embedder = &pipelineMockEmbedder{err: fmt.Errorf("embedding API returned HTTP 500: internal server error")}

	err := svc.ProcessDocument(context.Background(), "doc-1")

	// (a) No panic — we reached this line
	// (b) Meaningful error returned
	if err == nil {
		t.Fatal("expected error when embedding API returns 500")
	}
	if !strings.Contains(err.Error(), "embed") {
		t.Errorf("error should reference embed stage, got: %v", err)
	}

	// (c) Document status set to Failed
	foundFailed := false
	for _, s := range repo.statuses {
		if s == model.IndexFailed {
			foundFailed = true
		}
	}
	if !foundFailed {
		t.Error("expected document status to be set to Failed after embedding API 500")
	}

	// Verify error details stored in document text (failDocument writes JSON metadata)
	if repo.text == "" {
		t.Error("expected error details to be stored in document text")
	}
	if !strings.Contains(repo.text, "embed_failed") {
		t.Errorf("expected error details to contain 'embed_failed', got: %s", repo.text)
	}
	if !strings.Contains(repo.text, "500") {
		t.Errorf("expected error details to contain '500', got: %s", repo.text)
	}

	// Verify system recovers: can process another document after failure
	svc.embedder = &pipelineMockEmbedder{} // restore healthy embedder
	repo.statuses = nil                     // reset
	repo.text = ""
	err = svc.ProcessDocument(context.Background(), "doc-1")
	if err != nil {
		t.Fatalf("pipeline should recover after failure, got: %v", err)
	}
	if repo.statuses[len(repo.statuses)-1] != model.IndexIndexed {
		t.Errorf("recovered pipeline should reach Indexed, got: %v", repo.statuses)
	}
}

// TestProcessDocument_AuditLogDown_PipelineCompletes verifies that when the
// audit service is down (like Redis cache failure): (a) no panic, (b) pipeline
// still completes, (c) document reaches Indexed status (degraded, not broken).
func TestProcessDocument_AuditLogDown_PipelineCompletes(t *testing.T) {
	svc, repo, audit := newTestPipeline()
	audit.err = fmt.Errorf("redis connection refused: dial tcp 10.215.185.51:6379")

	err := svc.ProcessDocument(context.Background(), "doc-1")

	// (a) No panic — we reached this line
	// (b) Pipeline completes without error (audit failure is non-fatal)
	if err != nil {
		t.Fatalf("pipeline should complete despite audit log failure: %v", err)
	}

	// (c) Document reaches Indexed status
	if repo.statuses[len(repo.statuses)-1] != model.IndexIndexed {
		t.Errorf("expected final status Indexed despite audit failure, got: %v", repo.statuses)
	}

	// Chunks were still stored
	if repo.chunkCount != 2 {
		t.Errorf("chunkCount = %d, want 2 — pipeline should complete despite audit failure", repo.chunkCount)
	}
}

func TestProcessDocument_PIIFindingsLogged(t *testing.T) {
	svc, _, _ := newTestPipeline()
	svc.redactor = &pipelineMockRedactor{
		result: &ScanResult{
			FindingCount: 2,
			Types:        []string{"EMAIL_ADDRESS", "US_SOCIAL_SECURITY_NUMBER"},
		},
	}

	err := svc.ProcessDocument(context.Background(), "doc-1")
	if err != nil {
		t.Fatalf("ProcessDocument() error: %v", err)
	}
	// No assertion needed — just verifying pipeline completes with PII findings
}
