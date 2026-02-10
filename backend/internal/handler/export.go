package handler

import (
	"archive/zip"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/connexus-ai/ragbox-backend/internal/middleware"
	"github.com/connexus-ai/ragbox-backend/internal/model"
	"github.com/connexus-ai/ragbox-backend/internal/repository"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// ExportDocLister fetches documents for export.
type ExportDocLister interface {
	ListByUser(ctx context.Context, userID string, opts service.ListOpts) ([]model.Document, int, error)
}

// ExportDeps bundles dependencies for the export handler.
type ExportDeps struct {
	DocRepo     ExportDocLister
	AuditLister AuditLister
}

// ExportData returns a handler for GET /api/export.
// Generates a ZIP file with all user data (GDPR data portability).
func ExportData(deps ExportDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.UserIDFromContext(r.Context())
		if userID == "" {
			respondJSON(w, http.StatusUnauthorized, envelope{Success: false, Error: "unauthorized"})
			return
		}

		ctx := r.Context()

		// Fetch documents (all, including privileged)
		docs, _, err := deps.DocRepo.ListByUser(ctx, userID, service.ListOpts{
			Limit:         10000,
			PrivilegeMode: true, // Include privileged for full export
		})
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to fetch documents"})
			return
		}

		// Fetch audit logs
		auditEntries, _, err := deps.AuditLister.List(ctx, repository.ListFilter{
			UserID: userID,
			Limit:  10000,
		})
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to fetch audit logs"})
			return
		}

		// Build export payload
		exportData := map[string]interface{}{
			"user": map[string]string{
				"id": userID,
			},
			"documents":  docs,
			"auditLogs":  auditEntries,
			"exportedAt": "generated at request time",
		}

		// Write ZIP response
		w.Header().Set("Content-Type", "application/zip")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=ragbox-export-%s.zip", userID))

		zw := zip.NewWriter(w)
		defer zw.Close()

		// Write documents.json
		if err := writeJSONToZip(zw, "documents.json", docs); err != nil {
			return
		}

		// Write audit_logs.json
		if err := writeJSONToZip(zw, "audit_logs.json", auditEntries); err != nil {
			return
		}

		// Write manifest.json
		if err := writeJSONToZip(zw, "manifest.json", exportData); err != nil {
			return
		}
	}
}

// writeJSONToZip adds a JSON file to the ZIP archive.
func writeJSONToZip(zw *zip.Writer, filename string, data interface{}) error {
	f, err := zw.Create(filename)
	if err != nil {
		return err
	}
	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	return enc.Encode(data)
}
