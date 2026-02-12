package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

// newTestRateLimiter creates a RateLimiter suitable for testing (no background cleanup).
func newTestRateLimiter(maxRequests int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		config: RateLimiterConfig{
			MaxRequests:     maxRequests,
			Window:          window,
			CleanupInterval: 1 * time.Hour, // won't fire during test
		},
		nowFunc: time.Now,
		stopCh:  make(chan struct{}),
	}
}

func okHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"success":true}`))
	})
}

func TestRateLimit_UnderLimit(t *testing.T) {
	rl := newTestRateLimiter(5, 1*time.Minute)
	defer rl.Stop()
	handler := RateLimit(rl)(okHandler())

	for i := 0; i < 5; i++ {
		req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
		req = req.WithContext(WithUserID(req.Context(), "user-1"))
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("request %d: status = %d, want %d", i+1, rec.Code, http.StatusOK)
		}
	}
}

func TestRateLimit_OverLimit(t *testing.T) {
	rl := newTestRateLimiter(3, 1*time.Minute)
	defer rl.Stop()
	handler := RateLimit(rl)(okHandler())

	// Make 3 allowed requests
	for i := 0; i < 3; i++ {
		req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
		req = req.WithContext(WithUserID(req.Context(), "user-1"))
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("request %d: status = %d, want %d", i+1, rec.Code, http.StatusOK)
		}
	}

	// 4th request should be rate limited
	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req = req.WithContext(WithUserID(req.Context(), "user-1"))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusTooManyRequests {
		t.Errorf("4th request: status = %d, want %d", rec.Code, http.StatusTooManyRequests)
	}

	// Verify response body
	var body map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to parse response body: %v", err)
	}
	if body["success"] != false {
		t.Error("expected success=false")
	}
	if body["error"] != "rate limit exceeded" {
		t.Errorf("error = %q, want %q", body["error"], "rate limit exceeded")
	}

	// Verify Retry-After header is present and non-empty
	retryAfter := rec.Header().Get("Retry-After")
	if retryAfter == "" {
		t.Error("expected Retry-After header")
	}
}

func TestRateLimit_PerUserIsolation(t *testing.T) {
	rl := newTestRateLimiter(2, 1*time.Minute)
	defer rl.Stop()
	handler := RateLimit(rl)(okHandler())

	// User A makes 2 requests (hits limit)
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
		req = req.WithContext(WithUserID(req.Context(), "user-A"))
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Errorf("user-A request %d: status = %d, want %d", i+1, rec.Code, http.StatusOK)
		}
	}

	// User A's 3rd request is rate limited
	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req = req.WithContext(WithUserID(req.Context(), "user-A"))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusTooManyRequests {
		t.Errorf("user-A 3rd request: status = %d, want %d", rec.Code, http.StatusTooManyRequests)
	}

	// User B should still be allowed (isolation)
	req = httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req = req.WithContext(WithUserID(req.Context(), "user-B"))
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("user-B request: status = %d, want %d", rec.Code, http.StatusOK)
	}
}

func TestRateLimit_429ResponseBody(t *testing.T) {
	rl := newTestRateLimiter(1, 1*time.Minute)
	defer rl.Stop()
	handler := RateLimit(rl)(okHandler())

	// First request passes
	req := httptest.NewRequest(http.MethodPost, "/api/chat", nil)
	req = req.WithContext(WithUserID(req.Context(), "user-1"))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("first request: status = %d, want %d", rec.Code, http.StatusOK)
	}

	// Second request is rate limited
	req = httptest.NewRequest(http.MethodPost, "/api/chat", nil)
	req = req.WithContext(WithUserID(req.Context(), "user-1"))
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("second request: status = %d, want %d", rec.Code, http.StatusTooManyRequests)
	}

	// Verify Content-Type
	ct := rec.Header().Get("Content-Type")
	if ct != "application/json" {
		t.Errorf("Content-Type = %q, want %q", ct, "application/json")
	}

	// Verify exact JSON body structure
	var body map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to parse JSON: %v", err)
	}
	if len(body) != 2 {
		t.Errorf("response has %d fields, want 2", len(body))
	}
	if body["success"] != false {
		t.Errorf("success = %v, want false", body["success"])
	}
	if body["error"] != "rate limit exceeded" {
		t.Errorf("error = %q, want %q", body["error"], "rate limit exceeded")
	}

	// Verify Retry-After header
	retryAfter := rec.Header().Get("Retry-After")
	if retryAfter == "" {
		t.Error("missing Retry-After header")
	}
}

func TestRateLimit_WindowExpiry(t *testing.T) {
	// Use a controllable clock
	mu := sync.Mutex{}
	now := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)

	rl := &RateLimiter{
		config: RateLimiterConfig{
			MaxRequests:     2,
			Window:          1 * time.Minute,
			CleanupInterval: 1 * time.Hour,
		},
		nowFunc: func() time.Time {
			mu.Lock()
			defer mu.Unlock()
			return now
		},
		stopCh: make(chan struct{}),
	}
	defer rl.Stop()
	handler := RateLimit(rl)(okHandler())

	// Make 2 requests at t=0
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
		req = req.WithContext(WithUserID(req.Context(), "user-1"))
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("request %d at t=0: status = %d, want %d", i+1, rec.Code, http.StatusOK)
		}
	}

	// 3rd request at t=0 should fail
	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req = req.WithContext(WithUserID(req.Context(), "user-1"))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("3rd request at t=0: status = %d, want %d", rec.Code, http.StatusTooManyRequests)
	}

	// Advance clock past the window
	mu.Lock()
	now = now.Add(61 * time.Second)
	mu.Unlock()

	// Request should now succeed (old timestamps expired)
	req = httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req = req.WithContext(WithUserID(req.Context(), "user-1"))
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("request after window expiry: status = %d, want %d", rec.Code, http.StatusOK)
	}
}

func TestRateLimit_FallbackToRemoteAddr(t *testing.T) {
	rl := newTestRateLimiter(1, 1*time.Minute)
	defer rl.Stop()
	handler := RateLimit(rl)(okHandler())

	// No user ID in context — should use RemoteAddr as key
	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.RemoteAddr = "192.168.1.100:12345"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("first request: status = %d, want %d", rec.Code, http.StatusOK)
	}

	// Second request from same IP should be rate limited
	req = httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.RemoteAddr = "192.168.1.100:12345"
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusTooManyRequests {
		t.Errorf("second request same IP: status = %d, want %d", rec.Code, http.StatusTooManyRequests)
	}

	// Different IP should still be allowed
	req = httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.RemoteAddr = "10.0.0.1:54321"
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("request from different IP: status = %d, want %d", rec.Code, http.StatusOK)
	}
}

func TestRateLimiter_Allow(t *testing.T) {
	rl := newTestRateLimiter(3, 1*time.Minute)
	defer rl.Stop()

	for i := 0; i < 3; i++ {
		allowed, _ := rl.Allow("key1")
		if !allowed {
			t.Errorf("request %d should be allowed", i+1)
		}
	}

	allowed, retryAfter := rl.Allow("key1")
	if allowed {
		t.Error("4th request should be denied")
	}
	if retryAfter < 1 {
		t.Errorf("retryAfter = %d, want >= 1", retryAfter)
	}
}

func TestRateLimiter_Cleanup(t *testing.T) {
	mu := sync.Mutex{}
	now := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)

	rl := &RateLimiter{
		config: RateLimiterConfig{
			MaxRequests:     2,
			Window:          1 * time.Minute,
			CleanupInterval: 100 * time.Millisecond,
		},
		nowFunc: func() time.Time {
			mu.Lock()
			defer mu.Unlock()
			return now
		},
		stopCh: make(chan struct{}),
	}

	// Add some entries
	rl.Allow("user-stale")
	rl.Allow("user-stale")

	// Verify entry exists
	if _, ok := rl.windows.Load("user-stale"); !ok {
		t.Fatal("expected user-stale to exist")
	}

	// Advance clock past window and start cleanup
	mu.Lock()
	now = now.Add(2 * time.Minute)
	mu.Unlock()

	go rl.cleanup()
	// Give cleanup goroutine time to run
	time.Sleep(300 * time.Millisecond)
	rl.Stop()

	// Entry should be cleaned up
	if _, ok := rl.windows.Load("user-stale"); ok {
		t.Error("expected user-stale to be cleaned up")
	}
}

func TestPruneExpired(t *testing.T) {
	now := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	cutoff := now.Add(-1 * time.Minute)

	timestamps := []time.Time{
		now.Add(-2 * time.Minute), // expired
		now.Add(-90 * time.Second), // expired
		now.Add(-30 * time.Second), // still valid
		now,                        // still valid
	}

	result := pruneExpired(timestamps, cutoff)
	if len(result) != 2 {
		t.Errorf("pruneExpired returned %d entries, want 2", len(result))
	}
}
