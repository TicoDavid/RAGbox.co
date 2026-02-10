package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/connexus-ai/ragbox-backend/internal/middleware"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// ChatRequest is the request body for the chat endpoint.
type ChatRequest struct {
	Query         string `json:"query"`
	PrivilegeMode bool   `json:"privilegeMode"`
	Mode          string `json:"mode"` // "concise", "detailed", "risk-analysis"
	Persona       string `json:"persona"`
	StrictMode    bool   `json:"strictMode"`
}

// ChatDeps bundles the services needed by the chat handler.
type ChatDeps struct {
	Retriever *service.RetrieverService
	Generator service.Generator
	SelfRAG   *service.SelfRAGService
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

		var req ChatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "invalid request body"})
			return
		}

		if req.Query == "" {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "query is required"})
			return
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

		ctx := r.Context()

		// Step 1: Retrieve
		sendEvent(w, flusher, "status", `{"stage":"retrieving"}`)

		retrieval, err := deps.Retriever.Retrieve(ctx, req.Query, req.PrivilegeMode)
		if err != nil {
			sendEvent(w, flusher, "error", fmt.Sprintf(`{"message":%q}`, err.Error()))
			sendEvent(w, flusher, "done", `{}`)
			return
		}

		if len(retrieval.Chunks) == 0 {
			silence := service.BuildSilenceResponse(0.0, req.Query)
			silenceJSON, _ := json.Marshal(silence)
			sendEvent(w, flusher, "silence", string(silenceJSON))
			sendEvent(w, flusher, "done", `{}`)
			return
		}

		// Step 2: Generate
		sendEvent(w, flusher, "status", `{"stage":"generating","iteration":1}`)

		opts := service.GenerateOpts{
			Mode:       req.Mode,
			Persona:    req.Persona,
			StrictMode: req.StrictMode,
		}

		initial, err := deps.Generator.Generate(ctx, req.Query, retrieval.Chunks, opts)
		if err != nil {
			sendEvent(w, flusher, "error", fmt.Sprintf(`{"message":%q}`, err.Error()))
			sendEvent(w, flusher, "done", `{}`)
			return
		}

		// Step 3: Self-RAG Reflection
		result, err := deps.SelfRAG.Reflect(ctx, req.Query, retrieval.Chunks, initial)
		if err != nil {
			sendEvent(w, flusher, "error", fmt.Sprintf(`{"message":%q}`, err.Error()))
			sendEvent(w, flusher, "done", `{}`)
			return
		}

		// Step 4: Stream result
		if result.SilenceTriggered {
			silence := service.BuildSilenceResponse(result.FinalConfidence, req.Query)
			silenceJSON, _ := json.Marshal(silence)
			sendEvent(w, flusher, "silence", string(silenceJSON))
		} else {
			// Stream answer token by token
			tokens := splitIntoTokens(result.FinalAnswer)
			for _, token := range tokens {
				if ctx.Err() != nil {
					return // client disconnected
				}
				tokenJSON, _ := json.Marshal(map[string]string{"text": token})
				sendEvent(w, flusher, "token", string(tokenJSON))
				time.Sleep(15 * time.Millisecond)
			}

			citationsJSON, _ := json.Marshal(result.Citations)
			sendEvent(w, flusher, "citations", string(citationsJSON))

			confidenceJSON, _ := json.Marshal(map[string]interface{}{
				"score":      result.FinalConfidence,
				"iterations": result.Iterations,
			})
			sendEvent(w, flusher, "confidence", string(confidenceJSON))
		}

		sendEvent(w, flusher, "done", `{}`)
	}
}

// sendEvent writes a single SSE event in the standard format.
func sendEvent(w http.ResponseWriter, f http.Flusher, event, data string) {
	fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, data)
	f.Flush()
}

// splitIntoTokens splits text into word-level tokens for streaming.
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
