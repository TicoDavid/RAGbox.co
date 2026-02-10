package service

import (
	"context"
	"crypto/sha256"
	"fmt"
	"testing"
	"time"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// mockAuditRepo implements AuditRepository for testing.
type mockAuditRepo struct {
	entries    []*model.AuditLog
	latestHash string
	createErr  error
	rangeEntries []model.AuditLog
	rangeErr     error
}

func (m *mockAuditRepo) Create(ctx context.Context, entry *model.AuditLog) error {
	if m.createErr != nil {
		return m.createErr
	}
	m.entries = append(m.entries, entry)
	return nil
}

func (m *mockAuditRepo) GetLatestHash(ctx context.Context) (string, error) {
	return m.latestHash, nil
}

func (m *mockAuditRepo) GetRange(ctx context.Context, startID, endID string) ([]model.AuditLog, error) {
	if m.rangeErr != nil {
		return nil, m.rangeErr
	}
	return m.rangeEntries, nil
}

// mockBQWriter implements BigQueryWriter for testing.
type mockBQWriter struct {
	entries  []*model.AuditLog
	writeErr error
}

func (m *mockBQWriter) WriteAuditEntry(ctx context.Context, entry *model.AuditLog) error {
	if m.writeErr != nil {
		return m.writeErr
	}
	m.entries = append(m.entries, entry)
	return nil
}

func TestNewAuditService(t *testing.T) {
	repo := &mockAuditRepo{latestHash: "abc123"}
	svc, err := NewAuditService(repo, nil)
	if err != nil {
		t.Fatalf("NewAuditService() error: %v", err)
	}
	if svc.lastHash != "abc123" {
		t.Errorf("lastHash = %q, want %q", svc.lastHash, "abc123")
	}
}

func TestNewAuditService_EmptyChain(t *testing.T) {
	repo := &mockAuditRepo{latestHash: ""}
	svc, err := NewAuditService(repo, nil)
	if err != nil {
		t.Fatalf("NewAuditService() error: %v", err)
	}
	if svc.lastHash != "" {
		t.Errorf("lastHash = %q, want empty string (genesis)", svc.lastHash)
	}
}

func TestLog_SimpleSignature(t *testing.T) {
	repo := &mockAuditRepo{}
	svc, _ := NewAuditService(repo, nil)

	err := svc.Log(context.Background(), model.AuditDocumentUpload, "user1", "doc1", "document")
	if err != nil {
		t.Fatalf("Log() error: %v", err)
	}

	if len(repo.entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(repo.entries))
	}

	entry := repo.entries[0]
	if entry.Action != model.AuditDocumentUpload {
		t.Errorf("Action = %q, want %q", entry.Action, model.AuditDocumentUpload)
	}
	if *entry.UserID != "user1" {
		t.Errorf("UserID = %q, want %q", *entry.UserID, "user1")
	}
	if *entry.ResourceID != "doc1" {
		t.Errorf("ResourceID = %q, want %q", *entry.ResourceID, "doc1")
	}
	if entry.DetailsHash == nil {
		t.Fatal("DetailsHash should not be nil")
	}
}

func TestLogWithDetails(t *testing.T) {
	repo := &mockAuditRepo{}
	svc, _ := NewAuditService(repo, nil)

	details := map[string]interface{}{"filename": "contract.pdf", "size": 1024}
	err := svc.LogWithDetails(context.Background(), model.AuditDocumentUpload, "user1", "doc1", "document", details)
	if err != nil {
		t.Fatalf("LogWithDetails() error: %v", err)
	}

	entry := repo.entries[0]
	if entry.Details == nil {
		t.Fatal("Details should not be nil")
	}
	if entry.Severity != "LOW" {
		t.Errorf("Severity = %q, want LOW for DOCUMENT_UPLOAD", entry.Severity)
	}
}

func TestLogWithDetails_NilDetails(t *testing.T) {
	repo := &mockAuditRepo{}
	svc, _ := NewAuditService(repo, nil)

	err := svc.LogWithDetails(context.Background(), model.AuditDocumentDelete, "user1", "doc1", "document", nil)
	if err != nil {
		t.Fatalf("LogWithDetails() error: %v", err)
	}

	entry := repo.entries[0]
	if entry.Details != nil {
		t.Errorf("Details should be nil, got %s", string(entry.Details))
	}
}

func TestLog_HashChainLinks(t *testing.T) {
	repo := &mockAuditRepo{}
	svc, _ := NewAuditService(repo, nil)

	// Log two entries
	svc.Log(context.Background(), model.AuditDocumentUpload, "u1", "d1", "document")
	svc.Log(context.Background(), model.AuditQueryExecuted, "u1", "q1", "query")

	if len(repo.entries) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(repo.entries))
	}

	hash1 := *repo.entries[0].DetailsHash
	hash2 := *repo.entries[1].DetailsHash

	// Hashes should differ
	if hash1 == hash2 {
		t.Error("consecutive entries should have different hashes")
	}

	// Verify hash2 chains from hash1
	expectedHash := computeHash(hash1, repo.entries[1])
	if hash2 != expectedHash {
		t.Errorf("hash chain broken: got %q, want %q", hash2, expectedHash)
	}
}

