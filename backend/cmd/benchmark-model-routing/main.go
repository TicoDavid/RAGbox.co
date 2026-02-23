// benchmark-model-routing compares TTFB and total latency for Gemini 2.5 Flash
// via Vertex AI vs OpenRouter. Both paths use streaming for apples-to-apples.
//
// Usage:
//
//	OPENROUTER_API_KEY=sk-... GOOGLE_CLOUD_PROJECT=ragbox-sovereign-prod \
//	  go run ./cmd/benchmark-model-routing
//
// Results are printed as a markdown table to stdout. Redirect to file as needed.
package main

import (
	"context"
	"fmt"
	"math"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/connexus-ai/ragbox-backend/internal/gcpclient"
)

// benchQuery holds a single benchmark query and its category.
type benchQuery struct {
	ID       int
	Query    string
	Category string // simple, complex, keyword, cache
}

// benchResult stores timing for one provider + query.
type benchResult struct {
	QueryID    int
	Provider   string
	TTFBMs     int64
	TotalMs    int64
	TokenCount int
	Error      string
}

var queries = []benchQuery{
	{1, "What is the effective date?", "simple"},
	{2, "Who are the parties to this agreement?", "simple"},
	{3, "What is the termination notice period?", "simple"},
	{4, "Summarize all the obligations of the service provider", "complex"},
	{5, "What happens if both parties disagree on liability?", "complex"},
	{6, "Compare the warranty terms with the limitation of liability", "complex"},
	{7, "What does Section 4.2 say?", "keyword"},
	{8, "The Provider shall maintain insurance coverage of no less than one million dollars", "keyword"},
	{9, "What is the effective date?", "cache-repeat"},
	{10, "Summarize all the obligations of the service provider", "cache-repeat"},
}

const systemPrompt = `You are a document analysis assistant. Answer questions about legal documents concisely. If you don't have document context, provide a general answer demonstrating your reasoning capability. Keep answers under 200 words.`

func main() {
	openrouterKey := os.Getenv("OPENROUTER_API_KEY")
	project := os.Getenv("GOOGLE_CLOUD_PROJECT")
	location := os.Getenv("VERTEX_AI_LOCATION")

	if project == "" {
		project = "ragbox-sovereign-prod"
	}
	if location == "" {
		location = "us-east4"
	}

	ctx := context.Background()

	// --- Initialize clients (both optional) ---
	var vertexClient *gcpclient.GenAIAdapter
	var openrouterClient *gcpclient.BYOLLMClient

	vertexClient, err := gcpclient.NewGenAIAdapter(ctx, project, location, "gemini-2.5-flash")
	if err != nil {
		fmt.Fprintf(os.Stderr, "WARN: Vertex AI unavailable: %v\n", err)
		vertexClient = nil
	}

	if openrouterKey != "" {
		openrouterClient = gcpclient.NewBYOLLMClient(
			openrouterKey,
			"https://openrouter.ai/api/v1",
			"google/gemini-2.5-flash",
		)
	} else {
		fmt.Fprintln(os.Stderr, "WARN: OPENROUTER_API_KEY not set — skipping OpenRouter")
	}

	if vertexClient == nil && openrouterClient == nil {
		fmt.Fprintln(os.Stderr, "ERROR: at least one provider must be available")
		os.Exit(1)
	}

	providerCount := 0
	if vertexClient != nil {
		providerCount++
	}
	if openrouterClient != nil {
		providerCount++
	}

	fmt.Fprintf(os.Stderr, "Benchmark: Gemini 2.5 Flash — %d provider(s)\n", providerCount)
	if vertexClient != nil {
		fmt.Fprintf(os.Stderr, "  Vertex AI: %s/%s\n", project, location)
	}
	if openrouterClient != nil {
		fmt.Fprintln(os.Stderr, "  OpenRouter: google/gemini-2.5-flash")
	}
	fmt.Fprintf(os.Stderr, "Queries: %d × %d providers = %d measurements\n\n", len(queries), providerCount, len(queries)*providerCount)

	var results []benchResult

	for _, q := range queries {
		fmt.Fprintf(os.Stderr, "  [%d/%d] %q ...\n", q.ID, len(queries), truncate(q.Query, 50))

		// --- Vertex AI ---
		if vertexClient != nil {
			r := runStreamingBenchmark(ctx, vertexClient, q, "Vertex AI")
			results = append(results, r)
			fmt.Fprintf(os.Stderr, "    Vertex AI:   TTFB=%dms  Total=%dms  Tokens=%d\n", r.TTFBMs, r.TotalMs, r.TokenCount)
			time.Sleep(500 * time.Millisecond)
		}

		// --- OpenRouter ---
		if openrouterClient != nil {
			r := runStreamingBenchmark(ctx, openrouterClient, q, "OpenRouter")
			results = append(results, r)
			fmt.Fprintf(os.Stderr, "    OpenRouter:  TTFB=%dms  Total=%dms  Tokens=%d\n", r.TTFBMs, r.TotalMs, r.TokenCount)
		}

		// Pause between queries
		time.Sleep(1 * time.Second)
	}

	// --- Output markdown report ---
	printReport(results)
}

