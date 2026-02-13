package handler

import (
	"encoding/json"
	"net/http"
	"strings"
	"unicode"

	"github.com/google/uuid"
)

// validateUUID checks if a string is a valid UUID format.
// Returns true if valid, false otherwise.
func validateUUID(id string) bool {
	_, err := uuid.Parse(id)
	return err == nil
}

// sanitizeString trims whitespace and removes control characters.
func sanitizeString(s string, maxLen int) string {
	s = strings.TrimSpace(s)
	s = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) && r != '\n' && r != '\t' {
			return -1
		}
		return r
	}, s)
	if maxLen > 0 && len(s) > maxLen {
		s = s[:maxLen]
	}
	return s
}

// requireJSON validates Content-Type is application/json and decodes the body into dst.
// Writes a 400 error response and returns false if validation fails.
func requireJSON(w http.ResponseWriter, r *http.Request, dst interface{}) bool {
	ct := r.Header.Get("Content-Type")
	if !strings.HasPrefix(ct, "application/json") {
		http.Error(w, `{"error":"Content-Type must be application/json"}`, http.StatusBadRequest)
		return false
	}
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		http.Error(w, `{"error":"invalid JSON body"}`, http.StatusBadRequest)
		return false
	}
	return true
}
