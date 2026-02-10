package model

import (
	"encoding/json"
	"time"
)

// Audit action constants.
const (
	AuditDocumentUpload   = "DOCUMENT_UPLOAD"
	AuditDocumentDelete   = "DOCUMENT_DELETE"
	AuditDocumentRecover  = "DOCUMENT_RECOVER"
	AuditPrivilegeToggle  = "PRIVILEGE_TOGGLE"
	AuditQueryExecuted    = "QUERY_EXECUTED"
	AuditSilenceTriggered = "SILENCE_PROTOCOL_TRIGGERED"
	AuditDataExport       = "DATA_EXPORT"
	AuditForgeGenerate    = "FORGE_GENERATE"
	AuditUserLogin        = "USER_LOGIN"
)

// AuditLog represents an immutable audit trail entry.
type AuditLog struct {
	ID           string          `json:"id"`
	UserID       *string         `json:"userId,omitempty"`
	Action       string          `json:"action"`
	ResourceID   *string         `json:"resourceId,omitempty"`
	ResourceType *string         `json:"resourceType,omitempty"`
	Severity     string          `json:"severity"`
	Details      json.RawMessage `json:"details,omitempty"`
	DetailsHash  *string         `json:"detailsHash,omitempty"`
	IPAddress    *string         `json:"ipAddress,omitempty"`
	UserAgent    *string         `json:"userAgent,omitempty"`
	CreatedAt    time.Time       `json:"createdAt"`
}
