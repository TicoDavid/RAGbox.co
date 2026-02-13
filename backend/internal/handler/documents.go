package handler

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/connexus-ai/ragbox-backend/internal/middleware"
	"github.com/connexus-ai/ragbox-backend/internal/model"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

const maxFilenameLength = 255

// UploadRequest is the request body for document upload URL generation.
type UploadRequest struct {
	Filename    string `json:"filename"`
	ContentType string `json:"contentType"`
	SizeBytes   int    `json:"sizeBytes"`
	FolderID    string `json:"folderId,omitempty"`
}

// UploadDocument returns a handler that generates a signed upload URL.
// POST /api/documents/extract
func UploadDocument(docService *service.DocumentService) http.HandlerFunc {
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

		// Validate filename length
		if len(req.Filename) > maxFilenameLength {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "filename exceeds 255 character limit"})
			return
		}

		// Validate filename has no path traversal characters
		if strings.Contains(req.Filename, "..") || strings.Contains(req.Filename, "/") || strings.Contains(req.Filename, "\\") {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "filename contains invalid path characters"})
			return
		}

		// Validate content type
		if !model.AllowedMimeTypes[req.ContentType] {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "unsupported content type"})
			return
		}

		// Validate file size (max 50MB)
		if req.SizeBytes > model.MaxFileSizeBytes {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "file size exceeds 50MB limit"})
			return
		}

		resp, err := docService.GenerateUploadURL(r.Context(), userID, req.Filename, req.ContentType, req.SizeBytes, req.FolderID)
		if err != nil {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: err.Error()})
			return
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

// ChunkDeleter abstracts chunk deletion for testability.
type ChunkDeleter interface {
	DeleteByDocumentID(ctx context.Context, documentID string) error
}

// StorageSigner generates signed URLs for document download.
type StorageSigner interface {
	SignedURL(bucket, object string, opts *service.SignedURLOptions) (string, error)
}

// ObjectDownloader reads objects from cloud storage for integrity verification.
type ObjectDownloader interface {
	Download(ctx context.Context, bucket, object string) ([]byte, error)
}

// DocCRUDDeps bundles dependencies for document CRUD handlers.
type DocCRUDDeps struct {
	DocRepo          service.DocumentRepository
	ChunkDeleter     ChunkDeleter
	Storage          StorageSigner
	ObjectDownloader ObjectDownloader
	BucketName       string
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
		search := strings.TrimSpace(q.Get("search"))

		docs, total, err := deps.DocRepo.ListByUser(r.Context(), userID, service.ListOpts{
			Limit:         limit,
			Offset:        offset,
			PrivilegeMode: privilegeMode,
			Search:        search,
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
		if !validateUUID(docID) {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "invalid document ID format"})
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
		if !validateUUID(docID) {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "invalid document ID format"})
			return
		}

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
		if !validateUUID(docID) {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "invalid document ID format"})
			return
		}

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

		// Validate tier range
		if req.Tier < 1 || req.Tier > 5 {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "tier must be between 1 and 5"})
			return
		}

		if err := deps.DocRepo.UpdateTier(r.Context(), docID, req.Tier); err != nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to update tier"})
			return
		}

		respondJSON(w, http.StatusOK, envelope{Success: true})
	}
}

// UpdateDocumentRequest is the request body for document updates (rename and/or move).
type UpdateDocumentRequest struct {
	Name     *string `json:"name,omitempty"`
	FolderID *string `json:"folderId"`
}

// UpdateDocument handles PATCH /api/documents/{id}.
func UpdateDocument(deps DocCRUDDeps) http.HandlerFunc {
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
		if err != nil || doc.UserID != userID {
			respondJSON(w, http.StatusNotFound, envelope{Success: false, Error: "document not found"})
			return
		}

		var req UpdateDocumentRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "invalid request body"})
			return
		}

		if req.Name == nil && req.FolderID == nil {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "name or folderId is required"})
			return
		}

		// Rename
		if req.Name != nil {
			if *req.Name == "" {
				respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "name cannot be empty"})
				return
			}
			if len(*req.Name) > maxFilenameLength {
				respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "name exceeds 255 character limit"})
				return
			}
			if err := deps.DocRepo.Update(r.Context(), docID, *req.Name); err != nil {
				respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to rename document"})
				return
			}
		}

		// Move to folder (null = root)
		if req.FolderID != nil {
			folderID := *req.FolderID
			if folderID != "" && !validateUUID(folderID) {
				respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "invalid folder ID format"})
				return
			}
			var folderPtr *string
			if folderID != "" {
				folderPtr = &folderID
			}
			if err := deps.DocRepo.UpdateFolder(r.Context(), docID, folderPtr); err != nil {
				respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to move document"})
				return
			}
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
		if !validateUUID(docID) {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "invalid document ID format"})
			return
		}

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

