package service

import (
	"context"
	"fmt"
	"testing"
)

// mockDLPClient implements DLPClient for testing.
type mockDLPClient struct {
	findings []Finding
	err      error
}

func (m *mockDLPClient) InspectContent(ctx context.Context, project, text string, infoTypes []string) ([]Finding, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.findings, nil
}

func TestScan_DetectsSSNAndEmail(t *testing.T) {
	client := &mockDLPClient{
		findings: []Finding{
			{InfoType: "US_SOCIAL_SECURITY_NUMBER", Content: "123-45-6789", Likelihood: "VERY_LIKELY", StartIndex: 10, EndIndex: 21, Score: 0.95},
			{InfoType: "EMAIL_ADDRESS", Content: "john@example.com", Likelihood: "LIKELY", StartIndex: 30, EndIndex: 46, Score: 0.90},
		},
	}
	svc := NewRedactorService(client, "test-project")

	result, err := svc.Scan(context.Background(), "SSN is 123-45-6789 and email john@example.com")
	if err != nil {
		t.Fatalf("Scan() error: %v", err)
	}

	if result.FindingCount != 2 {
		t.Errorf("FindingCount = %d, want 2", result.FindingCount)
	}

	if len(result.Types) != 2 {
		t.Errorf("Types count = %d, want 2", len(result.Types))
	}

	// Types should be sorted
	if result.Types[0] != "EMAIL_ADDRESS" {
		t.Errorf("Types[0] = %q, want %q", result.Types[0], "EMAIL_ADDRESS")
	}
	if result.Types[1] != "US_SOCIAL_SECURITY_NUMBER" {
		t.Errorf("Types[1] = %q, want %q", result.Types[1], "US_SOCIAL_SECURITY_NUMBER")
	}
}

func TestScan_EmptyText(t *testing.T) {
	client := &mockDLPClient{}
	svc := NewRedactorService(client, "test-project")

	result, err := svc.Scan(context.Background(), "")
	if err != nil {
		t.Fatalf("Scan() error: %v", err)
	}
	if result.FindingCount != 0 {
		t.Errorf("FindingCount = %d, want 0", result.FindingCount)
	}
}

func TestScan_DLPError(t *testing.T) {
	client := &mockDLPClient{err: fmt.Errorf("DLP service unavailable")}
	svc := NewRedactorService(client, "test-project")

	_, err := svc.Scan(context.Background(), "test text with PII")
	if err == nil {
		t.Fatal("expected error when DLP fails")
	}
}

func TestRedact_SSNAndEmail(t *testing.T) {
	svc := NewRedactorService(nil, "test-project")

	text := "SSN is 123-45-6789 email john@example.com end"
	findings := []Finding{
		{InfoType: "US_SOCIAL_SECURITY_NUMBER", StartIndex: 7, EndIndex: 18},
		{InfoType: "EMAIL_ADDRESS", StartIndex: 25, EndIndex: 41},
	}

	result := svc.Redact(text, findings)

	if result != "SSN is [REDACTED-SSN] email [REDACTED-EMAIL] end" {
		t.Errorf("Redact() = %q", result)
	}
}

func TestRedact_NoFindings(t *testing.T) {
	svc := NewRedactorService(nil, "test-project")

	text := "clean text with no PII"
	result := svc.Redact(text, nil)

	if result != text {
		t.Errorf("Redact() = %q, want original text", result)
	}
}

func TestRedact_CreditCard(t *testing.T) {
	svc := NewRedactorService(nil, "test-project")

	text := "Card: 4111-1111-1111-1111 done"
	findings := []Finding{
		{InfoType: "CREDIT_CARD_NUMBER", StartIndex: 6, EndIndex: 25},
	}

	result := svc.Redact(text, findings)

	if result != "Card: [REDACTED-CREDIT_CARD] done" {
		t.Errorf("Redact() = %q", result)
	}
}

func TestRedact_MedicalRecord(t *testing.T) {
	svc := NewRedactorService(nil, "test-project")

	text := "MRN: MR12345 here"
	findings := []Finding{
		{InfoType: "MEDICAL_RECORD_NUMBER", StartIndex: 5, EndIndex: 12},
	}

	result := svc.Redact(text, findings)

	if result != "MRN: [REDACTED-MEDICAL_RECORD] here" {
		t.Errorf("Redact() = %q", result)
	}
}

func TestRedact_UnknownType(t *testing.T) {
	svc := NewRedactorService(nil, "test-project")

	text := "Data: secret123 end"
	findings := []Finding{
		{InfoType: "CUSTOM_TYPE", StartIndex: 6, EndIndex: 15},
	}

	result := svc.Redact(text, findings)

	if result != "Data: [REDACTED-PII] end" {
		t.Errorf("Redact() = %q, want [REDACTED-PII] for unknown type", result)
	}
}

func TestRedactByType_FilterByType(t *testing.T) {
	svc := NewRedactorService(nil, "test-project")

	text := "SSN: 123-45-6789 email: j@e.com end"
	findings := []Finding{
		{InfoType: "US_SOCIAL_SECURITY_NUMBER", StartIndex: 5, EndIndex: 16},
		{InfoType: "EMAIL_ADDRESS", StartIndex: 24, EndIndex: 31},
	}

	// Only redact SSN
	result := svc.RedactByType(text, findings, []string{"US_SOCIAL_SECURITY_NUMBER"})

	if result != "SSN: [REDACTED-SSN] email: j@e.com end" {
		t.Errorf("RedactByType() = %q", result)
	}
}

func TestSummaryForAudit(t *testing.T) {
	result := &ScanResult{
		FindingCount: 3,
		Types:        []string{"EMAIL_ADDRESS", "PHONE_NUMBER"},
	}

	summary := SummaryForAudit(result)

	if summary["pii_scan_complete"] != true {
		t.Error("expected pii_scan_complete=true")
	}
	if summary["finding_count"] != 3 {
		t.Errorf("finding_count = %v, want 3", summary["finding_count"])
	}
}

func TestScan_MultipleOfSameType(t *testing.T) {
	client := &mockDLPClient{
		findings: []Finding{
			{InfoType: "PHONE_NUMBER", Content: "555-0100", StartIndex: 0, EndIndex: 8, Score: 0.8},
			{InfoType: "PHONE_NUMBER", Content: "555-0200", StartIndex: 20, EndIndex: 28, Score: 0.85},
		},
	}
	svc := NewRedactorService(client, "test-project")

	result, err := svc.Scan(context.Background(), "555-0100 some text 555-0200")
	if err != nil {
		t.Fatalf("Scan() error: %v", err)
	}

	if result.FindingCount != 2 {
		t.Errorf("FindingCount = %d, want 2", result.FindingCount)
	}
	// Only one unique type
	if len(result.Types) != 1 {
		t.Errorf("Types count = %d, want 1", len(result.Types))
	}
}
