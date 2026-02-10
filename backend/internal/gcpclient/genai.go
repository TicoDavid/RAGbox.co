package gcpclient

import (
	"context"
	"fmt"
	"strings"

	"cloud.google.com/go/vertexai/genai"
)

// GenAIAdapter wraps the Vertex AI Gemini client to implement service.GenAIClient.
type GenAIAdapter struct {
	client *genai.Client
	model  string
}

// NewGenAIAdapter creates a GenAIAdapter.
func NewGenAIAdapter(ctx context.Context, project, location, model string) (*GenAIAdapter, error) {
	client, err := genai.NewClient(ctx, project, location)
	if err != nil {
		return nil, fmt.Errorf("gcpclient.NewGenAIAdapter: %w", err)
	}
	return &GenAIAdapter{client: client, model: model}, nil
}

// GenerateContent sends a prompt to Gemini and returns the text response.
func (a *GenAIAdapter) GenerateContent(ctx context.Context, systemPrompt string, userPrompt string) (string, error) {
	model := a.client.GenerativeModel(a.model)
	model.SystemInstruction = &genai.Content{
		Parts: []genai.Part{genai.Text(systemPrompt)},
	}

	resp, err := model.GenerateContent(ctx, genai.Text(userPrompt))
	if err != nil {
		return "", fmt.Errorf("gcpclient.GenerateContent: %w", err)
	}

	if len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("gcpclient.GenerateContent: empty response from model")
	}

	var parts []string
	for _, p := range resp.Candidates[0].Content.Parts {
		if t, ok := p.(genai.Text); ok {
			parts = append(parts, string(t))
		}
	}
	return strings.Join(parts, ""), nil
}

// Client returns the underlying genai.Client for shared use (e.g. embedding model).
func (a *GenAIAdapter) Client() *genai.Client {
	return a.client
}

// Close closes the underlying client.
func (a *GenAIAdapter) Close() {
	a.client.Close()
}
