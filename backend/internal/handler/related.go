package handler

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/connexus-ai/ragbox-backend/internal/middleware"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// RelatedDocsDeps bundles dependencies for the related documents handler.
type RelatedDocsDeps struct {
	DocRepo  service.DocumentRepository
	Searcher service.RelatedDocSearcher
}

// RelatedDocuments handles GET /api/documents/{id}/related.
// Returns the top N documents most similar to the given document,
// based on cosine similarity of document embedding centroids.
func RelatedDocuments(deps RelatedDocsDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.UserIDFromContext(r.Context())
		if userID == "" {
			respondJSON(w, http.StatusUnauthorized, envelope{Success: false, Error: "unauthorized"})
			return
		}

		docID := chi.URLParam(r, "id")
		if !validateUUID(docID) {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "invalid document ID format"})
			return
		}

		doc, err := deps.DocRepo.GetByID(r.Context(), docID)
		if err != nil || doc.UserID != userID {
			respondJSON(w, http.StatusNotFound, envelope{Success: false, Error: "document not found"})
			return
		}

		limit := 5
		if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && l >= 1 && l <= 10 {
			limit = l
		}

		related, err := deps.Searcher.FindRelatedDocuments(r.Context(), docID, userID, limit)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to find related documents"})
			return
		}

		if related == nil {
			related = []service.RelatedDocument{}
		}

		respondJSON(w, http.StatusOK, envelope{Success: true, Data: map[string]interface{}{
			"related": related,
		}})
	}
}
