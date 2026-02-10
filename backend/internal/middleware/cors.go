package middleware

import (
	"net/http"
	"strings"
)

// CORS returns middleware that handles Cross-Origin Resource Sharing for the
// specified frontend origin. Only the configured origin is allowed.
func CORS(frontendURL string) func(http.Handler) http.Handler {
	// Normalize: strip trailing slash
	origin := strings.TrimRight(frontendURL, "/")

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			reqOrigin := r.Header.Get("Origin")

			if reqOrigin == origin {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-ID")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Expose-Headers", "X-Request-ID")
				w.Header().Set("Access-Control-Max-Age", "86400")
			}

			// Handle preflight
			if r.Method == http.MethodOptions {
				if reqOrigin == origin {
					w.WriteHeader(http.StatusNoContent)
				} else {
					w.WriteHeader(http.StatusForbidden)
				}
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
