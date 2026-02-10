package model

import "time"

type UserRole string

const (
	UserRolePartner   UserRole = "Partner"
	UserRoleAssociate UserRole = "Associate"
	UserRoleAuditor   UserRole = "Auditor"
)

type UserStatus string

const (
	UserStatusActive    UserStatus = "Active"
	UserStatusSuspended UserStatus = "Suspended"
)

// User represents a RAGbox user account.
type User struct {
	ID                   string      `json:"id"`
	Email                string      `json:"email"`
	Name                 *string     `json:"name,omitempty"`
	Image                *string     `json:"image,omitempty"`
	Role                 UserRole    `json:"role"`
	Status               UserStatus  `json:"status"`
	PrivilegeModeEnabled bool        `json:"privilegeModeEnabled"`
	PrivilegeModeChangedAt *time.Time `json:"privilegeModeChangedAt,omitempty"`
	CreatedAt            time.Time   `json:"createdAt"`
	LastLoginAt          *time.Time  `json:"lastLoginAt,omitempty"`
}
