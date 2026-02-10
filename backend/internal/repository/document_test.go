package repository

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/connexus-ai/ragbox-backend/internal/model"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

func setupDocRepo(t *testing.T) (*DocumentRepo, func()) {
	t.Helper()
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL not set, skipping integration test")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := NewPool(ctx, dbURL, 5)
	if err != nil {
		t.Fatalf("NewPool: %v", err)
	}

	// Ensure schema + test user exist. Retry because migration tests in the
	// migrations package may concurrently drop/recreate tables.
	migrationSQL, err := os.ReadFile("../../migrations/001_initial_schema.up.sql")
	if err != nil {
		pool.Close()
		t.Fatalf("read migration: %v", err)
	}

	ensureSchema := func() error {
		if _, err := pool.Exec(ctx, string(migrationSQL)); err != nil {
			return err
		}
		_, err := pool.Exec(ctx, `
			INSERT INTO users (id, email, role, status, created_at)
			VALUES ('test-user-doc', 'doctest@ragbox.co', 'Associate', 'Active', now())
			ON CONFLICT (id) DO NOTHING
		`)
		return err
	}

	for attempt := 0; attempt < 5; attempt++ {
		err = ensureSchema()
		if err == nil {
			break
		}
		time.Sleep(time.Duration(attempt+1) * time.Second)
	}
	if err != nil {
		pool.Close()
		t.Fatalf("setup schema after retries: %v", err)
	}

	repo := NewDocumentRepo(pool)
	return repo, func() {
		pool.Close()
	}
}

func newTestDoc(userID string) *model.Document {
	id := uuid.New().String()
	storagePath := "uploads/" + userID + "/" + id + "/test.pdf"
	storageURI := "gs://bucket/" + storagePath
	return &model.Document{
		ID:             id,
		UserID:         userID,
		Filename:       "test.pdf",
		OriginalName:   "test.pdf",
		MimeType:       "application/pdf",
		FileType:       "pdf",
		SizeBytes:      1024,
		StoragePath:    &storagePath,
		StorageURI:     &storageURI,
		IndexStatus:    model.IndexPending,
		DeletionStatus: model.DeletionActive,
		CreatedAt:      time.Now().UTC(),
		UpdatedAt:      time.Now().UTC(),
	}
}

func TestDocumentRepo_CreateAndGetByID(t *testing.T) {
	repo, cleanup := setupDocRepo(t)
	defer cleanup()

	ctx := context.Background()
	doc := newTestDoc("test-user-doc")

	if err := repo.Create(ctx, doc); err != nil {
		t.Fatalf("Create() error: %v", err)
	}

	got, err := repo.GetByID(ctx, doc.ID)
	if err != nil {
		t.Fatalf("GetByID() error: %v", err)
	}

	if got.ID != doc.ID {
		t.Errorf("ID = %q, want %q", got.ID, doc.ID)
	}
	if got.UserID != doc.UserID {
		t.Errorf("UserID = %q, want %q", got.UserID, doc.UserID)
	}
	if got.IndexStatus != model.IndexPending {
		t.Errorf("IndexStatus = %q, want %q", got.IndexStatus, model.IndexPending)
	}
	if got.Filename != "test.pdf" {
		t.Errorf("Filename = %q, want %q", got.Filename, "test.pdf")
	}
}

func TestDocumentRepo_ListByUser(t *testing.T) {
	repo, cleanup := setupDocRepo(t)
	defer cleanup()

	ctx := context.Background()

	// Create 3 documents
	for i := 0; i < 3; i++ {
		doc := newTestDoc("test-user-doc")
		if err := repo.Create(ctx, doc); err != nil {
			t.Fatalf("Create() error: %v", err)
		}
	}

	docs, total, err := repo.ListByUser(ctx, "test-user-doc", service.ListOpts{Limit: 10, Offset: 0, PrivilegeMode: true})
	if err != nil {
		t.Fatalf("ListByUser() error: %v", err)
	}

	if total < 3 {
		t.Errorf("total = %d, want >= 3", total)
	}
	if len(docs) < 3 {
		t.Errorf("docs count = %d, want >= 3", len(docs))
	}
}

func TestDocumentRepo_SoftDelete(t *testing.T) {
	repo, cleanup := setupDocRepo(t)
	defer cleanup()

	ctx := context.Background()
	doc := newTestDoc("test-user-doc")
	repo.Create(ctx, doc)

	if err := repo.SoftDelete(ctx, doc.ID); err != nil {
		t.Fatalf("SoftDelete() error: %v", err)
	}

	got, err := repo.GetByID(ctx, doc.ID)
	if err != nil {
		t.Fatalf("GetByID() error: %v", err)
	}

	if got.DeletionStatus != model.DeletionSoftDeleted {
		t.Errorf("DeletionStatus = %q, want %q", got.DeletionStatus, model.DeletionSoftDeleted)
	}
	if got.DeletedAt == nil {
		t.Error("DeletedAt should be set after soft delete")
	}
}

