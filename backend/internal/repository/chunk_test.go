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

func setupChunkRepo(t *testing.T) (*ChunkRepo, *DocumentRepo, func()) {
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
			VALUES ('test-user-chunk', 'chunktest@ragbox.co', 'Associate', 'Active', now())
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

	chunkRepo := NewChunkRepo(pool)
	docRepo := NewDocumentRepo(pool)

	return chunkRepo, docRepo, func() { pool.Close() }
}

// createTestDocForChunks creates a document in the DB that chunks can reference.
func createTestDocForChunks(t *testing.T, docRepo *DocumentRepo, privileged bool) *model.Document {
	t.Helper()
	doc := newTestDoc("test-user-chunk")
	doc.IsPrivileged = privileged
	if err := docRepo.Create(context.Background(), doc); err != nil {
		t.Fatalf("create test doc: %v", err)
	}
	if privileged {
		if err := docRepo.TogglePrivilege(context.Background(), doc.ID, true); err != nil {
			t.Fatalf("toggle privilege: %v", err)
		}
	}
	return doc
}

func TestChunkRepo_BulkInsert(t *testing.T) {
	repo, docRepo, cleanup := setupChunkRepo(t)
	defer cleanup()

	doc := createTestDocForChunks(t, docRepo, false)
	ctx := context.Background()

	chunks := []service.Chunk{
		{Content: "First chunk content", ContentHash: "hash1", TokenCount: 10, Index: 0, DocumentID: doc.ID},
		{Content: "Second chunk content", ContentHash: "hash2", TokenCount: 12, Index: 1, DocumentID: doc.ID},
		{Content: "Third chunk content", ContentHash: "hash3", TokenCount: 8, Index: 2, DocumentID: doc.ID},
	}
	vectors := make([][]float32, 3)
	for i := range vectors {
		vec := make([]float32, 768)
		vec[0] = float32(i + 1)
		vec[1] = 0.5
		vectors[i] = vec
	}

	err := repo.BulkInsert(ctx, chunks, vectors)
	if err != nil {
		t.Fatalf("BulkInsert() error: %v", err)
	}

	count, err := repo.CountByDocumentID(ctx, doc.ID)
	if err != nil {
		t.Fatalf("CountByDocumentID() error: %v", err)
	}
	if count != 3 {
		t.Errorf("count = %d, want 3", count)
	}
}

func TestChunkRepo_BulkInsert_Empty(t *testing.T) {
	repo, _, cleanup := setupChunkRepo(t)
	defer cleanup()

	err := repo.BulkInsert(context.Background(), []service.Chunk{}, [][]float32{})
	if err != nil {
		t.Fatalf("BulkInsert(empty) should succeed: %v", err)
	}
}

func TestChunkRepo_BulkInsert_MismatchedLengths(t *testing.T) {
	repo, _, cleanup := setupChunkRepo(t)
	defer cleanup()

	chunks := []service.Chunk{{Content: "test", DocumentID: "x"}}
	vectors := [][]float32{{1.0}, {2.0}} // 2 vectors for 1 chunk

	err := repo.BulkInsert(context.Background(), chunks, vectors)
	if err == nil {
		t.Fatal("expected error for mismatched chunk/vector counts")
	}
}

func TestChunkRepo_DeleteByDocumentID(t *testing.T) {
	repo, docRepo, cleanup := setupChunkRepo(t)
	defer cleanup()

	doc := createTestDocForChunks(t, docRepo, false)
	ctx := context.Background()

	chunks := []service.Chunk{
		{Content: "Delete me 1", ContentHash: "delhash1", TokenCount: 5, Index: 0, DocumentID: doc.ID},
		{Content: "Delete me 2", ContentHash: "delhash2", TokenCount: 5, Index: 1, DocumentID: doc.ID},
	}
	vectors := make([][]float32, 2)
	for i := range vectors {
		vec := make([]float32, 768)
		vec[0] = float32(i + 1)
		vectors[i] = vec
	}
	repo.BulkInsert(ctx, chunks, vectors)

	err := repo.DeleteByDocumentID(ctx, doc.ID)
	if err != nil {
		t.Fatalf("DeleteByDocumentID() error: %v", err)
	}

	count, _ := repo.CountByDocumentID(ctx, doc.ID)
	if count != 0 {
		t.Errorf("count after delete = %d, want 0", count)
	}
}

func TestChunkRepo_CountByDocumentID_NoChunks(t *testing.T) {
	repo, _, cleanup := setupChunkRepo(t)
	defer cleanup()

	count, err := repo.CountByDocumentID(context.Background(), uuid.New().String())
	if err != nil {
		t.Fatalf("CountByDocumentID() error: %v", err)
	}
	if count != 0 {
		t.Errorf("count = %d, want 0 for non-existent document", count)
	}
}