func TestLog_HashChainFromPreviousHash(t *testing.T) {
	previousHash := "deadbeef1234"
	repo := &mockAuditRepo{latestHash: previousHash}
	svc, _ := NewAuditService(repo, nil)

	svc.Log(context.Background(), model.AuditUserLogin, "u1", "", "")

	entry := repo.entries[0]
	expected := computeHash(previousHash, entry)
	if *entry.DetailsHash != expected {
		t.Errorf("hash should chain from previous: got %q, want %q", *entry.DetailsHash, expected)
	}
}

func TestLog_BigQueryAsyncWrite(t *testing.T) {
	repo := &mockAuditRepo{}
	bq := &mockBQWriter{}
	svc, _ := NewAuditService(repo, bq)

	svc.Log(context.Background(), model.AuditDocumentUpload, "u1", "d1", "document")

	// Give goroutine time to execute
	time.Sleep(50 * time.Millisecond)

	if len(bq.entries) != 1 {
		t.Fatalf("expected 1 BQ entry, got %d", len(bq.entries))
	}

	if bq.entries[0].Action != model.AuditDocumentUpload {
		t.Errorf("BQ Action = %q, want %q", bq.entries[0].Action, model.AuditDocumentUpload)
	}
}

func TestLog_NilBigQueryWriter(t *testing.T) {
	repo := &mockAuditRepo{}
	svc, _ := NewAuditService(repo, nil)

	// Should not panic with nil BQ writer
	err := svc.Log(context.Background(), model.AuditDocumentUpload, "u1", "d1", "document")
	if err != nil {
		t.Fatalf("Log() with nil BQ should not error: %v", err)
	}
}

func TestLog_PGWriteError(t *testing.T) {
	repo := &mockAuditRepo{createErr: fmt.Errorf("connection refused")}
	svc, _ := NewAuditService(repo, nil)

	err := svc.Log(context.Background(), model.AuditDocumentUpload, "u1", "d1", "document")
	if err == nil {
		t.Fatal("expected error when PG write fails")
	}
}

func TestLog_EmptyOptionalFields(t *testing.T) {
	repo := &mockAuditRepo{}
	svc, _ := NewAuditService(repo, nil)

	err := svc.Log(context.Background(), model.AuditUserLogin, "u1", "", "")
	if err != nil {
		t.Fatalf("Log() error: %v", err)
	}

	entry := repo.entries[0]
	if entry.ResourceID != nil {
		t.Error("empty resourceID should result in nil pointer")
	}
	if entry.ResourceType != nil {
		t.Error("empty resourceType should result in nil pointer")
	}
}

func TestSeverityForAction(t *testing.T) {
	tests := []struct {
		action   string
		severity string
	}{
		{model.AuditDocumentDelete, "HIGH"},
		{model.AuditPrivilegeToggle, "HIGH"},
		{model.AuditSilenceTriggered, "MEDIUM"},
		{model.AuditDataExport, "MEDIUM"},
		{model.AuditDocumentUpload, "LOW"},
		{model.AuditDocumentRecover, "LOW"},
		{model.AuditQueryExecuted, "LOW"},
		{model.AuditForgeGenerate, "LOW"},
		{model.AuditUserLogin, "LOW"},
		{"UNKNOWN_ACTION", "INFO"},
	}

	for _, tt := range tests {
		t.Run(tt.action, func(t *testing.T) {
			got := severityForAction(tt.action)
			if got != tt.severity {
				t.Errorf("severityForAction(%q) = %q, want %q", tt.action, got, tt.severity)
			}
		})
	}
}

func TestComputeHash_Deterministic(t *testing.T) {
	entry := &model.AuditLog{
		Action:    model.AuditDocumentUpload,
		CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
	}

	hash1 := computeHash("prev", entry)
	hash2 := computeHash("prev", entry)

	if hash1 != hash2 {
		t.Error("computeHash should be deterministic")
	}
}

func TestComputeHash_DifferentPrevHash(t *testing.T) {
	entry := &model.AuditLog{
		Action:    model.AuditDocumentUpload,
		CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
	}

	hash1 := computeHash("prev1", entry)
	hash2 := computeHash("prev2", entry)

	if hash1 == hash2 {
		t.Error("different previous hashes should yield different results")
	}
}

func TestComputeHash_MatchesExpected(t *testing.T) {
	entry := &model.AuditLog{
		Action:    "TEST_ACTION",
		CreatedAt: time.Date(2025, 6, 15, 12, 0, 0, 0, time.UTC),
	}

	// Manually compute expected hash
	h := sha256.New()
	h.Write([]byte(""))                                                  // empty prev hash
	h.Write([]byte("TEST_ACTION"))                                       // action
	h.Write([]byte(entry.CreatedAt.Format(time.RFC3339Nano)))            // timestamp
	expected := fmt.Sprintf("%x", h.Sum(nil))

	got := computeHash("", entry)
	if got != expected {
		t.Errorf("hash mismatch: got %q, want %q", got, expected)
	}
}

