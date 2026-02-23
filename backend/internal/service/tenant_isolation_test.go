package service

import (
	"context"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// ── Test users and documents ────────────────────────────────────

type tenantTestUser struct {
	ID       string
	Email    string
	Filename string
	Content  string
	Domain   string // for cross-tenant assertions
}

var tenantUsers = []tenantTestUser{
	{
		ID:       "test-user-a",
		Email:    "test-user-a@ragbox.co",
		Filename: "solar-energy-contracts.pdf",
		Domain:   "solar energy",
		Content: `SOLAR ENERGY POWER PURCHASE AGREEMENT

Section 1: Generation Capacity
The solar facility shall maintain a minimum capacity of 50 megawatts (MW) during peak hours.
Electricity generated shall be purchased at $0.08 per kilowatt-hour.

Section 2: Interconnection
The facility connects to the grid at Substation Alpha via 138kV transmission line.
All interconnection costs are borne by the generator.

Section 3: Force Majeure
Solar irradiance below 3.5 kWh/m²/day for thirty (30) consecutive days constitutes force majeure.`,
	},
	{
		ID:       "test-user-b",
		Email:    "test-user-b@ragbox.co",
		Filename: "maritime-shipping-regulations.pdf",
		Domain:   "maritime shipping",
		Content: `INTERNATIONAL MARITIME SHIPPING REGULATIONS

Section 1: Vessel Classification
All cargo vessels exceeding 500 gross tonnage must carry a valid IMO certification.
Tankers transporting hazardous materials require double-hull construction.

Section 2: Port Entry Requirements
Vessels must submit manifest documentation forty-eight (48) hours before port arrival.
Quarantine inspection is mandatory for ships arriving from designated high-risk zones.

Section 3: Environmental Compliance
Ballast water must be treated using IMO-approved systems before discharge.
Sulfur content in fuel shall not exceed 0.50% per MARPOL Annex VI.`,
	},
	{
		ID:       "test-user-c",
		Email:    "test-user-c@ragbox.co",
		Filename: "pediatric-healthcare-protocols.pdf",
		Domain:   "pediatric healthcare",
		Content: `PEDIATRIC HEALTHCARE PROTOCOLS

Section 1: Vaccination Schedule
Children aged 0-6 shall receive immunizations per the CDC recommended schedule.
MMR vaccine is administered at twelve (12) months with a booster at four (4) years.

Section 2: Growth Monitoring
Height and weight percentiles are recorded at every well-child visit.
BMI screening begins at age two (2) and continues through adolescence.

Section 3: Emergency Triage
Pediatric patients presenting with fever above 104°F require immediate evaluation.
The Broselow tape determines medication dosing for patients under 36 kg.`,
	},
}

const demoUserID = "demo-user-id"

var demoSeedDocs = []struct {
	ID           string
	OriginalName string
	Content      string
}{
	{"doc-seed-1", "RAGbox_OpenClaw_Master_Research.md", "OpenClaw master research document about legal AI systems and contract analysis methodologies."},
	{"doc-seed-2", "RAGbox_Build_Manifest_Phase0-3.md", "Build manifest covering phases 0 through 3 of the RAGbox platform architecture and deployment pipeline."},
	{"doc-seed-3", "RAGbox_Phase10_Settings_DemoSeed.md", "Phase 10 settings configuration for demo seed data including Mercury personas and vault defaults."},
}

// ── Tenant-aware mocks ──────────────────────────────────────────

// tenantMockSearcher returns only documents belonging to the queried userID.
// It also tracks all queries for concurrent assertion.
type tenantMockSearcher struct {
	mu         sync.Mutex
	docsByUser map[string][]VectorSearchResult
	queries    []tenantQuery // audit trail
}

type tenantQuery struct {
	UserID string
	DocIDs []string // IDs returned
}

func (m *tenantMockSearcher) SimilaritySearch(_ context.Context, _ []float32, _ int, _ float64, userID string, _ bool) ([]VectorSearchResult, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	results := m.docsByUser[userID] // nil if userID not found = empty results
	var ids []string
	for _, r := range results {
		ids = append(ids, r.Document.ID)
	}
	m.queries = append(m.queries, tenantQuery{UserID: userID, DocIDs: ids})
	return results, nil
}

// tenantMockBM25 returns only BM25 results for the queried userID.
type tenantMockBM25 struct {
	mu         sync.Mutex
	docsByUser map[string][]VectorSearchResult
}

func (m *tenantMockBM25) FullTextSearch(_ context.Context, _ string, _ int, userID string) ([]VectorSearchResult, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.docsByUser[userID], nil
}

// buildTenantIndex creates the mock searcher with chunked documents per user.
func buildTenantIndex() (*tenantMockSearcher, *tenantMockBM25) {
	now := time.Now().UTC()
	chunker := NewLegacyChunkerService(512, 0.15)
	ctx := context.Background()

	vectorDocs := make(map[string][]VectorSearchResult)
	bm25Docs := make(map[string][]VectorSearchResult)

	// Chunk and index each user's documents
	for _, u := range tenantUsers {
		chunks, _ := chunker.Chunk(ctx, u.Content, "doc-"+u.ID)
		var results []VectorSearchResult
		for i, c := range chunks {
			results = append(results, VectorSearchResult{
				Chunk: model.DocumentChunk{
					ID:          fmt.Sprintf("doc-%s-chunk-%d", u.ID, i),
					DocumentID:  "doc-" + u.ID,
					ChunkIndex:  i,
					Content:     c.Content,
					ContentHash: c.ContentHash,
					TokenCount:  c.TokenCount,
				},
				Similarity: 0.85,
				Document: model.Document{
					ID:           "doc-" + u.ID,
					UserID:       u.ID,
					Filename:     u.Filename,
					OriginalName: u.Filename,
					ChunkCount:   len(chunks),
					CreatedAt:    now,
				},
			})
		}
		vectorDocs[u.ID] = results
		bm25Docs[u.ID] = results
	}

	// Add demo seed documents
	var demoResults []VectorSearchResult
	for _, d := range demoSeedDocs {
		demoResults = append(demoResults, VectorSearchResult{
			Chunk: model.DocumentChunk{
				ID:         d.ID + "-chunk-0",
				DocumentID: d.ID,
				Content:    d.Content,
			},
			Similarity: 0.90,
			Document: model.Document{
				ID:           d.ID,
				UserID:       demoUserID,
				Filename:     d.OriginalName,
				OriginalName: d.OriginalName,
				ChunkCount:   1,
				CreatedAt:    now,
			},
		})
	}
	vectorDocs[demoUserID] = demoResults
	bm25Docs[demoUserID] = demoResults

	return &tenantMockSearcher{docsByUser: vectorDocs},
		&tenantMockBM25{docsByUser: bm25Docs}
}

// ── Test harness ────────────────────────────────────────────────

func TestTenantIsolation(t *testing.T) {
	if os.Getenv("TENANT_TESTS") != "1" {
		t.Skip("TENANT_TESTS not set — skipping tenant isolation suite")
	}

	vectorSearcher, bm25Searcher := buildTenantIndex()
	svc := NewRetrieverService(&mockQueryEmbedder{}, vectorSearcher)
	svc.SetBM25(bm25Searcher)

	t.Run("Sequential_Isolation", func(t *testing.T) {
		ctx := context.Background()

		// User A queries about shipping (User B's domain) → must return NO User B docs
		resultA, err := svc.Retrieve(ctx, "test-user-a", "What are the shipping regulations?", false)
		if err != nil {
			t.Fatalf("User A Retrieve error: %v", err)
		}
		for _, c := range resultA.Chunks {
			if c.Document.UserID != "test-user-a" {
				t.Errorf("ISOLATION VIOLATION: User A got doc from %q (doc=%q)",
					c.Document.UserID, c.Document.ID)
			}
		}
		t.Logf("User A: %d chunks returned, all owned by test-user-a", len(resultA.Chunks))

		// User B queries about solar energy (User A's domain) → must return NO User A docs
		resultB, err := svc.Retrieve(ctx, "test-user-b", "Tell me about solar energy", false)
		if err != nil {
			t.Fatalf("User B Retrieve error: %v", err)
		}
		for _, c := range resultB.Chunks {
			if c.Document.UserID != "test-user-b" {
				t.Errorf("ISOLATION VIOLATION: User B got doc from %q (doc=%q)",
					c.Document.UserID, c.Document.ID)
			}
		}
		t.Logf("User B: %d chunks returned, all owned by test-user-b", len(resultB.Chunks))

		// User C queries "summarize my documents" → must return ONLY pediatric content
		resultC, err := svc.Retrieve(ctx, "test-user-c", "Summarize my documents", false)
		if err != nil {
			t.Fatalf("User C Retrieve error: %v", err)
		}
		for _, c := range resultC.Chunks {
			if c.Document.UserID != "test-user-c" {
				t.Errorf("ISOLATION VIOLATION: User C got doc from %q (doc=%q)",
					c.Document.UserID, c.Document.ID)
			}
		}
		t.Logf("User C: %d chunks returned, all owned by test-user-c", len(resultC.Chunks))
	})

	t.Run("Concurrent_Isolation", func(t *testing.T) {
		ctx := context.Background()
		queries := []struct {
			UserID string
			Query  string
		}{
			{"test-user-a", "solar panel efficiency"},
			{"test-user-b", "vessel tonnage requirements"},
			{"test-user-c", "vaccination schedule for children"},
			{"test-user-a", "power purchase agreement terms"},
			{"test-user-b", "port entry manifest documentation"},
			{"test-user-c", "pediatric emergency triage"},
			{"test-user-a", "interconnection costs"},
			{"test-user-b", "ballast water treatment"},
			{"test-user-c", "growth monitoring percentiles"},
			{"test-user-a", "force majeure solar irradiance"},
		}

		type queryResult struct {
			idx    int
			userID string
			chunks []RankedChunk
			err    error
		}

		results := make(chan queryResult, len(queries))
		var wg sync.WaitGroup

		for i, q := range queries {
			wg.Add(1)
			go func(idx int, userID, query string) {
				defer wg.Done()
				res, err := svc.Retrieve(ctx, userID, query, false)
				qr := queryResult{idx: idx, userID: userID, err: err}
				if res != nil {
					qr.chunks = res.Chunks
				}
				results <- qr
			}(i, q.UserID, q.Query)
		}

		wg.Wait()
		close(results)

		violations := 0
		for qr := range results {
			if qr.err != nil {
				t.Errorf("Query %d (user=%s) error: %v", qr.idx, qr.userID, qr.err)
				continue
			}
			for _, c := range qr.chunks {
				if c.Document.UserID != qr.userID {
					t.Errorf("CONCURRENT ISOLATION VIOLATION: query %d user=%q got doc from %q (doc=%q)",
						qr.idx, qr.userID, c.Document.UserID, c.Document.ID)
					violations++
				}
			}
		}
		t.Logf("Concurrent isolation: 10 queries, %d violations", violations)
		if violations > 0 {
			t.Fatalf("CRITICAL: %d cross-tenant results detected under concurrent load", violations)
		}
	})

	t.Run("DemoSeed_Isolation", func(t *testing.T) {
		ctx := context.Background()

		demoDocNames := map[string]bool{
			"RAGbox_OpenClaw_Master_Research.md":  true,
			"RAGbox_Build_Manifest_Phase0-3.md":   true,
			"RAGbox_Phase10_Settings_DemoSeed.md": true,
		}

		// Each non-demo user queries — must NEVER see demo seed docs
		for _, u := range tenantUsers {
			result, err := svc.Retrieve(ctx, u.ID, "RAGbox research documents build manifest settings", false)
			if err != nil {
				t.Fatalf("User %s Retrieve error: %v", u.ID, err)
			}
			for _, c := range result.Chunks {
				if demoDocNames[c.Document.Filename] || demoDocNames[c.Document.OriginalName] {
					t.Errorf("DEMO SEED LEAK: user %q got demo doc %q (original=%q)",
						u.ID, c.Document.Filename, c.Document.OriginalName)
				}
				if c.Document.UserID == demoUserID {
					t.Errorf("DEMO SEED LEAK: user %q got doc owned by %q (doc=%q)",
						u.ID, demoUserID, c.Document.ID)
				}
			}
			t.Logf("User %s: demo seed isolation verified (%d chunks, 0 demo docs)",
				u.ID, len(result.Chunks))
		}

		// Verify demo user CAN see their own docs
		demoResult, err := svc.Retrieve(ctx, demoUserID, "RAGbox documents", false)
		if err != nil {
			t.Fatalf("Demo user Retrieve error: %v", err)
		}
		if len(demoResult.Chunks) == 0 {
			t.Error("Demo user got 0 chunks — expected demo seed docs")
		}
		for _, c := range demoResult.Chunks {
			if c.Document.UserID != demoUserID {
				t.Errorf("Demo user got non-demo doc: %q owned by %q",
					c.Document.ID, c.Document.UserID)
			}
		}
		t.Logf("Demo user: %d chunks returned, all demo-owned", len(demoResult.Chunks))
	})
}

// ── Always-on unit tests (validate mock correctness) ────────────

func TestTenantMockSearcher_ReturnsOnlyOwnedDocs(t *testing.T) {
	now := time.Now().UTC()
	searcher := &tenantMockSearcher{
		docsByUser: map[string][]VectorSearchResult{
			"user-x": {{
				Chunk:      model.DocumentChunk{ID: "cx", DocumentID: "dx"},
				Similarity: 0.9,
				Document:   model.Document{ID: "dx", UserID: "user-x", CreatedAt: now},
			}},
			"user-y": {{
				Chunk:      model.DocumentChunk{ID: "cy", DocumentID: "dy"},
				Similarity: 0.8,
				Document:   model.Document{ID: "dy", UserID: "user-y", CreatedAt: now},
			}},
		},
	}

	ctx := context.Background()

	// user-x should only get dx
	results, _ := searcher.SimilaritySearch(ctx, nil, 10, 0.3, "user-x", false)
	if len(results) != 1 || results[0].Document.ID != "dx" {
		t.Errorf("user-x got %d results, want 1 (dx)", len(results))
	}

	// user-y should only get dy
	results, _ = searcher.SimilaritySearch(ctx, nil, 10, 0.3, "user-y", false)
	if len(results) != 1 || results[0].Document.ID != "dy" {
		t.Errorf("user-y got %d results, want 1 (dy)", len(results))
	}

	// unknown user should get nothing
	results, _ = searcher.SimilaritySearch(ctx, nil, 10, 0.3, "user-z", false)
	if len(results) != 0 {
		t.Errorf("user-z got %d results, want 0", len(results))
	}
}

func TestTenantMockBM25_ReturnsOnlyOwnedDocs(t *testing.T) {
	now := time.Now().UTC()
	bm25 := &tenantMockBM25{
		docsByUser: map[string][]VectorSearchResult{
			"user-x": {{
				Chunk:    model.DocumentChunk{ID: "cx"},
				Document: model.Document{ID: "dx", UserID: "user-x", CreatedAt: now},
			}},
		},
	}

	ctx := context.Background()

	results, _ := bm25.FullTextSearch(ctx, "query", 10, "user-x")
	if len(results) != 1 {
		t.Errorf("user-x got %d results, want 1", len(results))
	}

	results, _ = bm25.FullTextSearch(ctx, "query", 10, "user-unknown")
	if len(results) != 0 {
		t.Errorf("unknown user got %d results, want 0", len(results))
	}
}
