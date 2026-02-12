package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
	"time"
)

// Logging is middleware that logs each request with method, path, status code,
// latency in milliseconds, and a unique request ID.
func Logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		requestID := r.Header.Get("X-Request-ID")
		if requestID == "" {
			requestID = generateRequestID()
		}
		w.Header().Set("X-Request-ID", requestID)

		sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(sw, r)

		latency := time.Since(start)
		slog.Info("http request",
			"request_id", requestID,
			"method", r.Method,
			"path", r.URL.Path,
			"status", sw.status,
			"latency_ms", latency.Milliseconds())
	})
}

type statusWriter struct {
	http.ResponseWriter
	status      int
	wroteHeader bool
}

func (sw *statusWriter) WriteHeader(code int) {
	if !sw.wroteHeader {
		sw.status = code
		sw.wroteHeader = true
	}
	sw.ResponseWriter.WriteHeader(code)
}

func (sw *statusWriter) Write(b []byte) (int, error) {
	if !sw.wroteHeader {
		sw.wroteHeader = true
	}
	return sw.ResponseWriter.Write(b)
}

// Flush implements http.Flusher, delegating to the underlying ResponseWriter.
// Required for SSE streaming (chat endpoint).
func (sw *statusWriter) Flush() {
	if f, ok := sw.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func generateRequestID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}
