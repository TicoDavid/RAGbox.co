package service

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// StorageClient abstracts Cloud Storage operations for testability.
type StorageClient interface {
	SignedURL(bucket, object string, opts *SignedURLOptions) (string, error)
}

// SignedURLOptions mirrors the options needed for generating signed URLs.
type SignedURLOptions struct {
	Method      string
	Expires     time.Time
	ContentType string
}

// DocumentRepository defines the persistence operations for documents.
type DocumentRepository interface {
	Create(ctx context.Context, doc *model.Document) error
	GetByID(ctx context.Context, id string) (*model.Document, error)
	ListByUser(ctx context.Context, userID string, opts ListOpts) ([]model.Document, int, error)
	UpdateStatus(ctx context.Context, id string, status model.IndexStatus) error
	UpdateText(ctx context.Context, id string, text string, pageCount int) error
	UpdateChunkCount(ctx context.Context, id string, count int) error
	SoftDelete(ctx context.Context, id string) error
	Recover(ctx context.Context, id string) error
	UpdateTier(ctx context.Context, id string, tier int) error
	TogglePrivilege(ctx context.Context, id string, privileged bool) error
	Update(ctx context.Context, id string, name string) error
	UpdateFolder(ctx context.Context, id string, folderID *string) error
	ToggleStar(ctx context.Context, id string, starred bool) error
	UpdateChecksum(ctx context.Context, id string, checksum string) error
}

// FolderRepository defines persistence operations for folders.
type FolderRepository interface {
	Create(ctx context.Context, folder *model.Folder) error
	ListByUser(ctx context.Context, userID string) ([]model.Folder, error)
	GetByID(ctx context.Context, id string) (*model.Folder, error)
	Delete(ctx context.Context, id string) error
}

// DocSummary is a lightweight document summary for chat-handler queries like
// "summarize my documents". (STORY-172)
type DocSummary struct {
	ID           string
	OriginalName string
	IndexStatus  string
	CreatedAt    string
}

// ListOpts holds pagination and filtering options for document listing.
type ListOpts struct {
	Limit         int
	Offset        int
	PrivilegeMode bool
	Search        string
}

// SignedURLResponse is returned to the client with the upload URL.
type SignedURLResponse struct {
	URL        string `json:"url"`
	DocumentID string `json:"documentId"`
	ObjectName string `json:"objectName"`
}

// DocumentService handles document upload orchestration.
type DocumentService struct {
	storage    StorageClient
	docRepo    DocumentRepository
	bucketName string
	urlExpiry  time.Duration
}

// NewDocumentService creates a DocumentService.
func NewDocumentService(storage StorageClient, docRepo DocumentRepository, bucketName string, urlExpiry time.Duration) *DocumentService {
	return &DocumentService{
		storage:    storage,
		docRepo:    docRepo,
		bucketName: bucketName,
		urlExpiry:  urlExpiry,
	}
}

// GenerateUploadURL creates a signed PUT URL for direct client upload to Cloud Storage
// and creates a pending document record in the database.
func (s *DocumentService) GenerateUploadURL(ctx context.Context, userID, filename, contentType string, sizeBytes int, folderID string) (*SignedURLResponse, error) {
	if !model.AllowedMimeTypes[contentType] {
		return nil, fmt.Errorf("service.GenerateUploadURL: unsupported content type %q", contentType)
	}

	if sizeBytes > model.MaxFileSizeBytes {
		return nil, fmt.Errorf("service.GenerateUploadURL: file size %d exceeds maximum %d bytes", sizeBytes, model.MaxFileSizeBytes)
	}

	if sizeBytes <= 0 {
		return nil, fmt.Errorf("service.GenerateUploadURL: file size must be positive")
	}

	docID := uuid.New().String()
	objectName := fmt.Sprintf("uploads/%s/%s/%s", userID, docID, filename)

	url, err := s.storage.SignedURL(s.bucketName, objectName, &SignedURLOptions{
		Method:      "PUT",
		Expires:     time.Now().Add(s.urlExpiry),
		ContentType: contentType,
	})
	if err != nil {
		return nil, fmt.Errorf("service.GenerateUploadURL: sign URL: %w", err)
	}

	fileType := strings.TrimPrefix(filepath.Ext(filename), ".")
	storagePath := objectName
	storageURI := fmt.Sprintf("gs://%s/%s", s.bucketName, objectName)

	doc := &model.Document{
		ID:             docID,
		UserID:         userID,
		Filename:       filename,
		OriginalName:   filename,
		MimeType:       contentType,
		FileType:       fileType,
		SizeBytes:      sizeBytes,
		StoragePath:    &storagePath,
		StorageURI:     &storageURI,
		IndexStatus:    model.IndexPending,
		DeletionStatus: model.DeletionActive,
		CreatedAt:      time.Now().UTC(),
		UpdatedAt:      time.Now().UTC(),
	}
	if folderID != "" {
		doc.FolderID = &folderID
	}

	if err := s.docRepo.Create(ctx, doc); err != nil {
		return nil, fmt.Errorf("service.GenerateUploadURL: create document: %w", err)
	}

	return &SignedURLResponse{
		URL:        url,
		DocumentID: docID,
		ObjectName: objectName,
	}, nil
}
