package middleware

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// RateLimiterConfig holds configuration for the sliding window rate limiter.
type RateLimiterConfig struct {
	// MaxRequests is the maximum number of requests allowed within the window.
	MaxRequests int
	// Window is the sliding window duration (e.g. 1 minute).
	Window time.Duration
	// CleanupInterval is how often stale entries are purged. Defaults to 5 minutes.
	CleanupInterval time.Duration
}

// userWindow tracks request timestamps for a single user within the sliding window.
type userWindow struct {
	mu         sync.Mutex
	timestamps []time.Time
}

// RateLimiter implements a per-user sliding window rate limiter using only stdlib.
type RateLimiter struct {
	config  RateLimiterConfig
	windows sync.Map // map[string]*userWindow
	nowFunc func() time.Time
	stopCh  chan struct{}
}

// NewRateLimiter creates a new rate limiter and starts a background cleanup goroutine.
func NewRateLimiter(config RateLimiterConfig) *RateLimiter {
	if config.CleanupInterval == 0 {
		config.CleanupInterval = 5 * time.Minute
	}

	rl := &RateLimiter{
		config:  config,
		nowFunc: time.Now,
		stopCh:  make(chan struct{}),
	}

	go rl.cleanup()
	return rl
}

// Stop halts the background cleanup goroutine.
func (rl *RateLimiter) Stop() {
	close(rl.stopCh)
}

// cleanup periodically removes stale user entries whose timestamps have all expired.
func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(rl.config.CleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-rl.stopCh:
			return
		case <-ticker.C:
			now := rl.nowFunc()
			cutoff := now.Add(-rl.config.Window)
			rl.windows.Range(func(key, value interface{}) bool {
				uw := value.(*userWindow)
				uw.mu.Lock()
				// Remove expired timestamps
				uw.timestamps = pruneExpired(uw.timestamps, cutoff)
				empty := len(uw.timestamps) == 0
				uw.mu.Unlock()
				if empty {
					rl.windows.Delete(key)
				}
				return true
			})
		}
	}
}

// Allow checks whether the given key (user ID) is within the rate limit.
// Returns (allowed, retryAfterSeconds).
func (rl *RateLimiter) Allow(key string) (bool, int) {
	now := rl.nowFunc()
	cutoff := now.Add(-rl.config.Window)

	val, _ := rl.windows.LoadOrStore(key, &userWindow{})
	uw := val.(*userWindow)

	uw.mu.Lock()
	defer uw.mu.Unlock()

	// Prune expired timestamps
	uw.timestamps = pruneExpired(uw.timestamps, cutoff)

	if len(uw.timestamps) >= rl.config.MaxRequests {
		// Calculate when the oldest request in the window expires
		oldest := uw.timestamps[0]
		retryAfter := int(oldest.Add(rl.config.Window).Sub(now).Seconds()) + 1
		if retryAfter < 1 {
			retryAfter = 1
		}
		return false, retryAfter
	}

	uw.timestamps = append(uw.timestamps, now)
	return true, 0
}

// pruneExpired removes timestamps that are before the cutoff.
func pruneExpired(timestamps []time.Time, cutoff time.Time) []time.Time {
	idx := 0
	for _, t := range timestamps {
		if !t.Before(cutoff) {
			timestamps[idx] = t
			idx++
		}
	}
	return timestamps[:idx]
}

// RateLimit returns Chi middleware that enforces per-user rate limiting.
// It requires that auth middleware has already set the user ID in context.
// If no user ID is found, the client's remote address is used as fallback.
func RateLimit(rl *RateLimiter) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := UserIDFromContext(r.Context())
			if key == "" {
				key = r.RemoteAddr
			}

			allowed, retryAfter := rl.Allow(key)
			if !allowed {
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("Retry-After", fmt.Sprintf("%d", retryAfter))
				w.WriteHeader(http.StatusTooManyRequests)
				json.NewEncoder(w).Encode(map[string]interface{}{
					"success": false,
					"error":   "rate limit exceeded",
				})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
