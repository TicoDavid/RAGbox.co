package tools

import (
	"fmt"
	"time"
)

// ToolError represents a structured error from tool execution.
type ToolError struct {
	Code        string `json:"code"`
	Message     string `json:"message"`
	Recoverable bool   `json:"recoverable"`
	Suggestion  string `json:"suggestion"`
}

func (e *ToolError) Error() string {
	return e.Message
}

// Error codes.
const (
	ErrCodePermissionDenied = "PERMISSION_DENIED"
	ErrCodeTimeout          = "TIMEOUT"
	ErrCodeValidation       = "VALIDATION_FAILED"
	ErrCodeUpstream         = "UPSTREAM_FAILURE"
	ErrCodeFileError        = "FILE_ERROR"
	ErrCodeInternal         = "INTERNAL_ERROR"
	ErrCodeToolNotFound     = "TOOL_NOT_FOUND"
)

// Constructors

func NewPermissionError(role, tool string) *ToolError {
	return &ToolError{
		Code:        ErrCodePermissionDenied,
		Message:     fmt.Sprintf("Role '%s' cannot access tool '%s'", role, tool),
		Recoverable: false,
		Suggestion:  "Contact your administrator to request access.",
	}
}

func NewTimeoutError(tool string, duration time.Duration) *ToolError {
	return &ToolError{
		Code:        ErrCodeTimeout,
		Message:     fmt.Sprintf("Tool '%s' timed out after %v", tool, duration),
		Recoverable: true,
		Suggestion:  "Try again with a smaller document or simpler query.",
	}
}

func NewValidationError(tool, details string) *ToolError {
	return &ToolError{
		Code:        ErrCodeValidation,
		Message:     fmt.Sprintf("Invalid input for '%s': %s", tool, details),
		Recoverable: true,
		Suggestion:  "Check your input and try again.",
	}
}

func NewUpstreamError(tool string, cause error) *ToolError {
	return &ToolError{
		Code:        ErrCodeUpstream,
		Message:     fmt.Sprintf("Tool '%s' failed: %v", tool, cause),
		Recoverable: true,
		Suggestion:  "This may be a temporary issue. Please try again.",
	}
}

func NewFileError(operation string, cause error) *ToolError {
	return &ToolError{
		Code:        ErrCodeFileError,
		Message:     fmt.Sprintf("File %s failed: %v", operation, cause),
		Recoverable: true,
		Suggestion:  "The file may be corrupted or unsupported. Try re-exporting as PDF.",
	}
}

func NewInternalError(tool string) *ToolError {
	return &ToolError{
		Code:        ErrCodeInternal,
		Message:     fmt.Sprintf("Tool '%s' encountered an unexpected error", tool),
		Recoverable: true,
		Suggestion:  "Please try again. If this persists, contact support.",
	}
}

func NewToolNotFoundError(tool string) *ToolError {
	return &ToolError{
		Code:        ErrCodeToolNotFound,
		Message:     fmt.Sprintf("Unknown tool: %s", tool),
		Recoverable: false,
		Suggestion:  "This tool may not be available in your current plan.",
	}
}
