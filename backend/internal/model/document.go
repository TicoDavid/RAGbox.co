package model

import (
	"encoding/json"
	"time"
)

type IndexStatus string

const (
	IndexPending    IndexStatus = "Pending"
	IndexProcessing IndexStatus = "Processing"
	IndexIndexed    IndexStatus = "Indexed"
	IndexFailed     IndexStatus = "Failed"
)

type DeletionStatus string

const (
	DeletionActive      DeletionStatus = "Active"
	DeletionSoftDeleted DeletionStatus = "SoftDeleted"
	DeletionHardDeleted DeletionStatus = "HardDeleted"
)

// Document represents an uploaded file in the vault.
type Document struct {
	ID             string          `json:"id"`
	VaultID        *string         `json:"vaultId,omitempty"`
	UserID         string          `json:"userId"`
	Filename       string          `json:"filename"`
	OriginalName   string          `json:"originalName"`
	MimeType       string          `json:"mimeType"`
	FileType       string          `json:"fileType"`
	SizeBytes      int             `json:"sizeBytes"`
	StorageURI     *string         `json:"storageUri,omitempty"`
	StoragePath    *string         `json:"storagePath,omitempty"`
	ExtractedText  *string         `json:"extractedText,omitempty"`
	IndexStatus    IndexStatus     `json:"indexStatus"`
	DeletionStatus DeletionStatus  `json:"deletionStatus"`
	IsPrivileged   bool            `json:"isPrivileged"`
	SecurityTier   int             `json:"securityTier"`
	IsStarred      bool            `json:"isStarred"`
	ChunkCount     int             `json:"chunkCount"`
	Checksum       *string         `json:"checksum,omitempty"`
	FolderID       *string         `json:"folderId,omitempty"`
	Metadata       json.RawMessage `json:"metadata,omitempty"`
	DeletedAt      *time.Time      `json:"deletedAt,omitempty"`
	HardDeleteAt   *time.Time      `json:"hardDeleteAt,omitempty"`
	CreatedAt      time.Time       `json:"createdAt"`
	UpdatedAt      time.Time       `json:"updatedAt"`
}

// DocumentChunk represents a chunked piece of a document with its embedding vector.
type DocumentChunk struct {
	ID          string    `json:"id"`
	DocumentID  string    `json:"documentId"`
	ChunkIndex  int       `json:"chunkIndex"`
	Content     string    `json:"content"`
	ContentHash string    `json:"contentHash"`
	TokenCount  int       `json:"tokenCount"`
	Embedding   []float32 `json:"-"`
	CreatedAt   time.Time `json:"createdAt"`
}

// AllowedMimeTypes lists the mime types accepted for upload.
var AllowedMimeTypes = map[string]bool{
	"application/pdf":                                                true,
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
	"text/plain":       true,
	"text/csv":         true,
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": true,
	"image/png":        true,
	"image/jpeg":       true,
}

// MaxFileSizeBytes is the maximum allowed upload size (50 MB).
const MaxFileSizeBytes = 50 * 1024 * 1024
