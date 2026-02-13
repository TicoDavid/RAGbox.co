package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// KBHealthRepo defines persistence operations for KB health checks.
type KBHealthRepo interface {
	InsertCheck(ctx context.Context, check *model.KBHealthCheck) error
	LatestByVault(ctx context.Context, vaultID string, limit int) ([]model.KBHealthCheck, error)
}

// DocumentLister retrieves documents for a vault.
type DocumentLister interface {
	ListByVault(ctx context.Context, vaultID string) ([]model.Document, error)
}

// KBHealthService runs health checks on vault knowledge bases.
type KBHealthService struct {
	healthRepo KBHealthRepo
	docLister  DocumentLister
}

// NewKBHealthService creates a KBHealthService.
func NewKBHealthService(healthRepo KBHealthRepo, docLister DocumentLister) *KBHealthService {
	return &KBHealthService{
		healthRepo: healthRepo,
		docLister:  docLister,
	}
}

// RunFreshnessCheck checks if vault documents are stale (not updated in 90+ days).
func (s *KBHealthService) RunFreshnessCheck(ctx context.Context, vaultID string) (*model.KBHealthCheck, error) {
	docs, err := s.docLister.ListByVault(ctx, vaultID)
	if err != nil {
		return nil, fmt.Errorf("kb_health.RunFreshnessCheck: list docs: %w", err)
	}

	cutoff := time.Now().UTC().AddDate(0, 0, -90)
	var staleDocs []map[string]interface{}
	for _, d := range docs {
		if d.UpdatedAt.Before(cutoff) {
			staleDocs = append(staleDocs, map[string]interface{}{
				"id":        d.ID,
				"filename":  d.OriginalName,
				"updatedAt": d.UpdatedAt.Format(time.RFC3339),
			})
		}
	}

	var status model.HealthStatus
	totalDocs := len(docs)
	staleCount := len(staleDocs)

	switch {
	case staleCount == 0:
		status = model.HealthStatusPassed
	case totalDocs > 0 && float64(staleCount)/float64(totalDocs) > 0.3:
		status = model.HealthStatusFailed
	default:
		status = model.HealthStatusWarning
	}

	details, _ := json.Marshal(map[string]interface{}{
		"totalDocuments": totalDocs,
		"staleDocuments": staleCount,
		"staleDocs":      staleDocs,
		"cutoffDays":     90,
	})

	check := &model.KBHealthCheck{
		VaultID:   vaultID,
		CheckType: string(model.HealthCheckFreshness),
		Status:    status,
		Details:   json.RawMessage(details),
		RunAt:     time.Now().UTC(),
	}

	if err := s.healthRepo.InsertCheck(ctx, check); err != nil {
		return nil, fmt.Errorf("kb_health.RunFreshnessCheck: insert: %w", err)
	}

	return check, nil
}

// RunCoverageCheck flags docs with 0 chunks or not in Indexed status.
func (s *KBHealthService) RunCoverageCheck(ctx context.Context, vaultID string) (*model.KBHealthCheck, error) {
	docs, err := s.docLister.ListByVault(ctx, vaultID)
	if err != nil {
		return nil, fmt.Errorf("kb_health.RunCoverageCheck: list docs: %w", err)
	}

	var uncoveredDocs []map[string]interface{}
	for _, d := range docs {
		if d.ChunkCount == 0 || d.IndexStatus != model.IndexIndexed {
			uncoveredDocs = append(uncoveredDocs, map[string]interface{}{
				"id":          d.ID,
				"filename":    d.OriginalName,
				"chunkCount":  d.ChunkCount,
				"indexStatus": string(d.IndexStatus),
			})
		}
	}

	var status model.HealthStatus
	totalDocs := len(docs)
	uncoveredCount := len(uncoveredDocs)

	switch {
	case uncoveredCount == 0:
		status = model.HealthStatusPassed
	case totalDocs > 0 && float64(uncoveredCount)/float64(totalDocs) > 0.3:
		status = model.HealthStatusFailed
	default:
		status = model.HealthStatusWarning
	}

	details, _ := json.Marshal(map[string]interface{}{
		"totalDocuments":    totalDocs,
		"uncoveredDocuments": uncoveredCount,
		"uncoveredDocs":     uncoveredDocs,
	})

	check := &model.KBHealthCheck{
		VaultID:   vaultID,
		CheckType: string(model.HealthCheckCoverage),
		Status:    status,
		Details:   json.RawMessage(details),
		RunAt:     time.Now().UTC(),
	}

	if err := s.healthRepo.InsertCheck(ctx, check); err != nil {
		return nil, fmt.Errorf("kb_health.RunCoverageCheck: insert: %w", err)
	}

	return check, nil
}

// GetLatestChecks returns the most recent health checks for a vault.
func (s *KBHealthService) GetLatestChecks(ctx context.Context, vaultID string, limit int) ([]model.KBHealthCheck, error) {
	return s.healthRepo.LatestByVault(ctx, vaultID, limit)
}
