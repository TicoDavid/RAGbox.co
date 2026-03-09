// Sarah — EPIC-034 T1: Extract Worker Tests
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// ── Mocks ──────────────────────────────────────────────────────

type mockParser struct {
	result  *service.ParseResult
	err     error
	calledURI string
}

func (m *mockParser) Extract(ctx context.Context, gcsURI string) (*service.ParseResult, error) {
	m.calledURI = gcsURI
	return m.result, m.err
}

type mockPub struct {
	published []interface{}
	err       error
}

func (m *mockPub) Publish(ctx context.Context, data interface{}) error {
	m.published = append(m.published, data)
	return m.err
}

// ── Helpers ────────────────────────────────────────────────────

func makeExtractInput(overrides ...func(*extractInput)) extractInput {
	in := extractInput{
		DocumentID: "doc-001",
		TenantID:   "tenant-001",
		StorageURI: "gs://ragbox-docs/uploads/tenant-001/doc-001/contract.pdf",
		MimeType:   "application/pdf",
		Filename:   "contract.pdf",
	}
	for _, f := range overrides {
		f(&in)
	}
	return in
}

func marshal(t *testing.T, v interface{}) []byte {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	return b
}

// ── Tests ──────────────────────────────────────────────────────

func TestProcessExtract_ProcessesPDF(t *testing.T) {
	parser := &mockParser{
		result: &service.ParseResult{Text: "This is a legal contract...", Pages: 5},
	}
	pub := &mockPub{}

	err := processExtract(context.Background(), marshal(t, makeExtractInput()), parser, pub)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if parser.calledURI != "gs://ragbox-docs/uploads/tenant-001/doc-001/contract.pdf" {
		t.Errorf("parser called with %q, want GCS URI", parser.calledURI)
	}
}

func TestProcessExtract_ProcessesDocx(t *testing.T) {
	parser := &mockParser{
		result: &service.ParseResult{Text: "Word document content", Pages: 1},
	}
	pub := &mockPub{}

	input := makeExtractInput(func(in *extractInput) {
		in.StorageURI = "gs://ragbox-docs/uploads/tenant-001/doc-002/memo.docx"
		in.MimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
		in.Filename = "memo.docx"
	})

	err := processExtract(context.Background(), marshal(t, input), parser, pub)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(pub.published) != 1 {
		t.Fatalf("expected 1 published message, got %d", len(pub.published))
	}
}

func TestProcessExtract_ProcessesPlainText(t *testing.T) {
	parser := &mockParser{
		result: &service.ParseResult{Text: "Plain text file contents", Pages: 1},
	}
	pub := &mockPub{}

	input := makeExtractInput(func(in *extractInput) {
		in.StorageURI = "gs://ragbox-docs/uploads/tenant-001/doc-003/notes.txt"
		in.MimeType = "text/plain"
		in.Filename = "notes.txt"
	})

	err := processExtract(context.Background(), marshal(t, input), parser, pub)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(pub.published) != 1 {
		t.Fatalf("expected 1 published message, got %d", len(pub.published))
	}
}

func TestProcessExtract_PublishesToChunkTopic(t *testing.T) {
	parser := &mockParser{
		result: &service.ParseResult{Text: "Extracted text from PDF.", Pages: 3},
	}
	pub := &mockPub{}
	input := makeExtractInput()

	err := processExtract(context.Background(), marshal(t, input), parser, pub)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(pub.published) != 1 {
		t.Fatalf("expected 1 published message, got %d", len(pub.published))
	}

	output, ok := pub.published[0].(extractOutput)
	if !ok {
		t.Fatalf("published message is not extractOutput, got %T", pub.published[0])
	}
	if output.DocumentID != "doc-001" {
		t.Errorf("output.DocumentID = %q, want %q", output.DocumentID, "doc-001")
	}
	if output.TenantID != "tenant-001" {
		t.Errorf("output.TenantID = %q, want %q", output.TenantID, "tenant-001")
	}
	if output.RawText != "Extracted text from PDF." {
		t.Errorf("output.RawText = %q, want extracted text", output.RawText)
	}
	if output.PageCount != 3 {
		t.Errorf("output.PageCount = %d, want 3", output.PageCount)
	}
	if output.Filename != "contract.pdf" {
		t.Errorf("output.Filename = %q, want %q", output.Filename, "contract.pdf")
	}
}

func TestProcessExtract_DocumentAIFailure_NACK(t *testing.T) {
	parser := &mockParser{
		err: fmt.Errorf("Document AI timeout: deadline exceeded"),
	}
	pub := &mockPub{}

	err := processExtract(context.Background(), marshal(t, makeExtractInput()), parser, pub)
	if err == nil {
		t.Fatal("expected error when parser fails, got nil")
	}
	if len(pub.published) != 0 {
		t.Errorf("should not publish on parser failure, got %d messages", len(pub.published))
	}
}

func TestProcessExtract_InvalidJSON_NoRetry(t *testing.T) {
	parser := &mockParser{
		result: &service.ParseResult{Text: "text", Pages: 1},
	}
	pub := &mockPub{}

	err := processExtract(context.Background(), []byte("{invalid json"), parser, pub)
	if err == nil {
		t.Fatal("expected error for invalid JSON")
	}
	if len(pub.published) != 0 {
		t.Errorf("should not publish on invalid input, got %d messages", len(pub.published))
	}
}

func TestProcessExtract_PublishFailure_NACK(t *testing.T) {
	parser := &mockParser{
		result: &service.ParseResult{Text: "text", Pages: 1},
	}
	pub := &mockPub{err: fmt.Errorf("pubsub: connection refused")}

	err := processExtract(context.Background(), marshal(t, makeExtractInput()), parser, pub)
	if err == nil {
		t.Fatal("expected error when publisher fails")
	}
}
