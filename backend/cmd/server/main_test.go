package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestGetPort_Default(t *testing.T) {
	os.Unsetenv("PORT")
	if got := getPort(); got != "8080" {
		t.Errorf("getPort() = %q, want %q", got, "8080")
	}
}

func TestGetPort_FromEnv(t *testing.T) {
	t.Setenv("PORT", "3000")
	if got := getPort(); got != "3000" {
		t.Errorf("getPort() = %q, want %q", got, "3000")
	}
}

func TestHealthEndpoint(t *testing.T) {
	router := newRouter()

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusOK)
	}

	contentType := rec.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("Content-Type = %q, want %q", contentType, "application/json")
	}

	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to parse response body: %v", err)
	}

	if body["status"] != "ok" {
		t.Errorf("status = %q, want %q", body["status"], "ok")
	}

	if body["version"] != Version {
		t.Errorf("version = %q, want %q", body["version"], Version)
	}
}

func TestHealthEndpoint_MethodNotAllowed(t *testing.T) {
	router := newRouter()

	req := httptest.NewRequest(http.MethodPost, "/healthz", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusMethodNotAllowed)
	}
}

func TestVersion(t *testing.T) {
	if Version == "" {
		t.Error("Version must not be empty")
	}
}
