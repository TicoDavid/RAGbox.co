package service

import (
	"context"
	"testing"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// ── Pipeline benchmark mocks (full interface implementations) ────

type benchDocRepo struct{ doc *model.Document }

func (r *benchDocRepo) Create(_ context.Context, _ *model.Document) error                  { return nil }
func (r *benchDocRepo) GetByID(_ context.Context, _ string) (*model.Document, error)       { return r.doc, nil }
func (r *benchDocRepo) ListByUser(_ context.Context, _ string, _ ListOpts) ([]model.Document, int, error) {
	return nil, 0, nil
}
func (r *benchDocRepo) UpdateStatus(_ context.Context, _ string, _ model.IndexStatus) error { return nil }
func (r *benchDocRepo) UpdateText(_ context.Context, _ string, _ string, _ int) error       { return nil }
func (r *benchDocRepo) UpdateChunkCount(_ context.Context, _ string, _ int) error            { return nil }
func (r *benchDocRepo) SoftDelete(_ context.Context, _ string) error                         { return nil }
func (r *benchDocRepo) Recover(_ context.Context, _ string) error                            { return nil }
func (r *benchDocRepo) UpdateTier(_ context.Context, _ string, _ int) error                  { return nil }
func (r *benchDocRepo) TogglePrivilege(_ context.Context, _ string, _ bool) error            { return nil }
func (r *benchDocRepo) Update(_ context.Context, _ string, _ string) error                   { return nil }
func (r *benchDocRepo) UpdateFolder(_ context.Context, _ string, _ *string) error            { return nil }
func (r *benchDocRepo) ToggleStar(_ context.Context, _ string, _ bool) error                 { return nil }
func (r *benchDocRepo) UpdateChecksum(_ context.Context, _ string, _ string) error           { return nil }

type benchParser struct{ text string }

func (p *benchParser) Extract(_ context.Context, _ string) (*ParseResult, error) {
	return &ParseResult{Text: p.text, Pages: 1}, nil
}

type benchRedactor struct{}

func (r *benchRedactor) Scan(_ context.Context, _ string) (*ScanResult, error) {
	return &ScanResult{Findings: nil, FindingCount: 0}, nil
}

type benchChunker struct{ chunks []Chunk }

func (c *benchChunker) Chunk(_ context.Context, _ string, _ string) ([]Chunk, error) {
	return c.chunks, nil
}

type benchEmbedder struct{}

func (e *benchEmbedder) EmbedAndStore(_ context.Context, _ []Chunk) error {
	return nil
}

type benchAudit struct{}

func (a *benchAudit) Log(_ context.Context, _, _, _, _ string) error {
	return nil
}

func BenchmarkPipeline_FullQuery(b *testing.B) {
	uri := "gs://ragbox-docs/bench-doc.pdf"
	doc := &model.Document{
		ID:          "bench-doc",
		UserID:      "bench-user",
		Filename:    "bench-doc.pdf",
		IndexStatus: model.IndexPending,
		StorageURI:  &uri,
	}

	text := "The parties agree to maintain strict confidentiality of all proprietary information."
	chunks := []Chunk{
		{Content: text, ContentHash: "hash-1", TokenCount: 15, Index: 0, DocumentID: "bench-doc"},
	}

	svc := NewPipelineService(
		&benchDocRepo{doc: doc},
		&benchParser{text: text},
		&benchRedactor{},
		&benchChunker{chunks: chunks},
		&benchEmbedder{},
		&benchAudit{},
		"ragbox-docs",
	)

	ctx := context.Background()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = svc.ProcessDocument(ctx, "bench-doc")
	}
}
