package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"firebase.google.com/go/v4/auth"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// mockAuthClient implements service.AuthClient for testing.
type mockAuthClient struct {
	uid string
	err error
}

func (m *mockAuthClient) VerifyIDToken(ctx context.Context, idToken string) (*auth.Token, error) {
	if m.err != nil {
		return nil, m.err
	}
	return &auth.Token{UID: m.uid}, nil
}

func newTestHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		uid := UserIDFromContext(r.Context())
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"uid": uid})
	})
}

func TestFirebaseAuth_MissingToken(t *testing.T) {
	authSvc := service.NewAuthService(&mockAuthClient{uid: "user123"})
	handler := FirebaseAuth(authSvc)(newTestHandler())

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}

	var body map[string]interface{}
	json.Unmarshal(rec.Body.Bytes(), &body)
	if body["success"] != false {
		t.Error("expected success=false")
	}
}

func TestFirebaseAuth_InvalidToken(t *testing.T) {
	authSvc := service.NewAuthService(&mockAuthClient{
		err: fmt.Errorf("token is invalid"),
	})
	handler := FirebaseAuth(authSvc)(newTestHandler())

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer bad-token")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestFirebaseAuth_ValidToken(t *testing.T) {
	authSvc := service.NewAuthService(&mockAuthClient{uid: "user-abc-123"})
	handler := FirebaseAuth(authSvc)(newTestHandler())

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusOK)
	}

	var body map[string]string
	json.Unmarshal(rec.Body.Bytes(), &body)
	if body["uid"] != "user-abc-123" {
		t.Errorf("uid = %q, want %q", body["uid"], "user-abc-123")
	}
}

func TestFirebaseAuth_MalformedHeader(t *testing.T) {
	authSvc := service.NewAuthService(&mockAuthClient{uid: "user123"})
	handler := FirebaseAuth(authSvc)(newTestHandler())

	// No "Bearer" prefix
	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "just-a-token")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestUserIDFromContext_Empty(t *testing.T) {
	uid := UserIDFromContext(context.Background())
	if uid != "" {
		t.Errorf("uid = %q, want empty", uid)
	}
}

func TestExtractBearerToken(t *testing.T) {
	tests := []struct {
		header string
		want   string
	}{
		{"", ""},
		{"Bearer abc123", "abc123"},
		{"bearer xyz", "xyz"},
		{"BEARER token", "token"},
		{"Basic dXNlcjpwYXNz", ""},
		{"Bearer", ""},
	}

	for _, tt := range tests {
		r := httptest.NewRequest(http.MethodGet, "/", nil)
		if tt.header != "" {
			r.Header.Set("Authorization", tt.header)
		}
		got := extractBearerToken(r)
		if got != tt.want {
			t.Errorf("extractBearerToken(%q) = %q, want %q", tt.header, got, tt.want)
		}
	}
}
