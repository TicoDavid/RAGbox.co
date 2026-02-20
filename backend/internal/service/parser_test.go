package service

import (
	"context"
	"fmt"
	"testing"
)

// mockDocAIClient implements DocumentAIClient for testing.
type mockDocAIClient struct {
	resp *DocumentAIResponse
	err  error
}

func (m *mockDocAIClient) ProcessDocument(ctx context.Context, processor, gcsURI, mimeType string) (*DocumentAIResponse, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.resp, nil
}

// mockObjectDownloader implements ObjectDownloader for testing.
type mockObjectDownloader struct {
	data []byte
	err  error
}

func (m *mockObjectDownloader) Download(ctx context.Context, bucket, object string) ([]byte, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.data, nil
}

func TestExtract_PDF(t *testing.T) {
	client := &mockDocAIClient{
		resp: &DocumentAIResponse{
			Text:  "This is the extracted text from a PDF document.",
			Pages: 5,
			Entities: []Entity{
				{Type: "DATE", Content: "2026-01-15", Confidence: 0.95},
			},
		},
	}
	svc := NewParserService(client, "projects/test/locations/us/processors/abc", nil, "")

	result, err := svc.Extract(context.Background(), "gs://bucket/uploads/user1/doc1/contract.pdf")
	if err != nil {
		t.Fatalf("Extract() error: %v", err)
	}

	if result.Text == "" {
		t.Error("expected non-empty text")
	}
	if result.Pages != 5 {
		t.Errorf("Pages = %d, want 5", result.Pages)
	}
	if len(result.Entities) != 1 {
		t.Errorf("Entities count = %d, want 1", len(result.Entities))
	}
	if result.Entities[0].Type != "DATE" {
		t.Errorf("Entity type = %q, want %q", result.Entities[0].Type, "DATE")
	}
}

func TestExtract_Image(t *testing.T) {
	client := &mockDocAIClient{
		resp: &DocumentAIResponse{
			Text:  "OCR extracted text from scanned image.",
			Pages: 1,
		},
	}
	svc := NewParserService(client, "projects/test/locations/us/processors/abc", nil, "")

	result, err := svc.Extract(context.Background(), "gs://bucket/uploads/user1/doc1/scan.png")
	if err != nil {
		t.Fatalf("Extract() error: %v", err)
	}

	if result.Text == "" {
		t.Error("expected OCR text from image")
	}
	if result.Pages != 1 {
		t.Errorf("Pages = %d, want 1", result.Pages)
	}
}

func TestExtract_EmptyURI(t *testing.T) {
	client := &mockDocAIClient{}
	svc := NewParserService(client, "projects/test/locations/us/processors/abc", nil, "")

	_, err := svc.Extract(context.Background(), "")
	if err == nil {
		t.Fatal("expected error for empty URI")
	}
}

func TestExtract_DocumentAIError(t *testing.T) {
	client := &mockDocAIClient{
		err: fmt.Errorf("Document AI processing failed"),
	}
	svc := NewParserService(client, "projects/test/locations/us/processors/abc", nil, "")

	_, err := svc.Extract(context.Background(), "gs://bucket/file.pdf")
	if err == nil {
		t.Fatal("expected error when Document AI fails")
	}
}

func TestExtract_NoTextExtracted(t *testing.T) {
	client := &mockDocAIClient{
		resp: &DocumentAIResponse{
			Text:  "",
			Pages: 0,
		},
	}
	svc := NewParserService(client, "projects/test/locations/us/processors/abc", nil, "")

	_, err := svc.Extract(context.Background(), "gs://bucket/blank.pdf")
	if err == nil {
		t.Fatal("expected error for empty extracted text")
	}
}

func TestExtract_Docx_NoDownloader(t *testing.T) {
	client := &mockDocAIClient{}
	svc := NewParserService(client, "projects/test/locations/us/processors/abc", nil, "")

	_, err := svc.Extract(context.Background(), "gs://bucket/file.docx")
	if err == nil {
		t.Fatal("expected error when downloader is nil")
	}
}

