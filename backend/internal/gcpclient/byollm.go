package gcpclient

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// BYOLLMClient implements service.GenAIClient for OpenAI-compatible LLM providers
// (OpenRouter, OpenAI, etc.). It is created per-request and discarded after use.
type BYOLLMClient struct {
	apiKey     string
	baseURL    string
	model      string
	httpClient *http.Client
}

// NewBYOLLMClient creates a BYOLLMClient for an external LLM provider.
// The apiKey is held only for the duration of the request and never logged.
func NewBYOLLMClient(apiKey, baseURL, model string) *BYOLLMClient {
	if baseURL == "" {
		baseURL = "https://openrouter.ai/api/v1"
	}
	// Normalize: strip trailing slash
	baseURL = strings.TrimRight(baseURL, "/")

	return &BYOLLMClient{
		apiKey:  apiKey,
		baseURL: baseURL,
		model:   model,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// openAIRequest is the OpenAI-compatible chat completion request body.
type openAIRequest struct {
	Model       string          `json:"model"`
	Messages    []openAIMessage `json:"messages"`
	MaxTokens   int             `json:"max_tokens"`
	Temperature float64         `json:"temperature"`
	Stream      bool            `json:"stream,omitempty"`
}

type openAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// openAIResponse is the OpenAI-compatible chat completion response.
type openAIResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// openAIStreamChunk is a single SSE chunk from the OpenAI-compatible streaming API.
type openAIStreamChunk struct {
	Choices []struct {
		Delta struct {
			Content string `json:"content"`
		} `json:"delta"`
		FinishReason *string `json:"finish_reason"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// GenerateContent implements service.GenAIClient using the OpenAI chat completions API.
func (c *BYOLLMClient) GenerateContent(ctx context.Context, systemPrompt string, userPrompt string) (string, error) {
	reqBody := openAIRequest{
		Model:       c.model,
		MaxTokens:   4096,
		Temperature: 0.3,
		Messages: []openAIMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("byollm: marshal request: %w", err)
	}

	endpoint := c.baseURL + "/chat/completions"

	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("byollm: create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return "", fmt.Errorf("byollm: request cancelled: %w", ctx.Err())
		}
		if isTimeoutError(err) {
			return "", fmt.Errorf("byollm timeout after 30s")
		}
		return "", fmt.Errorf("byollm: request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("byollm: read response: %w", err)
	}

	switch {
	case resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden:
		return "", fmt.Errorf("byollm auth failed: %d", resp.StatusCode)
	case resp.StatusCode == http.StatusTooManyRequests:
		return "", fmt.Errorf("byollm rate limited")
	case resp.StatusCode >= 500:
		return "", fmt.Errorf("byollm server error: %d", resp.StatusCode)
	case resp.StatusCode != http.StatusOK:
		return "", fmt.Errorf("byollm: unexpected status %d", resp.StatusCode)
	}

	var parsed openAIResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return "", fmt.Errorf("byollm: decode response: %w", err)
	}

	if parsed.Error != nil {
		return "", fmt.Errorf("byollm: API error: %s", parsed.Error.Message)
	}

	if len(parsed.Choices) == 0 || parsed.Choices[0].Message.Content == "" {
		return "", fmt.Errorf("byollm returned empty response")
	}

	return parsed.Choices[0].Message.Content, nil
}

// GenerateContentStream implements service.StreamingGenAIClient using the
// OpenAI-compatible streaming API (stream: true → SSE chunks).
func (c *BYOLLMClient) GenerateContentStream(ctx context.Context, systemPrompt, userPrompt string) (<-chan string, <-chan error) {
	textCh := make(chan string, 64)
	errCh := make(chan error, 1)

	go func() {
		defer close(textCh)
		defer close(errCh)

		reqBody := openAIRequest{
			Model:       c.model,
			MaxTokens:   4096,
			Temperature: 0.3,
			Stream:      true,
			Messages: []openAIMessage{
				{Role: "system", Content: systemPrompt},
				{Role: "user", Content: userPrompt},
			},
		}

		bodyBytes, err := json.Marshal(reqBody)
		if err != nil {
			errCh <- fmt.Errorf("byollm stream: marshal request: %w", err)
			return
		}

		endpoint := c.baseURL + "/chat/completions"

		req, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewReader(bodyBytes))
		if err != nil {
			errCh <- fmt.Errorf("byollm stream: create request: %w", err)
			return
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+c.apiKey)

		// Use a separate client without the global timeout — streaming responses
		// can legitimately take longer than 30s. Context cancellation still works.
		streamHTTP := &http.Client{Timeout: 0}
		resp, err := streamHTTP.Do(req)
		if err != nil {
			if ctx.Err() != nil {
				errCh <- fmt.Errorf("byollm stream: request cancelled: %w", ctx.Err())
				return
			}
			errCh <- fmt.Errorf("byollm stream: request failed: %w", err)
			return
		}
		defer resp.Body.Close()

		switch {
		case resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden:
			errCh <- fmt.Errorf("byollm auth failed: %d", resp.StatusCode)
			return
		case resp.StatusCode == http.StatusTooManyRequests:
			errCh <- fmt.Errorf("byollm rate limited")
			return
		case resp.StatusCode >= 500:
			errCh <- fmt.Errorf("byollm server error: %d", resp.StatusCode)
			return
		case resp.StatusCode != http.StatusOK:
			errCh <- fmt.Errorf("byollm stream: unexpected status %d", resp.StatusCode)
			return
		}

		scanner := bufio.NewScanner(resp.Body)
		for scanner.Scan() {
			if ctx.Err() != nil {
				errCh <- fmt.Errorf("byollm stream: context cancelled: %w", ctx.Err())
				return
			}

			line := scanner.Text()
			if !strings.HasPrefix(line, "data: ") {
				continue
			}
			data := strings.TrimPrefix(line, "data: ")
			if data == "[DONE]" {
				break
			}

			var chunk openAIStreamChunk
			if err := json.Unmarshal([]byte(data), &chunk); err != nil {
				continue // skip malformed chunks
			}

			if chunk.Error != nil {
				errCh <- fmt.Errorf("byollm stream: API error: %s", chunk.Error.Message)
				return
			}

			if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Content != "" {
				textCh <- chunk.Choices[0].Delta.Content
			}
		}

		if err := scanner.Err(); err != nil {
			errCh <- fmt.Errorf("byollm stream: read error: %w", err)
		}
	}()

	return textCh, errCh
}

// isTimeoutError checks if an error is a timeout (net.Error with Timeout()).
func isTimeoutError(err error) bool {
	type timeoutErr interface {
		Timeout() bool
	}
	if te, ok := err.(timeoutErr); ok {
		return te.Timeout()
	}
	return strings.Contains(err.Error(), "timeout")
}
