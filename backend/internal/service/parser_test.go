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
	svc := NewParserService(client, "projects/test/locations/us/processors/abc")

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
	svc := NewParserService(client, "projects/test/locations/us/processors/abc")

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
	svc := NewParserService(client, "projects/test/locations/us/processors/abc")

	_, err := svc.Extract(context.Background(), "")
	if err == nil {
		t.Fatal("expected error for empty URI")
	}
}

func TestExtract_DocumentAIError(t *testing.T) {
	client := &mockDocAIClient{
		err: fmt.Errorf("Document AI processing failed"),
	}
	svc := NewParserService(client, "projects/test/locations/us/processors/abc")

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
	svc := NewParserService(client, "projects/test/locations/us/processors/abc")

	_, err := svc.Extract(context.Background(), "gs://bucket/blank.pdf")
	if err == nil {
		t.Fatal("expected error for empty extracted text")
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
