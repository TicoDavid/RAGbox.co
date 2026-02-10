package rbac

// SystemRoles defines roles that bypass tool permission checks.
var SystemRoles = map[string]bool{
	"mercury": true,
	"system":  true,
	"admin":   true,
}

// IsSystemRole returns true if the role should bypass RBAC checks.
func IsSystemRole(role string) bool {
	return SystemRoles[role]
}

// UserRolePermissions maps non-system roles to their permitted tools.
var UserRolePermissions = map[string][]string{
	"user": {
		"list_documents",
		"read_document",
		"search_documents",
		"query_rag",
	},
	"editor": {
		"list_documents",
		"read_document",
		"search_documents",
		"query_rag",
		"upload_document",
		"delete_document",
	},
}

// HasToolPermission checks if a role can use a specific tool.
func HasToolPermission(role, tool string) bool {
	if IsSystemRole(role) {
		return true
	}

	permissions, exists := UserRolePermissions[role]
	if !exists {
		return false
	}

	for _, permitted := range permissions {
		if permitted == tool {
			return true
		}
	}
	return false
}
