package gcpclient

import (
	"context"
	"log"

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
	log.Println("DLP scanning skipped (stub adapter)")
	return []service.Finding{}, nil
}
