package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestTranscribe_NoAPIKey_Returns501(t *testing.T) {
	h := Transcribe(TranscribeDeps{DeepgramAPIKey: ""})

	req := httptest.NewRequest(http.MethodPost, "/api/voice/transcribe", bytes.NewReader([]byte("fake-audio")))
	req.Header.Set("Content-Type", "audio/webm")
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusNotImplemented {
		t.Fatalf("expected 501, got %d", w.Code)
	}

	var resp envelope
	json.NewDecoder(w.Body).Decode(&resp)
	if resp.Success {
		t.Fatal("expected success=false")
	}
	if resp.Error == "" {
		t.Fatal("expected error message")
	}
}

func TestTranscribe_EmptyBody_Returns400(t *testing.T) {
	h := Transcribe(TranscribeDeps{DeepgramAPIKey: "test-key"})

	req := httptest.NewRequest(http.MethodPost, "/api/voice/transcribe", bytes.NewReader([]byte{}))
	req.Header.Set("Content-Type", "audio/webm")
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}

	var resp envelope
	json.NewDecoder(w.Body).Decode(&resp)
	if resp.Error != "empty audio body" {
		t.Fatalf("expected 'empty audio body', got %q", resp.Error)
	}
}
