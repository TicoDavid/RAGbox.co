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
