package service

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// mockStorage implements StorageClient for testing.
type mockStorage struct {
	url string
	err error
}

func (m *mockStorage) SignedURL(bucket, object string, opts *SignedURLOptions) (string, error) {
	if m.err != nil {
		return "", m.err
	}
	return m.url, nil
}

// mockDocRepo implements DocumentRepository for testing.
type mockDocRepo struct {
	created   *model.Document
	doc       *model.Document
	docs      []model.Document
	total     int
	createErr error
	getErr    error
}

func (m *mockDocRepo) Create(ctx context.Context, doc *model.Document) error {
	m.created = doc
	return m.createErr
}

func (m *mockDocRepo) GetByID(ctx context.Context, id string) (*model.Document, error) {
	if m.getErr != nil {
		return nil, m.getErr
	}
	return m.doc, nil
}

func (m *mockDocRepo) ListByUser(ctx context.Context, userID string, opts ListOpts) ([]model.Document, int, error) {
	return m.docs, m.total, nil
}

func (m *mockDocRepo) UpdateStatus(ctx context.Context, id string, status model.IndexStatus) error {
	return nil
}

func (m *mockDocRepo) UpdateText(ctx context.Context, id string, text string, pageCount int) error {
	return nil
}

func (m *mockDocRepo) UpdateChunkCount(ctx context.Context, id string, count int) error {
	return nil
}

func (m *mockDocRepo) SoftDelete(ctx context.Context, id string) error {
	return nil
}

func (m *mockDocRepo) Recover(ctx context.Context, id string) error {
	return nil
}

func (m *mockDocRepo) UpdateTier(ctx context.Context, id string, tier int) error {
	return nil
}

func (m *mockDocRepo) TogglePrivilege(ctx context.Context, id string, privileged bool) error {
	return nil
}

func (m *mockDocRepo) ToggleStar(ctx context.Context, id string, starred bool) error {
	return nil
}

func (m *mockDocRepo) Update(ctx context.Context, id string, name string) error {
	return nil
}

func (m *mockDocRepo) UpdateFolder(ctx context.Context, id string, folderID *string) error {
	return nil
}

func TestGenerateUploadURL_Success(t *testing.T) {
	storage := &mockStorage{url: "https://storage.googleapis.com/signed-url"}
	repo := &mockDocRepo{}
	svc := NewDocumentService(storage, repo, "ragbox-docs", 15*time.Minute)

	resp, err := svc.GenerateUploadURL(context.Background(), "user-123", "contract.pdf", "application/pdf", 1024*1024, "")
	if err != nil {
		t.Fatalf("GenerateUploadURL() error: %v", err)
	}

	if resp.URL != "https://storage.googleapis.com/signed-url" {
		t.Errorf("URL = %q, want signed URL", resp.URL)
	}
	if resp.DocumentID == "" {
		t.Error("DocumentID should not be empty")
	}
	if resp.ObjectName == "" {
		t.Error("ObjectName should not be empty")
	}

	// Verify document was created in repo
	if repo.created == nil {
		t.Fatal("expected document to be created in repo")
	}
	if repo.created.UserID != "user-123" {
		t.Errorf("UserID = %q, want %q", repo.created.UserID, "user-123")
	}
	if repo.created.IndexStatus != model.IndexPending {
		t.Errorf("IndexStatus = %q, want %q", repo.created.IndexStatus, model.IndexPending)
	}
	if repo.created.MimeType != "application/pdf" {
		t.Errorf("MimeType = %q, want %q", repo.created.MimeType, "application/pdf")
	}
	if repo.created.FileType != "pdf" {
		t.Errorf("FileType = %q, want %q", repo.created.FileType, "pdf")
	}
}

