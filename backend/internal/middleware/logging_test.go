package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestLogging_SetsRequestID(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := Logging(inner)

	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	requestID := rec.Header().Get("X-Request-ID")
	if requestID == "" {
		t.Error("X-Request-ID header should be set")
	}
	if len(requestID) != 16 { // 8 bytes = 16 hex chars
		t.Errorf("X-Request-ID length = %d, want 16", len(requestID))
	}
}

func TestLogging_PreservesExistingRequestID(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := Logging(inner)

	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	req.Header.Set("X-Request-ID", "my-custom-id")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if got := rec.Header().Get("X-Request-ID"); got != "my-custom-id" {
		t.Errorf("X-Request-ID = %q, want %q", got, "my-custom-id")
	}
}

func TestLogging_CapturesStatusCode(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	})
	handler := Logging(inner)

	req := httptest.NewRequest(http.MethodGet, "/missing", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}

func TestStatusWriter_DefaultStatus(t *testing.T) {
	rec := httptest.NewRecorder()
	sw := &statusWriter{ResponseWriter: rec, status: http.StatusOK}

	// Write without explicit WriteHeader
	sw.Write([]byte("hello"))

	if sw.status != http.StatusOK {
		t.Errorf("status = %d, want %d", sw.status, http.StatusOK)
	}
}
