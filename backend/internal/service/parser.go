package service

import (
	"context"
	"fmt"
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

// ParserService extracts text from documents via Document AI.
type ParserService struct {
	client    DocumentAIClient
	processor string // projects/{project}/locations/{loc}/processors/{id}
}

// NewParserService creates a ParserService.
func NewParserService(client DocumentAIClient, processor string) *ParserService {
	return &ParserService{
		client:    client,
		processor: processor,
	}
}

// Extract processes a document stored in GCS and returns extracted text, page count, and entities.
func (s *ParserService) Extract(ctx context.Context, gcsURI string) (*ParseResult, error) {
	if gcsURI == "" {
		return nil, fmt.Errorf("service.Extract: gcsURI is empty")
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
