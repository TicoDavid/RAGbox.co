package service

// SilenceResponse is the structured refusal for low-confidence scenarios.
type SilenceResponse struct {
	Message     string   `json:"message"`
	Confidence  float64  `json:"confidence"`
	Suggestions []string `json:"suggestions"`
	Protocol    string   `json:"protocol"`
}

// LowConfidenceFlag is attached to answers in the 0.40-0.59 range.
// The answer is still delivered, but with an amber warning indicator.
type LowConfidenceFlag struct {
	Warning    string  `json:"warning"`
	Confidence float64 `json:"confidence"`
}

const (
	// SilenceThreshold: below this, refuse to answer entirely.
	silenceHardFloor = 0.40
	// LowConfidenceCeiling: between hardFloor and this, answer with amber flag.
	lowConfidenceCeiling = 0.60
)

// ClassifyConfidence determines the response tier based on the final confidence score.
//
//	0.60+ → normal answer (no flag)
//	0.40-0.59 → answer + low-confidence amber indicator
//	below 0.40 → Silence Protocol refusal
func ClassifyConfidence(confidence float64) string {
	if confidence >= lowConfidenceCeiling {
		return "normal"
	}
	if confidence >= silenceHardFloor {
		return "low_confidence"
	}
	return "silence"
}

// BuildSilenceResponse creates a Silence Protocol response.
// Used when confidence is below 0.40.
func BuildSilenceResponse(confidence float64, query string) *SilenceResponse {
	return &SilenceResponse{
		Message:    "I cannot provide a sufficiently grounded answer to this query based on your documents.",
		Confidence: confidence,
		Suggestions: []string{
			"Upload additional documents related to this topic",
			"Try rephrasing your question with more specific terms",
			"Narrow the scope of your query to a specific document or date range",
		},
		Protocol: "SILENCE_PROTOCOL",
	}
}

// BuildLowConfidenceFlag creates the amber indicator for marginal answers (0.40-0.59).
func BuildLowConfidenceFlag(confidence float64) *LowConfidenceFlag {
	return &LowConfidenceFlag{
		Warning:    "Low confidence — limited evidence found in your documents.",
		Confidence: confidence,
	}
}
