package tools

import (
	"context"
	"time"

	"github.com/connexus-ai/ragbox-backend/internal/rbac"
)

// DefaultToolTimeout is the maximum time a tool may run.
const DefaultToolTimeout = 30 * time.Second

// Tool is the interface every registered tool must implement.
type Tool interface {
	Execute(ctx context.Context, params map[string]interface{}) (*ToolResult, error)
}

// ToolResult is the successful return value from a tool execution.
type ToolResult struct {
	Data     interface{} `json:"data"`
	UIAction interface{} `json:"uiAction,omitempty"`
}

// ToolExecutor dispatches tool calls with RBAC checks and error handling.
type ToolExecutor struct {
	registry map[string]Tool
}

// NewToolExecutor creates an empty executor.
func NewToolExecutor() *ToolExecutor {
	return &ToolExecutor{registry: make(map[string]Tool)}
}

// Register adds a tool to the registry.
func (e *ToolExecutor) Register(name string, tool Tool) {
	e.registry[name] = tool
}

// Execute runs a tool with RBAC checks and structured error handling.
func (e *ToolExecutor) Execute(ctx context.Context, toolName string, params map[string]interface{}, callerRole string) (*ToolResult, error) {
	// System roles bypass RBAC entirely
	if rbac.IsSystemRole(callerRole) {
		return e.executeWithErrorHandling(ctx, toolName, params)
	}

	// Standard RBAC check for user roles
	if !rbac.HasToolPermission(callerRole, toolName) {
		return nil, NewPermissionError(callerRole, toolName)
	}

	return e.executeWithErrorHandling(ctx, toolName, params)
}

// executeWithErrorHandling wraps tool execution with timeout and panic recovery.
func (e *ToolExecutor) executeWithErrorHandling(ctx context.Context, toolName string, params map[string]interface{}) (result *ToolResult, err error) {
	// Set timeout
	ctx, cancel := context.WithTimeout(ctx, DefaultToolTimeout)
	defer cancel()

	// Check tool exists
	tool, exists := e.registry[toolName]
	if !exists {
		return nil, NewToolNotFoundError(toolName)
	}

	// Panic recovery
	defer func() {
		if p := recover(); p != nil {
			err = NewInternalError(toolName)
		}
	}()

	// Execute tool
	result, err = tool.Execute(ctx, params)

	// Handle timeout
	if ctx.Err() == context.DeadlineExceeded {
		return nil, NewTimeoutError(toolName, DefaultToolTimeout)
	}

	// Wrap generic errors in ToolError
	if err != nil {
		if _, ok := err.(*ToolError); !ok {
			return nil, NewUpstreamError(toolName, err)
		}
	}

	return result, err
}
