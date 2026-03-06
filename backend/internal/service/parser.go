package service

import (
	"context"
	"fmt"
	"log/slog"
	"path/filepath"
	"strings"
	"unicode/utf8"
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
// Routing: .docx → native ZIP+XML, text-based → direct download, PDF/images → Document AI.
func (s *ParserService) Extract(ctx context.Context, gcsURI string) (*ParseResult, error) {
	if gcsURI == "" {
		return nil, fmt.Errorf("service.Extract: gcsURI is empty")
	}

	ext := strings.ToLower(filepath.Ext(gcsURI))

	// Route .docx files through native extraction (Document AI OCR doesn't support .docx)
	if ext == ".docx" {
		return s.extractDocx(ctx, gcsURI)
	}

	// Route text-based formats through direct GCS download — no Document AI needed.
	// .md, .txt, .csv, .json, etc. are already readable text.
	if isTextBasedFormat(ext) {
		return s.extractText(ctx, gcsURI)
	}

	// Everything else (PDF, images, XLSX) → Document AI with fallback
	mimeType := detectMimeType(gcsURI)

	resp, err := s.client.ProcessDocument(ctx, s.processor, gcsURI, mimeType)
	if err != nil {
		slog.Warn("document ai extraction failed, attempting direct download fallback",
			"gcs_uri", gcsURI, "mime_type", mimeType, "error", err)
		return s.extractFallback(ctx, gcsURI, err)
	}

	if resp.Text == "" {
		slog.Warn("document ai returned empty text, attempting direct download fallback",
			"gcs_uri", gcsURI, "mime_type", mimeType)
		return s.extractFallback(ctx, gcsURI, fmt.Errorf("document ai returned empty text"))
	}

	// Document AI outputs one \n per visual line (PDF column width), with no
	// distinction between line wraps and paragraph breaks.  The semantic chunker
	// splits on \n\n, so without normalisation PDF text collapses into 1-2 giant
	// chunks.  normalizeParagraphs infers paragraph boundaries.
	normalized := normalizeParagraphs(resp.Text)
	slog.Info("document ai text normalized",
		"gcs_uri", gcsURI, "raw_chars", len(resp.Text), "norm_chars", len(normalized),
		"raw_double_nl", strings.Count(resp.Text, "\n\n"),
		"norm_double_nl", strings.Count(normalized, "\n\n"))

	return &ParseResult{
		Text:     normalized,
		Pages:    resp.Pages,
		Entities: resp.Entities,
	}, nil
}

// isTextBasedFormat returns true for file extensions that are plain text
// and should be read directly from GCS rather than sent through Document AI.
func isTextBasedFormat(ext string) bool {
	switch ext {
	case ".txt", ".md", ".csv", ".json", ".log", ".xml", ".yaml", ".yml", ".html", ".htm":
		return true
	}
	return false
}

// extractText downloads a text-based file from GCS and returns its content.
func (s *ParserService) extractText(ctx context.Context, gcsURI string) (*ParseResult, error) {
	if s.downloader == nil {
		return nil, fmt.Errorf("service.Extract: text extraction requires ObjectDownloader (not configured)")
	}

	bucket, object, err := parseGCSURI(gcsURI)
	if err != nil {
		return nil, fmt.Errorf("service.Extract: %w", err)
	}

	slog.Info("extracting text file directly", "gcs_uri", gcsURI)

	data, err := s.downloader.Download(ctx, bucket, object)
	if err != nil {
		return nil, fmt.Errorf("service.Extract: download text file: %w", err)
	}

	text := string(data)
	if strings.TrimSpace(text) == "" {
		return nil, fmt.Errorf("service.Extract: text file is empty")
	}

	slog.Info("text file extracted", "chars", len(text), "gcs_uri", gcsURI)

	return &ParseResult{
		Text:  text,
		Pages: 1,
	}, nil
}

// extractFallback attempts direct GCS download when Document AI fails.
// Only succeeds if the downloaded content is valid UTF-8 text (not binary).
func (s *ParserService) extractFallback(ctx context.Context, gcsURI string, origErr error) (*ParseResult, error) {
	if s.downloader == nil {
		return nil, fmt.Errorf("service.Extract: document ai failed and no fallback available: %w", origErr)
	}

	bucket, object, err := parseGCSURI(gcsURI)
	if err != nil {
		return nil, fmt.Errorf("service.Extract: document ai failed: %w", origErr)
	}

	data, err := s.downloader.Download(ctx, bucket, object)
	if err != nil {
		return nil, fmt.Errorf("service.Extract: document ai failed and fallback download failed: %w", origErr)
	}

	text := string(data)

	// Reject binary content — fallback only works for text-like files
	if !isLikelyText(text) {
		return nil, fmt.Errorf("service.Extract: document ai failed for binary file (fallback cannot parse): %w", origErr)
	}

	slog.Info("fallback text extraction succeeded", "chars", len(text), "gcs_uri", gcsURI)

	return &ParseResult{
		Text:  text,
		Pages: 1,
	}, nil
}

// isLikelyText checks whether content is readable text rather than binary data.
func isLikelyText(s string) bool {
	if len(s) == 0 {
		return false
	}
	// Check a sample of the content
	sample := s
	if len(sample) > 4096 {
		sample = sample[:4096]
	}
	if !utf8.ValidString(sample) {
		return false
	}
	// Count non-printable characters (excluding common whitespace)
	nonPrintable := 0
	total := 0
	for _, r := range sample {
		total++
		if r < 0x20 && r != '\n' && r != '\r' && r != '\t' {
			nonPrintable++
		}
	}
	if total == 0 {
		return false
	}
	return float64(nonPrintable)/float64(total) < 0.05
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

// normalizeParagraphs converts Document AI single-newline text into
// paragraph-separated text that the semantic chunker can split correctly.
//
// Document AI emits one \n per visual line (PDF column width), with no
// distinction between soft line wraps and hard paragraph breaks.
// Heuristic rules:
//  1. Empty lines are preserved as paragraph breaks (\n\n).
//  2. A line that looks like a section header (starts with digit+dot, all-caps
//     short line, or markdown-style #) forces a paragraph break before it.
//  3. A line following a sentence-terminal character (.!?:) where the next
//     line starts with an uppercase letter or digit triggers a paragraph break.
//  4. Otherwise the newline is treated as a soft wrap and replaced with a space.
func normalizeParagraphs(text string) string {
	// If text already has reasonable paragraph breaks, don't touch it.
	if strings.Count(text, "\n\n") >= 3 {
		return text
	}

	lines := strings.Split(text, "\n")
	if len(lines) <= 1 {
		return text
	}

	var buf strings.Builder
	buf.Grow(len(text) + len(lines)) // slightly larger to accommodate extra \n

	for i, line := range lines {
		trimmed := strings.TrimSpace(line)

		// Empty line → paragraph break
		if trimmed == "" {
			buf.WriteString("\n\n")
			continue
		}

		if i > 0 {
			prevTrimmed := strings.TrimSpace(lines[i-1])

			if prevTrimmed == "" {
				// Previous was empty — \n\n already written, just continue
			} else if isLikelySectionHeader(trimmed) {
				buf.WriteString("\n\n")
			} else if endsWithTerminal(prevTrimmed) && startsNewUnit(trimmed) {
				buf.WriteString("\n\n")
			} else {
				buf.WriteByte(' ')
			}
		}

		buf.WriteString(trimmed)
	}

	return strings.TrimSpace(buf.String())
}

// isLikelySectionHeader returns true if a line looks like a section heading.
func isLikelySectionHeader(line string) bool {
	// Numbered sections: "1.", "2.1", "3.2.1 Title", etc.
	if len(line) > 0 && line[0] >= '0' && line[0] <= '9' {
		for j := 1; j < len(line) && j < 8; j++ {
			if line[j] == '.' {
				return true
			}
			if line[j] < '0' || line[j] > '9' {
				break
			}
		}
	}

	// Markdown headers
	if strings.HasPrefix(line, "#") {
		return true
	}

	// Short all-caps lines (titles): "EXECUTIVE SUMMARY", "FINDINGS", etc.
	if len(line) <= 60 && line == strings.ToUpper(line) && strings.ContainsAny(line, "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
		return true
	}

	return false
}

// endsWithTerminal returns true if a line ends with sentence-terminal punctuation.
func endsWithTerminal(line string) bool {
	if line == "" {
		return false
	}
	last := line[len(line)-1]
	return last == '.' || last == '!' || last == '?' || last == ':'
}

// startsNewUnit returns true if a line starts a new semantic unit.
func startsNewUnit(line string) bool {
	if line == "" {
		return false
	}
	r := rune(line[0])
	// Uppercase letter or digit (new sentence / numbered item)
	return (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9')
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
	case ".md":
		return "text/markdown"
	case ".csv":
		return "text/csv"
	case ".json":
		return "application/json"
	case ".xlsx":
		return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	default:
		return "application/octet-stream"
	}
}
