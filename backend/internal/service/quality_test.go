package service

import (
	"context"
	"fmt"
	"math"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// ── Test corpus ─────────────────────────────────────────────────

var qualityDocuments = []struct {
	ID       string
	Filename string
	Content  string
}{
	{
		ID:       "test-doc-contract",
		Filename: "master-services-agreement.pdf",
		Content: `MASTER SERVICES AGREEMENT

Section 1: Definitions
"Service Period" means the initial term of twelve (12) months commencing on the Effective Date.
"Fees" means the monthly subscription fee of $5,000 per month, payable in advance.

Section 2: Payment Terms
Payment is due within thirty (30) days of invoice date. Late payments accrue interest at 1.5% per month.

Section 3: Termination
Either party may terminate with ninety (90) days written notice. Early termination incurs a fee equal to three (3) months of remaining Fees.

Section 4: Liability
Total aggregate liability shall not exceed the Fees paid in the twelve (12) months preceding the claim.`,
	},
	{
		ID:       "test-doc-nda",
		Filename: "non-disclosure-agreement.pdf",
		Content: `NON-DISCLOSURE AGREEMENT

Section 1: Confidential Information
"Confidential Information" includes all proprietary information, trade secrets, business methods, customer lists, financial data, and technical specifications disclosed by either party.

Section 2: Obligations
The Receiving Party shall hold and maintain in strict confidence all Confidential Information. Disclosure to employees is permitted only on a need-to-know basis.

Section 3: Permitted Disclosures
The Receiving Party may disclose Confidential Information to its legal counsel and financial advisors, provided they are bound by similar confidentiality obligations.

Section 4: Duration
Confidentiality obligations shall survive for five (5) years after termination of this Agreement.

Section 5: Remedies
Any breach may result in irreparable harm. The Disclosing Party shall be entitled to seek injunctive relief and monetary damages without posting bond.`,
	},
	{
		ID:       "test-doc-employment",
		Filename: "employment-agreement.pdf",
		Content: `EMPLOYMENT AGREEMENT

Section 1: Position and Duties
Employee is hired as Senior Software Engineer, reporting to the VP of Engineering. Employment begins on the Start Date and is at-will.

Section 2: Compensation
Base salary of $150,000 per year, paid bi-weekly. Annual bonus target of 15% of base salary, subject to performance review.

Section 3: Probation
The first ninety (90) days constitute a probationary period. During probation, either party may terminate with one (1) week written notice.

Section 4: Resignation and Termination
After probation, Employee must provide thirty (30) days written notice of resignation. Employer may terminate with two (2) weeks notice or pay in lieu.

Section 5: Non-Compete
For twelve (12) months following termination, Employee shall not engage in any competing business within a fifty (50) mile radius.

Section 6: Intellectual Property
All inventions, works of authorship, and intellectual property created during employment shall be the exclusive property of the Company.`,
	},
	{
		ID:       "test-doc-privacy",
		Filename: "privacy-policy.pdf",
		Content: `PRIVACY POLICY

Section 1: Data Collection
We collect the following personal data: full name, email address, phone number, billing address, and usage analytics including pages visited and features used.

Section 2: Use of Data
Personal data is used to provide and improve our services, process payments, send notifications, and comply with legal obligations.

Section 3: Data Retention
Personal data is retained for three (3) years after account closure. Transaction records are retained for seven (7) years for tax compliance.

Section 4: Data Deletion
Users may request deletion of their personal data by contacting privacy@example.com. Deletion requests are processed within thirty (30) days, except where retention is required by law.

Section 5: Third-Party Sharing
We share data with analytics providers, payment processors, and cloud service providers. We do not sell personal data to third parties.

Section 6: Security
All personal data is encrypted at rest using AES-256 and in transit using TLS 1.3.`,
	},
	{
		ID:       "test-doc-sla",
		Filename: "service-level-agreement.pdf",
		Content: `SERVICE LEVEL AGREEMENT

Section 1: Uptime Guarantee
The Service shall maintain 99.9% uptime measured monthly, excluding scheduled maintenance windows.

Section 2: Support Response Times
Critical issues (P1): initial response within four (4) hours, resolution target of eight (8) hours.
High issues (P2): initial response within eight (8) hours, resolution target of twenty-four (24) hours.
Medium issues (P3): initial response within one (1) business day, resolution target of three (3) business days.

Section 3: Planned Maintenance
Scheduled maintenance windows require forty-eight (48) hours advance written notice. Maintenance is performed during off-peak hours (Saturday 2:00 AM - 6:00 AM EST).

Section 4: Service Credits
If monthly uptime falls below 99.9%, Customer receives a credit of 10% of monthly fees per 0.1% below the guarantee, up to a maximum of 30% of monthly fees.

Section 5: Escalation
Unresolved P1 issues are automatically escalated to the VP of Engineering after eight (8) hours and to the CTO after twenty-four (24) hours.`,
	},
}

// ── Golden queries ──────────────────────────────────────────────

type goldenQuery struct {
	Query             string
	ExpectedDocIDs    []string
	ExpectedKeywords  []string
	ForbiddenKeywords []string
	MinConfidence     float64
}

var goldenQueries = []goldenQuery{
	// MSA queries (1–4)
	{
		Query:             "What is the monthly fee?",
		ExpectedDocIDs:    []string{"test-doc-contract"},
		ExpectedKeywords:  []string{"5,000", "month"},
		ForbiddenKeywords: []string{"hourly", "annual subscription"},
		MinConfidence:     0.70,
	},
	{
		Query:             "What happens if I terminate early?",
		ExpectedDocIDs:    []string{"test-doc-contract"},
		ExpectedKeywords:  []string{"three", "months", "fee"},
		ForbiddenKeywords: []string{"penalty-free", "no cost"},
		MinConfidence:     0.70,
	},
	{
		Query:             "What is the late payment interest rate?",
		ExpectedDocIDs:    []string{"test-doc-contract"},
		ExpectedKeywords:  []string{"1.5%", "month"},
		ForbiddenKeywords: []string{"prime rate"},
		MinConfidence:     0.70,
	},
	{
		Query:             "What is the liability cap?",
		ExpectedDocIDs:    []string{"test-doc-contract"},
		ExpectedKeywords:  []string{"twelve", "months"},
		ForbiddenKeywords: []string{"unlimited", "no cap"},
		MinConfidence:     0.70,
	},
	// NDA queries (5–8)
	{
		Query:             "How long do confidentiality obligations last?",
		ExpectedDocIDs:    []string{"test-doc-nda"},
		ExpectedKeywords:  []string{"five", "years"},
		ForbiddenKeywords: []string{"perpetual", "indefinite"},
		MinConfidence:     0.70,
	},
	{
		Query:             "What information is covered by the NDA?",
		ExpectedDocIDs:    []string{"test-doc-nda"},
		ExpectedKeywords:  []string{"proprietary", "trade secrets"},
		ForbiddenKeywords: []string{"public information"},
		MinConfidence:     0.70,
	},
	{
		Query:             "Can I share confidential info with my lawyer?",
		ExpectedDocIDs:    []string{"test-doc-nda"},
		ExpectedKeywords:  []string{"legal counsel"},
		ForbiddenKeywords: []string{"prohibited", "no exceptions"},
		MinConfidence:     0.70,
	},
	{
		Query:             "What are the penalties for breach of the NDA?",
		ExpectedDocIDs:    []string{"test-doc-nda"},
		ExpectedKeywords:  []string{"injunctive relief", "damages"},
		ForbiddenKeywords: []string{"no penalty", "warning only"},
		MinConfidence:     0.70,
	},
	// Employment queries (9–12)
	{
		Query:             "What is the notice period for resignation?",
		ExpectedDocIDs:    []string{"test-doc-employment"},
		ExpectedKeywords:  []string{"thirty", "days"},
		ForbiddenKeywords: []string{"immediate", "no notice"},
		MinConfidence:     0.70,
	},
	{
		Query:             "Is there a non-compete clause?",
		ExpectedDocIDs:    []string{"test-doc-employment"},
		ExpectedKeywords:  []string{"twelve", "months"},
		ForbiddenKeywords: []string{"no restriction", "waived"},
		MinConfidence:     0.70,
	},
	{
		Query:             "What is the probation period?",
		ExpectedDocIDs:    []string{"test-doc-employment"},
		ExpectedKeywords:  []string{"ninety", "days"},
		ForbiddenKeywords: []string{"no probation"},
		MinConfidence:     0.70,
	},
	{
		Query:             "Who owns intellectual property created during employment?",
		ExpectedDocIDs:    []string{"test-doc-employment"},
		ExpectedKeywords:  []string{"company", "intellectual property"},
		ForbiddenKeywords: []string{"employee retains", "shared ownership"},
		MinConfidence:     0.70,
	},
	// Privacy Policy queries (13–16)
	{
		Query:             "What personal data is collected?",
		ExpectedDocIDs:    []string{"test-doc-privacy"},
		ExpectedKeywords:  []string{"name", "email"},
		ForbiddenKeywords: []string{"biometric", "genetic"},
		MinConfidence:     0.70,
	},
	{
		Query:             "How long is personal data retained?",
		ExpectedDocIDs:    []string{"test-doc-privacy"},
		ExpectedKeywords:  []string{"three", "years"},
		ForbiddenKeywords: []string{"forever", "indefinitely"},
		MinConfidence:     0.70,
	},
	{
		Query:             "Can users request data deletion?",
		ExpectedDocIDs:    []string{"test-doc-privacy"},
		ExpectedKeywords:  []string{"deletion", "thirty"},
		ForbiddenKeywords: []string{"not possible", "cannot delete"},
		MinConfidence:     0.70,
	},
	{
		Query:             "Is data shared with third parties?",
		ExpectedDocIDs:    []string{"test-doc-privacy"},
		ExpectedKeywords:  []string{"analytics", "providers"},
		ForbiddenKeywords: []string{"never shared"},
		MinConfidence:     0.70,
	},
	// SLA queries (17–20)
	{
		Query:             "What is the uptime guarantee?",
		ExpectedDocIDs:    []string{"test-doc-sla"},
		ExpectedKeywords:  []string{"99.9%", "uptime"},
		ForbiddenKeywords: []string{"best effort", "no guarantee"},
		MinConfidence:     0.70,
	},
	{
		Query:             "What are the support response times for critical issues?",
		ExpectedDocIDs:    []string{"test-doc-sla"},
		ExpectedKeywords:  []string{"four", "hours"},
		ForbiddenKeywords: []string{"next business day"},
		MinConfidence:     0.70,
	},
	{
		Query:             "How much advance notice is required for planned maintenance?",
		ExpectedDocIDs:    []string{"test-doc-sla"},
		ExpectedKeywords:  []string{"forty-eight", "hours"},
		ForbiddenKeywords: []string{"no notice", "immediate"},
		MinConfidence:     0.70,
	},
	{
		Query:             "What are the service credits for downtime?",
		ExpectedDocIDs:    []string{"test-doc-sla"},
		ExpectedKeywords:  []string{"10%", "monthly"},
		ForbiddenKeywords: []string{"no credits", "non-refundable"},
		MinConfidence:     0.70,
	},
}

// ── Scoring functions ───────────────────────────────────────────

// citationPrecision returns the fraction of cited docs that are in the expected set.
func citationPrecision(cited, expected []string) float64 {
	if len(cited) == 0 {
		return 0
	}
	exp := make(map[string]bool, len(expected))
	for _, e := range expected {
		exp[e] = true
	}
	correct := 0
	for _, c := range cited {
		if exp[c] {
			correct++
		}
	}
	return float64(correct) / float64(len(cited))
}

// citationRecall returns the fraction of expected docs that appear in cited.
func citationRecall(cited, expected []string) float64 {
	if len(expected) == 0 {
		return 1
	}
	set := make(map[string]bool, len(cited))
	for _, c := range cited {
		set[c] = true
	}
	found := 0
	for _, e := range expected {
		if set[e] {
			found++
		}
	}
	return float64(found) / float64(len(expected))
}

// keywordCoverage returns the fraction of expected keywords found in the answer.
func keywordCoverage(answer string, keywords []string) float64 {
	if len(keywords) == 0 {
		return 1
	}
	lower := strings.ToLower(answer)
	found := 0
	for _, kw := range keywords {
		if strings.Contains(lower, strings.ToLower(kw)) {
			found++
		}
	}
	return float64(found) / float64(len(keywords))
}

// hallucinationClean returns true if no forbidden keyword appears in the answer.
func hallucinationClean(answer string, forbidden []string) bool {
	lower := strings.ToLower(answer)
	for _, f := range forbidden {
		if strings.Contains(lower, strings.ToLower(f)) {
			return false
		}
	}
	return true
}

// ── Query result ────────────────────────────────────────────────

type queryResult struct {
	Query              string
	CitationPrecision  float64
	CitationRecall     float64
	KeywordCoverage    float64
	HallucinationClean bool
	Confidence         float64
	PassedConfidence   bool
}

// ── Mock quality pipeline ───────────────────────────────────────

// qualityChunkIndex holds pre-chunked documents for keyword-based retrieval.
type qualityChunkIndex struct {
	chunks []RankedChunk
}

// buildChunkIndex chunks all test documents with the real ChunkerService.
func buildChunkIndex() (*qualityChunkIndex, error) {
	chunker := NewChunkerService(512, 0.15)
	ctx := context.Background()
	var all []RankedChunk
	now := time.Now()

	for _, doc := range qualityDocuments {
		chunks, err := chunker.Chunk(ctx, doc.Content, doc.ID)
		if err != nil {
			return nil, fmt.Errorf("chunking %s: %w", doc.ID, err)
		}
		for i, c := range chunks {
			all = append(all, RankedChunk{
				Chunk: model.DocumentChunk{
					ID:          fmt.Sprintf("%s-chunk-%d", doc.ID, i),
					DocumentID:  doc.ID,
					ChunkIndex:  i,
					Content:     c.Content,
					ContentHash: c.ContentHash,
					TokenCount:  c.TokenCount,
				},
				Document: model.Document{
					ID:        doc.ID,
					UserID:    "quality-test-user",
					Filename:  doc.Filename,
					CreatedAt: now,
				},
			})
		}
	}
	return &qualityChunkIndex{chunks: all}, nil
}

// retrieve finds the top-k chunks matching a query via keyword overlap scoring.
func (idx *qualityChunkIndex) retrieve(query string, topK int) []RankedChunk {
	type scored struct {
		chunk RankedChunk
		score float64
	}

	words := strings.Fields(strings.ToLower(query))
	var results []scored
	for _, rc := range idx.chunks {
		content := strings.ToLower(rc.Chunk.Content)
		matches := 0
		for _, w := range words {
			if len(w) > 2 && strings.Contains(content, w) {
				matches++
			}
		}
		if matches > 0 {
			sim := float64(matches) / float64(len(words))
			rc.Similarity = sim
			rc.FinalScore = sim
			results = append(results, scored{chunk: rc, score: sim})
		}
	}

	// Sort descending by score.
	for i := 1; i < len(results); i++ {
		for j := i; j > 0 && results[j].score > results[j-1].score; j-- {
			results[j], results[j-1] = results[j-1], results[j]
		}
	}

	if len(results) > topK {
		results = results[:topK]
	}

	ranked := make([]RankedChunk, len(results))
	for i, r := range results {
		ranked[i] = r.chunk
	}
	return ranked
}

// mockGenerate builds an answer from the retrieved chunks with citations.
func mockGenerate(query string, chunks []RankedChunk) *GenerationResult {
	if len(chunks) == 0 {
		return &GenerationResult{
			Answer:     "I could not find relevant information to answer this question.",
			Confidence: 0.10,
			ModelUsed:  "mock-quality",
		}
	}

	var parts []string
	var citations []CitationRef
	seen := make(map[string]bool)

	for i, rc := range chunks {
		if i >= 3 {
			break
		}
		sentences := strings.Split(rc.Chunk.Content, ".")
		for _, s := range sentences {
			s = strings.TrimSpace(s)
			if len(s) > 20 && containsQueryWord(s, query) {
				parts = append(parts, s)
				if !seen[rc.Document.ID] {
					citations = append(citations, CitationRef{
						ChunkID:    rc.Chunk.ID,
						DocumentID: rc.Document.ID,
						Excerpt:    qTruncate(s, 80),
						Relevance:  rc.FinalScore,
						Index:      len(citations) + 1,
					})
					seen[rc.Document.ID] = true
				}
				break
			}
		}
	}

	answer := strings.Join(parts, ". ")
	if answer == "" {
		answer = chunks[0].Chunk.Content
		citations = []CitationRef{{
			ChunkID:    chunks[0].Chunk.ID,
			DocumentID: chunks[0].Document.ID,
			Excerpt:    qTruncate(chunks[0].Chunk.Content, 80),
			Relevance:  chunks[0].FinalScore,
			Index:      1,
		}}
	}

	conf := 0.60
	if len(citations) > 0 {
		conf = math.Min(0.95, 0.70+citations[0].Relevance*0.25)
	}
	return &GenerationResult{
		Answer:     answer,
		Citations:  citations,
		Confidence: conf,
		ModelUsed:  "mock-quality",
	}
}

func containsQueryWord(sentence, query string) bool {
	lower := strings.ToLower(sentence)
	for _, w := range strings.Fields(strings.ToLower(query)) {
		if len(w) > 3 && strings.Contains(lower, w) {
			return true
		}
	}
	return false
}

func qTruncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "..."
}

