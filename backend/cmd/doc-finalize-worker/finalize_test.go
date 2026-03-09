// Sarah — EPIC-034 T6: Finalize Worker Tests — FAIL-OPEN CRITICAL
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/connexus-ai/ragbox-backend/internal/model"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// ── Mocks ──────────────────────────────────────────────────────

type mockCache struct {
	queryCacheInvalidated bool
	docCacheInvalidated   bool
	statsSet              bool
	invalidatedTenantID   string
	invalidatedDocID      string
	statsTenantID         string
}

func (m *mockCache) InvalidateQueryCache(ctx context.Context, tenantID string) {
	m.queryCacheInvalidated = true
	m.invalidatedTenantID = tenantID
}

func (m *mockCache) InvalidateDocCache(ctx context.Context, documentID string) {
	m.docCacheInvalidated = true
	m.invalidatedDocID = documentID
}

func (m *mockCache) SetVaultStats(ctx context.Context, tenantID string, stats interface{}) {
	m.statsSet = true
	m.statsTenantID = tenantID
}

type mockStatusUpdater struct {
	statuses  []model.IndexStatus
	updateErr error
}

func (m *mockStatusUpdater) UpdateStatus(ctx context.Context, id string, status model.IndexStatus) error {
	m.statuses = append(m.statuses, status)
	return m.updateErr
}

type mockAuditLogger struct {
	logged    bool
	action    string
	userID    string
	err       error
}

func (m *mockAuditLogger) Log(ctx context.Context, action, userID, resourceID, resourceType string) error {
	m.logged = true
	m.action = action
	m.userID = userID
	return m.err
}

type mockStatsComputer struct {
	stats *service.VaultStats
	err   error
}

func (m *mockStatsComputer) ComputeVaultStats(ctx context.Context, tenantID string) (*service.VaultStats, error) {
	return m.stats, m.err
}

// ── Helpers ────────────────────────────────────────────────────

func makeFinalizeInput(overrides ...func(*finalizeInput)) finalizeInput {
	in := finalizeInput{
		DocumentID:  "doc-001",
		TenantID:    "tenant-001",
		TotalChunks: 5,
		Filename:    "contract.pdf",
	}
	for _, f := range overrides {
		f(&in)
	}
	return in
}

func marshal(t *testing.T, v interface{}) []byte {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	return b
}

// ── Tests ──────────────────────────────────────────────────────

func TestProcessFinalize_InvalidatesQueryCache(t *testing.T) {
	cache := &mockCache{}
	docRepo := &mockStatusUpdater{}
	audit := &mockAuditLogger{}
	stats := &mockStatsComputer{
		stats: &service.VaultStats{DocumentCount: 10, ChunkCount: 50},
	}

	err := processFinalize(context.Background(), marshal(t, makeFinalizeInput()), cache, docRepo, audit, stats)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !cache.queryCacheInvalidated {
		t.Error("expected query cache to be invalidated")
	}
	if cache.invalidatedTenantID != "tenant-001" {
		t.Errorf("invalidated tenant = %q, want %q", cache.invalidatedTenantID, "tenant-001")
	}
}

func TestProcessFinalize_InvalidatesDocCache(t *testing.T) {
	cache := &mockCache{}
	docRepo := &mockStatusUpdater{}
	audit := &mockAuditLogger{}
	stats := &mockStatsComputer{
		stats: &service.VaultStats{DocumentCount: 10, ChunkCount: 50},
	}

	err := processFinalize(context.Background(), marshal(t, makeFinalizeInput()), cache, docRepo, audit, stats)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !cache.docCacheInvalidated {
		t.Error("expected doc cache to be invalidated")
	}
	if cache.invalidatedDocID != "doc-001" {
		t.Errorf("invalidated docID = %q, want %q", cache.invalidatedDocID, "doc-001")
	}
}

func TestProcessFinalize_WarmsVaultStats(t *testing.T) {
	cache := &mockCache{}
	docRepo := &mockStatusUpdater{}
	audit := &mockAuditLogger{}
	stats := &mockStatsComputer{
		stats: &service.VaultStats{DocumentCount: 15, ChunkCount: 120},
	}

	err := processFinalize(context.Background(), marshal(t, makeFinalizeInput()), cache, docRepo, audit, stats)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !cache.statsSet {
		t.Error("expected vault stats to be cached")
	}
	if cache.statsTenantID != "tenant-001" {
		t.Errorf("stats tenant = %q, want %q", cache.statsTenantID, "tenant-001")
	}
}

func TestProcessFinalize_VerifiesIndexedStatus(t *testing.T) {
	cache := &mockCache{}
	docRepo := &mockStatusUpdater{}
	audit := &mockAuditLogger{}
	stats := &mockStatsComputer{
		stats: &service.VaultStats{DocumentCount: 1, ChunkCount: 5},
	}

	err := processFinalize(context.Background(), marshal(t, makeFinalizeInput()), cache, docRepo, audit, stats)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(docRepo.statuses) == 0 {
		t.Fatal("expected UpdateStatus call")
	}
	if docRepo.statuses[0] != model.IndexIndexed {
		t.Errorf("status = %q, want %q", docRepo.statuses[0], model.IndexIndexed)
	}
}

func TestProcessFinalize_LogsAuditEntry(t *testing.T) {
	cache := &mockCache{}
	docRepo := &mockStatusUpdater{}
	audit := &mockAuditLogger{}
	stats := &mockStatsComputer{
		stats: &service.VaultStats{DocumentCount: 1, ChunkCount: 5},
	}

	err := processFinalize(context.Background(), marshal(t, makeFinalizeInput()), cache, docRepo, audit, stats)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !audit.logged {
		t.Error("expected audit entry to be logged")
	}
	if audit.action != "DocumentUpload" {
		t.Errorf("audit action = %q, want %q", audit.action, "DocumentUpload")
	}
	if audit.userID != "tenant-001" {
		t.Errorf("audit userID = %q, want %q", audit.userID, "tenant-001")
	}
}

func TestProcessFinalize_FailOpen_RedisDown(t *testing.T) {
	// Redis errors should NOT stop finalization (fail-open)
	// The cache mock methods don't return errors (matching the real RedisClient which logs internally)
	// Stats computation failure is handled gracefully
	cache := &mockCache{}
	docRepo := &mockStatusUpdater{}
	audit := &mockAuditLogger{}
	stats := &mockStatsComputer{
		err: fmt.Errorf("redis: connection refused"),
	}

	err := processFinalize(context.Background(), marshal(t, makeFinalizeInput()), cache, docRepo, audit, stats)
	// Should NOT return error — fail-open
	if err != nil {
		t.Fatalf("FAIL-OPEN violated: finalize returned error %v despite Redis failure", err)
	}

	// Cache invalidation should still be called (even if Redis is down, the mock succeeds)
	// Status update and audit should still happen
	if len(docRepo.statuses) == 0 {
		t.Error("expected status update despite Redis failure")
	}
	if !audit.logged {
		t.Error("expected audit log despite Redis failure")
	}

	// Stats should NOT be cached (computation failed)
	if cache.statsSet {
		t.Error("should not cache stats when computation fails")
	}
}

func TestProcessFinalize_InvalidJSON(t *testing.T) {
	cache := &mockCache{}
	docRepo := &mockStatusUpdater{}
	audit := &mockAuditLogger{}
	stats := &mockStatsComputer{}

	err := processFinalize(context.Background(), []byte("invalid"), cache, docRepo, audit, stats)
	if err == nil {
		t.Fatal("expected error for invalid JSON")
	}
}
