package handler

import "github.com/google/uuid"

// validateUUID checks if a string is a valid UUID format.
// Returns true if valid, false otherwise.
func validateUUID(id string) bool {
	_, err := uuid.Parse(id)
	return err == nil
}
