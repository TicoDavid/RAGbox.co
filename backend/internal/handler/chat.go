package handler

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"errors"

	"github.com/connexus-ai/ragbox-backend/internal/cache"
	"github.com/connexus-ai/ragbox-backend/internal/gcpclient"
	"github.com/connexus-ai/ragbox-backend/internal/middleware"
	"github.com/connexus-ai/ragbox-backend/internal/model"
	"github.com/connexus-ai/ragbox-backend/internal/service"
	"golang.org/x/sync/errgroup"
)

// DonePayload is the structured payload sent with the final "done" SSE event.
type DonePayload struct {
	Answer    string         `json:"answer"`
	Sources   []DoneSource   `json:"sources"`
	Citations []DoneCitation `json:"citations"`
	Evidence  DoneEvidence   `json:"evidence"`
}

// DoneCitation represents a retrieved chunk used as context for the answer.
type DoneCitation struct {
	DocumentName   string  `json:"documentName"`
	DocumentID     string  `json:"documentId"`
	ChunkIndex     int     `json:"chunkIndex"`
	RelevanceScore float64 `json:"relevanceScore"`
	Snippet        string  `json:"snippet"`
}

// DoneSource describes a single source document referenced in the answer.
type DoneSource struct {
	DocumentID   string  `json:"documentId"`
	DocumentName string  `json:"documentName"`
	PageNumber   *int    `json:"pageNumber"`
	Excerpt      string  `json:"excerpt"`
	Relevance    float64 `json:"relevance"`
	ChunkID      string  `json:"chunkId"`
}

// DoneEvidence contains metadata about the retrieval and generation process.
type DoneEvidence struct {
	TotalChunksSearched    int     `json:"totalChunksSearched"`
	TotalDocumentsSearched int     `json:"totalDocumentsSearched"`
	ConfidenceScore        float64 `json:"confidenceScore"`
	Model                  string  `json:"model"`
	LatencyMs              int64   `json:"latencyMs"`
	CitationCount          int     `json:"citationCount"`
}

// buildDonePayload constructs a DonePayload from nullable pipeline outputs.
// All parameters may be nil; the function degrades gracefully.
func buildDonePayload(
	retrieval *service.RetrievalResult,
	initial *service.GenerationResult,
	result *service.ReflectionResult,
	startTime time.Time,
	providerName string,
) DonePayload {
	// Answer: prefer reflection result, fall back to initial, then empty
	answer := ""
	if result != nil {
		answer = result.FinalAnswer
	} else if initial != nil {
		answer = initial.Answer
	}

	// Model name
	modelName := ""
	if initial != nil {
		modelName = initial.ModelUsed
	}
	model := providerName + "/" + modelName

	// Confidence
	confidence := 0.0
	if result != nil {
		confidence = result.FinalConfidence
	} else if initial != nil {
		confidence = initial.Confidence
	}

	// Citations → Sources (cross-reference with retrieval chunks for doc names)
	var citations []service.CitationRef
	if result != nil {
		citations = result.Citations
	} else if initial != nil {
		citations = initial.Citations
	}

	// Build a map of chunk ID → document name from retrieval
	chunkDocName := make(map[string]string)
	if retrieval != nil {
		for _, rc := range retrieval.Chunks {
			chunkDocName[rc.Chunk.ID] = rc.Document.OriginalName
		}
	}

	sources := make([]DoneSource, 0, len(citations))
	for _, c := range citations {
		sources = append(sources, DoneSource{
			DocumentID:   c.DocumentID,
			DocumentName: chunkDocName[c.ChunkID],
			PageNumber:   nil,
			Excerpt:      c.Excerpt,
			Relevance:    c.Relevance,
			ChunkID:      c.ChunkID,
		})
	}

	// Citations: built from retrieval chunks (the actual context fed to the model)
	doneCitations := make([]DoneCitation, 0)
	if retrieval != nil {
		for _, rc := range retrieval.Chunks {
			snippet := rc.Chunk.Content
			if len(snippet) > 200 {
				snippet = snippet[:200] + "..."
			}
			doneCitations = append(doneCitations, DoneCitation{
				DocumentName:   rc.Document.OriginalName,
				DocumentID:     rc.Document.ID,
				ChunkIndex:     rc.Chunk.ChunkIndex,
				RelevanceScore: rc.FinalScore,
				Snippet:        snippet,
			})
		}
	}

	// Evidence
	totalChunks := 0
	totalDocs := 0
	if retrieval != nil {
		totalChunks = retrieval.TotalCandidates
		totalDocs = retrieval.TotalDocumentsFound
	}

	return DonePayload{
		Answer:    answer,
		Sources:   sources,
		Citations: doneCitations,
		Evidence: DoneEvidence{
			TotalChunksSearched:    totalChunks,
			TotalDocumentsSearched: totalDocs,
			ConfidenceScore:        confidence,
			Model:                  model,
			LatencyMs:              time.Since(startTime).Milliseconds(),
			CitationCount:          len(citations),
		},
	}
}

