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
	log.Printf("[PIPELINE] Starting processing for document %s", docID)

	doc, err := s.docRepo.GetByID(ctx, docID)
	if err != nil {
		log.Printf("[PIPELINE ERROR] Failed to get document %s: %v", docID, err)
		return fmt.Errorf("pipeline.ProcessDocument: get document: %w", err)
	}
	log.Printf("[PIPELINE] Processing document: %s (type: %s, size: %d bytes)", doc.Filename, doc.MimeType, doc.SizeBytes)

	// Mark as processing
	if err := s.docRepo.UpdateStatus(ctx, docID, model.IndexProcessing); err != nil {
		log.Printf("[PIPELINE ERROR] Failed to update status to Processing: %v", err)
		return fmt.Errorf("pipeline.ProcessDocument: set processing: %w", err)
	}

	// Step 1: Parse — extract text via Document AI
	gcsURI := fmt.Sprintf("gs://%s/%s", s.bucketName, ptrStr(doc.StoragePath))
	log.Printf("[PIPELINE] Step 1: Extracting text from %s", gcsURI)
	parsed, err := s.parser.Extract(ctx, gcsURI)
	if err != nil {
		log.Printf("[PIPELINE ERROR] Text extraction failed for doc %s: %v", docID, err)
		s.failDocument(ctx, docID, "parse_failed", err)
		return fmt.Errorf("pipeline.ProcessDocument: parse: %w", err)
	}
	log.Printf("[PIPELINE] Extracted %d characters, %d pages", len(parsed.Text), parsed.Pages)

	// Step 2: Scan for PII/PHI
	log.Printf("[PIPELINE] Step 2: Scanning for PII")
	scanResult, err := s.redactor.Scan(ctx, parsed.Text)
	if err != nil {
		log.Printf("[PIPELINE WARNING] PII scan failed for doc %s (non-fatal): %v", docID, err)
		// PII scan failure is non-fatal — continue pipeline
	} else if scanResult.FindingCount > 0 {
		log.Printf("[PIPELINE] Found %d PII instances (types: %v), continuing without redaction", scanResult.FindingCount, scanResult.Types)
	} else {
		log.Printf("[PIPELINE] No PII findings")
	}

	// Step 3: Store extracted text
	log.Printf("[PIPELINE] Step 3: Storing extracted text")
	if err := s.docRepo.UpdateText(ctx, docID, parsed.Text, parsed.Pages); err != nil {
		log.Printf("[PIPELINE ERROR] Failed to store extracted text: %v", err)
		s.failDocument(ctx, docID, "store_text_failed", err)
		return fmt.Errorf("pipeline.ProcessDocument: store text: %w", err)
	}

	// Step 4: Chunk
	log.Printf("[PIPELINE] Step 4: Chunking text (%d chars)", len(parsed.Text))
	chunks, err := s.chunker.Chunk(ctx, parsed.Text, docID)
	if err != nil {
		log.Printf("[PIPELINE ERROR] Chunking failed for doc %s: %v", docID, err)
		s.failDocument(ctx, docID, "chunk_failed", err)
		return fmt.Errorf("pipeline.ProcessDocument: chunk: %w", err)
	}
	log.Printf("[PIPELINE] Created %d chunks", len(chunks))

	// Step 5: Embed and store vectors
	log.Printf("[PIPELINE] Step 5: Generating embeddings for %d chunks", len(chunks))
	if err := s.embedder.EmbedAndStore(ctx, chunks); err != nil {
		log.Printf("[PIPELINE ERROR] Embedding failed for doc %s: %v", docID, err)
		s.failDocument(ctx, docID, "embed_failed", err)
		return fmt.Errorf("pipeline.ProcessDocument: embed: %w", err)
	}
	log.Printf("[PIPELINE] Embeddings stored successfully")

	// Step 6: Update status to Indexed
	if err := s.docRepo.UpdateStatus(ctx, docID, model.IndexIndexed); err != nil {
		log.Printf("[PIPELINE ERROR] Failed to update status to Indexed: %v", err)
		return fmt.Errorf("pipeline.ProcessDocument: set indexed: %w", err)
	}
	if err := s.docRepo.UpdateChunkCount(ctx, docID, len(chunks)); err != nil {
		log.Printf("[PIPELINE WARNING] Failed to update chunk count: %v", err)
		return fmt.Errorf("pipeline.ProcessDocument: update chunk count: %w", err)
	}

	// Step 7: Audit
	if s.audit != nil {
		if err := s.audit.Log(ctx, model.AuditDocumentUpload, doc.UserID, doc.ID, "document"); err != nil {
			log.Printf("[PIPELINE WARNING] Audit log failed for doc %s: %v", docID, err)
		}
	}

	log.Printf("[PIPELINE] Completed processing for document %s (%d chunks indexed)", docID, len(chunks))
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