// streamable is an interface for both GenAIAdapter and BYOLLMClient.
type streamable interface {
	GenerateContentStream(ctx context.Context, systemPrompt, userPrompt string) (<-chan string, <-chan error)
}

func runStreamingBenchmark(ctx context.Context, client streamable, q benchQuery, provider string) benchResult {
	ctx, cancel := context.WithTimeout(ctx, 120*time.Second)
	defer cancel()

	start := time.Now()
	textCh, errCh := client.GenerateContentStream(ctx, systemPrompt, q.Query)

	var ttfb time.Duration
	var tokenCount int
	first := true

	for token := range textCh {
		if first {
			ttfb = time.Since(start)
			first = false
		}
		tokenCount += len(strings.Fields(token)) // approximate word count as token proxy
		_ = token
	}

	totalDur := time.Since(start)

	// Check error
	var errStr string
	select {
	case e := <-errCh:
		if e != nil {
			errStr = e.Error()
		}
	default:
	}

	if first {
		// No tokens received at all
		if errStr == "" {
			errStr = "no tokens received"
		}
		return benchResult{
			QueryID:  q.ID,
			Provider: provider,
			TotalMs:  totalDur.Milliseconds(),
			Error:    errStr,
		}
	}

	return benchResult{
		QueryID:    q.ID,
		Provider:   provider,
		TTFBMs:     ttfb.Milliseconds(),
		TotalMs:    totalDur.Milliseconds(),
		TokenCount: tokenCount,
		Error:      errStr,
	}
}