func qSanitize(s string) string {
	r := strings.NewReplacer(" ", "_", "?", "", "'", "", ",", "")
	s = r.Replace(s)
	if len(s) > 40 {
		s = s[:40]
	}
	return s
}

// ── Quality test harness ────────────────────────────────────────

func TestRetrievalQuality(t *testing.T) {
	if os.Getenv("QUALITY_TESTS") != "1" {
		t.Skip("QUALITY_TESTS not set — skipping quality suite")
	}

	idx, err := buildChunkIndex()
	if err != nil {
		t.Fatalf("building chunk index: %v", err)
	}
	t.Logf("Indexed %d chunks from %d documents", len(idx.chunks), len(qualityDocuments))

	var results []queryResult

	for i, gq := range goldenQueries {
		t.Run(fmt.Sprintf("Q%02d_%s", i+1, qSanitize(gq.Query)), func(t *testing.T) {
			chunks := idx.retrieve(gq.Query, 5)
			gen := mockGenerate(gq.Query, chunks)

			var cited []string
			seen := make(map[string]bool)
			for _, c := range gen.Citations {
				if !seen[c.DocumentID] {
					cited = append(cited, c.DocumentID)
					seen[c.DocumentID] = true
				}
			}

			qr := queryResult{
				Query:              gq.Query,
				CitationPrecision:  citationPrecision(cited, gq.ExpectedDocIDs),
				CitationRecall:     citationRecall(cited, gq.ExpectedDocIDs),
				KeywordCoverage:    keywordCoverage(gen.Answer, gq.ExpectedKeywords),
				HallucinationClean: hallucinationClean(gen.Answer, gq.ForbiddenKeywords),
				Confidence:         gen.Confidence,
				PassedConfidence:   gen.Confidence >= gq.MinConfidence,
			}
			results = append(results, qr)

			t.Logf("Precision=%.2f Recall=%.2f Keywords=%.2f Halluc=%v Conf=%.2f",
				qr.CitationPrecision, qr.CitationRecall, qr.KeywordCoverage,
				qr.HallucinationClean, qr.Confidence)

			if qr.CitationRecall < 1.0 {
				t.Errorf("citation recall %.2f < 1.0: expected %v, got %v",
					qr.CitationRecall, gq.ExpectedDocIDs, cited)
			}
			if !qr.HallucinationClean {
				t.Errorf("hallucination detected in answer for query %q", gq.Query)
			}
		})
	}

	// Aggregate scores
	if len(results) > 0 {
		var sumP, sumR, sumK, sumC float64
		hallucCount := 0
		for _, r := range results {
			sumP += r.CitationPrecision
			sumR += r.CitationRecall
			sumK += r.KeywordCoverage
			sumC += r.Confidence
			if !r.HallucinationClean {
				hallucCount++
			}
		}
		n := float64(len(results))
		t.Logf("\n=== QUALITY BASELINE ===")
		t.Logf("Mean citation precision:  %.2f", sumP/n)
		t.Logf("Mean citation recall:     %.2f", sumR/n)
		t.Logf("Mean keyword coverage:    %.2f", sumK/n)
		t.Logf("Hallucination rate:       %.1f%% (%d/%d)",
			float64(hallucCount)/n*100, hallucCount, len(results))
		t.Logf("Mean confidence:          %.2f", sumC/n)
	}
}

