package gcpclient

import (
	"context"
	"log/slog"

	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// StubDLPAdapter is a no-op DLP implementation for MVP.
// Returns empty findings so the pipeline continues without PII scanning.
// Full DLP integration can be added in a later phase.
type StubDLPAdapter struct{}

// NewStubDLPAdapter creates a StubDLPAdapter.
func NewStubDLPAdapter() *StubDLPAdapter {
	return &StubDLPAdapter{}
}

// InspectContent returns empty findings (no-op for MVP).
func (a *StubDLPAdapter) InspectContent(ctx context.Context, project string, text string, infoTypes []string) ([]service.Finding, error) {
	slog.Info("DLP scanning skipped", "reason", "stub_adapter")
	return []service.Finding{}, nil
}
