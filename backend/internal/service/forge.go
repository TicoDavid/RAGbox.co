package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// ForgeTemplate defines the available report templates.
const (
	TemplateExecutiveBrief    = "executive_brief"
	TemplateRiskAssessment    = "risk_assessment"
	TemplateComplianceSummary = "compliance_summary"
)

// ForgeRequest is the input for a Forge generation.
type ForgeRequest struct {
	Template string        `json:"template"` // one of the Template* constants
	Query    string        `json:"query"`
	Chunks   []RankedChunk `json:"chunks"`
	Persona  string        `json:"persona"`
}

// ForgeResult is the output of a Forge generation.
type ForgeResult struct {
	DocumentID  string `json:"documentId"`
	DownloadURL string `json:"downloadUrl"`
	Title       string `json:"title"`
	PageCount   int    `json:"pageCount"`
	GeneratedAt string `json:"generatedAt"`
}

// ObjectUploader abstracts uploading generated content to Cloud Storage.
type ObjectUploader interface {
	Upload(ctx context.Context, bucket, object string, data []byte, contentType string) error
	SignedDownloadURL(ctx context.Context, bucket, object string, expiry time.Duration) (string, error)
}

// ForgeService generates template-based reports from RAG context.
type ForgeService struct {
	genAI      GenAIClient
	uploader   ObjectUploader
	bucketName string
}

// NewForgeService creates a ForgeService.
func NewForgeService(genAI GenAIClient, uploader ObjectUploader, bucketName string) *ForgeService {
	return &ForgeService{
		genAI:      genAI,
		uploader:   uploader,
		bucketName: bucketName,
	}
}

// Generate creates a report document from RAG context using the specified template.
func (s *ForgeService) Generate(ctx context.Context, req ForgeRequest) (*ForgeResult, error) {
	if req.Template == "" {
		return nil, fmt.Errorf("forge: template is required")
	}
	if req.Query == "" {
		return nil, fmt.Errorf("forge: query is required")
	}

	systemPrompt := forgeSystemPrompt(req.Template)
	userPrompt := forgeUserPrompt(req.Query, req.Chunks)

	content, err := s.genAI.GenerateContent(ctx, systemPrompt, userPrompt)
	if err != nil {
		return nil, fmt.Errorf("forge: generation failed: %w", err)
	}

	title := forgeTitleForTemplate(req.Template, req.Query)
	docID := uuid.New().String()
	objectName := fmt.Sprintf("forge/%s/%s.txt", docID, sanitizeFilename(title))

	// Upload generated content
	if err := s.uploader.Upload(ctx, s.bucketName, objectName, []byte(content), "text/plain; charset=utf-8"); err != nil {
		return nil, fmt.Errorf("forge: upload failed: %w", err)
	}

	downloadURL, err := s.uploader.SignedDownloadURL(ctx, s.bucketName, objectName, 24*time.Hour)
	if err != nil {
		return nil, fmt.Errorf("forge: signed URL failed: %w", err)
	}

	return &ForgeResult{
		DocumentID:  docID,
		DownloadURL: downloadURL,
		Title:       title,
		PageCount:   estimatePages(content),
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
	}, nil
}

// forgeSystemPrompt returns the system prompt for a given template type.
func forgeSystemPrompt(template string) string {
	switch template {
	case TemplateExecutiveBrief:
		return `You are a professional report writer. Generate an Executive Brief document.
Structure: Title, Executive Summary, Key Findings (numbered), Recommendations, Conclusion.
Use formal business language. Include all citation references from the source material.`
	case TemplateRiskAssessment:
		return `You are a risk assessment specialist. Generate a Risk Assessment Report.
Structure: Title, Risk Overview, Risk Matrix (High/Medium/Low), Detailed Findings, Mitigation Strategies, Timeline.
Quantify risks where possible. Reference source documents with citations.`
	case TemplateComplianceSummary:
		return `You are a compliance analyst. Generate a Compliance Summary Report.
Structure: Title, Compliance Status Overview, Requirements Checklist, Gap Analysis, Action Items, Attestation Section.
Be precise about regulatory requirements. Include all supporting citations.`
	default:
		return `You are a professional document writer. Generate a structured report based on the provided context. Include citations.`
	}
}

// forgeUserPrompt builds the user prompt with query and context.
func forgeUserPrompt(query string, chunks []RankedChunk) string {
	var sb fmt.Stringer = &forgePromptBuilder{query: query, chunks: chunks}
	return sb.(fmt.Stringer).String()
}

type forgePromptBuilder struct {
	query  string
	chunks []RankedChunk
}

func (b *forgePromptBuilder) String() string {
	result := fmt.Sprintf("Topic/Question: %s\n\nSource Documents:\n", b.query)
	for i, c := range b.chunks {
		docID := c.Document.ID
		if docID == "" {
			docID = "unknown"
		}
		result += fmt.Sprintf("\n[%d] (Document: %s, Relevance: %.2f)\n%s\n",
			i+1, docID, c.Similarity, c.Chunk.Content)
	}
	result += "\nGenerate the report based on the above source documents. Include citation numbers [1], [2], etc. referencing the source documents."
	return result
}

// forgeTitleForTemplate generates a title based on template and query.
func forgeTitleForTemplate(template, query string) string {
	prefix := "Report"
	switch template {
	case TemplateExecutiveBrief:
		prefix = "Executive Brief"
	case TemplateRiskAssessment:
		prefix = "Risk Assessment"
	case TemplateComplianceSummary:
		prefix = "Compliance Summary"
	}
	if len(query) > 50 {
		query = query[:50]
	}
	return fmt.Sprintf("%s - %s", prefix, query)
}

// sanitizeFilename removes characters unsafe for file paths.
func sanitizeFilename(name string) string {
	safe := make([]byte, 0, len(name))
	for i := 0; i < len(name); i++ {
		c := name[i]
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.' {
			safe = append(safe, c)
		} else if c == ' ' {
			safe = append(safe, '_')
		}
	}
	return string(safe)
}

// estimatePages estimates the number of pages based on content length.
// Assumes roughly 3000 characters per page.
func estimatePages(content string) int {
	pages := len(content) / 3000
	if pages < 1 {
		return 1
	}
	return pages + 1
}
