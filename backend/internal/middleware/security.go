package middleware

import "net/http"

// SecurityHeaders adds standard security headers to all API responses.
// STORY-S07: Tightened CSP — Go backend is API-only (JSON responses),
// so no scripts/styles/images are needed. "default-src 'none'" is the
// gold standard for pure API servers.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "0") // disabled per OWASP — rely on CSP instead
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		w.Header().Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Permissions-Policy", "microphone=(self), camera=()")
		next.ServeHTTP(w, r)
	})
}