// ChatRequest is the request body for the chat endpoint.
type ChatRequest struct {
	Query         string `json:"query"`
	PrivilegeMode bool   `json:"privilegeMode"`
	Mode          string `json:"mode"` // "concise", "detailed", "risk-analysis"
	Persona       string `json:"persona"`
	StrictMode    bool   `json:"strictMode"`
	// Safety mode: when false, web-fetched content is accepted as pseudo-chunks
	SafetyMode *bool  `json:"safetyMode,omitempty"`
	WebContext string `json:"webContext,omitempty"`
	// BYOLLM fields (optional — absent means use AEGIS/Vertex AI)
	LLMProvider string `json:"llmProvider,omitempty"`
	LLMModel    string `json:"llmModel,omitempty"`
	LLMApiKey   string `json:"llmApiKey,omitempty"`
	LLMBaseUrl  string `json:"llmBaseUrl,omitempty"`
}

// PersonaFetcher loads persona from the database.
type PersonaFetcher interface {
	GetByTenantID(ctx context.Context, tenantID string) (*model.MercuryPersona, error)
}

// CortexSearcher abstracts cortex working memory for the chat handler.
type CortexSearcher interface {
	Search(ctx context.Context, tenantID, query string, limit int) ([]model.CortexEntry, error)
	GetActiveInstructions(ctx context.Context, tenantID string) ([]model.CortexEntry, error)
	Ingest(ctx context.Context, tenantID, content, sourceChannel string, sourceMessageID *string, isInstruction bool) error
}

// ChatDeps bundles the services needed by the chat handler.
// DocumentStatusChecker provides lightweight document status queries for the chat handler.
// Implemented by repository.DocumentRepo. (STORY-172)
type DocumentStatusChecker interface {
	HasProcessingDocuments(ctx context.Context, userID string) (bool, error)
	ListUserDocumentSummaries(ctx context.Context, userID string) ([]service.DocSummary, error)
}

type ChatDeps struct {
	Retriever      *service.RetrieverService
	Generator      service.Generator
	SelfRAG        *service.SelfRAGService
	Metrics        *middleware.Metrics // optional, for silence trigger tracking
	ContentGapSvc  *service.ContentGapService
	SessionSvc     *service.SessionService
	PersonaFetcher PersonaFetcher  // optional — nil means use file-based persona
	CortexSvc      CortexSearcher  // optional — nil means no working memory
	QueryCache     *cache.QueryCache // optional — nil disables retrieval caching
	EmbedCache     *cache.EmbeddingCache // optional — nil disables embedding caching
	UsageSvc       *service.UsageService // optional — nil disables usage metering
	UserTierFunc   func(ctx context.Context, userID string) string // optional — returns user's subscription tier
	DocStatus      DocumentStatusChecker // optional — STORY-172: check if docs are still processing
	PrivilegeState *PrivilegeState // STORY-S01 Gap 3: server-side privilege state (ignores request body)
}

// selfRAGSkipThreshold: skip SelfRAG reflection when initial confidence is above this.
// Configurable via SELFRAG_SKIP_THRESHOLD env var (default 0.80).
func selfRAGSkipThreshold() float64 {
	if v := os.Getenv("SELFRAG_SKIP_THRESHOLD"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil && f > 0 && f <= 1 {
			return f
		}
	}
	return 0.80
}

// confidenceFloor returns the minimum confidence required to show citations.
// Below this threshold, a clean "no relevant context" message is returned instead
// of misleading citations with low confidence. (STORY-171)
// Configurable via CONFIDENCE_FLOOR env var (default 0.30).
func confidenceFloor() float64 {
	if v := os.Getenv("CONFIDENCE_FLOOR"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil && f >= 0 && f <= 1 {
			return f
		}
	}
	return 0.30
}

const lowConfidenceMessage = "I don't have enough relevant context to answer this question. Please upload related documents or try a more specific query."

const processingMessage = "Your document is still being processed. Please wait a moment and try again."

// isSummarizeQuery detects general document summarization queries that don't match
// specific chunk content. These need document-level metadata, not RAG search. (STORY-172)
func isSummarizeQuery(query string) bool {
	q := strings.ToLower(query)
	summarizePatterns := []string{
		"summarize my documents",
		"summarize my uploaded",
		"summary of my documents",
		"list my documents",
		"what documents do i have",
		"what have i uploaded",
		"show my documents",
		"what files do i have",
	}
	for _, p := range summarizePatterns {
		if strings.Contains(q, p) {
			return true
		}
	}
	return false
}

