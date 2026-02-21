package handler

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/connexus-ai/ragbox-backend/internal/middleware"
	"github.com/connexus-ai/ragbox-backend/internal/model"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// ChunkWithNeighborsReader fetches a chunk and its immediate neighbors.
type ChunkWithNeighborsReader interface {
	GetChunkWithNeighbors(ctx context.Context, documentID, chunkID string) ([]model.DocumentChunk, error)
}

// ChunkPreviewDeps bundles dependencies for the chunk preview handler.
type ChunkPreviewDeps struct {
	DocRepo     service.DocumentRepository
	ChunkReader ChunkWithNeighborsReader
}

// chunkPreviewItem is a single chunk in the preview response.
type chunkPreviewItem struct {
	ID         string `json:"id"`
	ChunkIndex int    `json:"chunkIndex"`
	Content    string `json:"content"`
	TokenCount int    `json:"tokenCount"`
}

// chunkPreviewData is the response payload for the chunk preview endpoint.
type chunkPreviewData struct {
	Chunk  chunkPreviewItem  `json:"chunk"`
	Before *chunkPreviewItem `json:"before"`
	After  *chunkPreviewItem `json:"after"`
}

// ChunkPreview handles GET /api/documents/{id}/chunks/{chunkId}/preview.
// Returns the target chunk with its immediate before/after neighbors for citation context.
func ChunkPreview(deps ChunkPreviewDeps) http.HandlerFunc {
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

		chunkID := chi.URLParam(r, "chunkId")
		if !validateUUID(chunkID) {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "invalid chunk ID format"})
			return
		}

		// Verify document exists and belongs to the user
		doc, err := deps.DocRepo.GetByID(r.Context(), docID)
		if err != nil || doc == nil || doc.UserID != userID {
			respondJSON(w, http.StatusNotFound, envelope{Success: false, Error: "document not found"})
			return
		}

		// Fetch chunk + neighbors
		chunks, err := deps.ChunkReader.GetChunkWithNeighbors(r.Context(), docID, chunkID)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to fetch chunk preview"})
			return
		}

		if len(chunks) == 0 {
			respondJSON(w, http.StatusNotFound, envelope{Success: false, Error: "chunk not found"})
			return
		}

		// Find the target chunk in the result set
		targetIdx := -1
		for i, c := range chunks {
			if c.ID == chunkID {
				targetIdx = i
				break
			}
		}

		if targetIdx == -1 {
			respondJSON(w, http.StatusNotFound, envelope{Success: false, Error: "chunk not found"})
			return
		}

		target := chunks[targetIdx]
		data := chunkPreviewData{
			Chunk: chunkPreviewItem{
				ID:         target.ID,
				ChunkIndex: target.ChunkIndex,
				Content:    target.Content,
				TokenCount: target.TokenCount,
			},
		}

		// Before neighbor
		if targetIdx > 0 {
			before := chunks[targetIdx-1]
			data.Before = &chunkPreviewItem{
				ID:         before.ID,
				ChunkIndex: before.ChunkIndex,
				Content:    before.Content,
				TokenCount: before.TokenCount,
			}
		}

		// After neighbor
		if targetIdx < len(chunks)-1 {
			after := chunks[targetIdx+1]
			data.After = &chunkPreviewItem{
				ID:         after.ID,
				ChunkIndex: after.ChunkIndex,
				Content:    after.Content,
				TokenCount: after.TokenCount,
			}
		}

		respondJSON(w, http.StatusOK, envelope{Success: true, Data: data})
	}
}