// ── Scoring unit tests (always run) ─────────────────────────────

func TestCitationPrecision(t *testing.T) {
	tests := []struct {
		name     string
		cited    []string
		expected []string
		want     float64
	}{
		{"perfect", []string{"doc-1"}, []string{"doc-1"}, 1.0},
		{"extra_citation", []string{"doc-1", "doc-2"}, []string{"doc-1"}, 0.5},
		{"all_wrong", []string{"doc-2"}, []string{"doc-1"}, 0.0},
		{"empty_cited", []string{}, []string{"doc-1"}, 0.0},
		{"multi_match", []string{"doc-1", "doc-2"}, []string{"doc-1", "doc-2"}, 1.0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := citationPrecision(tt.cited, tt.expected)
			if math.Abs(got-tt.want) > 0.001 {
				t.Errorf("citationPrecision(%v, %v) = %.2f, want %.2f",
					tt.cited, tt.expected, got, tt.want)
			}
		})
	}
}

func TestCitationRecall(t *testing.T) {
	tests := []struct {
		name     string
		cited    []string
		expected []string
		want     float64
	}{
		{"perfect", []string{"doc-1"}, []string{"doc-1"}, 1.0},
		{"missing_one", []string{"doc-1"}, []string{"doc-1", "doc-2"}, 0.5},
		{"all_found", []string{"doc-1", "doc-2", "doc-3"}, []string{"doc-1", "doc-2"}, 1.0},
		{"none_found", []string{"doc-3"}, []string{"doc-1", "doc-2"}, 0.0},
		{"empty_expected", []string{"doc-1"}, []string{}, 1.0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := citationRecall(tt.cited, tt.expected)
			if math.Abs(got-tt.want) > 0.001 {
				t.Errorf("citationRecall(%v, %v) = %.2f, want %.2f",
					tt.cited, tt.expected, got, tt.want)
			}
		})
	}
}