func TestChunkRepo_SimilaritySearch(t *testing.T) {
	repo, docRepo, cleanup := setupChunkRepo(t)
	defer cleanup()

	doc := createTestDocForChunks(t, docRepo, false)
	ctx := context.Background()

	// Use a unique high-dimensional direction to avoid collisions with other test data.
	// Place vec1 along axis 100, vec2 along axis 200.
	vec1 := make([]float32, 768)
	vec1[100] = 1.0

	vec2 := make([]float32, 768)
	vec2[200] = 1.0

	chunks := []service.Chunk{
		{Content: "About machine learning " + doc.ID, ContentHash: "simhash1-" + doc.ID, TokenCount: 4, Index: 0, DocumentID: doc.ID},
		{Content: "About legal contracts " + doc.ID, ContentHash: "simhash2-" + doc.ID, TokenCount: 4, Index: 1, DocumentID: doc.ID},
	}
	vectors := [][]float32{vec1, vec2}

	err := repo.BulkInsert(ctx, chunks, vectors)
	if err != nil {
		t.Fatalf("BulkInsert() error: %v", err)
	}

	// Search with query vector matching vec1 exactly
	queryVec := make([]float32, 768)
	queryVec[100] = 1.0

	results, err := repo.SimilaritySearch(ctx, queryVec, 5, 0.9, "test-user-chunk", false)
	if err != nil {
		t.Fatalf("SimilaritySearch() error: %v", err)
	}

	if len(results) == 0 {
		t.Fatal("expected at least 1 result")
	}

	// Find our chunk in results (there may be other data in the DB)
	found := false
	for _, r := range results {
		if r.Document.ID == doc.ID && r.Similarity > 0.99 {
			found = true
			if r.Document.UserID != "test-user-chunk" {
				t.Errorf("result doc UserID = %q, want %q", r.Document.UserID, "test-user-chunk")
			}
		}
	}
	if !found {
		t.Errorf("expected to find our doc %s in results with similarity > 0.99", doc.ID)
	}
}

func TestChunkRepo_SimilaritySearch_ExcludePrivileged(t *testing.T) {
	repo, docRepo, cleanup := setupChunkRepo(t)
	defer cleanup()

	ctx := context.Background()

	// Use a unique vector axis to isolate this test from other data
	normalDoc := createTestDocForChunks(t, docRepo, false)
	normalVec := make([]float32, 768)
	normalVec[300] = 1.0
	repo.BulkInsert(ctx, []service.Chunk{
		{Content: "Normal doc " + normalDoc.ID, ContentHash: "normhash-" + normalDoc.ID, TokenCount: 4, Index: 0, DocumentID: normalDoc.ID},
	}, [][]float32{normalVec})

	privDoc := createTestDocForChunks(t, docRepo, true)
	privVec := make([]float32, 768)
	privVec[300] = 1.0
	repo.BulkInsert(ctx, []service.Chunk{
		{Content: "Privileged doc " + privDoc.ID, ContentHash: "privhash-" + privDoc.ID, TokenCount: 4, Index: 0, DocumentID: privDoc.ID},
	}, [][]float32{privVec})

	queryVec := make([]float32, 768)
	queryVec[300] = 1.0

	// Search WITHOUT excluding privileged — should find both
	allResults, err := repo.SimilaritySearch(ctx, queryVec, 100, 0.9, "test-user-chunk", false)
	if err != nil {
		t.Fatalf("SimilaritySearch(all) error: %v", err)
	}

	foundPriv := false
	foundNormal := false
	for _, r := range allResults {
		if r.Document.ID == privDoc.ID {
			foundPriv = true
		}
		if r.Document.ID == normalDoc.ID {
			foundNormal = true
		}
	}
	if !foundPriv {
		t.Error("expected privileged doc in unfiltered results")
	}
	if !foundNormal {
		t.Error("expected normal doc in unfiltered results")
	}

	// Search WITH excluding privileged — privileged doc should not appear
	filteredResults, err := repo.SimilaritySearch(ctx, queryVec, 100, 0.9, "test-user-chunk", true)
	if err != nil {
		t.Fatalf("SimilaritySearch(exclude) error: %v", err)
	}

	for _, r := range filteredResults {
		if r.Document.ID == privDoc.ID {
			t.Error("privileged doc should not appear when excludePrivileged=true")
		}
	}

	// Normal doc should still be found
	foundNormal = false
	for _, r := range filteredResults {
		if r.Document.ID == normalDoc.ID {
			foundNormal = true
		}
	}
	if !foundNormal {
		t.Error("normal doc should appear when excludePrivileged=true")
	}
}

func TestChunkRepo_SimilaritySearch_ThresholdFilters(t *testing.T) {
	repo, docRepo, cleanup := setupChunkRepo(t)
	defer cleanup()

	doc := createTestDocForChunks(t, docRepo, false)
	ctx := context.Background()

	// Use axis 400 which is unlikely to match any existing data
	vec := make([]float32, 768)
	vec[400] = 1.0
	repo.BulkInsert(ctx, []service.Chunk{
		{Content: "Threshold test " + doc.ID, ContentHash: "threshhash-" + doc.ID, TokenCount: 4, Index: 0, DocumentID: doc.ID},
	}, [][]float32{vec})

	// Query with an orthogonal vector along axis 600 — cosine similarity should be ~0
	orthogonalVec := make([]float32, 768)
	orthogonalVec[600] = 1.0

	results, err := repo.SimilaritySearch(ctx, orthogonalVec, 10, 0.5, "test-user-chunk", false)
	if err != nil {
		t.Fatalf("SimilaritySearch() error: %v", err)
	}

	// With threshold 0.5, our chunk should NOT appear (similarity ~0)
	for _, r := range results {
		if r.Document.ID == doc.ID {
			t.Errorf("threshold test chunk should not appear with orthogonal query, similarity=%f", r.Similarity)
		}
	}
}
