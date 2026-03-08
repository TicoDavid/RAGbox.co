package handler

// Sarah — EPIC-028 Phase 4, Task 8: Insight API handler tests

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"github.com/connexus-ai/ragbox-backend/internal/middleware"
	"github.com/connexus-ai/ragbox-backend/internal/model"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// mockInsightScanner implements InsightScannerService for testing.
type mockInsightScanner struct {
	insights []model.ProactiveInsight
	scanErr  error
	ackErr   error
}

func (m *mockInsightScanner) GetActiveInsights(_ context.Context, _ string, _ int) ([]model.ProactiveInsight, error) {
	return m.insights, nil
}

func (m *mockInsightScanner) AcknowledgeInsight(_ context.Context, _ string) error {
	return m.ackErr
}

func (m *mockInsightScanner) ScanVaultForInsights(_ context.Context, _, _ string) ([]model.ProactiveInsight, error) {
	return m.insights, m.scanErr
}

func insightDeps(scanner *service.InsightScannerService) InsightDeps {
	return InsightDeps{Scanner: scanner}
}

// withAuth sets a user ID in the request context for testing.
func withAuth(r *http.Request, uid string) *http.Request {
	ctx := middleware.WithUserID(r.Context(), uid)
	return r.WithContext(ctx)
}

// --- ListInsights tests ---

func TestListInsights_ReturnsInsightsArray(t *testing.T) {
	deps := insightDepsFromMock(&mockInsightScanner{
		insights: []model.ProactiveInsight{
			{ID: "i1", Title: "Deadline approaching", InsightType: model.InsightDeadline},
		},
	})

	req := httptest.NewRequest("GET", "/api/v1/insights", nil)
	req = withAuth(req, "user1")
	rr := httptest.NewRecorder()

	ListInsights(deps).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}

	var resp envelope
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if !resp.Success {
		t.Error("expected success = true")
	}
}

func TestListInsights_ReturnsEmptyArrayWhenNone(t *testing.T) {
	deps := insightDepsFromMock(&mockInsightScanner{insights: nil})

	req := httptest.NewRequest("GET", "/api/v1/insights", nil)
	req = withAuth(req, "user1")
	rr := httptest.NewRecorder()

	ListInsights(deps).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}

	var resp struct {
		Success bool                      `json:"success"`
		Data    []model.ProactiveInsight   `json:"data"`
	}
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if len(resp.Data) != 0 {
		t.Errorf("expected empty array, got %d items", len(resp.Data))
	}
}

func TestListInsights_RequiresAuth(t *testing.T) {
	deps := insightDepsFromMock(&mockInsightScanner{})

	req := httptest.NewRequest("GET", "/api/v1/insights", nil)
	// No auth context
	rr := httptest.NewRecorder()

	ListInsights(deps).ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

// --- AcknowledgeInsight tests ---

func TestAcknowledgeInsight_Returns200(t *testing.T) {
	deps := insightDepsFromMock(&mockInsightScanner{})

	req := httptest.NewRequest("PATCH", "/api/v1/insights/i1/acknowledge", nil)
	req = withAuth(req, "user1")
	// Set Chi URL param
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", "i1")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	rr := httptest.NewRecorder()
	AcknowledgeInsight(deps).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}
}

func TestAcknowledgeInsight_RequiresAuth(t *testing.T) {
	deps := insightDepsFromMock(&mockInsightScanner{})

	req := httptest.NewRequest("PATCH", "/api/v1/insights/i1/acknowledge", nil)
	// No auth
	rr := httptest.NewRecorder()
	AcknowledgeInsight(deps).ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

// --- ScanVault tests ---

func TestScanVault_Returns200(t *testing.T) {
	deps := insightDepsFromMock(&mockInsightScanner{
		insights: []model.ProactiveInsight{
			{ID: "i1", Title: "Test insight"},
		},
	})

	body := strings.NewReader(`{"tenantId":"t1"}`)
	req := httptest.NewRequest("POST", "/api/v1/insights/scan", body)
	req = withAuth(req, "user1")
	rr := httptest.NewRecorder()

	ScanVault(deps).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}

	var resp envelope
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if !resp.Success {
		t.Error("expected success = true")
	}
}

func TestScanVault_RequiresAuth(t *testing.T) {
	deps := insightDepsFromMock(&mockInsightScanner{})

	req := httptest.NewRequest("POST", "/api/v1/insights/scan", nil)
	rr := httptest.NewRecorder()
	ScanVault(deps).ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

// insightDepsFromMock builds InsightDeps from a mock scanner.
// Since InsightScannerService is a concrete struct with unexported fields,
// we build one with mock dependencies that route calls to our mock.
func insightDepsFromMock(mock *mockInsightScanner) InsightDeps {
	return InsightDeps{
		Scanner: service.NewInsightScannerService(
			&testGenAI{response: "[]"},
			&testInsightRepo{
				activeInsights: mock.insights,
				ackErr:         mock.ackErr,
			},
			&testChunkScanner{},
		),
	}
}

// testGenAI is a minimal GenAIClient for handler tests.
type testGenAI struct {
	response string
}

func (m *testGenAI) GenerateContent(_ context.Context, _, _ string) (string, error) {
	return m.response, nil
}

// testInsightRepo implements service.InsightRepository for handler tests.
type testInsightRepo struct {
	activeInsights []model.ProactiveInsight
	ackErr         error
}

func (m *testInsightRepo) CreateInsight(_ context.Context, _ *model.ProactiveInsight) error { return nil }

func (m *testInsightRepo) GetActiveInsights(_ context.Context, _ string, _ int) ([]model.ProactiveInsight, error) {
	return m.activeInsights, nil
}

func (m *testInsightRepo) AcknowledgeInsight(_ context.Context, _ string) error {
	return m.ackErr
}

func (m *testInsightRepo) DeleteExpiredInsights(_ context.Context) (int, error) {
	return 0, nil
}

func (m *testInsightRepo) ExistsByHash(_ context.Context, _, _, _, _ string) (bool, error) {
	return false, nil
}

// testChunkScanner is a minimal ChunkScanner for handler tests.
type testChunkScanner struct{}

func (m *testChunkScanner) RecentChunksByUser(_ context.Context, _ string, _ int) ([]service.ScannableChunk, error) {
	return nil, nil
}
