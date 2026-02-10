package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/connexus-ai/ragbox-backend/internal/middleware"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// stubForgeGenAI implements service.GenAIClient.
type stubForgeGenAI struct {
	response string
}

func (s *stubForgeGenAI) GenerateContent(ctx context.Context, systemPrompt, userPrompt string) (string, error) {
	return s.response, nil
}

// stubObjectUploader implements service.ObjectUploader.
type stubObjectUploader struct {
	downloadURL string
}

func (s *stubObjectUploader) Upload(ctx context.Context, bucket, object string, data []byte, contentType string) error {
	return nil
}
func (s *stubObjectUploader) SignedDownloadURL(ctx context.Context, bucket, object string, expiry time.Duration) (string, error) {
	return s.downloadURL, nil
}

func TestForgeHandler_Success(t *testing.T) {
	genAI := &stubForgeGenAI{response: "Generated report content"}
	uploader := &stubObjectUploader{downloadURL: "https://example.com/download"}
	forgeSvc := service.NewForgeService(genAI, uploader, "test-bucket")

	handler := ForgeHandler(forgeSvc)

	body, _ := json.Marshal(service.ForgeRequest{
		Template: service.TemplateExecutiveBrief,
		Query:    "Q3 summary",
	})

	req := httptest.NewRequest(http.MethodPost, "/api/forge", bytes.NewReader(body))
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200. body: %s", rec.Code, rec.Body.String())
	}

	var resp envelope
	json.Unmarshal(rec.Body.Bytes(), &resp)
	if !resp.Success {
		t.Error("expected success=true")
	}
}

func TestForgeHandler_Unauthorized(t *testing.T) {
	handler := ForgeHandler(nil)

	req := httptest.NewRequest(http.MethodPost, "/api/forge", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rec.Code)
	}
}

func TestForgeHandler_InvalidBody(t *testing.T) {
	genAI := &stubForgeGenAI{response: "content"}
	uploader := &stubObjectUploader{downloadURL: "url"}
	forgeSvc := service.NewForgeService(genAI, uploader, "bucket")

	handler := ForgeHandler(forgeSvc)

	req := httptest.NewRequest(http.MethodPost, "/api/forge", bytes.NewBufferString("{bad json"))
	req = req.WithContext(middleware.WithUserID(req.Context(), "user-1"))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
}
