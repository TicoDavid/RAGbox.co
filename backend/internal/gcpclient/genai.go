package gcpclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"cloud.google.com/go/vertexai/genai"
	"golang.org/x/oauth2/google"
)

// GenAIAdapter wraps the Vertex AI Gemini client to implement service.GenAIClient.
// Supports both regional endpoints (via Go SDK) and the global endpoint (via REST API).
type GenAIAdapter struct {
	client     *genai.Client // nil when using global endpoint
	httpClient *http.Client  // used for global endpoint REST calls
	project    string
	location   string
	model      string
	useREST    bool
}

// NewGenAIAdapter creates a GenAIAdapter.
// For location "global", uses the REST API directly since the deprecated
// vertexai/genai SDK does not support the global endpoint.
func NewGenAIAdapter(ctx context.Context, project, location, model string) (*GenAIAdapter, error) {
	if location == "global" {
		httpClient, err := google.DefaultClient(ctx, "https://www.googleapis.com/auth/cloud-platform")
		if err != nil {
			return nil, fmt.Errorf("gcpclient.NewGenAIAdapter: default credentials: %w", err)
		}
		return &GenAIAdapter{
			httpClient: httpClient,
			project:    project,
			location:   location,
			model:      model,
			useREST:    true,
		}, nil
	}

	client, err := genai.NewClient(ctx, project, location)
	if err != nil {
		return nil, fmt.Errorf("gcpclient.NewGenAIAdapter: %w", err)
	}
	return &GenAIAdapter{
		client:   client,
		project:  project,
		location: location,
		model:    model,
	}, nil
}

// GenerateContent sends a prompt to Gemini and returns the text response.
// Retries up to 3 times on 429/RESOURCE_EXHAUSTED with 500→1000→2000ms backoff (4s ceiling).
func (a *GenAIAdapter) GenerateContent(ctx context.Context, systemPrompt string, userPrompt string) (string, error) {
	return withRetry(ctx, "GenerateContent", func() (string, error) {
		if a.useREST {
			return a.generateContentREST(ctx, systemPrompt, userPrompt)
		}
		return a.generateContentSDK(ctx, systemPrompt, userPrompt)
	})
}

// generateContentSDK uses the Go SDK for regional endpoints.
func (a *GenAIAdapter) generateContentSDK(ctx context.Context, systemPrompt string, userPrompt string) (string, error) {
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

// REST API types for the global endpoint.
type restGenerateRequest struct {
	Contents         []restContent        `json:"contents"`
	SystemInstruction *restContent        `json:"systemInstruction,omitempty"`
	GenerationConfig *restGenerationConfig `json:"generationConfig,omitempty"`
}

type restContent struct {
	Role  string     `json:"role"`
	Parts []restPart `json:"parts"`
}

type restPart struct {
	Text string `json:"text"`
}

type restGenerationConfig struct {
	Temperature     *float64 `json:"temperature,omitempty"`
	MaxOutputTokens *int     `json:"maxOutputTokens,omitempty"`
}

type restGenerateResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text             string `json:"text"`
				ThoughtSignature string `json:"thoughtSignature,omitempty"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
	Error *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// generateContentREST uses the REST API for the global endpoint.
func (a *GenAIAdapter) generateContentREST(ctx context.Context, systemPrompt string, userPrompt string) (string, error) {
	url := fmt.Sprintf(
		"https://aiplatform.googleapis.com/v1/projects/%s/locations/global/publishers/google/models/%s:generateContent",
		a.project, a.model,
	)

	reqBody := restGenerateRequest{
		Contents: []restContent{
			{Role: "user", Parts: []restPart{{Text: userPrompt}}},
		},
	}
	if systemPrompt != "" {
		reqBody.SystemInstruction = &restContent{
			Role:  "user",
			Parts: []restPart{{Text: systemPrompt}},
		}
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("gcpclient.GenerateContent: marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("gcpclient.GenerateContent: request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("gcpclient.GenerateContent: call: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("gcpclient.GenerateContent: read body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("gcpclient.GenerateContent: status %d: %s", resp.StatusCode, respBody)
	}

	var genResp restGenerateResponse
	if err := json.Unmarshal(respBody, &genResp); err != nil {
		return "", fmt.Errorf("gcpclient.GenerateContent: decode: %w", err)
	}

	if genResp.Error != nil {
		return "", fmt.Errorf("gcpclient.GenerateContent: API error %d: %s", genResp.Error.Code, genResp.Error.Message)
	}

	if len(genResp.Candidates) == 0 || len(genResp.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("gcpclient.GenerateContent: empty response from model")
	}

	// Extract text parts, skipping thoughtSignature-only parts
	var parts []string
	for _, p := range genResp.Candidates[0].Content.Parts {
		if p.Text != "" {
			parts = append(parts, p.Text)
		}
	}
	if len(parts) == 0 {
		return "", fmt.Errorf("gcpclient.GenerateContent: no text in response")
	}
	return strings.Join(parts, ""), nil
}

// HealthCheck validates the Vertex AI connection by making a minimal API call.
func (a *GenAIAdapter) HealthCheck(ctx context.Context) error {
	resp, err := a.GenerateContent(ctx, "", "Reply with only: OK")
	if err != nil {
		return fmt.Errorf("vertex AI health check failed (model: %s, location: %s): %w", a.model, a.location, err)
	}
	if resp == "" {
		return fmt.Errorf("vertex AI returned empty response (model: %s)", a.model)
	}
	slog.Info("vertex ai health check passed", "model", a.model, "location", a.location)
	return nil
}

// Close closes the underlying client.
func (a *GenAIAdapter) Close() {
	if a.client != nil {
		a.client.Close()
	}
}