func TestLog_CreatesValidEntry(t *testing.T) {
	repo := &mockAuditRepo{}
	svc, _ := NewAuditService(repo, nil)

	svc.Log(context.Background(), model.AuditDocumentUpload, "user1", "doc1", "document")

	entry := repo.entries[0]

	// Verify required fields are populated
	if entry.ID == "" {
		t.Error("entry ID should not be empty")
	}
	if entry.CreatedAt.IsZero() {
		t.Error("CreatedAt should not be zero")
	}
	if entry.DetailsHash == nil || *entry.DetailsHash == "" {
		t.Error("DetailsHash should be populated")
	}
}

// --- VerifyChain tests ---

// buildValidChain creates a sequence of audit entries with valid hash chain.
func buildValidChain(n int) []model.AuditLog {
	entries := make([]model.AuditLog, n)
	prevHash := ""
	for i := 0; i < n; i++ {
		entries[i] = model.AuditLog{
			ID:        fmt.Sprintf("entry-%d", i),
			Action:    model.AuditDocumentUpload,
			CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, i*1000000, time.UTC),
		}
		hash := computeHash(prevHash, &entries[i])
		entries[i].DetailsHash = &hash
		prevHash = hash
	}
	return entries
}

func TestVerifyChain_IntactChain(t *testing.T) {
	entries := buildValidChain(5)
	repo := &mockAuditRepo{rangeEntries: entries}
	svc, _ := NewAuditService(repo, nil)

	result, err := svc.VerifyChain(context.Background(), "entry-0", "entry-4")
	if err != nil {
		t.Fatalf("VerifyChain() error: %v", err)
	}
	if !result.Valid {
		t.Errorf("chain should be valid, broken at %q index %d", result.BrokenAt, result.BrokenIndex)
	}
	if result.EntriesChecked != 5 {
		t.Errorf("EntriesChecked = %d, want 5", result.EntriesChecked)
	}
}

func TestVerifyChain_TamperedEntry(t *testing.T) {
	entries := buildValidChain(5)
	// Tamper with entry 2
	tampered := "tampered_hash_value"
	entries[2].DetailsHash = &tampered

	repo := &mockAuditRepo{rangeEntries: entries}
	svc, _ := NewAuditService(repo, nil)

	result, err := svc.VerifyChain(context.Background(), "entry-0", "entry-4")
	if err != nil {
		t.Fatalf("VerifyChain() error: %v", err)
	}
	if result.Valid {
		t.Error("chain should be invalid after tampering")
	}
	if result.BrokenAt != "entry-2" {
		t.Errorf("BrokenAt = %q, want %q", result.BrokenAt, "entry-2")
	}
	if result.BrokenIndex != 2 {
		t.Errorf("BrokenIndex = %d, want 2", result.BrokenIndex)
	}
}

func TestVerifyChain_EmptyRange(t *testing.T) {
	repo := &mockAuditRepo{rangeEntries: nil}
	svc, _ := NewAuditService(repo, nil)

	result, err := svc.VerifyChain(context.Background(), "start", "end")
	if err != nil {
		t.Fatalf("VerifyChain() error: %v", err)
	}
	if !result.Valid {
		t.Error("empty range should be valid")
	}
	if result.EntriesChecked != 0 {
		t.Errorf("EntriesChecked = %d, want 0", result.EntriesChecked)
	}
}

func TestVerifyChain_SingleEntry(t *testing.T) {
	entries := buildValidChain(1)
	repo := &mockAuditRepo{rangeEntries: entries}
	svc, _ := NewAuditService(repo, nil)

	result, err := svc.VerifyChain(context.Background(), "entry-0", "entry-0")
	if err != nil {
		t.Fatalf("VerifyChain() error: %v", err)
	}
	if !result.Valid {
		t.Error("single entry should be valid")
	}
	if result.EntriesChecked != 1 {
		t.Errorf("EntriesChecked = %d, want 1", result.EntriesChecked)
	}
}

func TestVerifyChain_RepoError(t *testing.T) {
	repo := &mockAuditRepo{rangeErr: fmt.Errorf("database error")}
	svc, _ := NewAuditService(repo, nil)

	_, err := svc.VerifyChain(context.Background(), "start", "end")
	if err == nil {
		t.Fatal("expected error when repo fails")
	}
}

func TestVerifyChain_TamperedLastEntry(t *testing.T) {
	entries := buildValidChain(3)
	tampered := "bad_hash"
	entries[2].DetailsHash = &tampered

	repo := &mockAuditRepo{rangeEntries: entries}
	svc, _ := NewAuditService(repo, nil)

	result, err := svc.VerifyChain(context.Background(), "entry-0", "entry-2")
	if err != nil {
		t.Fatalf("VerifyChain() error: %v", err)
	}
	if result.Valid {
		t.Error("chain should detect tampered last entry")
	}
	if result.BrokenAt != "entry-2" {
		t.Errorf("BrokenAt = %q, want %q", result.BrokenAt, "entry-2")
	}
}
