package service

// SilenceResponse is the structured refusal for low-confidence scenarios.
type SilenceResponse struct {
	Message     string   `json:"message"`
	Confidence  float64  `json:"confidence"`
	Suggestions []string `json:"suggestions"`
	Protocol    string   `json:"protocol"`
}

// BuildSilenceResponse creates a Silence Protocol response.
// This is the only response when Mercury cannot provide a sufficiently grounded answer.
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
