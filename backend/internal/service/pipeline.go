package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

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
	doc, err := s.docRepo.GetByID(ctx, docID)
	if err != nil {
		return fmt.Errorf("pipeline.ProcessDocument: get document: %w", err)
	}

	// Mark as processing
	if err := s.docRepo.UpdateStatus(ctx, docID, model.IndexProcessing); err != nil {
		return fmt.Errorf("pipeline.ProcessDocument: set processing: %w", err)
	}

	// Step 1: Parse
	gcsURI := fmt.Sprintf("gs://%s/%s", s.bucketName, ptrStr(doc.StoragePath))
	parsed, err := s.parser.Extract(ctx, gcsURI)
	if err != nil {
		s.failDocument(ctx, docID, "parse_failed", err)
		return fmt.Errorf("pipeline.ProcessDocument: parse: %w", err)
	}

	// Step 2: Scan for PII/PHI
	scanResult, err := s.redactor.Scan(ctx, parsed.Text)
	if err != nil {
		log.Printf("pipeline: PII scan failed for doc %s (non-fatal): %v", docID, err)
		// PII scan failure is non-fatal — continue pipeline
	} else if scanResult.FindingCount > 0 {
		log.Printf("pipeline: doc %s has %d PII findings: %v", docID, scanResult.FindingCount, scanResult.Types)
	}

	// Step 3: Store extracted text
	if err := s.docRepo.UpdateText(ctx, docID, parsed.Text, parsed.Pages); err != nil {
		s.failDocument(ctx, docID, "store_text_failed", err)
		return fmt.Errorf("pipeline.ProcessDocument: store text: %w", err)
	}

	// Step 4: Chunk
	chunks, err := s.chunker.Chunk(ctx, parsed.Text, docID)
	if err != nil {
		s.failDocument(ctx, docID, "chunk_failed", err)
		return fmt.Errorf("pipeline.ProcessDocument: chunk: %w", err)
	}

	// Step 5: Embed and store vectors
	if err := s.embedder.EmbedAndStore(ctx, chunks); err != nil {
		s.failDocument(ctx, docID, "embed_failed", err)
		return fmt.Errorf("pipeline.ProcessDocument: embed: %w", err)
	}

	// Step 6: Update status to Indexed
	if err := s.docRepo.UpdateStatus(ctx, docID, model.IndexIndexed); err != nil {
		return fmt.Errorf("pipeline.ProcessDocument: set indexed: %w", err)
	}
	if err := s.docRepo.UpdateChunkCount(ctx, docID, len(chunks)); err != nil {
		return fmt.Errorf("pipeline.ProcessDocument: update chunk count: %w", err)
	}

	// Step 7: Audit
	if s.audit != nil {
		if err := s.audit.Log(ctx, model.AuditDocumentUpload, doc.UserID, doc.ID, "document"); err != nil {
			log.Printf("pipeline: audit log failed for doc %s: %v", docID, err)
		}
	}

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
