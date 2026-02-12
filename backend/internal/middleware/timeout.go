package middleware

import (
	"net/http"
	"time"
)

// Timeout wraps non-streaming handlers with an http.TimeoutHandler.
// This protects against slow-read attacks on endpoints that don't use SSE.
// SSE endpoints (like /api/chat) should NOT use this middleware.
func Timeout(d time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.TimeoutHandler(next, d, `{"success":false,"error":"request timeout"}`)
	}
}
