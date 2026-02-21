package handler

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// VonageDeps bundles dependencies for Vonage webhook handlers.
type VonageDeps struct {
	APIKey             string
	APISecret          string
	SMSFromNumber      string
	WhatsAppFromNumber string
	DefaultTenant      string // fallback tenant ID when no phone→user mapping exists
	Retriever          *service.RetrieverService
	Generator          service.Generator
	SelfRAG            *service.SelfRAGService
}

// vonageInbound is the Vonage Messages API inbound webhook payload.
type vonageInbound struct {
	MessageUUID string `json:"message_uuid"`
	From        string `json:"from"`
	To          string `json:"to"`
	Text        string `json:"text"`
	Channel     string `json:"channel"`   // "sms" | "whatsapp"
	MessageType string `json:"message_type"` // "text", "image", etc.
	Timestamp   string `json:"timestamp"`
}

// vonageStatus is the Vonage Messages API status webhook payload.
type vonageStatus struct {
	MessageUUID string `json:"message_uuid"`
	To          string `json:"to"`
	From        string `json:"from"`
	Status      string `json:"status"` // "submitted" | "delivered" | "read" | "rejected"
	Timestamp   string `json:"timestamp"`
	Channel     string `json:"channel"`
}

// vonageSendRequest is the body for Vonage Messages API POST.
type vonageSendRequest struct {
	MessageType string `json:"message_type"`
	Text        string `json:"text"`
	To          string `json:"to"`
	From        string `json:"from"`
	Channel     string `json:"channel"`
}

// VonageInbound handles POST /api/webhooks/vonage/inbound.
// Vonage sends inbound SMS/WhatsApp messages here.
// Flow: parse → RAG pipeline → reply via Vonage Messages API.
func VonageInbound(deps VonageDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var msg vonageInbound
		if err := json.NewDecoder(r.Body).Decode(&msg); err != nil {
			slog.Error("[Vonage] failed to parse inbound webhook", "error", err)
			// Vonage expects 200 even on parse errors (to prevent retries)
			w.WriteHeader(http.StatusOK)
			return
		}

		slog.Info("[Vonage] inbound message",
			"message_uuid", msg.MessageUUID,
			"from", msg.From,
			"to", msg.To,
			"channel", msg.Channel,
			"text_len", len(msg.Text),
		)

		// Ignore non-text messages (images, stickers, etc.)
		if msg.Text == "" {
			slog.Warn("[Vonage] ignoring non-text message", "message_type", msg.MessageType, "from", msg.From)
			w.WriteHeader(http.StatusOK)
			return
		}

		// Acknowledge immediately — Vonage expects 200 within seconds
		w.WriteHeader(http.StatusOK)

		// Process async: RAG query → reply
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
			defer cancel()

			answer := processRAGQuery(ctx, deps, msg.From, msg.Text)
			if answer == "" {
				answer = "I couldn't find a relevant answer in the vault. Please try rephrasing your question."
			}

			// Determine reply sender number based on channel
			fromNumber := deps.SMSFromNumber
			channel := "sms"
			if msg.Channel == "whatsapp" {
				fromNumber = deps.WhatsAppFromNumber
				channel = "whatsapp"
			}

			if err := sendVonageReply(deps.APIKey, deps.APISecret, channel, fromNumber, msg.From, answer); err != nil {
				slog.Error("[Vonage] failed to send reply",
					"error", err,
					"to", msg.From,
					"channel", channel,
				)
			} else {
				slog.Info("[Vonage] reply sent",
					"to", msg.From,
					"channel", channel,
					"answer_len", len(answer),
				)
			}
		}()
	}
}

// VonageStatus handles POST /api/webhooks/vonage/status.
// Vonage sends delivery receipts here.
func VonageStatus() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var status vonageStatus
		if err := json.NewDecoder(r.Body).Decode(&status); err != nil {
			slog.Error("[Vonage] failed to parse status webhook", "error", err)
			w.WriteHeader(http.StatusOK)
			return
		}

		slog.Info("[Vonage] delivery status",
			"message_uuid", status.MessageUUID,
			"to", status.To,
			"status", status.Status,
			"channel", status.Channel,
		)

		// Acknowledge — no DB persistence yet (TODO: store delivery receipts)
		w.WriteHeader(http.StatusOK)
	}
}

// processRAGQuery runs the retrieval + generation pipeline for a Vonage message.
// Uses a synthetic user ID based on phone number (no Firebase auth for webhooks).
func processRAGQuery(ctx context.Context, deps VonageDeps, phoneFrom, query string) string {
	// Guard: RAG pipeline must be configured
	if deps.Retriever == nil || deps.Generator == nil || deps.SelfRAG == nil {
		slog.Error("[Vonage] RAG pipeline not configured — cannot process message")
		return ""
	}

	// Map phone number to tenant ID for retrieval scoping.
	// Use default tenant if configured (allows vault queries before phone→user mapping exists).
	// In production this should be a DB lookup: phone_number → user_id.
	userID := deps.DefaultTenant
	if userID == "" {
		userID = "vonage:" + phoneFrom
	}

	// Step 1: Retrieve relevant chunks
	retrieval, err := deps.Retriever.Retrieve(ctx, userID, query, false)
	if err != nil {
		slog.Error("[Vonage] RAG retrieval failed", "user_id", userID, "error", err)
		return ""
	}

	if len(retrieval.Chunks) == 0 {
		slog.Warn("[Vonage] zero chunks retrieved", "user_id", userID, "query", query)
		return ""
	}

	// Step 2: Generate answer
	opts := service.GenerateOpts{
		Mode:    "concise",
		Persona: "default",
	}
	initial, err := deps.Generator.Generate(ctx, query, retrieval.Chunks, opts)
	if err != nil {
		slog.Error("[Vonage] RAG generation failed", "user_id", userID, "error", err)
		return ""
	}

	// Step 3: Self-RAG reflection
	result, err := deps.SelfRAG.Reflect(ctx, query, retrieval.Chunks, initial)
	if err != nil {
		slog.Error("[Vonage] RAG reflection failed", "user_id", userID, "error", err)
		return initial.Answer
	}

	// Truncate for SMS (160 char limit) or WhatsApp (4096 char limit)
	answer := result.FinalAnswer
	if len(answer) > 4000 {
		answer = answer[:3997] + "..."
	}

	return answer
}

// sendVonageReply sends a message via the Vonage Messages API.
// POST https://api.nexmo.com/v1/messages
// Auth: Basic base64(apiKey:apiSecret)
func sendVonageReply(apiKey, apiSecret, channel, from, to, text string) error {
	payload := vonageSendRequest{
		MessageType: "text",
		Text:        text,
		To:          to,
		From:        from,
		Channel:     channel,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.nexmo.com/v1/messages", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	// Basic auth: base64(apiKey:apiSecret)
	credentials := base64.StdEncoding.EncodeToString([]byte(apiKey + ":" + apiSecret))
	req.Header.Set("Authorization", "Basic "+credentials)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("vonage API call: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		var errBody bytes.Buffer
		errBody.ReadFrom(resp.Body)
		return fmt.Errorf("vonage API %d: %s", resp.StatusCode, errBody.String())
	}

	return nil
}