// Chat returns an SSE streaming handler for Mercury chat.
// POST /api/chat
func Chat(deps ChatDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.UserIDFromContext(r.Context())
		if userID == "" {
			respondJSON(w, http.StatusUnauthorized, envelope{Success: false, Error: "unauthorized"})
			return
		}

		startTime := time.Now()

		slog.Info("[DEBUG-CHAT] request received",
			"user_id", userID,
			"remote_addr", r.RemoteAddr,
			"x_internal_auth_present", r.Header.Get("X-Internal-Auth") != "",
			"x_user_id_header", r.Header.Get("X-User-ID"),
		)

		var req ChatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "invalid request body"})
			return
		}

		// STORY-S01 Gap 3: IGNORE req.PrivilegeMode from request body.
		// Derive privilege state from server-side authenticated session only.
		privilegeMode := false
		if deps.PrivilegeState != nil {
			privilegeMode = deps.PrivilegeState.IsPrivileged(userID)
		}

		slog.Info("[DEBUG-CHAT] parsed request",
			"user_id", userID,
			"query", req.Query,
			"query_len", len(req.Query),
			"privilege_mode", privilegeMode,
			"mode", req.Mode,
			"persona", req.Persona,
			"llm_provider", req.LLMProvider,
			"llm_model", req.LLMModel,
			"llm_api_key_present", req.LLMApiKey != "",
		)

		if req.Query == "" {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "query is required"})
			return
		}

		// Validate query length
		if len(req.Query) > 10000 {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "query exceeds 10000 character limit"})
			return
		}

		// Validate mode if provided
		if req.Mode != "" {
			switch req.Mode {
			case "concise", "detailed", "risk-analysis":
				// valid
			default:
				respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "mode must be one of: concise, detailed, risk-analysis"})
				return
			}
		}

		// Resolve persona key: "cfo" → "persona_cfo", default → "persona_ceo"
		// DB persona (PersonaFetcher) overrides file-based persona in Generate.
		personaKey := resolvePersonaKey(req.Persona)

		// BYOLLM routing: per-request generator when external LLM fields are present.
		// The API key is NEVER logged — only provider and model are safe to log.
		generator := deps.Generator
		selfRAG := deps.SelfRAG
		var byollmActive bool

		if req.LLMProvider != "" && req.LLMApiKey != "" {
			byollmClient := gcpclient.NewBYOLLMClient(req.LLMApiKey, req.LLMBaseUrl, req.LLMModel)
			byollmGen := service.NewGeneratorService(byollmClient, req.LLMModel)
			if gs, ok := deps.Generator.(*service.GeneratorService); ok {
				byollmGen.SetPromptLoader(gs.PromptLoader())
			}
			generator = byollmGen
			selfRAG = service.NewSelfRAGService(byollmGen, deps.SelfRAG.MaxIterations(), deps.SelfRAG.Threshold())
			byollmActive = true
			slog.Info("[DEBUG-CHAT] BYOLLM active",
				"user_id", userID,
				"provider", req.LLMProvider,
				"model", req.LLMModel,
			)
		}

		// Set SSE headers
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming not supported", http.StatusInternalServerError)
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 120*time.Second)
		defer cancel()

		// Usage metering: check tier limit before processing
		var usageTier string
		if deps.UsageSvc != nil {
			usageTier = "free"
			if deps.UserTierFunc != nil {
				usageTier = deps.UserTierFunc(ctx, userID)
			}

			// Check query count limit
			allowed, currentCount, limit, err := deps.UsageSvc.CheckLimit(ctx, userID, "aegis_queries", usageTier)
			if err != nil {
				slog.Error("usage check failed", "user_id", userID, "error", err)
				// Allow query on metering error — don't block on infra failure
			} else if !allowed {
				slog.Warn("usage limit reached", "user_id", userID, "tier", usageTier, "count", currentCount, "limit", limit)
				limitMsg := fmt.Sprintf(`{"error":"monthly_limit_reached","message":"You've used %d of %d AEGIS queries this month. Upgrade your plan to continue.","used":%d,"limit":%d}`, currentCount, limit, currentCount, limit)
				sendEvent(w, flusher, "error", limitMsg)
				sendEvent(w, flusher, "done", `{}`)
				return
			}

			// STORY-199: Check token budget limit before processing.
			// Current request is allowed to complete — enforcement blocks the NEXT request.
			tokenAllowed, tokensUsed, tokenBudget, tokenErr := deps.UsageSvc.CheckTokenLimit(ctx, userID, usageTier)
			if tokenErr != nil {
				slog.Error("token limit check failed", "user_id", userID, "error", tokenErr)
				// Allow query on metering error — don't block on infra failure
			} else if !tokenAllowed {
				slog.Warn("token budget exhausted",
					"user_id", userID, "tier", usageTier,
					"tokens_used", tokensUsed, "token_budget", tokenBudget)
				limitMsg := fmt.Sprintf(`{"error":"token_budget_exhausted","message":"You've used %d of %d tokens this month. Upgrade your plan to continue.","used":%d,"limit":%d}`,
					tokensUsed, tokenBudget, tokensUsed, tokenBudget)
				sendEvent(w, flusher, "error", limitMsg)
				sendEvent(w, flusher, "done", `{}`)
				return
			}
		}

		// Step 1: Retrieve — parallel cache check + embedding (STORY-150)
		sendEvent(w, flusher, "status", `{"stage":"retrieving"}`)

		var retrieval *service.RetrievalResult
		var cacheHit bool
		var embedCached bool

		tEmbedStart := time.Now()

		// Run cache check and embedding in parallel via errgroup
		var queryVec []float32
		queryHash := cache.EmbeddingQueryHash(req.Query)

		g, gCtx := errgroup.WithContext(ctx)

		// Goroutine 1: check query result cache
		g.Go(func() error {
			if deps.QueryCache != nil {
				if cached, ok := deps.QueryCache.Get(userID, req.Query, privilegeMode); ok {
					retrieval = cached
					cacheHit = true
				}
			}
			return nil // cache miss is not an error
		})

		// Goroutine 2: embed query (check embedding cache first)
		g.Go(func() error {
			if deps.EmbedCache != nil {
				if vec, ok := deps.EmbedCache.Get(queryHash); ok {
					queryVec = vec
					embedCached = true
					return nil
				}
			}
			vecs, err := deps.Retriever.Embedder().Embed(gCtx, []string{req.Query})
			if err != nil {
				return err
			}
			queryVec = vecs[0]
			if deps.EmbedCache != nil {
				deps.EmbedCache.Set(queryHash, queryVec)
			}
			return nil
		})

		if err := g.Wait(); err != nil {
			slog.Error("chat embedding failed", "user_id", userID, "stage", "embedding", "error", err)
			sendEvent(w, flusher, "error", fmt.Sprintf(`{"message":%q}`, rateLimitMessage(err)))
			sendEvent(w, flusher, "done", `{}`)
			return
		}

		tEmbedEnd := time.Now()

		// If result cache hit, skip retrieval entirely
		if retrieval == nil {
			tSearchStart := time.Now()
			var err error
			retrieval, err = deps.Retriever.RetrieveWithVec(ctx, userID, req.Query, queryVec, privilegeMode)
			if err != nil {
				slog.Error("chat retrieval failed", "user_id", userID, "stage", "retrieval", "error", err)
				sendEvent(w, flusher, "error", fmt.Sprintf(`{"message":%q}`, rateLimitMessage(err)))
				sendEvent(w, flusher, "done", `{}`)
				return
			}
			_ = tSearchStart // used in latency log below
			if deps.QueryCache != nil {
				deps.QueryCache.Set(userID, req.Query, privilegeMode, retrieval)
			}
		}

		// Inject web pseudo-chunks when safety mode is off and web content was fetched
		if req.SafetyMode != nil && !*req.SafetyMode && req.WebContext != "" {
			webChunks := buildWebPseudoChunks(req.WebContext)
			if len(webChunks) > 0 {
				retrieval.Chunks = append(retrieval.Chunks, webChunks...)
				retrieval.TotalCandidates += len(webChunks)
				retrieval.TotalDocumentsFound++
				slog.Info("[DEBUG-CHAT] web pseudo-chunks injected",
					"user_id", userID,
					"web_chunks", len(webChunks),
					"total_chunks_now", len(retrieval.Chunks),
				)
			}
		}

		slog.Info("[DEBUG-CHAT] retrieval complete",
			"user_id", userID,
			"chunks_returned", len(retrieval.Chunks),
			"total_candidates", retrieval.TotalCandidates,
			"cache_hit", cacheHit,
		)
		for i, c := range retrieval.Chunks {
			slog.Info("[DEBUG-CHAT] chunk",
				"rank", i,
				"doc_id", c.Document.ID,
				"doc_name", c.Document.OriginalName,
				"similarity", fmt.Sprintf("%.4f", c.Similarity),
				"final_score", fmt.Sprintf("%.4f", c.FinalScore),
				"chunk_index", c.Chunk.ChunkIndex,
				"content_preview", truncate(c.Chunk.Content, 80),
			)
		}

		// STORY-172: Check for processing documents and summarize queries before silence protocol
		if len(retrieval.Chunks) == 0 && deps.DocStatus != nil {
			// Check if user has documents still being processed
			hasProcessing, err := deps.DocStatus.HasProcessingDocuments(ctx, userID)
			if err != nil {
				slog.Error("chat doc status check failed", "user_id", userID, "error", err)
			}
			if hasProcessing {
				slog.Info("[DOC_PROCESSING] user has documents still being processed",
					"user_id", userID, "query", truncate(req.Query, 100))

				tokens := splitIntoTokens(processingMessage)
				for _, token := range tokens {
					tokenJSON, _ := json.Marshal(map[string]string{"text": token})
					sendEvent(w, flusher, "token", string(tokenJSON))
				}
				donePayload := DonePayload{
					Answer:    processingMessage,
					Sources:   []DoneSource{},
					Citations: []DoneCitation{},
					Evidence:  DoneEvidence{LatencyMs: time.Since(startTime).Milliseconds()},
				}
				doneJSON, _ := json.Marshal(donePayload)
				sendEvent(w, flusher, "done", string(doneJSON))
				return
			}
		}

		// STORY-172: Handle "summarize my documents" queries with document metadata
		if isSummarizeQuery(req.Query) && deps.DocStatus != nil {
			summaries, err := deps.DocStatus.ListUserDocumentSummaries(ctx, userID)
			if err != nil {
				slog.Error("chat list documents failed", "user_id", userID, "error", err)
			}
			if len(summaries) > 0 {
				var sb strings.Builder
				sb.WriteString(fmt.Sprintf("You have %d document(s) in your vault:\n\n", len(summaries)))
				for i, doc := range summaries {
					status := "Ready"
					if doc.IndexStatus != "Indexed" {
						status = doc.IndexStatus
					}
					sb.WriteString(fmt.Sprintf("%d. **%s** — %s (uploaded %s)\n", i+1, doc.OriginalName, status, doc.CreatedAt))
				}
				sb.WriteString("\nTo get specific information, try asking a question about a particular document's content.")
				summaryAnswer := sb.String()

				tokens := splitIntoTokens(summaryAnswer)
				for _, token := range tokens {
					if ctx.Err() != nil {
						return
					}
					tokenJSON, _ := json.Marshal(map[string]string{"text": token})
					sendEvent(w, flusher, "token", string(tokenJSON))
				}
				donePayload := DonePayload{
					Answer:    summaryAnswer,
					Sources:   []DoneSource{},
					Citations: []DoneCitation{},
					Evidence:  DoneEvidence{LatencyMs: time.Since(startTime).Milliseconds()},
				}
				doneJSON, _ := json.Marshal(donePayload)
				sendEvent(w, flusher, "done", string(doneJSON))
				return
			}
		}

		if len(retrieval.Chunks) == 0 {
			slog.Warn("[DEBUG-CHAT] SILENCE: zero chunks retrieved — triggering silence protocol",
				"user_id", userID,
				"query", req.Query,
				"privilege_mode", privilegeMode,
			)
			if deps.Metrics != nil {
				deps.Metrics.IncrementSilenceTrigger()
			}
			silence := service.BuildSilenceResponse(0.0, req.Query)
			silenceJSON, _ := json.Marshal(silence)
			sendEvent(w, flusher, "silence", string(silenceJSON))
			if deps.ContentGapSvc != nil {
				go deps.ContentGapSvc.LogGap(context.Background(), userID, req.Query, 0.0)
			}
			donePayload := buildDonePayload(retrieval, nil, nil, startTime, "aegis")
			doneJSON, _ := json.Marshal(donePayload)
			sendEvent(w, flusher, "done", string(doneJSON))
			return
		}

		// Step 2: Load persona (DB persona overrides file-based persona key)
		var dbPersona *model.MercuryPersona
		if deps.PersonaFetcher != nil {
			p, err := deps.PersonaFetcher.GetByTenantID(ctx, userID)
			if err != nil {
				slog.Error("persona lookup failed (falling back to file-based)", "user_id", userID, "error", err)
			} else if p != nil {
				dbPersona = p
				slog.Info("[DEBUG-CHAT] using DB persona", "persona_name", p.FullName(), "tenant_id", p.TenantID)
			}
		}

		// Step 2b: Cortex search (working memory — parallel to vault, non-fatal)
		var cortexContext []string
		var cortexInstructions []string
		if deps.CortexSvc != nil {
			cortexResults, err := deps.CortexSvc.Search(ctx, userID, req.Query, 3)
			if err != nil {
				slog.Error("cortex search failed (non-fatal)", "user_id", userID, "error", err)
			} else {
				for _, entry := range cortexResults {
					cortexContext = append(cortexContext, entry.Content)
				}
			}

			instructions, err := deps.CortexSvc.GetActiveInstructions(ctx, userID)
			if err != nil {
				slog.Error("cortex instructions failed (non-fatal)", "user_id", userID, "error", err)
			} else {
				for _, entry := range instructions {
					cortexInstructions = append(cortexInstructions, entry.Content)
				}
			}

			if len(cortexContext) > 0 || len(cortexInstructions) > 0 {
				slog.Info("[DEBUG-CHAT] cortex enrichment",
					"user_id", userID,
					"context_count", len(cortexContext),
					"instruction_count", len(cortexInstructions),
				)
			}
		}

		// Step 3: Generate (with streaming if supported — STORY-151)
		sendEvent(w, flusher, "status", `{"stage":"generating","iteration":1}`)
		tGenerateStart := time.Now()

		opts := service.GenerateOpts{
			Mode:           req.Mode,
			Persona:        personaKey,
			StrictMode:     req.StrictMode,
			DynamicPersona: dbPersona,
			CortexContext:  cortexContext,
			Instructions:   cortexInstructions,
		}

		var initial *service.GenerationResult
		var streamedTokens bool
		var ttfbMs int64

		// Try streaming generation (real TTFB breakthrough)
		if gs, ok := generator.(*service.GeneratorService); ok {
			streamResult, streamErr := gs.GenerateStream(ctx, req.Query, retrieval.Chunks, opts)
			if streamErr != nil {
				if byollmActive {
					slog.Warn("BYOLLM streaming failed, falling back to AEGIS",
						"user_id", userID, "provider", req.LLMProvider, "error", streamErr)
					generator = deps.Generator
					selfRAG = deps.SelfRAG
					byollmActive = false
					// Fall through to non-streaming path below
				} else {
					slog.Error("chat streaming generation failed", "user_id", userID, "error", streamErr)
					sendEvent(w, flusher, "error", fmt.Sprintf(`{"message":%q}`, rateLimitMessage(streamErr)))
					sendEvent(w, flusher, "done", `{}`)
					return
				}
			} else {
				// Stream tokens to client AS THEY ARRIVE
				first := true
				for token := range streamResult.TokenCh {
					if ctx.Err() != nil {
						return
					}
					if first {
						ttfbMs = time.Since(tGenerateStart).Milliseconds()
						first = false
					}
					tokenJSON, _ := json.Marshal(map[string]string{"text": token})
					sendEvent(w, flusher, "token", string(tokenJSON))
				}
				streamedTokens = true

				// Check for generation errors
				select {
				case genErr := <-streamResult.ErrCh:
					if genErr != nil {
						// BUG-036: BYOLLM error with no tokens sent → fall back to AEGIS
						if byollmActive && first {
							slog.Warn("BYOLLM streaming error, falling back to AEGIS",
								"user_id", userID, "provider", req.LLMProvider, "error", genErr)
							generator = deps.Generator
							selfRAG = deps.SelfRAG
							byollmActive = false
							streamedTokens = false
						} else {
							slog.Error("chat streaming generation error", "user_id", userID, "error", genErr)
							sendEvent(w, flusher, "error", fmt.Sprintf(`{"message":%q}`, rateLimitMessage(genErr)))
							sendEvent(w, flusher, "done", `{}`)
							return
						}
					}
				default:
				}

				// Parse full accumulated response for citations + confidence
				// (skip if BYOLLM error triggered AEGIS fallback — streamedTokens was reset)
				if streamedTokens {
					fullText := streamResult.Full()
					var parseErr error
					initial, parseErr = service.ParseGenerationResponse(fullText, retrieval.Chunks)
					if parseErr != nil {
						slog.Error("chat parse failed", "user_id", userID, "error", parseErr)
					}
					initial.ModelUsed = streamResult.Model
					initial.LatencyMs = time.Since(tGenerateStart).Milliseconds()
				}
			}
		}

		// Non-streaming fallback (BYOLLM fallback or non-streaming client)
		if initial == nil {
			var err error
			initial, err = generator.Generate(ctx, req.Query, retrieval.Chunks, opts)
			if err != nil && byollmActive {
				slog.Warn("BYOLLM generation failed, falling back to AEGIS",
					"user_id", userID, "provider", req.LLMProvider, "error", err)
				generator = deps.Generator
				selfRAG = deps.SelfRAG
				byollmActive = false
				initial, err = generator.Generate(ctx, req.Query, retrieval.Chunks, opts)
			}
			if err != nil {
				slog.Error("chat generation failed", "user_id", userID, "stage", "generation", "error", err)
				sendEvent(w, flusher, "error", fmt.Sprintf(`{"message":%q}`, rateLimitMessage(err)))
				sendEvent(w, flusher, "done", `{}`)
				return
			}
		}

		tGenerateEnd := time.Now()

		// Step 3b: Self-RAG Reflection — conditional skip (STORY-153)
		tSelfRAGStart := time.Now()
		var result *service.ReflectionResult
		selfRAGSkipped := false
		skipThreshold := selfRAGSkipThreshold()

		if initial.Confidence >= skipThreshold {
			selfRAGSkipped = true
			slog.Info("[SelfRAG] skipped — confidence above threshold",
				"user_id", userID,
				"confidence", fmt.Sprintf("%.2f", initial.Confidence),
				"threshold", fmt.Sprintf("%.2f", skipThreshold),
			)
			result = &service.ReflectionResult{
				FinalAnswer:      initial.Answer,
				FinalConfidence:  initial.Confidence,
				Citations:        initial.Citations,
				Iterations:       0,
				SilenceTriggered: false,
			}
		} else {
			var reflErr error
			result, reflErr = selfRAG.Reflect(ctx, req.Query, retrieval.Chunks, initial)
			if reflErr != nil {
				slog.Error("chat self-rag reflection failed", "user_id", userID, "stage", "reflection", "error", reflErr)
				sendEvent(w, flusher, "error", fmt.Sprintf(`{"message":%q}`, rateLimitMessage(reflErr)))
				sendEvent(w, flusher, "done", `{}`)
				return
			}
		}

		tSelfRAGEnd := time.Now()

		// STORY-171: Confidence floor — suppress misleading citations when confidence is too low.
		floor := confidenceFloor()
		if result.FinalConfidence < floor {
			slog.Warn("[LOW_CONFIDENCE]",
				"query", truncate(req.Query, 100),
				"confidence", fmt.Sprintf("%.2f", result.FinalConfidence),
				"floor", fmt.Sprintf("%.2f", floor),
				"user_id", userID,
			)

			// Send clean response with zero citations
			cleanTokens := splitIntoTokens(lowConfidenceMessage)
			for _, token := range cleanTokens {
				if ctx.Err() != nil {
					return
				}
				tokenJSON, _ := json.Marshal(map[string]string{"text": token})
				sendEvent(w, flusher, "token", string(tokenJSON))
			}

			emptyJSON, _ := json.Marshal([]interface{}{})
			sendEvent(w, flusher, "citations", string(emptyJSON))

			confidenceJSON, _ := json.Marshal(map[string]interface{}{
				"score":      result.FinalConfidence,
				"iterations": result.Iterations,
				"modelUsed":  initial.ModelUsed,
				"provider":   "aegis",
				"latencyMs":  initial.LatencyMs,
			})
			sendEvent(w, flusher, "confidence", string(confidenceJSON))

			donePayload := DonePayload{
				Answer:    lowConfidenceMessage,
				Sources:   []DoneSource{},
				Citations: []DoneCitation{},
				Evidence: DoneEvidence{
					ConfidenceScore: result.FinalConfidence,
					Model:           "aegis/" + initial.ModelUsed,
					LatencyMs:       time.Since(startTime).Milliseconds(),
				},
			}
			doneJSON, _ := json.Marshal(donePayload)
			sendEvent(w, flusher, "done", string(doneJSON))

			if deps.ContentGapSvc != nil {
				go deps.ContentGapSvc.LogGap(context.Background(), userID, req.Query, result.FinalConfidence)
			}
			return
		}

		// Step 4: Post-generation events
		providerName := "aegis"
		if byollmActive {
			providerName = req.LLMProvider
		}

		tier := service.ClassifyConfidence(result.FinalConfidence)
		if isWhistleblower(req.Persona) && tier == "low_confidence" {
			tier = "normal"
		}

		if tier == "silence" {
			if deps.Metrics != nil {
				deps.Metrics.IncrementSilenceTrigger()
			}
			silence := service.BuildSilenceResponse(result.FinalConfidence, req.Query)
			silenceJSON, _ := json.Marshal(silence)
			sendEvent(w, flusher, "silence", string(silenceJSON))
			if deps.ContentGapSvc != nil {
				go deps.ContentGapSvc.LogGap(context.Background(), userID, req.Query, result.FinalConfidence)
			}
		} else {
			// Stream tokens only if NOT already streamed (non-streaming path)
			if !streamedTokens {
				tokens := splitIntoTokens(result.FinalAnswer)
				for _, token := range tokens {
					if ctx.Err() != nil {
						return
					}
					tokenJSON, _ := json.Marshal(map[string]string{"text": token})
					sendEvent(w, flusher, "token", string(tokenJSON))
					time.Sleep(5 * time.Millisecond)
				}
			}

			citationsJSON, _ := json.Marshal(result.Citations)
			sendEvent(w, flusher, "citations", string(citationsJSON))

			confidenceJSON, _ := json.Marshal(map[string]interface{}{
				"score":      result.FinalConfidence,
				"iterations": result.Iterations,
				"modelUsed":  initial.ModelUsed,
				"provider":   providerName,
				"latencyMs":  initial.LatencyMs,
			})
			sendEvent(w, flusher, "confidence", string(confidenceJSON))

			if tier == "low_confidence" {
				flag := service.BuildLowConfidenceFlag(result.FinalConfidence)
				flagJSON, _ := json.Marshal(flag)
				sendEvent(w, flusher, "low_confidence", string(flagJSON))
				if deps.ContentGapSvc != nil {
					go deps.ContentGapSvc.LogGap(context.Background(), userID, req.Query, result.FinalConfidence)
				}
			}

			if deps.SessionSvc != nil {
				docIDs := make([]string, 0, len(retrieval.Chunks))
				for _, c := range retrieval.Chunks {
					docIDs = append(docIDs, c.Document.ID)
				}
				go deps.SessionSvc.RecordQuery(context.Background(), userID, req.Query, docIDs, time.Since(startTime).Milliseconds(), providerName, initial.ModelUsed)
			}
		}

		// STORY-026: Emit metadata event for model badge display.
		// Fires on ALL code paths (silence, normal, low_confidence) so the
		// frontend can always render the correct model badge.
		modelUsedForBadge := "aegis"
		if byollmActive {
			modelUsedForBadge = initial.ModelUsed
		}
		metadataJSON, _ := json.Marshal(map[string]interface{}{
			"model_used": modelUsedForBadge,
			"provider":   providerName,
			"latency_ms": time.Since(startTime).Milliseconds(),
		})
		sendEvent(w, flusher, "metadata", string(metadataJSON))

		// Structured latency log (STORY-150 + STORY-151)
		slog.Info("[Chat Latency]",
			"embed_ms", tEmbedEnd.Sub(tEmbedStart).Milliseconds(),
			"search_ms", tGenerateStart.Sub(tEmbedEnd).Milliseconds(),
			"generate_ms", tGenerateEnd.Sub(tGenerateStart).Milliseconds(),
			"selfrag_ms", tSelfRAGEnd.Sub(tSelfRAGStart).Milliseconds(),
			"total_ms", time.Since(startTime).Milliseconds(),
			"ttfb_ms", ttfbMs,
			"embed_cached", embedCached,
			"selfrag_skipped", selfRAGSkipped,
			"cache_hit", cacheHit,
			"streamed", streamedTokens,
			"model", initial.ModelUsed,
			"user_id", userID,
		)

		donePayload := buildDonePayload(retrieval, initial, result, startTime, providerName)
		doneJSON, _ := json.Marshal(donePayload)
		sendEvent(w, flusher, "done", string(doneJSON))

		// Usage metering: increment after successful query
		if deps.UsageSvc != nil {
			// Collect chunk texts for token estimation
			chunkTexts := make([]string, 0, len(retrieval.Chunks))
			for _, c := range retrieval.Chunks {
				chunkTexts = append(chunkTexts, c.Chunk.Content)
			}
			// Estimate total tokens: input (query + context) + output (answer)
			answer := ""
			if result != nil {
				answer = result.FinalAnswer
			} else if initial != nil {
				answer = initial.Answer
			}
			estimatedTokens := service.EstimateRequestTokens(req.Query, chunkTexts, answer)

			go func() {
				bgCtx := context.Background()
				// Increment query count
				if err := deps.UsageSvc.IncrementUsage(bgCtx, userID, "aegis_queries"); err != nil {
					slog.Error("usage increment failed", "user_id", userID, "error", err)
				}
				// STORY-199: Increment token usage
				if err := deps.UsageSvc.IncrementTokenUsage(bgCtx, userID, estimatedTokens); err != nil {
					slog.Error("token usage increment failed", "user_id", userID, "tokens", estimatedTokens, "error", err)
				}
			}()
		}

		// Auto-capture: store query + response in cortex for future context
		if deps.CortexSvc != nil && tier != "silence" {
			go func() {
				bgCtx, bgCancel := context.WithTimeout(context.Background(), 30*time.Second)
				defer bgCancel()

				// Store user query
				if err := deps.CortexSvc.Ingest(bgCtx, userID, req.Query, "dashboard", nil, false); err != nil {
					slog.Error("cortex ingest query failed", "user_id", userID, "error", err)
				}
				// Store assistant response (truncate to 2000 chars to avoid huge embeddings)
				response := result.FinalAnswer
				if len(response) > 2000 {
					response = response[:2000]
				}
				if err := deps.CortexSvc.Ingest(bgCtx, userID, response, "assistant", nil, false); err != nil {
					slog.Error("cortex ingest response failed", "user_id", userID, "error", err)
				}
			}()
		}
	}
}

