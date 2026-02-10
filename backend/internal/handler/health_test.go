package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

// stubPinger implements DBPinger for testing.
type stubPinger struct {
	err error
}

func (s *stubPinger) Ping(ctx context.Context) error { return s.err }

func TestHealth_OK(t *testing.T) {
	handler := Health(&stubPinger{})

	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}

	var resp map[string]string
	json.Unmarshal(rec.Body.Bytes(), &resp)
	if resp["status"] != "ok" {
		t.Errorf("status = %q, want %q", resp["status"], "ok")
	}
	if resp["database"] != "connected" {
		t.Errorf("database = %q, want %q", resp["database"], "connected")
	}
}

func TestHealth_Degraded(t *testing.T) {
	handler := Health(&stubPinger{err: fmt.Errorf("connection refused")})

	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rec.Code)
	}

	var resp map[string]string
	json.Unmarshal(rec.Body.Bytes(), &resp)
	if resp["status"] != "degraded" {
		t.Errorf("status = %q, want %q", resp["status"], "degraded")
	}
	if resp["database"] != "disconnected" {
		t.Errorf("database = %q, want %q", resp["database"], "disconnected")
	}
}

func TestHealth_NilDB(t *testing.T) {
	handler := Health(nil)

	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
}
