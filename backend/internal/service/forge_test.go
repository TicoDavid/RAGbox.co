package service

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// mockUploader implements ObjectUploader for testing.
type mockUploader struct {
	uploaded    []uploadedObject
	uploadErr   error
	downloadURL string
	downloadErr error
}

type uploadedObject struct {
	bucket      string
	object      string
	data        []byte
	contentType string
}

func (m *mockUploader) Upload(ctx context.Context, bucket, object string, data []byte, contentType string) error {
	if m.uploadErr != nil {
		return m.uploadErr
	}
	m.uploaded = append(m.uploaded, uploadedObject{bucket, object, data, contentType})
	return nil
}

func (m *mockUploader) SignedDownloadURL(ctx context.Context, bucket, object string, expiry time.Duration) (string, error) {
	if m.downloadErr != nil {
		return "", m.downloadErr
	}
	return m.downloadURL, nil
}

// mockForgeGenAI implements GenAIClient for forge testing.
type mockForgeGenAI struct {
	response string
	err      error
}

func (m *mockForgeGenAI) GenerateContent(ctx context.Context, systemPrompt, userPrompt string) (string, error) {
	if m.err != nil {
		return "", m.err
	}
	return m.response, nil
}

func testForgeChunks() []RankedChunk {
	return []RankedChunk{
		{
			Chunk:      model.DocumentChunk{ID: "c1", Content: "Revenue increased 15% YoY."},
			Similarity: 0.95,
			Document:   model.Document{ID: "d1"},
		},
		{
			Chunk:      model.DocumentChunk{ID: "c2", Content: "Operating costs remained stable."},
			Similarity: 0.88,
			Document:   model.Document{ID: "d2"},
		},
	}
}

func TestForge_Generate_Success(t *testing.T) {
	genAI := &mockForgeGenAI{response: "# Executive Brief\n\nRevenue grew 15% [1]. Costs stable [2]."}
	uploader := &mockUploader{downloadURL: "https://storage.example.com/forge/report.txt?sig=abc"}
	svc := NewForgeService(genAI, uploader, "test-bucket")

	result, err := svc.Generate(context.Background(), ForgeRequest{
		Template: TemplateExecutiveBrief,
		Query:    "Q3 financial summary",
		Chunks:   testForgeChunks(),
	})

	if err != nil {
		t.Fatalf("Generate() error: %v", err)
	}
	if result.DocumentID == "" {
		t.Error("DocumentID should not be empty")
	}
	if result.DownloadURL != "https://storage.example.com/forge/report.txt?sig=abc" {
		t.Errorf("DownloadURL = %q, unexpected", result.DownloadURL)
	}
	if !strings.Contains(result.Title, "Executive Brief") {
		t.Errorf("Title = %q, want to contain 'Executive Brief'", result.Title)
	}
	if result.PageCount < 1 {
		t.Errorf("PageCount = %d, want >= 1", result.PageCount)
	}
	if result.GeneratedAt == "" {
		t.Error("GeneratedAt should not be empty")
	}

	// Verify upload
	if len(uploader.uploaded) != 1 {
		t.Fatalf("expected 1 upload, got %d", len(uploader.uploaded))
	}
	if uploader.uploaded[0].bucket != "test-bucket" {
		t.Errorf("bucket = %q, want %q", uploader.uploaded[0].bucket, "test-bucket")
	}
}

func TestForge_Generate_AllTemplates(t *testing.T) {
	templates := []string{TemplateExecutiveBrief, TemplateRiskAssessment, TemplateComplianceSummary}

	for _, tmpl := range templates {
		t.Run(tmpl, func(t *testing.T) {
			genAI := &mockForgeGenAI{response: "Generated content for " + tmpl}
			uploader := &mockUploader{downloadURL: "https://example.com/dl"}
			svc := NewForgeService(genAI, uploader, "bucket")

			result, err := svc.Generate(context.Background(), ForgeRequest{
				Template: tmpl,
				Query:    "test query",
				Chunks:   testForgeChunks(),
			})
			if err != nil {
				t.Fatalf("Generate(%s) error: %v", tmpl, err)
			}
			if result.DocumentID == "" {
				t.Error("DocumentID should not be empty")
			}
		})
	}
}

