package service

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// AuditRepository abstracts PostgreSQL audit log storage.
type AuditRepository interface {
	Create(ctx context.Context, entry *model.AuditLog) error
	GetLatestHash(ctx context.Context) (string, error)
	GetRange(ctx context.Context, startID, endID string) ([]model.AuditLog, error)
}

// VerificationResult reports the outcome of a hash-chain verification.
type VerificationResult struct {
	Valid          bool   `json:"valid"`
	EntriesChecked int    `json:"entriesChecked"`
	BrokenAt       string `json:"brokenAt,omitempty"` // ID of the first invalid entry
	BrokenIndex    int    `json:"brokenIndex,omitempty"`
}

// BigQueryWriter abstracts async writes to BigQuery for WORM archival.
type BigQueryWriter interface {
	WriteAuditEntry(ctx context.Context, entry *model.AuditLog) error
}

// AuditService provides audit logging with SHA-256 hash-chain integrity.
// Writes to PostgreSQL (immediate) and BigQuery (async WORM archive).
type AuditService struct {
	repo     AuditRepository
	bq       BigQueryWriter // nil means BQ disabled
	lastHash string
}

// Compile-time check that AuditService implements AuditLogger.
var _ AuditLogger = (*AuditService)(nil)

// NewAuditService creates an AuditService. It fetches the latest hash from the
// repo to continue the chain. bqWriter may be nil to disable BigQuery writes.
func NewAuditService(repo AuditRepository, bqWriter BigQueryWriter) (*AuditService, error) {
	lastHash, err := repo.GetLatestHash(context.Background())
	if err != nil {
		return nil, fmt.Errorf("audit: failed to fetch latest hash: %w", err)
	}
	return &AuditService{
		repo:     repo,
		bq:       bqWriter,
		lastHash: lastHash,
	}, nil
}

// Log implements AuditLogger for pipeline integration (simple signature).
func (s *AuditService) Log(ctx context.Context, action, userID, resourceID, resourceType string) error {
	return s.LogWithDetails(ctx, action, userID, resourceID, resourceType, nil)
}

// LogWithDetails creates an audit entry with optional JSON details.
// It computes the SHA-256 hash chain, writes to PG immediately,
// and writes to BigQuery asynchronously.
func (s *AuditService) LogWithDetails(ctx context.Context, action, userID, resourceID, resourceType string, details map[string]interface{}) error {
	entry := &model.AuditLog{
		ID:           uuid.New().String(),
		Action:       action,
		Severity:     severityForAction(action),
		CreatedAt:    time.Now().UTC(),
	}

	if userID != "" {
		entry.UserID = &userID
	}
	if resourceID != "" {
		entry.ResourceID = &resourceID
	}
	if resourceType != "" {
		entry.ResourceType = &resourceType
	}

	if details != nil {
		detailsJSON, err := json.Marshal(details)
		if err != nil {
			return fmt.Errorf("audit: marshal details: %w", err)
		}
		entry.Details = detailsJSON
	}

	// Compute hash chain: SHA-256(previousHash + action + timestamp + details)
	hash := computeHash(s.lastHash, entry)
	entry.DetailsHash = &hash
	s.lastHash = hash

	// Write to PostgreSQL (immediate)
	if err := s.repo.Create(ctx, entry); err != nil {
		return fmt.Errorf("audit: pg write: %w", err)
	}

	// Write to BigQuery (async, non-blocking)
	if s.bq != nil {
		go func() {
			if err := s.bq.WriteAuditEntry(context.Background(), entry); err != nil {
				log.Printf("WARNING: BigQuery audit write failed: %v", err)
			}
		}()
	}

	return nil
}

// VerifyChain validates the hash-chain integrity for a range of audit entries.
// It walks from startID to endID and verifies each entry's hash links correctly.
func (s *AuditService) VerifyChain(ctx context.Context, startID, endID string) (*VerificationResult, error) {
	entries, err := s.repo.GetRange(ctx, startID, endID)
	if err != nil {
		return nil, fmt.Errorf("audit: verify chain: %w", err)
	}

	if len(entries) == 0 {
		return &VerificationResult{Valid: true, EntriesChecked: 0}, nil
	}

	// For the first entry in the range, we cannot verify its link to the previous
	// entry outside the range. We start verification from the second entry.
	var prevHash string
	if entries[0].DetailsHash != nil {
		prevHash = *entries[0].DetailsHash
	}

	for i := 1; i < len(entries); i++ {
		expected := computeHash(prevHash, &entries[i])
		actual := ""
		if entries[i].DetailsHash != nil {
			actual = *entries[i].DetailsHash
		}

		if actual != expected {
			return &VerificationResult{
				Valid:          false,
				EntriesChecked: i + 1,
				BrokenAt:       entries[i].ID,
				BrokenIndex:    i,
			}, nil
		}
		prevHash = actual
	}

	return &VerificationResult{Valid: true, EntriesChecked: len(entries)}, nil
}

// computeHash produces a SHA-256 hash linking to the previous entry.
// Formula: SHA-256(previousHash + action + createdAt(RFC3339Nano) + details)
func computeHash(previousHash string, entry *model.AuditLog) string {
	h := sha256.New()
	h.Write([]byte(previousHash))
	h.Write([]byte(entry.Action))
	h.Write([]byte(entry.CreatedAt.Format(time.RFC3339Nano)))
	if entry.Details != nil {
		h.Write(entry.Details)
	}
	return fmt.Sprintf("%x", h.Sum(nil))
}

// severityForAction maps audit actions to severity levels.
func severityForAction(action string) string {
	switch action {
	case model.AuditDocumentDelete:
		return "HIGH"
	case model.AuditPrivilegeToggle:
		return "HIGH"
	case model.AuditSilenceTriggered:
		return "MEDIUM"
	case model.AuditDataExport:
		return "MEDIUM"
	case model.AuditDocumentUpload:
		return "LOW"
	case model.AuditDocumentRecover:
		return "LOW"
	case model.AuditQueryExecuted:
		return "LOW"
	case model.AuditForgeGenerate:
		return "LOW"
	case model.AuditUserLogin:
		return "LOW"
	default:
		return "INFO"
	}
}
