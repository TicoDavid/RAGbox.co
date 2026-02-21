package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestVonageInbound_ValidMessage(t *testing.T) {
	deps := VonageDeps{
		APIKey:             "test-key",
		APISecret:          "test-secret",
		SMSFromNumber:      "+15551234567",
		WhatsAppFromNumber: "+15559876543",
		// Retriever/Generator/SelfRAG nil — processRAGQuery will fail gracefully in goroutine
	}

	body := vonageInbound{
		MessageUUID: "msg-123",
		From:        "+17282206780",
		To:          "+15551234567",
		Text:        "What is our refund policy?",
		Channel:     "sms",
		MessageType: "text",
	}
	payload, _ := json.Marshal(body)

	req := httptest.NewRequest("POST", "/api/webhooks/vonage/inbound", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler := VonageInbound(deps)
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestVonageInbound_EmptyText(t *testing.T) {
	deps := VonageDeps{
		APIKey:    "test-key",
		APISecret: "test-secret",
	}

	body := vonageInbound{
		MessageUUID: "msg-456",
		From:        "+17282206780",
		To:          "+15551234567",
		Text:        "",
		Channel:     "whatsapp",
		MessageType: "image",
	}
	payload, _ := json.Marshal(body)

	req := httptest.NewRequest("POST", "/api/webhooks/vonage/inbound", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler := VonageInbound(deps)
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for non-text message, got %d", w.Code)
	}
}

func TestVonageInbound_InvalidJSON(t *testing.T) {
	deps := VonageDeps{
		APIKey:    "test-key",
		APISecret: "test-secret",
	}

	req := httptest.NewRequest("POST", "/api/webhooks/vonage/inbound", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler := VonageInbound(deps)
	handler.ServeHTTP(w, req)

	// Vonage expects 200 even on parse errors
	if w.Code != http.StatusOK {
		t.Errorf("expected 200 on invalid JSON (prevent retries), got %d", w.Code)
	}
}

func TestVonageStatus_Valid(t *testing.T) {
	body := vonageStatus{
		MessageUUID: "msg-789",
		To:          "+17282206780",
		From:        "+15551234567",
		Status:      "delivered",
		Channel:     "sms",
	}
	payload, _ := json.Marshal(body)

	req := httptest.NewRequest("POST", "/api/webhooks/vonage/status", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler := VonageStatus()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestVonageStatus_InvalidJSON(t *testing.T) {
	req := httptest.NewRequest("POST", "/api/webhooks/vonage/status", bytes.NewReader([]byte("{bad")))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler := VonageStatus()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 on invalid JSON, got %d", w.Code)
	}
}

func TestVonageInbound_WhatsAppChannel(t *testing.T) {
	deps := VonageDeps{
		APIKey:             "test-key",
		APISecret:          "test-secret",
		SMSFromNumber:      "+15551234567",
		WhatsAppFromNumber: "+15559876543",
	}

	body := vonageInbound{
		MessageUUID: "msg-wa-001",
		From:        "+17282206780",
		To:          "+15559876543",
		Text:        "Hello from WhatsApp",
		Channel:     "whatsapp",
		MessageType: "text",
	}
	payload, _ := json.Marshal(body)

	req := httptest.NewRequest("POST", "/api/webhooks/vonage/inbound", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler := VonageInbound(deps)
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for WhatsApp message, got %d", w.Code)
	}
}
