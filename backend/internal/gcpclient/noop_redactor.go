package gcpclient

import (
	"context"
	"log/slog"

	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// NoopRedactor implements service.Redactor as a no-op.
// PII scanning is non-fatal in the pipeline, so this placeholder is safe.
type NoopRedactor struct{}

// NewNoopRedactor creates a NoopRedactor.
func NewNoopRedactor() *NoopRedactor {
	return &NoopRedactor{}
}

// Scan always returns an empty ScanResult with no findings.
func (r *NoopRedactor) Scan(ctx context.Context, text string) (*service.ScanResult, error) {
	slog.Info("PII scanning skipped", "reason", "noop_redactor")
	return &service.ScanResult{
		Findings:     nil,
		FindingCount: 0,
		Types:        nil,
	}, nil
}