func TestKeywordCoverage(t *testing.T) {
	tests := []struct {
		name     string
		answer   string
		keywords []string
		want     float64
	}{
		{"all_found", "The fee is $5,000 per month", []string{"5,000", "month"}, 1.0},
		{"partial", "The fee is $5,000", []string{"5,000", "month"}, 0.5},
		{"none_found", "No relevant info", []string{"5,000", "month"}, 0.0},
		{"case_insensitive", "Interest Rate applied Monthly", []string{"interest", "monthly"}, 1.0},
		{"empty_keywords", "Some answer", []string{}, 1.0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := keywordCoverage(tt.answer, tt.keywords)
			if math.Abs(got-tt.want) > 0.001 {
				t.Errorf("keywordCoverage(%q, %v) = %.2f, want %.2f",
					tt.answer, tt.keywords, got, tt.want)
			}
		})
	}
}

func TestHallucinationClean(t *testing.T) {
	tests := []struct {
		name      string
		answer    string
		forbidden []string
		want      bool
	}{
		{"clean", "The fee is $5,000 per month", []string{"hourly", "annual"}, true},
		{"hallucinated", "The annual subscription costs $60,000", []string{"annual subscription"}, false},
		{"case_insensitive", "ANNUAL SUBSCRIPTION available", []string{"annual subscription"}, false},
		{"empty_forbidden", "Any answer", []string{}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := hallucinationClean(tt.answer, tt.forbidden)
			if got != tt.want {
				t.Errorf("hallucinationClean(%q, %v) = %v, want %v",
					tt.answer, tt.forbidden, got, tt.want)
			}
		})
	}
}