func printReport(results []benchResult) {
	now := time.Now().Format("2006-01-02 15:04 MST")

	// Detect which providers were tested
	hasVertex := hasProvider(results, "Vertex AI")
	hasOR := hasProvider(results, "OpenRouter")

	fmt.Println("# Model Routing Benchmark: Gemini 2.5 Flash")
	fmt.Println()
	fmt.Printf("**Date:** %s\n", now)
	fmt.Println("**Model:** Gemini 2.5 Flash")
	if hasVertex && hasOR {
		fmt.Println("**Providers:** Vertex AI (us-east4) vs OpenRouter")
	} else if hasVertex {
		fmt.Println("**Providers:** Vertex AI (us-east4) — OpenRouter not tested (no API key)")
	} else {
		fmt.Println("**Providers:** OpenRouter — Vertex AI not tested (no GCP credentials)")
	}
	fmt.Println("**Engineer:** Sheldon (Chief Engineer)")
	fmt.Println()
	fmt.Println("---")
	fmt.Println()

	// Per-query table
	fmt.Println("## Per-Query Results")
	fmt.Println()
	fmt.Println("| # | Category | Query | Vertex TTFB | OR TTFB | Vertex Total | OR Total | TTFB Winner |")
	fmt.Println("|---|----------|-------|-------------|---------|--------------|----------|-------------|")

	for _, q := range queries {
		var vr, or benchResult
		var vrTested, orTested bool
		for _, r := range results {
			if r.QueryID == q.ID && r.Provider == "Vertex AI" {
				vr = r
				vrTested = true
			}
			if r.QueryID == q.ID && r.Provider == "OpenRouter" {
				or = r
				orTested = true
			}
		}

		winner := "—"
		if vrTested && orTested && vr.Error == "" && or.Error == "" {
			if vr.TTFBMs < or.TTFBMs {
				winner = "Vertex AI"
			} else if or.TTFBMs < vr.TTFBMs {
				winner = "OpenRouter"
			} else {
				winner = "Tie"
			}
		}

		vTTFB := fmtResult(vr.TTFBMs, vr.Error, vrTested)
		oTTFB := fmtResult(or.TTFBMs, or.Error, orTested)
		vTotal := fmtResult(vr.TotalMs, vr.Error, vrTested)
		oTotal := fmtResult(or.TotalMs, or.Error, orTested)

		fmt.Printf("| %d | %s | %s | %s | %s | %s | %s | %s |\n",
			q.ID, q.Category, truncate(q.Query, 45), vTTFB, oTTFB, vTotal, oTotal, winner)
	}

	fmt.Println()
	fmt.Println("---")
	fmt.Println()

	// Summary stats
	fmt.Println("## Summary Statistics")
	fmt.Println()

	vertexTTFBs := collectTTFBs(results, "Vertex AI")
	orTTFBs := collectTTFBs(results, "OpenRouter")
	vertexTotals := collectTotals(results, "Vertex AI")
	orTotals := collectTotals(results, "OpenRouter")

	fmt.Println("| Metric | Vertex AI | OpenRouter |")
	fmt.Println("|--------|-----------|------------|")
	fmt.Printf("| Avg TTFB | %s | %s |\n", fmtStat(vertexTTFBs, avg, hasVertex), fmtStat(orTTFBs, avg, hasOR))
	fmt.Printf("| P50 TTFB | %s | %s |\n", fmtPercentileStat(vertexTTFBs, 50, hasVertex), fmtPercentileStat(orTTFBs, 50, hasOR))
	fmt.Printf("| P95 TTFB | %s | %s |\n", fmtPercentileStat(vertexTTFBs, 95, hasVertex), fmtPercentileStat(orTTFBs, 95, hasOR))
	fmt.Printf("| Min TTFB | %s | %s |\n", fmtStat(vertexTTFBs, minVal, hasVertex), fmtStat(orTTFBs, minVal, hasOR))
	fmt.Printf("| Max TTFB | %s | %s |\n", fmtStat(vertexTTFBs, maxVal, hasVertex), fmtStat(orTTFBs, maxVal, hasOR))
	fmt.Printf("| Avg Total | %s | %s |\n", fmtStat(vertexTotals, avg, hasVertex), fmtStat(orTotals, avg, hasOR))
	vErrCount := countErrors(results, "Vertex AI")
	oErrCount := countErrors(results, "OpenRouter")
	fmt.Printf("| Errors | %s | %s |\n",
		fmtErrorCount(vErrCount, hasVertex), fmtErrorCount(oErrCount, hasOR))

	fmt.Println()
	fmt.Println("---")
	fmt.Println()

	// Recommendation
	fmt.Println("## Recommendation")
	fmt.Println()

	if !hasVertex || !hasOR {
		fmt.Println("**Incomplete comparison** — only one provider was tested. Re-run with both")
		fmt.Println("`OPENROUTER_API_KEY` and GCP credentials to get a full comparison.")
		if hasVertex {
			fmt.Println()
			fmt.Printf("Vertex AI baseline TTFB: avg %dms, P50 %dms, P95 %dms.\n",
				avg(vertexTTFBs), percentile(vertexTTFBs, 50), percentile(vertexTTFBs, 95))
		}
	} else {
		vAvg := avg(vertexTTFBs)
		oAvg := avg(orTTFBs)

		if vErrCount > 0 && oErrCount > 0 {
			fmt.Println("Both providers had errors during testing. Manual investigation needed.")
		} else if vErrCount > 0 {
			fmt.Println("**OpenRouter** — Vertex AI had errors during testing.")
		} else if oErrCount > 0 {
			fmt.Println("**Vertex AI** — OpenRouter had errors during testing.")
		} else {
			diff := float64(vAvg-oAvg) / float64(vAvg) * 100
			absDiff := math.Abs(diff)

			if absDiff < 10 {
				fmt.Printf("**Stay Vertex AI** — difference is negligible (%.0f%%). Vertex AI offers lower operational complexity (no external API key, no egress costs, GCP-native IAM).\n", absDiff)
			} else if diff > 0 {
				fmt.Printf("**Consider OpenRouter** — %dms avg TTFB improvement (%.0f%% faster). Evaluate: egress costs, API key management, availability SLA.\n", vAvg-oAvg, diff)
			} else {
				fmt.Printf("**Stay Vertex AI** — Vertex AI is %dms faster avg TTFB (%.0f%% faster). Lower operational complexity, no external dependency.\n", oAvg-vAvg, absDiff)
			}
		}
	}

	fmt.Println()
	fmt.Println("---")
	fmt.Println()
	fmt.Println("— Sheldon, Chief Engineer")
}