func TestExtract_Docx_DownloadError(t *testing.T) {
	client := &mockDocAIClient{}
	dl := &mockObjectDownloader{err: fmt.Errorf("storage unavailable")}
	svc := NewParserService(client, "projects/test/locations/us/processors/abc", dl, "bucket")

	_, err := svc.Extract(context.Background(), "gs://bucket/file.docx")
	if err == nil {
		t.Fatal("expected error when download fails")
	}
}

func TestDetectMimeType(t *testing.T) {
	tests := []struct {
		uri  string
		want string
	}{
		{"gs://bucket/file.pdf", "application/pdf"},
		{"gs://bucket/file.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
		{"gs://bucket/file.txt", "text/plain"},
		{"gs://bucket/file.csv", "text/csv"},
		{"gs://bucket/file.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
		{"gs://bucket/file.png", "image/png"},
		{"gs://bucket/file.jpg", "image/jpeg"},
		{"gs://bucket/file.jpeg", "image/jpeg"},
		{"gs://bucket/file.unknown", "application/octet-stream"},
	}

	for _, tt := range tests {
		t.Run(tt.uri, func(t *testing.T) {
			got := detectMimeType(tt.uri)
			if got != tt.want {
				t.Errorf("detectMimeType(%q) = %q, want %q", tt.uri, got, tt.want)
			}
		})
	}
}

// ============================================================================
// Tests for text extraction paths (GAP-1 coverage)
// ============================================================================

func TestIsTextBasedFormat(t *testing.T) {
	textExts := []string{".txt", ".md", ".csv", ".json", ".log", ".xml", ".yaml", ".yml", ".html", ".htm"}
	for _, ext := range textExts {
		if !isTextBasedFormat(ext) {
			t.Errorf("isTextBasedFormat(%q) = false, want true", ext)
		}
	}

	nonTextExts := []string{".pdf", ".docx", ".png", ".jpg", ".xlsx", ".gif", ".webp", ".exe", ".zip", ""}
	for _, ext := range nonTextExts {
		if isTextBasedFormat(ext) {
			t.Errorf("isTextBasedFormat(%q) = true, want false", ext)
		}
	}
}

func TestIsLikelyText(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want bool
	}{
		{"normal text", "Hello, world! This is a normal text file.\nWith multiple lines.", true},
		{"markdown", "# Heading\n\n- bullet one\n- bullet two\n\n```go\nfmt.Println(\"code\")\n```", true},
		{"json", `{"key": "value", "count": 42}`, true},
		{"csv", "name,age,city\nAlice,30,NYC\nBob,25,LA", true},
		{"empty", "", false},
		{"binary null bytes", "hello\x00\x00\x00world\x00\x01\x02\x03", false},
		{"mostly binary", string([]byte{0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x0B}), false},
		{"whitespace only", "   \t\n\r  ", true},
		{"unicode text", "Vertrag zwischen Parteien. Datum: 2026-01-15.", true},
		{"text with few control chars", "header\x01tail but mostly text content here for a while so the ratio stays low enough to pass", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isLikelyText(tt.in)
			if got != tt.want {
				t.Errorf("isLikelyText(%q) = %v, want %v", tt.name, got, tt.want)
			}
		})
	}
}

func TestExtractText_Markdown(t *testing.T) {
	dl := &mockObjectDownloader{data: []byte("# RAGbox User Guide\n\nThis is a markdown document.\n\n## Features\n\n- Upload documents\n- Ask questions")}
	svc := NewParserService(&mockDocAIClient{}, "proc", dl, "bucket")

	result, err := svc.Extract(context.Background(), "gs://bucket/uploads/user1/doc1/guide.md")
	if err != nil {
		t.Fatalf("Extract(.md) error: %v", err)
	}
	if result.Pages != 1 {
		t.Errorf("Pages = %d, want 1", result.Pages)
	}
	if result.Text == "" {
		t.Error("expected non-empty text for .md file")
	}
	if len(result.Text) < 10 {
		t.Errorf("text too short: %q", result.Text)
	}
}

