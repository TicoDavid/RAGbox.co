package middleware

import (
	"net/http"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Metrics holds all Prometheus metrics collectors.
type Metrics struct {
	RequestsTotal    *prometheus.CounterVec
	RequestDuration  *prometheus.HistogramVec
	ErrorsTotal      *prometheus.CounterVec
	SilenceTriggers  prometheus.Counter
	ActiveRequests   prometheus.Gauge
}

// NewMetrics creates and registers Prometheus metrics.
func NewMetrics(reg prometheus.Registerer) *Metrics {
	m := &Metrics{
		RequestsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "http_requests_total",
				Help: "Total number of HTTP requests by method and path.",
			},
			[]string{"method", "path", "status"},
		),
		RequestDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "http_request_duration_seconds",
				Help:    "HTTP request latency in seconds.",
				Buckets: []float64{0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5},
			},
			[]string{"method", "path"},
		),
		ErrorsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "http_errors_total",
				Help: "Total number of HTTP error responses (4xx/5xx).",
			},
			[]string{"method", "path", "status"},
		),
		SilenceTriggers: prometheus.NewCounter(
			prometheus.CounterOpts{
				Name: "silence_protocol_triggers_total",
				Help: "Total number of Silence Protocol triggers (confidence < threshold).",
			},
		),
		ActiveRequests: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "http_active_requests",
				Help: "Number of currently active HTTP requests.",
			},
		),
	}

	reg.MustRegister(m.RequestsTotal, m.RequestDuration, m.ErrorsTotal, m.SilenceTriggers, m.ActiveRequests)
	return m
}

// Monitoring returns middleware that records request metrics.
func Monitoring(m *Metrics) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			m.ActiveRequests.Inc()

			sw := &metricsWriter{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(sw, r)

			duration := time.Since(start).Seconds()
			status := strconv.Itoa(sw.status)
			path := sanitizePath(r.URL.Path)

			m.RequestsTotal.WithLabelValues(r.Method, path, status).Inc()
			m.RequestDuration.WithLabelValues(r.Method, path).Observe(duration)
			m.ActiveRequests.Dec()

			if sw.status >= 400 {
				m.ErrorsTotal.WithLabelValues(r.Method, path, status).Inc()
			}
		})
	}
}

// MetricsHandler returns the Prometheus metrics endpoint handler.
func MetricsHandler(reg *prometheus.Registry) http.Handler {
	return promhttp.HandlerFor(reg, promhttp.HandlerOpts{})
}

// IncrementSilenceTrigger records a Silence Protocol trigger.
func (m *Metrics) IncrementSilenceTrigger() {
	m.SilenceTriggers.Inc()
}

type metricsWriter struct {
	http.ResponseWriter
	status      int
	wroteHeader bool
}

func (mw *metricsWriter) WriteHeader(code int) {
	if !mw.wroteHeader {
		mw.status = code
		mw.wroteHeader = true
	}
	mw.ResponseWriter.WriteHeader(code)
}

func (mw *metricsWriter) Write(b []byte) (int, error) {
	if !mw.wroteHeader {
		mw.wroteHeader = true
	}
	return mw.ResponseWriter.Write(b)
}

// sanitizePath normalizes URL paths to prevent high-cardinality label values.
// Replaces path segments that look like IDs with ":id".
func sanitizePath(path string) string {
	if len(path) == 0 {
		return "/"
	}

	var result []byte
	start := 0
	segIdx := 0
	for i := 0; i <= len(path); i++ {
		if i == len(path) || path[i] == '/' {
			seg := path[start:i]
			if segIdx > 0 && looksLikeID(seg) {
				result = append(result, ":id"...)
			} else {
				result = append(result, seg...)
			}
			if i < len(path) {
				result = append(result, '/')
			}
			start = i + 1
			segIdx++
		}
	}
	return string(result)
}

// looksLikeID returns true if the segment looks like a UUID or numeric ID.
func looksLikeID(seg string) bool {
	if len(seg) == 0 {
		return false
	}
	// UUID-like: contains dashes and is 36 chars
	if len(seg) == 36 {
		dashes := 0
		for _, c := range seg {
			if c == '-' {
				dashes++
			}
		}
		if dashes == 4 {
			return true
		}
	}
	// Numeric IDs
	for _, c := range seg {
		if c < '0' || c > '9' {
			return false
		}
	}
	return len(seg) > 0
}