// sendEvent writes a single SSE event in the standard format.
func sendEvent(w http.ResponseWriter, f http.Flusher, event, data string) {
	fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, data)
	f.Flush()
}

// truncate returns the first n characters of s, appending "…" if truncated.
func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

// rateLimitMessage returns a clean user-facing message for rate-limit errors,
// or the original error message for other errors.
func rateLimitMessage(err error) string {
	if errors.Is(err, gcpclient.ErrRateLimited) {
		return gcpclient.ErrRateLimited.Error()
	}
	return err.Error()
}

// splitIntoTokens splits text into word-level tokens for streaming.
// isWhistleblower returns true if the persona ID refers to the whistleblower persona.
func isWhistleblower(persona string) bool {
	return persona == "whistleblower" || persona == "persona_whistleblower"
}

// resolvePersonaKey maps a request persona ID to the prompt file key.
// Accepts short ("cfo") or prefixed ("persona_cfo") forms.
// Defaults to "persona_ceo" when empty, "default", or unrecognized.
func resolvePersonaKey(persona string) string {
	if persona == "" || persona == "default" {
		return "persona_ceo"
	}
	short := strings.TrimPrefix(persona, "persona_")
	switch short {
	case "ceo", "cfo", "coo", "cpo", "cmo", "cto",
		"legal", "compliance", "auditor", "whistleblower", "analyst":
		return "persona_" + short
	default:
		return "persona_ceo"
	}
}