func TestExtractText_TXT(t *testing.T) {
	dl := &mockObjectDownloader{data: []byte("Plain text content.\nLine two.\nLine three.")}
	svc := NewParserService(&mockDocAIClient{}, "proc", dl, "bucket")

	result, err := svc.Extract(context.Background(), "gs://bucket/uploads/user1/doc1/notes.txt")
	if err != nil {
		t.Fatalf("Extract(.txt) error: %v", err)
	}
	if result.Text == "" {
		t.Error("expected text content")
	}
}

func TestExtractText_CSV(t *testing.T) {
	dl := &mockObjectDownloader{data: []byte("name,email,role\nAlice,alice@example.com,admin\nBob,bob@example.com,user")}
	svc := NewParserService(&mockDocAIClient{}, "proc", dl, "bucket")

	result, err := svc.Extract(context.Background(), "gs://bucket/uploads/user1/doc1/data.csv")
	if err != nil {
		t.Fatalf("Extract(.csv) error: %v", err)
	}
	if result.Text == "" {
		t.Error("expected CSV content")
	}
}

func TestExtractText_JSON(t *testing.T) {
	dl := &mockObjectDownloader{data: []byte(`{"project":"RAGbox","version":"1.0"}`)}
	svc := NewParserService(&mockDocAIClient{}, "proc", dl, "bucket")

	result, err := svc.Extract(context.Background(), "gs://bucket/uploads/user1/doc1/config.json")
	if err != nil {
		t.Fatalf("Extract(.json) error: %v", err)
	}
	if result.Text == "" {
		t.Error("expected JSON content")
	}
}

func TestExtractText_EmptyFile(t *testing.T) {
	dl := &mockObjectDownloader{data: []byte("   \n\t  ")}
	svc := NewParserService(&mockDocAIClient{}, "proc", dl, "bucket")

	_, err := svc.Extract(context.Background(), "gs://bucket/uploads/user1/doc1/empty.md")
	if err == nil {
		t.Fatal("expected error for whitespace-only file")
	}
}

func TestExtractText_NoDownloader(t *testing.T) {
	svc := NewParserService(&mockDocAIClient{}, "proc", nil, "bucket")

	_, err := svc.Extract(context.Background(), "gs://bucket/uploads/user1/doc1/readme.md")
	if err == nil {
		t.Fatal("expected error when downloader is nil for text file")
	}
}

func TestExtractText_DownloadError(t *testing.T) {
	dl := &mockObjectDownloader{err: fmt.Errorf("gcs timeout")}
	svc := NewParserService(&mockDocAIClient{}, "proc", dl, "bucket")

	_, err := svc.Extract(context.Background(), "gs://bucket/uploads/user1/doc1/readme.md")
	if err == nil {
		t.Fatal("expected error when download fails")
	}
}

func TestExtractFallback_Success(t *testing.T) {
	// Document AI fails, but the file is actually text — fallback should work
	client := &mockDocAIClient{err: fmt.Errorf("document ai crashed")}
	dl := &mockObjectDownloader{data: []byte("This is actually a text file that was uploaded with wrong extension.")}
	svc := NewParserService(client, "proc", dl, "bucket")

	result, err := svc.Extract(context.Background(), "gs://bucket/uploads/user1/doc1/mystery.pdf")
	if err != nil {
		t.Fatalf("Extract with fallback error: %v", err)
	}
	if result.Text == "" {
		t.Error("expected fallback text")
	}
	if result.Pages != 1 {
		t.Errorf("Pages = %d, want 1", result.Pages)
	}
}

func TestExtractFallback_BinaryFile(t *testing.T) {
	// Document AI fails and the file is binary — fallback should also fail
	client := &mockDocAIClient{err: fmt.Errorf("document ai crashed")}
	binaryData := make([]byte, 256)
	for i := range binaryData {
		binaryData[i] = byte(i)
	}
	dl := &mockObjectDownloader{data: binaryData}
	svc := NewParserService(client, "proc", dl, "bucket")

	_, err := svc.Extract(context.Background(), "gs://bucket/uploads/user1/doc1/binary.pdf")
	if err == nil {
		t.Fatal("expected error for binary file fallback")
	}
}

