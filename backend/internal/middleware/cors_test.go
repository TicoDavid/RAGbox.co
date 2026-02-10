package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCORS_AllowedOrigin_Preflight(t *testing.T) {
	handler := CORS("https://ragbox.co")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called on OPTIONS preflight")
	}))

	req := httptest.NewRequest(http.MethodOptions, "/api/documents", nil)
	req.Header.Set("Origin", "https://ragbox.co")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusNoContent)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "https://ragbox.co" {
		t.Errorf("Allow-Origin = %q, want %q", got, "https://ragbox.co")
	}
	if got := rec.Header().Get("Access-Control-Allow-Credentials"); got != "true" {
		t.Errorf("Allow-Credentials = %q, want %q", got, "true")
	}
}

func TestCORS_BlockedOrigin_Preflight(t *testing.T) {
	handler := CORS("https://ragbox.co")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called on OPTIONS preflight")
	}))

	req := httptest.NewRequest(http.MethodOptions, "/api/documents", nil)
	req.Header.Set("Origin", "https://evil.com")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusForbidden)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Allow-Origin = %q, want empty for blocked origin", got)
	}
}

func TestCORS_AllowedOrigin_NormalRequest(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := CORS("https://ragbox.co")(inner)

	req := httptest.NewRequest(http.MethodGet, "/api/documents", nil)
	req.Header.Set("Origin", "https://ragbox.co")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "https://ragbox.co" {
		t.Errorf("Allow-Origin = %q, want %q", got, "https://ragbox.co")
	}
}

func TestCORS_NoOriginHeader(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := CORS("https://ragbox.co")(inner)

	req := httptest.NewRequest(http.MethodGet, "/api/documents", nil)
	// No Origin header
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Allow-Origin = %q, want empty for no-origin request", got)
	}
}

func TestCORS_TrailingSlashNormalized(t *testing.T) {
	handler := CORS("https://ragbox.co/")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.Header.Set("Origin", "https://ragbox.co")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "https://ragbox.co" {
		t.Errorf("Allow-Origin = %q, want %q (trailing slash should be normalized)", got, "https://ragbox.co")
	}
}
