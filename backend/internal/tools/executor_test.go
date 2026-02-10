package tools

import (
	"context"
	"errors"
	"testing"
)

// mockTool implements Tool for testing.
type mockTool struct {
	result *ToolResult
	err    error
	panics bool
}

func (m *mockTool) Execute(_ context.Context, _ map[string]interface{}) (*ToolResult, error) {
	if m.panics {
		panic("boom")
	}
	return m.result, m.err
}

func TestMercuryBypassesRBAC(t *testing.T) {
	executor := NewToolExecutor()
	executor.Register("test_tool", &mockTool{
		result: &ToolResult{Data: "ok"},
	})

	ctx := context.Background()

	// Mercury should succeed
	result, err := executor.Execute(ctx, "test_tool", nil, "mercury")
	if err != nil {
		t.Errorf("Mercury should bypass RBAC, got error: %v", err)
	}
	if result == nil || result.Data != "ok" {
		t.Error("Expected result data 'ok'")
	}
}

func TestSystemRoleBypassesRBAC(t *testing.T) {
	executor := NewToolExecutor()
	executor.Register("secret_tool", &mockTool{
		result: &ToolResult{Data: "secret"},
	})

	ctx := context.Background()

	result, err := executor.Execute(ctx, "secret_tool", nil, "system")
	if err != nil {
		t.Errorf("System role should bypass RBAC, got error: %v", err)
	}
	if result == nil {
		t.Error("Expected result")
	}
}

func TestUserPermissionDenied(t *testing.T) {
	executor := NewToolExecutor()
	executor.Register("admin_only_tool", &mockTool{
		result: &ToolResult{Data: "admin"},
	})

	ctx := context.Background()

	_, err := executor.Execute(ctx, "admin_only_tool", nil, "user")
	if err == nil {
		t.Error("User without permission should get error")
	}

	toolErr, ok := err.(*ToolError)
	if !ok {
		t.Fatalf("Error should be *ToolError, got %T", err)
	}
	if toolErr.Code != ErrCodePermissionDenied {
		t.Errorf("Expected PERMISSION_DENIED, got %s", toolErr.Code)
	}
	if toolErr.Recoverable {
		t.Error("Permission denied should not be recoverable")
	}
}

func TestUserWithPermissionSucceeds(t *testing.T) {
	executor := NewToolExecutor()
	executor.Register("list_documents", &mockTool{
		result: &ToolResult{Data: []string{"doc1", "doc2"}},
	})

	ctx := context.Background()

	result, err := executor.Execute(ctx, "list_documents", nil, "user")
	if err != nil {
		t.Errorf("User with permission should succeed, got error: %v", err)
	}
	if result == nil {
		t.Error("Expected result")
	}
}

func TestToolNotFound(t *testing.T) {
	executor := NewToolExecutor()

	ctx := context.Background()

	_, err := executor.Execute(ctx, "nonexistent", nil, "mercury")
	if err == nil {
		t.Error("Unknown tool should return error")
	}

	toolErr, ok := err.(*ToolError)
	if !ok {
		t.Fatalf("Error should be *ToolError, got %T", err)
	}
	if toolErr.Code != ErrCodeToolNotFound {
		t.Errorf("Expected TOOL_NOT_FOUND, got %s", toolErr.Code)
	}
}

func TestGenericErrorWrapped(t *testing.T) {
	executor := NewToolExecutor()
	executor.Register("failing_tool", &mockTool{
		err: errors.New("db connection lost"),
	})

	ctx := context.Background()

	_, err := executor.Execute(ctx, "failing_tool", nil, "mercury")
	if err == nil {
		t.Error("Failing tool should return error")
	}

	toolErr, ok := err.(*ToolError)
	if !ok {
		t.Fatalf("Error should be wrapped as *ToolError, got %T", err)
	}
	if toolErr.Code != ErrCodeUpstream {
		t.Errorf("Expected UPSTREAM_FAILURE, got %s", toolErr.Code)
	}
	if !toolErr.Recoverable {
		t.Error("Upstream failure should be recoverable")
	}
}

func TestPanicRecovery(t *testing.T) {
	executor := NewToolExecutor()
	executor.Register("panicking_tool", &mockTool{panics: true})

	ctx := context.Background()

	_, err := executor.Execute(ctx, "panicking_tool", nil, "mercury")
	if err == nil {
		t.Error("Panicking tool should return error")
	}

	toolErr, ok := err.(*ToolError)
	if !ok {
		t.Fatalf("Error should be *ToolError, got %T", err)
	}
	if toolErr.Code != ErrCodeInternal {
		t.Errorf("Expected INTERNAL_ERROR, got %s", toolErr.Code)
	}
}

func TestToolErrorPassedThrough(t *testing.T) {
	executor := NewToolExecutor()
	executor.Register("validation_tool", &mockTool{
		err: NewValidationError("validation_tool", "missing required field 'query'"),
	})

	ctx := context.Background()

	_, err := executor.Execute(ctx, "validation_tool", nil, "mercury")
	if err == nil {
		t.Error("Tool returning ToolError should propagate it")
	}

	toolErr, ok := err.(*ToolError)
	if !ok {
		t.Fatalf("Error should remain *ToolError, got %T", err)
	}
	if toolErr.Code != ErrCodeValidation {
		t.Errorf("Expected VALIDATION_FAILED, got %s", toolErr.Code)
	}
}
