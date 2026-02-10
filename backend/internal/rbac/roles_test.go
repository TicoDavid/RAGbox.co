package rbac

import "testing"

func TestIsSystemRole(t *testing.T) {
	tests := []struct {
		role string
		want bool
	}{
		{"mercury", true},
		{"system", true},
		{"admin", true},
		{"user", false},
		{"editor", false},
		{"viewer", false},
		{"", false},
	}

	for _, tt := range tests {
		if got := IsSystemRole(tt.role); got != tt.want {
			t.Errorf("IsSystemRole(%q) = %v, want %v", tt.role, got, tt.want)
		}
	}
}

func TestHasToolPermission(t *testing.T) {
	tests := []struct {
		role string
		tool string
		want bool
	}{
		// System roles bypass all checks
		{"mercury", "any_tool", true},
		{"system", "delete_everything", true},
		{"admin", "list_documents", true},

		// User role
		{"user", "list_documents", true},
		{"user", "read_document", true},
		{"user", "search_documents", true},
		{"user", "query_rag", true},
		{"user", "upload_document", false},
		{"user", "delete_document", false},

		// Editor role
		{"editor", "list_documents", true},
		{"editor", "upload_document", true},
		{"editor", "delete_document", true},

		// Unknown role
		{"viewer", "list_documents", false},
		{"", "list_documents", false},
	}

	for _, tt := range tests {
		if got := HasToolPermission(tt.role, tt.tool); got != tt.want {
			t.Errorf("HasToolPermission(%q, %q) = %v, want %v", tt.role, tt.tool, got, tt.want)
		}
	}
}