func TestForge_Generate_EmptyTemplate(t *testing.T) {
	svc := NewForgeService(nil, nil, "bucket")
	_, err := svc.Generate(context.Background(), ForgeRequest{Query: "test"})
	if err == nil {
		t.Fatal("expected error for empty template")
	}
}

func TestForge_Generate_EmptyQuery(t *testing.T) {
	svc := NewForgeService(nil, nil, "bucket")
	_, err := svc.Generate(context.Background(), ForgeRequest{Template: TemplateExecutiveBrief})
	if err == nil {
		t.Fatal("expected error for empty query")
	}
}

func TestForge_Generate_GenAIError(t *testing.T) {
	genAI := &mockForgeGenAI{err: fmt.Errorf("model unavailable")}
	svc := NewForgeService(genAI, nil, "bucket")

	_, err := svc.Generate(context.Background(), ForgeRequest{
		Template: TemplateExecutiveBrief,
		Query:    "test",
		Chunks:   testForgeChunks(),
	})
	if err == nil {
		t.Fatal("expected error when GenAI fails")
	}
}

func TestForge_Generate_UploadError(t *testing.T) {
	genAI := &mockForgeGenAI{response: "content"}
	uploader := &mockUploader{uploadErr: fmt.Errorf("storage full")}
	svc := NewForgeService(genAI, uploader, "bucket")

	_, err := svc.Generate(context.Background(), ForgeRequest{
		Template: TemplateExecutiveBrief,
		Query:    "test",
		Chunks:   testForgeChunks(),
	})
	if err == nil {
		t.Fatal("expected error when upload fails")
	}
}

func TestForge_Generate_SignedURLError(t *testing.T) {
	genAI := &mockForgeGenAI{response: "content"}
	uploader := &mockUploader{downloadErr: fmt.Errorf("signing failed")}
	svc := NewForgeService(genAI, uploader, "bucket")

	_, err := svc.Generate(context.Background(), ForgeRequest{
		Template: TemplateExecutiveBrief,
		Query:    "test",
		Chunks:   testForgeChunks(),
	})
	if err == nil {
		t.Fatal("expected error when signed URL fails")
	}
}

func TestSanitizeFilename(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"Hello World", "Hello_World"},
		{"test/file:name", "testfilename"},
		{"report-2025_v1.txt", "report-2025_v1.txt"},
		{"café résumé", "caf_rsum"},
	}
	for _, tt := range tests {
		got := sanitizeFilename(tt.input)
		if got != tt.want {
			t.Errorf("sanitizeFilename(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestEstimatePages(t *testing.T) {
	if p := estimatePages("short"); p != 1 {
		t.Errorf("short content = %d pages, want 1", p)
	}
	long := strings.Repeat("x", 9000)
	if p := estimatePages(long); p < 3 {
		t.Errorf("9000 chars = %d pages, want >= 3", p)
	}
}

func TestForgeTitleForTemplate(t *testing.T) {
	title := forgeTitleForTemplate(TemplateRiskAssessment, "financial exposure analysis")
	if !strings.Contains(title, "Risk Assessment") {
		t.Errorf("title = %q, want to contain 'Risk Assessment'", title)
	}
	if !strings.Contains(title, "financial exposure") {
		t.Errorf("title = %q, want to contain query text", title)
	}
}

func TestForgeTitleForTemplate_LongQuery(t *testing.T) {
	longQuery := strings.Repeat("a", 100)
	title := forgeTitleForTemplate(TemplateExecutiveBrief, longQuery)
	if len(title) > 80 {
		t.Errorf("title length = %d, want <= 80 for truncated query", len(title))
	}
}
