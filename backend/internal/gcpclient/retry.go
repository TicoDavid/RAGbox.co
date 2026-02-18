package gcpclient

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

// ErrRateLimited is returned when all retries are exhausted on a 429 response.
var ErrRateLimited = fmt.Errorf("the system is experiencing high demand. Please try again in a few seconds")

// retryConfig holds the backoff schedule for Vertex AI 429 mitigation.
var retryConfig = struct {
	delays  []time.Duration
	ceiling time.Duration
}{
	delays:  []time.Duration{500 * time.Millisecond, 1000 * time.Millisecond, 2000 * time.Millisecond},
	ceiling: 4 * time.Second,
}

// isRetryableError checks if an error is a Vertex AI 429 rate-limit error.
// Works for both SDK errors (which embed status codes in the message) and REST responses.
func isRetryableError(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "429") ||
		strings.Contains(msg, "RESOURCE_EXHAUSTED") ||
		strings.Contains(msg, "quota") ||
		strings.Contains(msg, "rate limit")
}

// isRetryableStatus checks if an HTTP status code warrants a retry.
func isRetryableStatus(code int) bool {
	return code == http.StatusTooManyRequests || code == http.StatusServiceUnavailable
}

// withRetry executes fn up to len(retryConfig.delays)+1 times, retrying on 429/rate-limit errors.
// Backoff: 500ms → 1000ms → 2000ms, capped at 4s ceiling.
func withRetry[T any](ctx context.Context, operation string, fn func() (T, error)) (T, error) {
	result, err := fn()
	if err == nil {
		return result, nil
	}

	if !isRetryableError(err) {
		return result, err
	}

	for i, delay := range retryConfig.delays {
		if delay > retryConfig.ceiling {
			delay = retryConfig.ceiling
		}

		slog.Warn("vertex AI rate limited, retrying",
			"operation", operation,
			"attempt", i+2,
			"delay_ms", delay.Milliseconds(),
			"error", err.Error(),
		)

		select {
		case <-ctx.Done():
			var zero T
			return zero, fmt.Errorf("%s: context cancelled during retry: %w", operation, ctx.Err())
		case <-time.After(delay):
		}

		result, err = fn()
		if err == nil {
			slog.Info("vertex AI retry succeeded", "operation", operation, "attempt", i+2)
			return result, nil
		}

		if !isRetryableError(err) {
			return result, err
		}
	}

	var zero T
	slog.Error("vertex AI retries exhausted", "operation", operation, "attempts", len(retryConfig.delays)+1)
	return zero, ErrRateLimited
}
