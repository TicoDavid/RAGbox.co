package handler

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/connexus-ai/ragbox-backend/internal/middleware"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// UploadRequest is the request body for document upload URL generation.
type UploadRequest struct {
	Filename    string `json:"filename"`
	ContentType string `json:"contentType"`
	SizeBytes   int    `json:"sizeBytes"`
	FolderID    string `json:"folderId,omitempty"`
}

// UploadDocument returns a handler that generates a signed upload URL.
// If a PipelineService is provided, it triggers async document processing after creation.
// POST /api/documents/extract
func UploadDocument(docService *service.DocumentService, pipeline *service.PipelineService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.UserIDFromContext(r.Context())
		if userID == "" {
			respondJSON(w, http.StatusUnauthorized, envelope{Success: false, Error: "unauthorized"})
			return
		}

		var req UploadRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "invalid request body"})
			return
		}

		if req.Filename == "" || req.ContentType == "" || req.SizeBytes == 0 {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "filename, contentType, and sizeBytes are required"})
			return
		}

		resp, err := docService.GenerateUploadURL(r.Context(), userID, req.Filename, req.ContentType, req.SizeBytes, req.FolderID)
		if err != nil {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: err.Error()})
			return
		}

		// Trigger pipeline processing asynchronously
		if pipeline != nil {
			go func(docID string) {
				ctx := context.Background()
				log.Printf("[PIPELINE] Starting async processing for document %s", docID)
				if err := pipeline.ProcessDocument(ctx, docID); err != nil {
					log.Printf("[PIPELINE ERROR] Failed to process document %s: %v", docID, err)
				} else {
					log.Printf("[PIPELINE] Completed processing for document %s", docID)
				}
			}(resp.DocumentID)
		}

		respondJSON(w, http.StatusOK, envelope{Success: true, Data: resp})
	}
}

type envelope struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

func respondJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// DocCRUDDeps bundles dependencies for document CRUD handlers.
type DocCRUDDeps struct {
	DocRepo service.DocumentRepository
}

// ListDocuments handles GET /api/documents.
func ListDocuments(deps DocCRUDDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.UserIDFromContext(r.Context())
		if userID == "" {
			respondJSON(w, http.StatusUnauthorized, envelope{Success: false, Error: "unauthorized"})
			return
		}

		q := r.URL.Query()
		limit, _ := strconv.Atoi(q.Get("limit"))
		offset, _ := strconv.Atoi(q.Get("offset"))
		privilegeMode := q.Get("privilegeMode") == "true"

		docs, total, err := deps.DocRepo.ListByUser(r.Context(), userID, service.ListOpts{
			Limit:         limit,
			Offset:        offset,
			PrivilegeMode: privilegeMode,
		})
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to list documents"})
			return
		}

		respondJSON(w, http.StatusOK, envelope{Success: true, Data: map[string]interface{}{
			"documents": docs,
			"total":     total,
		}})
	}
}

// GetDocument handles GET /api/documents/{id}.
func GetDocument(deps DocCRUDDeps) http.HandlerFunc {
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

		doc, err := deps.DocRepo.GetByID(r.Context(), docID)
		if err != nil {
			respondJSON(w, http.StatusNotFound, envelope{Success: false, Error: "document not found"})
			return
		}

		if doc.UserID != userID {
			respondJSON(w, http.StatusForbidden, envelope{Success: false, Error: "access denied"})
			return
		}

		respondJSON(w, http.StatusOK, envelope{Success: true, Data: doc})
	}
}

// DeleteDocument handles DELETE /api/documents/{id} (soft delete).
func DeleteDocument(deps DocCRUDDeps) http.HandlerFunc {
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

		doc, err := deps.DocRepo.GetByID(r.Context(), docID)
		if err != nil || doc.UserID != userID {
			respondJSON(w, http.StatusNotFound, envelope{Success: false, Error: "document not found"})
			return
		}

		if err := deps.DocRepo.SoftDelete(r.Context(), docID); err != nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to delete document"})
			return
		}

		respondJSON(w, http.StatusOK, envelope{Success: true})
	}
}

// RecoverDocument handles POST /api/documents/{id}/recover.
func RecoverDocument(deps DocCRUDDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.UserIDFromContext(r.Context())
		if userID == "" {
			respondJSON(w, http.StatusUnauthorized, envelope{Success: false, Error: "unauthorized"})
			return
		}

		docID := chi.URLParam(r, "id")
		doc, err := deps.DocRepo.GetByID(r.Context(), docID)
		if err != nil || doc.UserID != userID {
			respondJSON(w, http.StatusNotFound, envelope{Success: false, Error: "document not found"})
			return
		}

		if err := deps.DocRepo.Recover(r.Context(), docID); err != nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to recover document"})
			return
		}

		respondJSON(w, http.StatusOK, envelope{Success: true})
	}
}

// UpdateTierRequest is the request body for tier updates.
type UpdateTierRequest struct {
	Tier int `json:"tier"`
}

// UpdateDocumentTier handles PATCH /api/documents/{id}/tier.
func UpdateDocumentTier(deps DocCRUDDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.UserIDFromContext(r.Context())
		if userID == "" {
			respondJSON(w, http.StatusUnauthorized, envelope{Success: false, Error: "unauthorized"})
			return
		}

		docID := chi.URLParam(r, "id")
		doc, err := deps.DocRepo.GetByID(r.Context(), docID)
		if err != nil || doc.UserID != userID {
			respondJSON(w, http.StatusNotFound, envelope{Success: false, Error: "document not found"})
			return
		}

		var req UpdateTierRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "invalid request body"})
			return
		}

		if err := deps.DocRepo.UpdateTier(r.Context(), docID, req.Tier); err != nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to update tier"})
			return
		}

		respondJSON(w, http.StatusOK, envelope{Success: true})
	}
}

// ToggleDocPrivilegeRequest is the request body for document privilege toggle.
type ToggleDocPrivilegeRequest struct {
	Privileged bool `json:"privileged"`
}

// ToggleDocPrivilege handles PATCH /api/documents/{id}/privilege.
func ToggleDocPrivilege(deps DocCRUDDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.UserIDFromContext(r.Context())
		if userID == "" {
			respondJSON(w, http.StatusUnauthorized, envelope{Success: false, Error: "unauthorized"})
			return
		}

		docID := chi.URLParam(r, "id")
		doc, err := deps.DocRepo.GetByID(r.Context(), docID)
		if err != nil || doc.UserID != userID {
			respondJSON(w, http.StatusNotFound, envelope{Success: false, Error: "document not found"})
			return
		}

		var req ToggleDocPrivilegeRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "invalid request body"})
			return
		}

		if err := deps.DocRepo.TogglePrivilege(r.Context(), docID, req.Privileged); err != nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to toggle privilege"})
			return
		}

		respondJSON(w, http.StatusOK, envelope{Success: true})
	}
}
