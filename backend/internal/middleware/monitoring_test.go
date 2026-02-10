package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	io_prometheus "github.com/prometheus/client_model/go"
)

func newTestMetrics(t *testing.T) (*Metrics, *prometheus.Registry) {
	t.Helper()
	reg := prometheus.NewRegistry()
	m := NewMetrics(reg)
	return m, reg
}

func TestMonitoring_RecordsSuccessMetrics(t *testing.T) {
	m, _ := newTestMetrics(t)

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	handler := Monitoring(m)(inner)
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}

	// Verify request count incremented
	counter, err := m.RequestsTotal.GetMetricWithLabelValues("GET", "/api/health", "200")
	if err != nil {
		t.Fatal(err)
	}
	var metric io_prometheus.Metric
	counter.Write(&metric)
	if got := metric.GetCounter().GetValue(); got != 1 {
		t.Errorf("requests_total = %f, want 1", got)
	}
}

func TestMonitoring_Records4xxAsError(t *testing.T) {
	m, _ := newTestMetrics(t)

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	})

	handler := Monitoring(m)(inner)
	req := httptest.NewRequest(http.MethodGet, "/api/documents/missing", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	counter, err := m.ErrorsTotal.GetMetricWithLabelValues("GET", "/api/documents/missing", "404")
	if err != nil {
		t.Fatal(err)
	}
	var metric io_prometheus.Metric
	counter.Write(&metric)
	if got := metric.GetCounter().GetValue(); got != 1 {
		t.Errorf("errors_total = %f, want 1", got)
	}
}

func TestMonitoring_Records5xxAsError(t *testing.T) {
	m, _ := newTestMetrics(t)

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})

	handler := Monitoring(m)(inner)
	req := httptest.NewRequest(http.MethodPost, "/api/chat", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	counter, err := m.ErrorsTotal.GetMetricWithLabelValues("POST", "/api/chat", "500")
	if err != nil {
		t.Fatal(err)
	}
	var metric io_prometheus.Metric
	counter.Write(&metric)
	if got := metric.GetCounter().GetValue(); got != 1 {
		t.Errorf("errors_total = %f, want 1", got)
	}
}

func TestMonitoring_RecordsLatency(t *testing.T) {
	m, _ := newTestMetrics(t)

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := Monitoring(m)(inner)
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	observer, err := m.RequestDuration.GetMetricWithLabelValues("GET", "/api/health")
	if err != nil {
		t.Fatal(err)
	}
	var metric io_prometheus.Metric
	observer.(prometheus.Metric).Write(&metric)
	if got := metric.GetHistogram().GetSampleCount(); got != 1 {
		t.Errorf("duration sample count = %d, want 1", got)
	}
}

func TestMonitoring_ActiveRequests(t *testing.T) {
	m, _ := newTestMetrics(t)

	var activeInHandler float64
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var metric io_prometheus.Metric
		m.ActiveRequests.(prometheus.Metric).Write(&metric)
		activeInHandler = metric.GetGauge().GetValue()
		w.WriteHeader(http.StatusOK)
	})

	handler := Monitoring(m)(inner)
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if activeInHandler != 1 {
		t.Errorf("active_requests during request = %f, want 1", activeInHandler)
	}

	// After request completes, should be back to 0
	var metric io_prometheus.Metric
	m.ActiveRequests.(prometheus.Metric).Write(&metric)
	if got := metric.GetGauge().GetValue(); got != 0 {
		t.Errorf("active_requests after request = %f, want 0", got)
	}
}

func TestSilenceTrigger(t *testing.T) {
	m, _ := newTestMetrics(t)

	m.IncrementSilenceTrigger()
	m.IncrementSilenceTrigger()

	var metric io_prometheus.Metric
	m.SilenceTriggers.(prometheus.Metric).Write(&metric)
	if got := metric.GetCounter().GetValue(); got != 2 {
		t.Errorf("silence_triggers = %f, want 2", got)
	}
}

func TestMetricsHandler_ServesPrometheusFormat(t *testing.T) {
	m, reg := newTestMetrics(t)

	// Generate some observations so counters appear in output
	m.RequestsTotal.WithLabelValues("GET", "/api/health", "200").Inc()
	m.RequestDuration.WithLabelValues("GET", "/api/health").Observe(0.05)
	m.IncrementSilenceTrigger()

	metricsH := MetricsHandler(reg)
	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	rec := httptest.NewRecorder()
	metricsH.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}

	body := rec.Body.String()
	if !strings.Contains(body, "http_requests_total") {
		t.Error("expected http_requests_total in metrics output")
	}
	if !strings.Contains(body, "http_request_duration_seconds") {
		t.Error("expected http_request_duration_seconds in metrics output")
	}
	if !strings.Contains(body, "silence_protocol_triggers_total") {
		t.Error("expected silence_protocol_triggers_total in metrics output")
	}
}

func TestSanitizePath(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"/api/health", "/api/health"},
		{"/api/documents/550e8400-e29b-41d4-a716-446655440000", "/api/documents/:id"},
		{"/api/documents/12345", "/api/documents/:id"},
		{"/api/documents/12345/tier", "/api/documents/:id/tier"},
		{"/", "/"},
		{"", "/"},
	}

	for _, tt := range tests {
		got := sanitizePath(tt.input)
		if got != tt.want {
			t.Errorf("sanitizePath(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestLooksLikeID(t *testing.T) {
	tests := []struct {
		input string
		want  bool
	}{
		{"550e8400-e29b-41d4-a716-446655440000", true},
		{"12345", true},
		{"api", false},
		{"documents", false},
		{"", false},
	}

	for _, tt := range tests {
		got := looksLikeID(tt.input)
		if got != tt.want {
			t.Errorf("looksLikeID(%q) = %v, want %v", tt.input, got, tt.want)
		}
	}
}

func TestMonitoring_DefaultStatus(t *testing.T) {
	m, _ := newTestMetrics(t)

	// Handler that writes body without calling WriteHeader — defaults to 200
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})

	handler := Monitoring(m)(inner)
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	counter, err := m.RequestsTotal.GetMetricWithLabelValues("GET", "/api/health", "200")
	if err != nil {
		t.Fatal(err)
	}
	var metric io_prometheus.Metric
	counter.Write(&metric)
	if got := metric.GetCounter().GetValue(); got != 1 {
		t.Errorf("requests_total = %f, want 1", got)
	}
}
