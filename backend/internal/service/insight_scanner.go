package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// InsightRepository abstracts persistence for proactive insights.
type InsightRepository interface {
	CreateInsight(ctx context.Context, insight *model.ProactiveInsight) error
	GetActiveInsights(ctx context.Context, userID string, limit int) ([]model.ProactiveInsight, error)
	AcknowledgeInsight(ctx context.Context, insightID string) error
	DeleteExpiredInsights(ctx context.Context) (int, error)
	ExistsByHash(ctx context.Context, userID, documentID, insightType, titleHash string) (bool, error)
}

// ChunkScanner abstracts reading chunks for vault scanning.
type ChunkScanner interface {
	RecentChunksByUser(ctx context.Context, userID string, limit int) ([]ScannableChunk, error)
}

// ScannableChunk is a minimal chunk record used for vault scanning.
type ScannableChunk struct {
	ChunkID    string
	DocumentID string
	Content    string
}

// InsightScannerService scans vault chunks for time-sensitive patterns
// and uses Gemini to extract structured insights.
type InsightScannerService struct {
	genAI      GenAIClient
	insightRepo InsightRepository
	chunkScanner ChunkScanner
}

// NewInsightScannerService creates an InsightScannerService.
func NewInsightScannerService(genAI GenAIClient, insightRepo InsightRepository, chunkScanner ChunkScanner) *InsightScannerService {
	return &InsightScannerService{
		genAI:        genAI,
		insightRepo:  insightRepo,
		chunkScanner: chunkScanner,
	}
}

// Time-sensitive keyword patterns for pre-filtering chunks before Gemini extraction.
var insightPatterns = []*regexp.Regexp{
	// Deadlines
	regexp.MustCompile(`(?i)(due by|deadline|must be (filed|submitted|completed) by|deliver by)`),
	// Expiring contracts
	regexp.MustCompile(`(?i)(renewal date|termination clause|expir(es|ation|ing)|contract ends|term ends)`),
	// Financial anomalies
	regexp.MustCompile(`(?i)(overdue|past due|delinquent|outstanding balance|unpaid)`),
	// Action items
	regexp.MustCompile(`(?i)(action required|please respond by|awaiting your|immediate attention|urgent)`),
	// Date patterns (month/day/year or day month year within plausible ranges)
	regexp.MustCompile(`(?i)(\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2},?\s+\d{4}\b)`),
}

// ScanVaultForInsights scans recent document chunks for time-sensitive content,
// uses Gemini to extract structured insights, deduplicates, and returns new insights.
func (s *InsightScannerService) ScanVaultForInsights(ctx context.Context, userID, tenantID string) ([]model.ProactiveInsight, error) {
	// Fetch recent chunks (limit to 100 to stay within budget)
	chunks, err := s.chunkScanner.RecentChunksByUser(ctx, userID, 100)
	if err != nil {
		return nil, fmt.Errorf("service.ScanVaultForInsights: fetch chunks: %w", err)
	}

	if len(chunks) == 0 {
		return nil, nil
	}

	// Pre-filter: only chunks matching time-sensitive patterns
	var candidates []ScannableChunk
	for _, chunk := range chunks {
		for _, pattern := range insightPatterns {
			if pattern.MatchString(chunk.Content) {
				candidates = append(candidates, chunk)
				break
			}
		}
	}

	if len(candidates) == 0 {
		slog.Info("[InsightScanner] No time-sensitive chunks found", "user_id", userID, "scanned", len(chunks))
		return nil, nil
	}

	slog.Info("[InsightScanner] Found candidate chunks", "user_id", userID, "candidates", len(candidates), "scanned", len(chunks))

	// Batch candidates into a single Gemini call (up to 20 chunks per call)
	batchSize := 20
	if len(candidates) > batchSize {
		candidates = candidates[:batchSize]
	}

	extracted, err := s.extractInsightsWithGemini(ctx, candidates)
	if err != nil {
		return nil, fmt.Errorf("service.ScanVaultForInsights: extract: %w", err)
	}

	// Deduplicate and persist
	now := time.Now().UTC()
	var newInsights []model.ProactiveInsight

	for _, raw := range extracted {
		// Check for duplicates
		docID := raw.DocumentID
		if docID != "" {
			exists, err := s.insightRepo.ExistsByHash(ctx, userID, docID, raw.Type, titleHash(raw.Title))
			if err != nil {
				slog.Warn("[InsightScanner] dedup check failed", "error", err)
				continue
			}
			if exists {
				continue
			}
		}

		var expiresAt *time.Time
		if raw.ExpiresAt != "" {
			if t, err := time.Parse(time.RFC3339, raw.ExpiresAt); err == nil {
				expiresAt = &t
			}
		}

		insight := model.ProactiveInsight{
			ID:             uuid.New().String(),
			UserID:         userID,
			TenantID:       tenantID,
			DocumentID:     ptrOrNil(docID),
			InsightType:    model.InsightType(raw.Type),
			Title:          raw.Title,
			Summary:        raw.Summary,
			SourceChunkID:  ptrOrNil(raw.ChunkID),
			RelevanceScore: raw.RelevanceScore,
			ExpiresAt:      expiresAt,
			CreatedAt:      now,
			UpdatedAt:      now,
		}

		if err := s.insightRepo.CreateInsight(ctx, &insight); err != nil {
			slog.Warn("[InsightScanner] failed to create insight", "error", err, "title", raw.Title)
			continue
		}
		newInsights = append(newInsights, insight)
	}

	slog.Info("[InsightScanner] Scan complete", "user_id", userID, "new_insights", len(newInsights))

	// Cleanup expired insights while we're at it
	if deleted, err := s.insightRepo.DeleteExpiredInsights(ctx); err == nil && deleted > 0 {
		slog.Info("[InsightScanner] Cleaned expired insights", "deleted", deleted)
	}

	return newInsights, nil
}

