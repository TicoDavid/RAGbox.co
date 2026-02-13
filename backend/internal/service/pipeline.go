package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// Parser abstracts document text extraction.
type Parser interface {
	Extract(ctx context.Context, gcsURI string) (*ParseResult, error)
}

// Redactor abstracts PII/PHI scanning.
type Redactor interface {
	Scan(ctx context.Context, text string) (*ScanResult, error)
}

// Chunker abstracts document chunking.
type Chunker interface {
	Chunk(ctx context.Context, text string, docID string) ([]Chunk, error)
}

// Chunk represents a chunked piece of text (used by the pipeline).
type Chunk struct {
	Content      string
	ContentHash  string
	TokenCount   int
	Index        int
	DocumentID   string
	PageNumber   int
	SectionTitle string
}

// Embedder abstracts vector embedding and storage.
type Embedder interface {
	EmbedAndStore(ctx context.Context, chunks []Chunk) error
}

// AuditLogger abstracts audit logging.
type AuditLogger interface {
	Log(ctx context.Context, action, userID, resourceID, resourceType string) error
}

// PipelineService orchestrates the document ingestion pipeline:
// parse → scan PII → store text → chunk → embed → update status.
type PipelineService struct {
	docRepo    DocumentRepository
	parser     Parser
	redactor   Redactor
	chunker    Chunker
	embedder   Embedder
	audit      AuditLogger
	bucketName string
}

// NewPipelineService creates a PipelineService with all required dependencies.
func NewPipelineService(
	docRepo DocumentRepository,
	parser Parser,
	redactor Redactor,
	chunker Chunker,
	embedder Embedder,
	audit AuditLogger,
	bucketName string,
) *PipelineService {
	return &PipelineService{
		docRepo:    docRepo,
		parser:     parser,
		redactor:   redactor,
		chunker:    chunker,
		embedder:   embedder,
		audit:      audit,
		bucketName: bucketName,
	}
}

