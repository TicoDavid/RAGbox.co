package handler

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/connexus-ai/ragbox-backend/internal/cache"
	"github.com/connexus-ai/ragbox-backend/internal/middleware"
	"github.com/connexus-ai/ragbox-backend/internal/model"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// Ingester abstracts document processing for testability.
type Ingester interface {
	ProcessDocument(ctx context.Context, docID string) error
}

// IngestDeps bundles dependencies for the ingest handler.
type IngestDeps struct {
	DocRepo    service.DocumentRepository
	Pipeline   Ingester
	QueryCache *cache.QueryCache // optional — invalidated after pipeline completes
}

// IngestDocument handles POST /api/documents/{id}/ingest.
// It validates ownership and status, then fires the pipeline in a background goroutine.
// Returns 202 Accepted immediately.
func IngestDocument(deps IngestDeps) http.HandlerFunc {
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

		go func(id, uid string) {
			ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
			defer cancel()
			slog.Info("ingest starting pipeline", "document_id", id)
			if err := deps.Pipeline.ProcessDocument(ctx, id); err != nil {
				slog.Error("ingest pipeline failed", "document_id", id, "error", err)
			} else {
				slog.Info("ingest pipeline completed", "document_id", id)
				if deps.QueryCache != nil {
					deps.QueryCache.InvalidateUser(uid)
				}
			}
		}(docID, userID)

		respondJSON(w, http.StatusAccepted, envelope{
			Success: true,
			Data: map[string]string{
				"documentId": docID,
				"status":     "processing",
			},
		})
	}
}
