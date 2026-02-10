package service

import (
	"context"
	"fmt"
	"sort"
	"strings"
)

// Finding represents a detected PII/PHI occurrence in text.
type Finding struct {
	InfoType   string  `json:"infoType"`
	Content    string  `json:"content"`
	Likelihood string  `json:"likelihood"`
	StartIndex int     `json:"startIndex"`
	EndIndex   int     `json:"endIndex"`
	Score      float64 `json:"score"`
}

// ScanResult holds the results of a DLP scan.
type ScanResult struct {
	Findings     []Finding `json:"findings"`
	FindingCount int       `json:"findingCount"`
	Types        []string  `json:"types"`
}

// DLPClient abstracts DLP inspection operations for testability.
type DLPClient interface {
	InspectContent(ctx context.Context, project string, text string, infoTypes []string) ([]Finding, error)
}

// RedactorService scans text for PII/PHI and optionally redacts it.
type RedactorService struct {
	client  DLPClient
	project string
}

// Supported info types for PII/PHI detection.
var defaultInfoTypes = []string{
	"PERSON_NAME",
	"EMAIL_ADDRESS",
	"PHONE_NUMBER",
	"US_SOCIAL_SECURITY_NUMBER",
	"CREDIT_CARD_NUMBER",
	"US_INDIVIDUAL_TAXPAYER_IDENTIFICATION_NUMBER",
	"MEDICAL_RECORD_NUMBER",
	"HEALTH_INSURANCE_ID",
}

// infoTypeToRedactLabel maps DLP info types to redaction markers.
var infoTypeToRedactLabel = map[string]string{
	"PERSON_NAME":                                  "NAME",
	"EMAIL_ADDRESS":                                "EMAIL",
	"PHONE_NUMBER":                                 "PHONE",
	"US_SOCIAL_SECURITY_NUMBER":                    "SSN",
	"CREDIT_CARD_NUMBER":                           "CREDIT_CARD",
	"US_INDIVIDUAL_TAXPAYER_IDENTIFICATION_NUMBER":  "TIN",
	"MEDICAL_RECORD_NUMBER":                        "MEDICAL_RECORD",
	"HEALTH_INSURANCE_ID":                          "HEALTH_ID",
}

// NewRedactorService creates a RedactorService.
func NewRedactorService(client DLPClient, project string) *RedactorService {
	return &RedactorService{
		client:  client,
		project: project,
	}
}

// Scan inspects text for PII/PHI and returns findings without modifying the text.
func (s *RedactorService) Scan(ctx context.Context, text string) (*ScanResult, error) {
	if text == "" {
		return &ScanResult{}, nil
	}

	findings, err := s.client.InspectContent(ctx, s.project, text, defaultInfoTypes)
	if err != nil {
		return nil, fmt.Errorf("service.Scan: inspect content: %w", err)
	}

	typeSet := make(map[string]bool)
	for _, f := range findings {
		typeSet[f.InfoType] = true
	}

	types := make([]string, 0, len(typeSet))
	for t := range typeSet {
		types = append(types, t)
	}
	sort.Strings(types)

	return &ScanResult{
		Findings:     findings,
		FindingCount: len(findings),
		Types:        types,
	}, nil
}

// Redact replaces PII/PHI findings in text with [REDACTED-TYPE] markers.
// Findings must be sorted by StartIndex descending to preserve offsets.
func (s *RedactorService) Redact(text string, findings []Finding) string {
	if len(findings) == 0 {
		return text
	}

	// Sort findings by StartIndex descending so replacements don't shift offsets
	sorted := make([]Finding, len(findings))
	copy(sorted, findings)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].StartIndex > sorted[j].StartIndex
	})

	result := text
	for _, f := range sorted {
		if f.StartIndex < 0 || f.EndIndex > len(result) || f.StartIndex >= f.EndIndex {
			continue
		}
		label := infoTypeToRedactLabel[f.InfoType]
		if label == "" {
			label = "PII"
		}
		replacement := fmt.Sprintf("[REDACTED-%s]", label)
		result = result[:f.StartIndex] + replacement + result[f.EndIndex:]
	}

	return result
}

// RedactByType replaces only findings of specified types.
func (s *RedactorService) RedactByType(text string, findings []Finding, types []string) string {
	typeSet := make(map[string]bool, len(types))
	for _, t := range types {
		typeSet[t] = true
	}

	filtered := make([]Finding, 0)
	for _, f := range findings {
		if typeSet[f.InfoType] {
			filtered = append(filtered, f)
		}
	}

	return s.Redact(text, filtered)
}

// SummaryForAudit returns a map suitable for storing in document metadata.
func SummaryForAudit(result *ScanResult) map[string]interface{} {
	return map[string]interface{}{
		"pii_scan_complete": true,
		"finding_count":     result.FindingCount,
		"types_detected":    strings.Join(result.Types, ","),
	}
}
