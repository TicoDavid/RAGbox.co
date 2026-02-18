package gcpclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"golang.org/x/oauth2/google"
)

// EmbeddingAdapter calls the Vertex AI text embedding REST API.
// Implements service.EmbeddingClient and service.QueryEmbedder.
type EmbeddingAdapter struct {
	project  string
	location string
	model    string
	client   *http.Client
}

// NewEmbeddingAdapter creates an EmbeddingAdapter using default credentials.
func NewEmbeddingAdapter(ctx context.Context, project, location, model string) (*EmbeddingAdapter, error) {
	client, err := google.DefaultClient(ctx, "https://www.googleapis.com/auth/cloud-platform")
	if err != nil {
		return nil, fmt.Errorf("gcpclient.NewEmbeddingAdapter: %w", err)
	}
	return &EmbeddingAdapter{
		project:  project,
		location: location,
		model:    model,
		client:   client,
	}, nil
}

type embeddingRequest struct {
	Instances []embeddingInstance `json:"instances"`
}

type embeddingInstance struct {
	Content  string `json:"content"`
	TaskType string `json:"task_type"`
}

type embeddingResponse struct {
	Predictions []struct {
		Embeddings struct {
			Values []float32 `json:"values"`
		} `json:"embeddings"`
	} `json:"predictions"`
}

// EmbedTexts generates embeddings for a batch of texts using RETRIEVAL_DOCUMENT task type.
// Use this for document chunks that will be stored and searched against.
func (a *EmbeddingAdapter) EmbedTexts(ctx context.Context, texts []string) ([][]float32, error) {
	return a.embedWithTaskType(ctx, texts, "RETRIEVAL_DOCUMENT")
}

// Embed generates embeddings for a batch of texts using RETRIEVAL_QUERY task type.
// Use this for search queries. Implements service.QueryEmbedder.
func (a *EmbeddingAdapter) Embed(ctx context.Context, texts []string) ([][]float32, error) {
	return a.embedWithTaskType(ctx, texts, "RETRIEVAL_QUERY")
}

// embedWithTaskType is the shared implementation that sends texts to the Vertex AI embedding API
// with the specified task_type. text-embedding-004 produces different vector spaces for
// RETRIEVAL_DOCUMENT vs RETRIEVAL_QUERY, optimized for asymmetric retrieval.
// Retries up to 3 times on 429/RESOURCE_EXHAUSTED with 500→1000→2000ms backoff (4s ceiling).
func (a *EmbeddingAdapter) embedWithTaskType(ctx context.Context, texts []string, taskType string) ([][]float32, error) {
	return withRetry(ctx, "EmbedTexts", func() ([][]float32, error) {
		return a.doEmbed(ctx, texts, taskType)
	})
}

func (a *EmbeddingAdapter) doEmbed(ctx context.Context, texts []string, taskType string) ([][]float32, error) {
	instances := make([]embeddingInstance, len(texts))
	for i, t := range texts {
		instances[i] = embeddingInstance{Content: t, TaskType: taskType}
	}

	reqBody, err := json.Marshal(embeddingRequest{Instances: instances})
	if err != nil {
		return nil, fmt.Errorf("gcpclient.EmbedTexts marshal: %w", err)
	}

	url := a.buildEndpointURL()

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("gcpclient.EmbedTexts request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gcpclient.EmbedTexts call: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("gcpclient.EmbedTexts: status %d: %s", resp.StatusCode, body)
	}

	var embResp embeddingResponse
	if err := json.NewDecoder(resp.Body).Decode(&embResp); err != nil {
		return nil, fmt.Errorf("gcpclient.EmbedTexts decode: %w", err)
	}

	results := make([][]float32, len(embResp.Predictions))
	for i, p := range embResp.Predictions {
		results[i] = p.Embeddings.Values
	}
	return results, nil
}

// buildEndpointURL returns the correct Vertex AI endpoint URL.
// For "global" location, uses the non-regional endpoint.
func (a *EmbeddingAdapter) buildEndpointURL() string {
	if a.location == "global" {
		return fmt.Sprintf(
			"https://aiplatform.googleapis.com/v1/projects/%s/locations/global/publishers/google/models/%s:predict",
			a.project, a.model,
		)
	}
	return fmt.Sprintf(
		"https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/%s:predict",
		a.location, a.project, a.location, a.model,
	)
}

// HealthCheck validates the embedding service connection.
func (a *EmbeddingAdapter) HealthCheck(ctx context.Context) error {
	_, err := a.Embed(ctx, []string{"health check"})
	if err != nil {
		return fmt.Errorf("embedding health check failed: %w", err)
	}
	return nil
}