func TestDocumentRepo_TogglePrivilege(t *testing.T) {
	repo, cleanup := setupDocRepo(t)
	defer cleanup()

	ctx := context.Background()
	doc := newTestDoc("test-user-doc")
	repo.Create(ctx, doc)

	if err := repo.TogglePrivilege(ctx, doc.ID, true); err != nil {
		t.Fatalf("TogglePrivilege(true) error: %v", err)
	}

	got, err := repo.GetByID(ctx, doc.ID)
	if err != nil {
		t.Fatalf("GetByID() error: %v", err)
	}
	if !got.IsPrivileged {
		t.Error("expected IsPrivileged=true after toggle")
	}

	// Toggle back
	if err := repo.TogglePrivilege(ctx, doc.ID, false); err != nil {
		t.Fatalf("TogglePrivilege(false) error: %v", err)
	}

	got, _ = repo.GetByID(ctx, doc.ID)
	if got.IsPrivileged {
		t.Error("expected IsPrivileged=false after toggle back")
	}
}

func TestDocumentRepo_UpdateStatus(t *testing.T) {
	repo, cleanup := setupDocRepo(t)
	defer cleanup()

	ctx := context.Background()
	doc := newTestDoc("test-user-doc")
	repo.Create(ctx, doc)

	if err := repo.UpdateStatus(ctx, doc.ID, model.IndexProcessing); err != nil {
		t.Fatalf("UpdateStatus() error: %v", err)
	}

	got, _ := repo.GetByID(ctx, doc.ID)
	if got.IndexStatus != model.IndexProcessing {
		t.Errorf("IndexStatus = %q, want %q", got.IndexStatus, model.IndexProcessing)
	}
}

func TestDocumentRepo_UpdateText(t *testing.T) {
	repo, cleanup := setupDocRepo(t)
	defer cleanup()

	ctx := context.Background()
	doc := newTestDoc("test-user-doc")
	repo.Create(ctx, doc)

	if err := repo.UpdateText(ctx, doc.ID, "Extracted text content", 5); err != nil {
		t.Fatalf("UpdateText() error: %v", err)
	}

	got, _ := repo.GetByID(ctx, doc.ID)
	if got.ExtractedText == nil || *got.ExtractedText != "Extracted text content" {
		t.Errorf("ExtractedText = %v, want 'Extracted text content'", got.ExtractedText)
	}
}

func TestDocumentRepo_ListByUser_PrivilegeFilter(t *testing.T) {
	repo, cleanup := setupDocRepo(t)
	defer cleanup()

	ctx := context.Background()

	// Create a normal doc
	normalDoc := newTestDoc("test-user-doc")
	repo.Create(ctx, normalDoc)

	// Create a privileged doc
	privDoc := newTestDoc("test-user-doc")
	repo.Create(ctx, privDoc)
	repo.TogglePrivilege(ctx, privDoc.ID, true)

	// Without privilege mode: should not include privileged docs
	docs, _, err := repo.ListByUser(ctx, "test-user-doc", service.ListOpts{Limit: 100, PrivilegeMode: false})
	if err != nil {
		t.Fatalf("ListByUser() error: %v", err)
	}

	for _, d := range docs {
		if d.IsPrivileged {
			t.Error("privileged doc should not appear when PrivilegeMode=false")
		}
	}

	// With privilege mode: should include all
	allDocs, _, err := repo.ListByUser(ctx, "test-user-doc", service.ListOpts{Limit: 100, PrivilegeMode: true})
	if err != nil {
		t.Fatalf("ListByUser(privileged) error: %v", err)
	}

	if len(allDocs) <= len(docs) {
		t.Error("privilege mode should return more or equal docs")
	}
}

func TestDocumentRepo_UpdateChunkCount(t *testing.T) {
	repo, cleanup := setupDocRepo(t)
	defer cleanup()

	ctx := context.Background()
	doc := newTestDoc("test-user-doc")
	repo.Create(ctx, doc)

	if err := repo.UpdateChunkCount(ctx, doc.ID, 42); err != nil {
		t.Fatalf("UpdateChunkCount() error: %v", err)
	}

	got, _ := repo.GetByID(ctx, doc.ID)
	if got.ChunkCount != 42 {
		t.Errorf("ChunkCount = %d, want 42", got.ChunkCount)
	}
}
