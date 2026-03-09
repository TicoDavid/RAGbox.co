// doc-extract-worker — EPIC-034 E34-006
// Downloads file from GCS, extracts text via ParserService, publishes to doc-chunk topic.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"

	"cloud.google.com/go/pubsub"

	"github.com/connexus-ai/ragbox-backend/internal/gcpclient"
	"github.com/connexus-ai/ragbox-backend/internal/service"
	"github.com/connexus-ai/ragbox-backend/internal/worker"
)

type extractInput struct {
	DocumentID string `json:"document_id"`
	TenantID   string `json:"tenant_id"`
	StorageURI string `json:"storage_uri"`
	MimeType   string `json:"mime_type"`
	Filename   string `json:"filename"`
}

type extractOutput struct {
	DocumentID string `json:"document_id"`
	TenantID   string `json:"tenant_id"`
	RawText    string `json:"raw_text"`
	PageCount  int    `json:"page_count"`
	MimeType   string `json:"mime_type"`
	Filename   string `json:"filename"`
}

// textExtractor abstracts document text extraction for testability.
type textExtractor interface {
	Extract(ctx context.Context, gcsURI string) (*service.ParseResult, error)
}

// messagePublisher abstracts Pub/Sub publishing for testability.
type messagePublisher interface {
	Publish(ctx context.Context, data interface{}) error
}

// processExtract handles a single extract message.
func processExtract(ctx context.Context, data []byte, p textExtractor, pub messagePublisher) error {
	var input extractInput
	if err := json.Unmarshal(data, &input); err != nil {
		return fmt.Errorf("unmarshal: %w", err)
	}

	slog.Info("extracting", "document_id", input.DocumentID, "mime_type", input.MimeType)

	result, err := p.Extract(ctx, input.StorageURI)
	if err != nil {
		return fmt.Errorf("extract %s: %w", input.DocumentID, err)
	}

	output := extractOutput{
		DocumentID: input.DocumentID,
		TenantID:   input.TenantID,
		RawText:    result.Text,
		PageCount:  result.Pages,
		MimeType:   input.MimeType,
		Filename:   input.Filename,
	}

	if err := pub.Publish(ctx, output); err != nil {
		return fmt.Errorf("publish %s: %w", input.DocumentID, err)
	}

	slog.Info("extracted", "document_id", input.DocumentID, "pages", result.Pages, "text_len", len(result.Text))
	return nil
}

func main() {
	ctx := context.Background()
	project := os.Getenv("GOOGLE_CLOUD_PROJECT")
	bucketName := os.Getenv("GCS_BUCKET_NAME")
	processorID := os.Getenv("DOCUMENT_AI_PROCESSOR_ID")
	docAILocation := os.Getenv("DOCUMENT_AI_LOCATION")
	if docAILocation == "" {
		docAILocation = "us"
	}

	// Init GCS
	storageAdapter, err := gcpclient.NewStorageAdapter(ctx)
	if err != nil {
		slog.Error("init storage failed", "error", err)
		os.Exit(1)
	}

	// Init Document AI
	docAI, err := gcpclient.NewDocumentAIAdapter(ctx, project, docAILocation)
	if err != nil {
		slog.Error("init docai failed", "error", err)
		os.Exit(1)
	}

	processorName := fmt.Sprintf("projects/%s/locations/%s/processors/%s", project, docAILocation, processorID)
	parser := service.NewParserService(docAI, processorName, storageAdapter, bucketName)

	// Init Pub/Sub publisher
	psClient, err := pubsub.NewClient(ctx, project)
	if err != nil {
		slog.Error("init pubsub failed", "error", err)
		os.Exit(1)
	}
	defer psClient.Close()
	publisher := worker.NewPublisher(psClient, "doc-chunk")
	defer publisher.Close()

	worker.Run("doc-extract-worker", func(ctx context.Context, data []byte) error {
		return processExtract(ctx, data, parser, publisher)
	})
}
