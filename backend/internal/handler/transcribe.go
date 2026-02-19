package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
)

// TranscribeDeps holds dependencies for the transcribe handler.
type TranscribeDeps struct {
	DeepgramAPIKey string
}

// transcribeResponse is what Deepgram Nova returns (simplified).
type deepgramResponse struct {
	Results struct {
		Channels []struct {
			Alternatives []struct {
				Transcript string  `json:"transcript"`
				Confidence float64 `json:"confidence"`
			} `json:"alternatives"`
		} `json:"channels"`
	} `json:"results"`
}

// Transcribe handles POST /api/voice/transcribe.
// Accepts an audio blob (webm/opus from browser MediaRecorder),
// sends it to Deepgram Nova STT, and returns the transcript.
func Transcribe(deps TranscribeDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if deps.DeepgramAPIKey == "" {
			respondJSON(w, http.StatusNotImplemented, envelope{
				Success: false,
				Error:   "STT not configured — use browser speech recognition",
			})
			return
		}

		// Read the audio body (limit to 25 MB)
		const maxBody = 25 << 20
		r.Body = http.MaxBytesReader(w, r.Body, maxBody)
		audio, err := io.ReadAll(r.Body)
		if err != nil {
			respondJSON(w, http.StatusBadRequest, envelope{
				Success: false,
				Error:   "failed to read audio body",
			})
			return
		}
		if len(audio) == 0 {
			respondJSON(w, http.StatusBadRequest, envelope{
				Success: false,
				Error:   "empty audio body",
			})
			return
		}

		// Detect content type from request header, default to webm
		contentType := r.Header.Get("Content-Type")
		if contentType == "" {
			contentType = "audio/webm"
		}

		// Call Deepgram Nova REST API
		dgReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost,
			"https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=en",
			bytes.NewReader(audio))
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, envelope{
				Success: false,
				Error:   "failed to create Deepgram request",
			})
			return
		}
		dgReq.Header.Set("Authorization", "Token "+deps.DeepgramAPIKey)
		dgReq.Header.Set("Content-Type", contentType)

		resp, err := http.DefaultClient.Do(dgReq)
		if err != nil {
			slog.Error("deepgram request failed", "error", err)
			respondJSON(w, http.StatusBadGateway, envelope{
				Success: false,
				Error:   "Deepgram STT request failed",
			})
			return
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)

		if resp.StatusCode != http.StatusOK {
			slog.Error("deepgram error", "status", resp.StatusCode, "body", string(body))
			respondJSON(w, http.StatusBadGateway, envelope{
				Success: false,
				Error:   fmt.Sprintf("Deepgram returned %d", resp.StatusCode),
			})
			return
		}

		var dgResp deepgramResponse
		if err := json.Unmarshal(body, &dgResp); err != nil {
			slog.Error("deepgram response parse failed", "error", err)
			respondJSON(w, http.StatusInternalServerError, envelope{
				Success: false,
				Error:   "failed to parse Deepgram response",
			})
			return
		}

		// Extract best transcript
		transcript := ""
		confidence := 0.0
		if len(dgResp.Results.Channels) > 0 && len(dgResp.Results.Channels[0].Alternatives) > 0 {
			best := dgResp.Results.Channels[0].Alternatives[0]
			transcript = best.Transcript
			confidence = best.Confidence
		}

		respondJSON(w, http.StatusOK, envelope{
			Success: true,
			Data: map[string]interface{}{
				"transcript": transcript,
				"confidence": confidence,
			},
		})
	}
}