func splitIntoTokens(text string) []string {
	words := strings.Fields(text)
	if len(words) == 0 {
		return nil
	}
	tokens := make([]string, len(words))
	for i, w := range words {
		if i < len(words)-1 {
			tokens[i] = w + " "
		} else {
			tokens[i] = w
		}
	}
	return tokens
}

// buildWebPseudoChunks creates ephemeral RankedChunk entries from web-fetched content.
// These are NOT persisted — they exist only for the duration of this request.
// Content is split into chunks of ~3000 characters to match typical chunk sizes.
func buildWebPseudoChunks(webContext string) []service.RankedChunk {
	webContext = strings.TrimSpace(webContext)
	if webContext == "" {
		return nil
	}

	// Extract URL from the web context header if present: "[Web content from URL]:\n..."
	sourceURL := "web-content"
	if strings.HasPrefix(webContext, "[Web content from ") {
		end := strings.Index(webContext, "]:")
		if end > 18 {
			sourceURL = webContext[18:end]
			// Strip the header line from the content
			if nl := strings.Index(webContext, "\n"); nl >= 0 {
				webContext = strings.TrimSpace(webContext[nl+1:])
			}
		}
	}

	// Hash the content for a stable pseudo-ID
	hash := sha256.Sum256([]byte(webContext))
	docID := "web-" + hex.EncodeToString(hash[:8])

	doc := model.Document{
		ID:           docID,
		UserID:       "ephemeral",
		Filename:     sourceURL,
		OriginalName: sourceURL,
		MimeType:     "text/html",
		FileType:     "web",
		IndexStatus:  model.IndexIndexed,
	}

	const maxChunkChars = 3000
	var chunks []service.RankedChunk

	for i := 0; i < len(webContext); i += maxChunkChars {
		end := i + maxChunkChars
		if end > len(webContext) {
			end = len(webContext)
		}
		chunkContent := webContext[i:end]

		chunkHash := sha256.Sum256([]byte(chunkContent))
		chunkID := fmt.Sprintf("%s-chunk-%d", docID, len(chunks))

		chunks = append(chunks, service.RankedChunk{
			Chunk: model.DocumentChunk{
				ID:          chunkID,
				DocumentID:  docID,
				ChunkIndex:  len(chunks),
				Content:     chunkContent,
				ContentHash: hex.EncodeToString(chunkHash[:16]),
				TokenCount:  len(strings.Fields(chunkContent)),
				CreatedAt:   time.Now(),
			},
			Similarity: 0.95,
			FinalScore: 0.95,
			Document:   doc,
		})
	}

	return chunks
}
