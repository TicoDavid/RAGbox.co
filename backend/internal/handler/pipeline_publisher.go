package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"cloud.google.com/go/pubsub"

	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// PipelinePublisher implements Ingester by publishing to Pub/Sub
// instead of running the sync pipeline.
type PipelinePublisher struct {
	topic   *pubsub.Topic
	docRepo service.DocumentRepository
	bucket  string
}

// NewPipelinePublisher creates a new async pipeline trigger.
func NewPipelinePublisher(client *pubsub.Client, docRepo service.DocumentRepository, bucket string) *PipelinePublisher {
	return &PipelinePublisher{
		topic:   client.Topic("doc-extract"),
		docRepo: docRepo,
		bucket:  bucket,
	}
}

// extractMessage matches the extractInput struct in doc-extract-worker.
type extractMessage struct {
	DocumentID string `json:"document_id"`
	TenantID   string `json:"tenant_id"`
	StorageURI string `json:"storage_uri"`
	MimeType   string `json:"mime_type"`
	Filename   string `json:"filename"`
}

// ProcessDocument publishes a message to the doc-extract Pub/Sub topic.
// This triggers the 6-worker async pipeline instead of running sync.
func (p *PipelinePublisher) ProcessDocument(ctx context.Context, docID string) error {
	doc, err := p.docRepo.GetByID(ctx, docID)
	if err != nil {
		return fmt.Errorf("pipeline_publisher: get doc: %w", err)
	}

	// Build GCS URI from stored path fields.
	// Priority: StorageURI (full gs:// URI) > StoragePath (object key) > fallback construction.
	storageURI := ""
	switch {
	case doc.StorageURI != nil && *doc.StorageURI != "":
		storageURI = *doc.StorageURI
	case doc.StoragePath != nil && *doc.StoragePath != "":
		storageURI = fmt.Sprintf("gs://%s/%s", p.bucket, *doc.StoragePath)
	default:
		// Fallback: construct from convention uploads/{userId}/{docId}/{filename}
		storageURI = fmt.Sprintf("gs://%s/uploads/%s/%s/%s", p.bucket, doc.UserID, docID, doc.Filename)
	}

	msg := extractMessage{
		DocumentID: docID,
		TenantID:   doc.UserID,
		StorageURI: storageURI,
		MimeType:   doc.MimeType,
		Filename:   doc.OriginalName,
	}

	data, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("pipeline_publisher: marshal: %w", err)
	}

	result := p.topic.Publish(ctx, &pubsub.Message{Data: data})
	if _, err := result.Get(ctx); err != nil {
		return fmt.Errorf("pipeline_publisher: publish: %w", err)
	}

	slog.Info("pipeline_publisher: published to doc-extract",
		"document_id", docID, "storage_uri", msg.StorageURI)
	return nil
}

// Close flushes the topic buffer.
func (p *PipelinePublisher) Close() {
	p.topic.Stop()
}