// ProcessDocument runs the full ingestion pipeline for a document.
// It is designed to be called asynchronously (via goroutine).
func (s *PipelineService) ProcessDocument(ctx context.Context, docID string) error {
	slog.Info("pipeline starting", "document_id", docID)

	doc, err := s.docRepo.GetByID(ctx, docID)
	if err != nil {
		slog.Error("pipeline failed to get document", "document_id", docID, "error", err)
		return fmt.Errorf("pipeline.ProcessDocument: get document: %w", err)
	}
	slog.Info("pipeline processing document", "document_id", docID, "filename", doc.Filename, "mime_type", doc.MimeType, "size_bytes", doc.SizeBytes)

	// Mark as processing
	if err := s.docRepo.UpdateStatus(ctx, docID, model.IndexProcessing); err != nil {
		slog.Error("pipeline failed to update status", "document_id", docID, "target_status", "processing", "error", err)
		return fmt.Errorf("pipeline.ProcessDocument: set processing: %w", err)
	}

	// Step 1: Parse — extract text via Document AI
	gcsURI := fmt.Sprintf("gs://%s/%s", s.bucketName, ptrStr(doc.StoragePath))
	slog.Info("pipeline step 1: extracting text", "document_id", docID, "gcs_uri", gcsURI)
	parsed, err := s.parser.Extract(ctx, gcsURI)
	if err != nil {
		slog.Error("pipeline text extraction failed", "document_id", docID, "error", err)
		s.failDocument(ctx, docID, "parse_failed", err)
		return fmt.Errorf("pipeline.ProcessDocument: parse: %w", err)
	}
	slog.Info("pipeline text extracted", "document_id", docID, "chars", len(parsed.Text), "pages", parsed.Pages)

	// Step 2: Scan for PII/PHI
	slog.Info("pipeline step 2: scanning for PII", "document_id", docID)
	scanResult, err := s.redactor.Scan(ctx, parsed.Text)
	if err != nil {
		slog.Warn("pipeline PII scan failed (non-fatal)", "document_id", docID, "error", err)
		// PII scan failure is non-fatal — continue pipeline
	} else if scanResult.FindingCount > 0 {
		slog.Info("pipeline PII findings detected", "document_id", docID, "count", scanResult.FindingCount, "types", scanResult.Types)
	} else {
		slog.Info("pipeline no PII findings", "document_id", docID)
	}

	// Step 3: Store extracted text
	slog.Info("pipeline step 3: storing extracted text", "document_id", docID)
	if err := s.docRepo.UpdateText(ctx, docID, parsed.Text, parsed.Pages); err != nil {
		slog.Error("pipeline failed to store extracted text", "document_id", docID, "error", err)
		s.failDocument(ctx, docID, "store_text_failed", err)
		return fmt.Errorf("pipeline.ProcessDocument: store text: %w", err)
	}

	// Step 3b: Compute and store SHA-256 checksum of extracted text
	hash := sha256.Sum256([]byte(parsed.Text))
	checksum := hex.EncodeToString(hash[:])
	if err := s.docRepo.UpdateChecksum(ctx, docID, checksum); err != nil {
		slog.Warn("pipeline failed to store checksum", "document_id", docID, "error", err)
		// Non-fatal — continue pipeline
	} else {
		slog.Info("pipeline checksum stored", "document_id", docID, "sha256", checksum[:16]+"...")
	}

	// Step 4: Chunk
	slog.Info("pipeline step 4: chunking text", "document_id", docID, "chars", len(parsed.Text))
	chunks, err := s.chunker.Chunk(ctx, parsed.Text, docID)
	if err != nil {
		slog.Error("pipeline chunking failed", "document_id", docID, "error", err)
		s.failDocument(ctx, docID, "chunk_failed", err)
		return fmt.Errorf("pipeline.ProcessDocument: chunk: %w", err)
	}
	slog.Info("pipeline chunks created", "document_id", docID, "chunk_count", len(chunks))

	// Step 5: Embed and store vectors
	slog.Info("pipeline step 5: generating embeddings", "document_id", docID, "chunk_count", len(chunks))
	if err := s.embedder.EmbedAndStore(ctx, chunks); err != nil {
		slog.Error("pipeline embedding failed", "document_id", docID, "error", err)
		s.failDocument(ctx, docID, "embed_failed", err)
		return fmt.Errorf("pipeline.ProcessDocument: embed: %w", err)
	}
	slog.Info("pipeline embeddings stored", "document_id", docID)

	// Step 6: Update status to Indexed
	if err := s.docRepo.UpdateStatus(ctx, docID, model.IndexIndexed); err != nil {
		slog.Error("pipeline failed to update status to indexed", "document_id", docID, "error", err)
		return fmt.Errorf("pipeline.ProcessDocument: set indexed: %w", err)
	}
	if err := s.docRepo.UpdateChunkCount(ctx, docID, len(chunks)); err != nil {
		slog.Warn("pipeline failed to update chunk count", "document_id", docID, "error", err)
		return fmt.Errorf("pipeline.ProcessDocument: update chunk count: %w", err)
	}

	// Step 7: Audit
	if s.audit != nil {
		if err := s.audit.Log(ctx, model.AuditDocumentUpload, doc.UserID, doc.ID, "document"); err != nil {
			slog.Warn("pipeline audit log failed", "document_id", docID, "error", err)
		}
	}

	slog.Info("pipeline completed", "document_id", docID, "chunk_count", len(chunks))
	return nil
}

// failDocument sets the document status to Failed with error details in metadata.
func (s *PipelineService) failDocument(ctx context.Context, docID, stage string, origErr error) {
	_ = s.docRepo.UpdateStatus(ctx, docID, model.IndexFailed)

	details := map[string]string{
		"failed_stage": stage,
		"error":        origErr.Error(),
	}
	detailsJSON, _ := json.Marshal(details)
	_ = s.docRepo.UpdateText(ctx, docID, string(detailsJSON), 0)
}

func ptrStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
