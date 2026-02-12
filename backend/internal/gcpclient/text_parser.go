package gcpclient

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// ObjectDownloader abstracts downloading an object from Cloud Storage.
// StorageAdapter satisfies this interface implicitly.
type ObjectDownloader interface {
	Download(ctx context.Context, bucket, object string) ([]byte, error)
}

// TextParser implements service.Parser by downloading the raw file from GCS
// and returning its content as text. Works well for .txt, .md, .csv files.
// For binary files (PDF, DOCX), the raw bytes are lossy but non-fatal;
// the real Document AI parser should be used for production OCR.
type TextParser struct {
	downloader ObjectDownloader
}

// NewTextParser creates a TextParser backed by the given downloader.
func NewTextParser(dl ObjectDownloader) *TextParser {
	return &TextParser{downloader: dl}
}

// Extract downloads the file from GCS and returns its content as a ParseResult.
func (p *TextParser) Extract(ctx context.Context, gcsURI string) (*service.ParseResult, error) {
	bucket, object, err := parseGCSURI(gcsURI)
	if err != nil {
		return nil, fmt.Errorf("text_parser.Extract: %w", err)
	}

	data, err := p.downloader.Download(ctx, bucket, object)
	if err != nil {
		return nil, fmt.Errorf("text_parser.Extract: download %s/%s: %w", bucket, object, err)
	}

	text := string(data)
	slog.Info("text parser extracted content", "chars", len(text), "bucket", bucket, "object", object)

	return &service.ParseResult{
		Text:  text,
		Pages: 1,
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
