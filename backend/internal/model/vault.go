package model

import "time"

type VaultStatus string

const (
	VaultOpen   VaultStatus = "open"
	VaultClosed VaultStatus = "closed"
	VaultSecure VaultStatus = "secure"
)

// Vault represents a document container.
type Vault struct {
	ID               string      `json:"id"`
	Name             string      `json:"name"`
	UserID           string      `json:"userId"`
	Status           VaultStatus `json:"status"`
	DocumentCount    int         `json:"documentCount"`
	StorageUsedBytes int64       `json:"storageUsedBytes"`
	CreatedAt        time.Time   `json:"createdAt"`
	UpdatedAt        time.Time   `json:"updatedAt"`
}

// Folder represents a file organization folder.
type Folder struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	UserID    string    `json:"userId"`
	ParentID  *string   `json:"parentId,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}
