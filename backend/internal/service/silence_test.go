package service

import (
	"encoding/json"
	"testing"
)

func TestBuildSilenceResponse(t *testing.T) {
	resp := BuildSilenceResponse(0.42, "What is quantum computing?")

	if resp.Protocol != "SILENCE_PROTOCOL" {
		t.Errorf("Protocol = %q, want %q", resp.Protocol, "SILENCE_PROTOCOL")
	}
	if resp.Confidence != 0.42 {
		t.Errorf("Confidence = %f, want 0.42", resp.Confidence)
	}
	if resp.Message == "" {
		t.Error("Message should not be empty")
	}
	if len(resp.Suggestions) < 2 {
		t.Errorf("expected at least 2 suggestions, got %d", len(resp.Suggestions))
	}
}

func TestBuildSilenceResponse_JSONSerializable(t *testing.T) {
	resp := BuildSilenceResponse(0.5, "test query")

	data, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("json.Marshal() error: %v", err)
	}

	var parsed SilenceResponse
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("json.Unmarshal() error: %v", err)
	}

	if parsed.Protocol != "SILENCE_PROTOCOL" {
		t.Errorf("round-trip Protocol = %q, want %q", parsed.Protocol, "SILENCE_PROTOCOL")
	}
	if parsed.Confidence != 0.5 {
		t.Errorf("round-trip Confidence = %f, want 0.5", parsed.Confidence)
	}
	if len(parsed.Suggestions) != 3 {
		t.Errorf("round-trip Suggestions count = %d, want 3", len(parsed.Suggestions))
	}
}

func TestBuildSilenceResponse_NeverEmpty(t *testing.T) {
	resp := BuildSilenceResponse(0.0, "")

	if resp.Message == "" {
		t.Error("message should never be empty even for zero confidence")
	}
	if resp.Protocol != "SILENCE_PROTOCOL" {
		t.Errorf("protocol should always be SILENCE_PROTOCOL, got %q", resp.Protocol)
	}
}

func TestClassifyConfidence_Normal(t *testing.T) {
	for _, c := range []float64{0.60, 0.75, 0.90, 1.0} {
		if tier := ClassifyConfidence(c); tier != "normal" {
			t.Errorf("ClassifyConfidence(%f) = %q, want %q", c, tier, "normal")
		}
	}
}

func TestClassifyConfidence_LowConfidence(t *testing.T) {
	for _, c := range []float64{0.40, 0.45, 0.50, 0.59} {
		if tier := ClassifyConfidence(c); tier != "low_confidence" {
			t.Errorf("ClassifyConfidence(%f) = %q, want %q", c, tier, "low_confidence")
		}
	}
}

func TestClassifyConfidence_Silence(t *testing.T) {
	for _, c := range []float64{0.0, 0.10, 0.30, 0.39} {
		if tier := ClassifyConfidence(c); tier != "silence" {
			t.Errorf("ClassifyConfidence(%f) = %q, want %q", c, tier, "silence")
		}
	}
}

func TestBuildLowConfidenceFlag(t *testing.T) {
	flag := BuildLowConfidenceFlag(0.48)
	if flag.Confidence != 0.48 {
		t.Errorf("Confidence = %f, want 0.48", flag.Confidence)
	}
	if flag.Warning == "" {
		t.Error("expected non-empty warning")
	}
}