// GetActiveInsights returns active (not acknowledged, not expired) insights for a user.
func (s *InsightScannerService) GetActiveInsights(ctx context.Context, userID string, limit int) ([]model.ProactiveInsight, error) {
	return s.insightRepo.GetActiveInsights(ctx, userID, limit)
}

// AcknowledgeInsight marks an insight as seen/dismissed.
func (s *InsightScannerService) AcknowledgeInsight(ctx context.Context, insightID string) error {
	return s.insightRepo.AcknowledgeInsight(ctx, insightID)
}

// rawInsight is the structured output from Gemini extraction.
type rawInsight struct {
	Type           string  `json:"type"`
	Title          string  `json:"title"`
	Summary        string  `json:"summary"`
	RelevanceScore float64 `json:"relevanceScore"`
	ExpiresAt      string  `json:"expiresAt,omitempty"` // RFC3339
	DocumentID     string  `json:"documentId,omitempty"`
	ChunkID        string  `json:"chunkId,omitempty"`
}

const insightExtractionPrompt = `You are a document intelligence scanner. Analyze the following document chunks and extract time-sensitive insights.

For each insight found, return a JSON object with:
- type: one of "deadline", "expiring", "anomaly", "trend", "reminder"
- title: short title (under 60 chars), e.g. "Contract expires in 3 days"
- summary: 1-2 sentence summary
- relevanceScore: 0.0-1.0 (higher = more urgent/relevant)
- expiresAt: RFC3339 date when this insight is no longer relevant (estimate if needed)
- documentId: the document ID from the chunk
- chunkId: the chunk ID

Today's date is %s. Only flag items relevant within the next 60 days.

Return a JSON array of insight objects. If no time-sensitive content is found, return [].
Do NOT return anything except the JSON array.`

func (s *InsightScannerService) extractInsightsWithGemini(ctx context.Context, chunks []ScannableChunk) ([]rawInsight, error) {
	// Build chunk context for Gemini
	var sb strings.Builder
	for i, c := range chunks {
		sb.WriteString(fmt.Sprintf("[Chunk %d] (doc: %s, chunk: %s)\n%s\n\n", i+1, c.DocumentID, c.ChunkID, c.Content))
	}

	systemPrompt := fmt.Sprintf(insightExtractionPrompt, time.Now().UTC().Format("2006-01-02"))
	userPrompt := sb.String()

	raw, err := s.genAI.GenerateContent(ctx, systemPrompt, userPrompt)
	if err != nil {
		return nil, fmt.Errorf("gemini extraction: %w", err)
	}

	// Parse JSON array from response
	jsonText := strings.TrimSpace(raw)

	// Handle code fences
	if idx := strings.Index(jsonText, "```"); idx >= 0 {
		rest := jsonText[idx+3:]
		if nl := strings.Index(rest, "\n"); nl >= 0 {
			rest = rest[nl+1:]
		}
		if endIdx := strings.Index(rest, "```"); endIdx >= 0 {
			jsonText = strings.TrimSpace(rest[:endIdx])
		}
	}

	// Find array start
	if idx := strings.Index(jsonText, "["); idx >= 0 {
		jsonText = jsonText[idx:]
	}

	var results []rawInsight
	if err := json.Unmarshal([]byte(jsonText), &results); err != nil {
		slog.Warn("[InsightScanner] Failed to parse Gemini response", "error", err, "raw_length", len(raw))
		return nil, nil // Non-fatal: return empty, don't block
	}

	return results, nil
}

// titleHash returns a hex-encoded SHA-256 hash of s (for deduplication).
func titleHash(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

func ptrOrNil(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
