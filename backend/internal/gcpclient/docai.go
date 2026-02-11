package gcpclient

import (
	"context"
	"fmt"
	"log"

	documentai "cloud.google.com/go/documentai/apiv1"
	"cloud.google.com/go/documentai/apiv1/documentaipb"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"

	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// DocumentAIAdapter implements service.DocumentAIClient using the Document AI API.
type DocumentAIAdapter struct {
	client   *documentai.DocumentProcessorClient
	project  string
	location string
}

// NewDocumentAIAdapter creates a new Document AI client.
// location is typically "us" or "eu" for Document AI (multi-region).
func NewDocumentAIAdapter(ctx context.Context, project, location string) (*DocumentAIAdapter, error) {
	endpoint := fmt.Sprintf("%s-documentai.googleapis.com:443", location)
	client, err := documentai.NewDocumentProcessorClient(ctx, option.WithEndpoint(endpoint))
	if err != nil {
		return nil, fmt.Errorf("gcpclient.NewDocumentAIAdapter: %w", err)
	}

	return &DocumentAIAdapter{
		client:   client,
		project:  project,
		location: location,
	}, nil
}

// ProcessDocument sends a GCS document to Document AI for text extraction.
// processor is the full resource name: projects/{p}/locations/{l}/processors/{id}
func (a *DocumentAIAdapter) ProcessDocument(ctx context.Context, processor string, gcsURI string, mimeType string) (*service.DocumentAIResponse, error) {
	req := &documentaipb.ProcessRequest{
		Name: processor,
		Source: &documentaipb.ProcessRequest_GcsDocument{
			GcsDocument: &documentaipb.GcsDocument{
				GcsUri:   gcsURI,
				MimeType: mimeType,
			},
		},
	}

	resp, err := a.client.ProcessDocument(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("gcpclient.ProcessDocument: %w", err)
	}

	if resp.Document == nil {
		return nil, fmt.Errorf("gcpclient.ProcessDocument: nil document in response")
	}

	pageCount := len(resp.Document.Pages)
	log.Printf("Document AI extracted %d pages, %d chars", pageCount, len(resp.Document.Text))

	// Extract entities if present
	var entities []service.Entity
	for _, entity := range resp.Document.Entities {
		entities = append(entities, service.Entity{
			Type:       entity.Type,
			Content:    entity.MentionText,
			Confidence: float64(entity.Confidence),
		})
	}

	return &service.DocumentAIResponse{
		Text:     resp.Document.Text,
		Pages:    pageCount,
		Entities: entities,
	}, nil
}

// HealthCheck verifies the Document AI connection by listing processors.
func (a *DocumentAIAdapter) HealthCheck(ctx context.Context) error {
	parent := fmt.Sprintf("projects/%s/locations/%s", a.project, a.location)
	req := &documentaipb.ListProcessorsRequest{
		Parent: parent,
	}

	iter := a.client.ListProcessors(ctx, req)
	_, err := iter.Next()
	if err != nil && err != iterator.Done {
		return fmt.Errorf("gcpclient.DocumentAI.HealthCheck: %w", err)
	}

	log.Printf("Document AI health check passed (project: %s, location: %s)", a.project, a.location)
	return nil
}

// Close releases the underlying gRPC connection.
func (a *DocumentAIAdapter) Close() {
	a.client.Close()
}
