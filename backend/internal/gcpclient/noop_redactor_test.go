package gcpclient

import (
	"context"
	"testing"
)

func TestNoopRedactor_Scan(t *testing.T) {
	r := NewNoopRedactor()

	result, err := r.Scan(context.Background(), "John Doe lives at 123 Main St, SSN 123-45-6789")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.FindingCount != 0 {
		t.Errorf("FindingCount = %d, want 0", result.FindingCount)
	}
	if len(result.Findings) != 0 {
		t.Errorf("Findings len = %d, want 0", len(result.Findings))
	}
	if len(result.Types) != 0 {
		t.Errorf("Types len = %d, want 0", len(result.Types))
	}
}