func TestGenerateUploadURL_UnsupportedMimeType(t *testing.T) {
	storage := &mockStorage{url: "https://example.com"}
	repo := &mockDocRepo{}
	svc := NewDocumentService(storage, repo, "bucket", 15*time.Minute)

	_, err := svc.GenerateUploadURL(context.Background(), "user-1", "file.exe", "application/x-msdownload", 1024, "")
	if err == nil {
		t.Fatal("expected error for unsupported mime type")
	}
}

func TestGenerateUploadURL_FileTooLarge(t *testing.T) {
	storage := &mockStorage{url: "https://example.com"}
	repo := &mockDocRepo{}
	svc := NewDocumentService(storage, repo, "bucket", 15*time.Minute)

	_, err := svc.GenerateUploadURL(context.Background(), "user-1", "huge.pdf", "application/pdf", 100*1024*1024, "")
	if err == nil {
		t.Fatal("expected error for file >50MB")
	}
}

func TestGenerateUploadURL_ZeroSize(t *testing.T) {
	storage := &mockStorage{url: "https://example.com"}
	repo := &mockDocRepo{}
	svc := NewDocumentService(storage, repo, "bucket", 15*time.Minute)

	_, err := svc.GenerateUploadURL(context.Background(), "user-1", "empty.pdf", "application/pdf", 0, "")
	if err == nil {
		t.Fatal("expected error for zero size")
	}
}

func TestGenerateUploadURL_StorageError(t *testing.T) {
	storage := &mockStorage{err: fmt.Errorf("storage unavailable")}
	repo := &mockDocRepo{}
	svc := NewDocumentService(storage, repo, "bucket", 15*time.Minute)

	_, err := svc.GenerateUploadURL(context.Background(), "user-1", "file.pdf", "application/pdf", 1024, "")
	if err == nil {
		t.Fatal("expected error when storage fails")
	}
}

func TestGenerateUploadURL_RepoCreateError(t *testing.T) {
	storage := &mockStorage{url: "https://example.com"}
	repo := &mockDocRepo{createErr: fmt.Errorf("db error")}
	svc := NewDocumentService(storage, repo, "bucket", 15*time.Minute)

	_, err := svc.GenerateUploadURL(context.Background(), "user-1", "file.pdf", "application/pdf", 1024, "")
	if err == nil {
		t.Fatal("expected error when repo Create fails")
	}
}

func TestGenerateUploadURL_AllMimeTypes(t *testing.T) {
	types := []struct {
		filename    string
		contentType string
	}{
		{"doc.pdf", "application/pdf"},
		{"doc.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
		{"notes.txt", "text/plain"},
		{"data.csv", "text/csv"},
		{"sheet.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
		{"scan.png", "image/png"},
		{"photo.jpg", "image/jpeg"},
	}

	for _, tt := range types {
		t.Run(tt.contentType, func(t *testing.T) {
			storage := &mockStorage{url: "https://example.com"}
			repo := &mockDocRepo{}
			svc := NewDocumentService(storage, repo, "bucket", 15*time.Minute)

			resp, err := svc.GenerateUploadURL(context.Background(), "user-1", tt.filename, tt.contentType, 1024, "")
			if err != nil {
				t.Fatalf("GenerateUploadURL(%q) error: %v", tt.contentType, err)
			}
			if resp.URL == "" {
				t.Error("expected non-empty URL")
			}
		})
	}
}

func TestGenerateUploadURL_ObjectPathScoped(t *testing.T) {
	storage := &mockStorage{url: "https://example.com"}
	repo := &mockDocRepo{}
	svc := NewDocumentService(storage, repo, "bucket", 15*time.Minute)

	resp, err := svc.GenerateUploadURL(context.Background(), "user-xyz", "report.pdf", "application/pdf", 2048, "")
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	// Object name should be scoped to user
	if !contains(resp.ObjectName, "user-xyz") {
		t.Errorf("ObjectName %q should contain user ID", resp.ObjectName)
	}
	if !contains(resp.ObjectName, "report.pdf") {
		t.Errorf("ObjectName %q should contain filename", resp.ObjectName)
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && searchString(s, substr)
}

func searchString(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
