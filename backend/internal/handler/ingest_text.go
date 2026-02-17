package handler

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/connexus-ai/ragbox-backend/internal/middleware"
	"github.com/connexus-ai/ragbox-backend/internal/model"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// TextIngester abstracts text-only document processing for testability.
type TextIngester interface {
	ProcessText(ctx context.Context, docID string) error
}

// IngestTextDeps bundles dependencies for the ingest-text handler.
type IngestTextDeps struct {
	DocRepo  service.DocumentRepository
	Pipeline TextIngester
}

// IngestText handles POST /api/documents/{id}/ingest-text.
// Used for webhook knowledge ingestion where text is already extracted.
// Validates ownership, checks that extractedText exists, then fires pipeline.
// Returns 202 Accepted immediately.
func IngestText(deps IngestTextDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.UserIDFromContext(r.Context())
		if userID == "" {
			respondJSON(w, http.StatusUnauthorized, envelope{Success: false, Error: "unauthorized"})
			return
		}

		docID := chi.URLParam(r, "id")
		if docID == "" {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "document id required"})
			return
		}
		if !validateUUID(docID) {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "invalid document ID format"})
			return
		}

		doc, err := deps.DocRepo.GetByID(r.Context(), docID)
		if err != nil {
			respondJSON(w, http.StatusNotFound, envelope{Success: false, Error: "document not found"})
			return
		}

		if doc.UserID != userID {
			respondJSON(w, http.StatusForbidden, envelope{Success: false, Error: "access denied"})
			return
		}

		if doc.IndexStatus != model.IndexPending {
			respondJSON(w, http.StatusConflict, envelope{
				Success: false,
				Error:   "document is not in Pending status",
			})
			return
		}

		if doc.ExtractedText == nil || *doc.ExtractedText == "" {
			respondJSON(w, http.StatusBadRequest, envelope{
				Success: false,
				Error:   "document has no extracted text to process",
			})
			return
		}

		go func(id string) {
			ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
			defer cancel()
			slog.Info("ingest-text starting pipeline", "document_id", id)
			if err := deps.Pipeline.ProcessText(ctx, id); err != nil {
				slog.Error("ingest-text pipeline failed", "document_id", id, "error", err)
			} else {
				slog.Info("ingest-text pipeline completed", "document_id", id)
			}
		}(docID)

		respondJSON(w, http.StatusAccepted, envelope{
			Success: true,
			Data: map[string]string{
				"documentId": docID,
				"status":     "processing",
			},
		})
	}
}
