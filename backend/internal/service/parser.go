package service

import (
	"context"
	"fmt"
	"log/slog"
	"path/filepath"
	"strings"
)

// ParseResult holds the extracted text and metadata from a document.
type ParseResult struct {
	Text     string   `json:"text"`
	Pages    int      `json:"pages"`
	Entities []Entity `json:"entities,omitempty"`
}

// Entity represents a detected entity in the document (e.g. date, person, amount).
type Entity struct {
	Type       string  `json:"type"`
	Content    string  `json:"content"`
	Confidence float64 `json:"confidence"`
}

// DocumentAIClient abstracts Document AI operations for testability.
type DocumentAIClient interface {
	ProcessDocument(ctx context.Context, processor string, gcsURI string, mimeType string) (*DocumentAIResponse, error)
}

// DocumentAIResponse is the parsed result from Document AI.
type DocumentAIResponse struct {
	Text     string
	Pages    int
	Entities []Entity
}

// ObjectDownloader abstracts downloading an object from Cloud Storage.
type ObjectDownloader interface {
	Download(ctx context.Context, bucket, object string) ([]byte, error)
}

// ParserService extracts text from documents via Document AI,
// with native extraction for formats that Document AI does not support (e.g. .docx).
type ParserService struct {
	client     DocumentAIClient
	processor  string // projects/{project}/locations/{loc}/processors/{id}
	downloader ObjectDownloader
	bucketName string
}

// NewParserService creates a ParserService.
// downloader and bucketName are optional — if nil, .docx extraction is unavailable.
func NewParserService(client DocumentAIClient, processor string, downloader ObjectDownloader, bucketName string) *ParserService {
	return &ParserService{
		client:     client,
		processor:  processor,
		downloader: downloader,
		bucketName: bucketName,
	}
}

// Extract processes a document stored in GCS and returns extracted text, page count, and entities.
// For .docx files, it uses native ZIP+XML extraction instead of Document AI.
func (s *ParserService) Extract(ctx context.Context, gcsURI string) (*ParseResult, error) {
	if gcsURI == "" {
		return nil, fmt.Errorf("service.Extract: gcsURI is empty")
	}

	ext := strings.ToLower(filepath.Ext(gcsURI))

	// Route .docx files through native extraction (Document AI OCR doesn't support .docx)
	if ext == ".docx" {
		return s.extractDocx(ctx, gcsURI)
	}

	mimeType := detectMimeType(gcsURI)

	resp, err := s.client.ProcessDocument(ctx, s.processor, gcsURI, mimeType)
	if err != nil {
		return nil, fmt.Errorf("service.Extract: process document: %w", err)
	}

	if resp.Text == "" {
		return nil, fmt.Errorf("service.Extract: no text extracted from document")
	}

	return &ParseResult{
		Text:     resp.Text,
		Pages:    resp.Pages,
		Entities: resp.Entities,
	}, nil
}

// extractDocx downloads a .docx from GCS and extracts text natively via ZIP+XML parsing.
func (s *ParserService) extractDocx(ctx context.Context, gcsURI string) (*ParseResult, error) {
	if s.downloader == nil {
		return nil, fmt.Errorf("service.Extract: .docx extraction requires ObjectDownloader (not configured)")
	}

	bucket, object, err := parseGCSURI(gcsURI)
	if err != nil {
		return nil, fmt.Errorf("service.Extract: %w", err)
	}

	slog.Info("extracting docx natively", "gcs_uri", gcsURI)

	data, err := s.downloader.Download(ctx, bucket, object)
	if err != nil {
		return nil, fmt.Errorf("service.Extract: download docx: %w", err)
	}

	text, err := extractDocxText(data)
	if err != nil {
		return nil, fmt.Errorf("service.Extract: parse docx: %w", err)
	}

	slog.Info("docx text extracted", "chars", len(text), "gcs_uri", gcsURI)

	return &ParseResult{
		Text:  text,
		Pages: 1, // docx doesn't have reliable page count without rendering
	}, nil
}

// parseGCSURI splits "gs://bucket/path/to/object" into bucket and object.
func parseGCSURI(uri string) (bucket, object string, err error) {
	if uri == "" {
		return "", "", fmt.Errorf("empty GCS URI")
	}
	if !strings.HasPrefix(uri, "gs://") {
		return "", "", fmt.Errorf("invalid GCS URI %q: must start with gs://", uri)
	}
	trimmed := strings.TrimPrefix(uri, "gs://")
	idx := strings.Index(trimmed, "/")
	if idx < 0 || idx == 0 {
		return "", "", fmt.Errorf("invalid GCS URI %q: missing object path", uri)
	}
	return trimmed[:idx], trimmed[idx+1:], nil
}

// detectMimeType infers the MIME type from a GCS URI's file extension.
func detectMimeType(gcsURI string) string {
	ext := strings.ToLower(filepath.Ext(gcsURI))
	switch ext {
	case ".pdf":
		return "application/pdf"
	case ".docx":
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	case ".txt":
		return "text/plain"
	case ".csv":
		return "text/csv"
	case ".xlsx":
		return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	default:
		return "application/octet-stream"
	}
}