func hasProvider(results []benchResult, provider string) bool {
	for _, r := range results {
		if r.Provider == provider {
			return true
		}
	}
	return false
}

func fmtResult(ms int64, errStr string, tested bool) string {
	if !tested {
		return "—"
	}
	if errStr != "" {
		return "ERROR"
	}
	return fmt.Sprintf("%dms", ms)
}

func fmtStat(vals []int64, fn func([]int64) int64, tested bool) string {
	if !tested {
		return "—"
	}
	return fmt.Sprintf("%dms", fn(vals))
}

func fmtPercentileStat(vals []int64, p float64, tested bool) string {
	if !tested {
		return "—"
	}
	return fmt.Sprintf("%dms", percentile(vals, p))
}

func fmtErrorCount(count int, tested bool) string {
	if !tested {
		return "—"
	}
	return fmt.Sprintf("%d/%d", count, len(queries))
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max-3] + "..."
}

func collectTTFBs(results []benchResult, provider string) []int64 {
	var vals []int64
	for _, r := range results {
		if r.Provider == provider && r.Error == "" {
			vals = append(vals, r.TTFBMs)
		}
	}
	return vals
}

func collectTotals(results []benchResult, provider string) []int64 {
	var vals []int64
	for _, r := range results {
		if r.Provider == provider && r.Error == "" {
			vals = append(vals, r.TotalMs)
		}
	}
	return vals
}

func countErrors(results []benchResult, provider string) int {
	var count int
	for _, r := range results {
		if r.Provider == provider && r.Error != "" {
			count++
		}
	}
	return count
}

func avg(vals []int64) int64 {
	if len(vals) == 0 {
		return 0
	}
	var sum int64
	for _, v := range vals {
		sum += v
	}
	return sum / int64(len(vals))
}

func percentile(vals []int64, p float64) int64 {
	if len(vals) == 0 {
		return 0
	}
	sorted := make([]int64, len(vals))
	copy(sorted, vals)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i] < sorted[j] })

	idx := int(math.Ceil(p/100*float64(len(sorted)))) - 1
	if idx < 0 {
		idx = 0
	}
	if idx >= len(sorted) {
		idx = len(sorted) - 1
	}
	return sorted[idx]
}

func minVal(vals []int64) int64 {
	if len(vals) == 0 {
		return 0
	}
	m := vals[0]
	for _, v := range vals[1:] {
		if v < m {
			m = v
		}
	}
	return m
}

func maxVal(vals []int64) int64 {
	if len(vals) == 0 {
		return 0
	}
	m := vals[0]
	for _, v := range vals[1:] {
		if v > m {
			m = v
		}
	}
	return m
}