// DeleteChunks handles DELETE /api/documents/{id}/chunks.
// Removes all embeddings for a document and resets index status to Pending.
func DeleteChunks(deps DocCRUDDeps) http.HandlerFunc {
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
		if err != nil || doc.UserID != userID {
			respondJSON(w, http.StatusNotFound, envelope{Success: false, Error: "document not found"})
			return
		}

		if deps.ChunkDeleter == nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "chunk deletion not configured"})
			return
		}

		if err := deps.ChunkDeleter.DeleteByDocumentID(r.Context(), docID); err != nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to delete chunks"})
			return
		}

		if err := deps.DocRepo.UpdateStatus(r.Context(), docID, model.IndexPending); err != nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to update document status"})
			return
		}

		if err := deps.DocRepo.UpdateChunkCount(r.Context(), docID, 0); err != nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to update chunk count"})
			return
		}

		respondJSON(w, http.StatusOK, envelope{Success: true})
	}
}

// DownloadDocument handles GET /api/documents/{id}/download.
// Returns a signed GET URL for the original file in Cloud Storage.
func DownloadDocument(deps DocCRUDDeps) http.HandlerFunc {
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

		if doc.StoragePath == nil || *doc.StoragePath == "" {
			respondJSON(w, http.StatusNotFound, envelope{Success: false, Error: "file not available for download"})
			return
		}

		if deps.Storage == nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "storage not configured"})
			return
		}

		url, err := deps.Storage.SignedURL(deps.BucketName, *doc.StoragePath, &service.SignedURLOptions{
			Method:  "GET",
			Expires: time.Now().Add(15 * time.Minute),
		})
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to generate download URL"})
			return
		}

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"url":     url,
		})
	}
}

// VerifyIntegrity handles POST /api/documents/{id}/verify.
// Downloads the file from GCS, computes SHA-256, and compares against stored checksum.
func VerifyIntegrity(deps DocCRUDDeps) http.HandlerFunc {
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

		if doc.Checksum == nil || *doc.Checksum == "" {
			respondJSON(w, http.StatusOK, map[string]interface{}{
				"valid":  false,
				"reason": "no stored checksum",
			})
			return
		}

		if doc.StoragePath == nil || *doc.StoragePath == "" {
			respondJSON(w, http.StatusOK, map[string]interface{}{
				"valid":  false,
				"reason": "file not available",
			})
			return
		}

		if deps.ObjectDownloader == nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "storage reader not configured"})
			return
		}

		data, err := deps.ObjectDownloader.Download(r.Context(), deps.BucketName, *doc.StoragePath)
		if err != nil {
			respondJSON(w, http.StatusOK, map[string]interface{}{
				"valid":  false,
				"reason": "could not read file from storage",
			})
			return
		}

		hash := sha256.Sum256(data)
		computedHash := hex.EncodeToString(hash[:])

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"valid":        computedHash == *doc.Checksum,
			"storedHash":   *doc.Checksum,
			"computedHash": computedHash,
		})
	}
}

// ToggleStarRequest is the request body for star toggle.
type ToggleStarRequest struct {
	Starred bool `json:"starred"`
}

// ToggleStar handles POST /api/documents/{id}/star.
func ToggleStar(deps DocCRUDDeps) http.HandlerFunc {
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

		var req ToggleStarRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondJSON(w, http.StatusBadRequest, envelope{Success: false, Error: "invalid request body"})
			return
		}

		if err := deps.DocRepo.ToggleStar(r.Context(), docID, req.Starred); err != nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to update star"})
			return
		}

		respondJSON(w, http.StatusOK, envelope{Success: true})
	}
}