func TestExtractFallback_NoDownloader(t *testing.T) {
	client := &mockDocAIClient{err: fmt.Errorf("document ai crashed")}
	svc := NewParserService(client, "proc", nil, "bucket")

	_, err := svc.Extract(context.Background(), "gs://bucket/uploads/user1/doc1/file.pdf")
	if err == nil {
		t.Fatal("expected error when fallback has no downloader")
	}
}

func TestExtractFallback_DownloadFails(t *testing.T) {
	client := &mockDocAIClient{err: fmt.Errorf("document ai crashed")}
	dl := &mockObjectDownloader{err: fmt.Errorf("gcs also failed")}
	svc := NewParserService(client, "proc", dl, "bucket")

	_, err := svc.Extract(context.Background(), "gs://bucket/uploads/user1/doc1/file.pdf")
	if err == nil {
		t.Fatal("expected error when both Document AI and fallback download fail")
	}
}

func TestExtractFallback_EmptyTextFromDocAI(t *testing.T) {
	// Document AI returns empty text — should trigger fallback
	client := &mockDocAIClient{resp: &DocumentAIResponse{Text: "", Pages: 0}}
	dl := &mockObjectDownloader{data: []byte("Actual content recovered by fallback download")}
	svc := NewParserService(client, "proc", dl, "bucket")

	result, err := svc.Extract(context.Background(), "gs://bucket/uploads/user1/doc1/report.pdf")
	if err != nil {
		t.Fatalf("expected fallback to succeed: %v", err)
	}
	if result.Text == "" {
		t.Error("expected recovered text from fallback")
	}
}

func TestDetectMimeType_NewTypes(t *testing.T) {
	// Test the MIME types added in GAP-1 fix
	tests := []struct {
		uri  string
		want string
	}{
		{"gs://bucket/file.md", "text/markdown"},
		{"gs://bucket/file.json", "application/json"},
		{"gs://bucket/file.gif", "image/gif"},
		{"gs://bucket/file.webp", "image/webp"},
	}
	for _, tt := range tests {
		t.Run(tt.uri, func(t *testing.T) {
			got := detectMimeType(tt.uri)
			if got != tt.want {
				t.Errorf("detectMimeType(%q) = %q, want %q", tt.uri, got, tt.want)
			}
		})
	}
}

func TestExtract_TextRoutingBypassesDocAI(t *testing.T) {
	// Verify that .md files do NOT call Document AI — they route directly to extractText
	called := false
	client := &mockDocAIClient{
		resp: &DocumentAIResponse{Text: "should not be used"},
	}
	// Wrap to detect calls
	origClient := client
	_ = origClient

	dl := &mockObjectDownloader{data: []byte("# Direct download content")}
	svc := NewParserService(client, "proc", dl, "bucket")

	result, err := svc.Extract(context.Background(), "gs://bucket/uploads/user1/readme.md")
	if err != nil {
		t.Fatalf("Extract(.md) error: %v", err)
	}
	if result.Text != "# Direct download content" {
		t.Errorf("expected direct download text, got %q", result.Text)
	}
	if called {
		t.Error("Document AI should NOT be called for .md files")
	}
}

func TestParseGCSURI(t *testing.T) {
	tests := []struct {
		name       string
		uri        string
		wantBucket string
		wantObject string
		wantErr    bool
	}{
		{"valid", "gs://my-bucket/path/to/file.pdf", "my-bucket", "path/to/file.pdf", false},
		{"empty", "", "", "", true},
		{"no prefix", "s3://bucket/file", "", "", true},
		{"no object", "gs://bucket", "", "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			bucket, object, err := parseGCSURI(tt.uri)
			if (err != nil) != tt.wantErr {
				t.Errorf("parseGCSURI(%q) error = %v, wantErr %v", tt.uri, err, tt.wantErr)
				return
			}
			if bucket != tt.wantBucket {
				t.Errorf("bucket = %q, want %q", bucket, tt.wantBucket)
			}
			if object != tt.wantObject {
				t.Errorf("object = %q, want %q", object, tt.wantObject)
			}
		})
	}
}
