package gcpclient

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"
)

func TestWithRetry_SuccessOnFirstAttempt(t *testing.T) {
	calls := 0
	result, err := withRetry(context.Background(), "test", func() (string, error) {
		calls++
		return "ok", nil
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != "ok" {
		t.Fatalf("expected 'ok', got %q", result)
	}
	if calls != 1 {
		t.Fatalf("expected 1 call, got %d", calls)
	}
}

func TestWithRetry_NonRetryableError(t *testing.T) {
	calls := 0
	_, err := withRetry(context.Background(), "test", func() (string, error) {
		calls++
		return "", fmt.Errorf("some other error")
	})
	if err == nil {
		t.Fatal("expected error")
	}
	if calls != 1 {
		t.Fatalf("expected 1 call (no retry for non-retryable), got %d", calls)
	}
}

func TestWithRetry_RetryOn429ThenSucceed(t *testing.T) {
	calls := 0
	result, err := withRetry(context.Background(), "test", func() (string, error) {
		calls++
		if calls <= 2 {
			return "", fmt.Errorf("status 429: RESOURCE_EXHAUSTED")
		}
		return "recovered", nil
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != "recovered" {
		t.Fatalf("expected 'recovered', got %q", result)
	}
	if calls != 3 {
		t.Fatalf("expected 3 calls, got %d", calls)
	}
}

func TestWithRetry_ExhaustAllRetries(t *testing.T) {
	calls := 0
	_, err := withRetry(context.Background(), "test", func() (string, error) {
		calls++
		return "", fmt.Errorf("status 429: RESOURCE_EXHAUSTED")
	})
	if !errors.Is(err, ErrRateLimited) {
		t.Fatalf("expected ErrRateLimited, got: %v", err)
	}
	// 1 initial + 3 retries = 4
	if calls != 4 {
		t.Fatalf("expected 4 calls (1 + 3 retries), got %d", calls)
	}
}

func TestWithRetry_ContextCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	calls := 0
	go func() {
		time.Sleep(100 * time.Millisecond)
		cancel()
	}()
	_, err := withRetry(ctx, "test", func() (string, error) {
		calls++
		return "", fmt.Errorf("429 rate limit")
	})
	if err == nil {
		t.Fatal("expected error on cancelled context")
	}
}

func TestIsRetryableError(t *testing.T) {
	tests := []struct {
		err  error
		want bool
	}{
		{nil, false},
		{fmt.Errorf("status 429: too many requests"), true},
		{fmt.Errorf("RESOURCE_EXHAUSTED: quota exceeded"), true},
		{fmt.Errorf("quota limit reached"), true},
		{fmt.Errorf("rate limit exceeded"), true},
		{fmt.Errorf("internal server error"), false},
		{fmt.Errorf("connection refused"), false},
	}
	for _, tt := range tests {
		got := isRetryableError(tt.err)
		if got != tt.want {
			t.Errorf("isRetryableError(%v) = %v, want %v", tt.err, got, tt.want)
		}
	}
}
