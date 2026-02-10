package handler

import (
	"context"
	"fmt"
	"net/http"
	"strconv"

	"github.com/connexus-ai/ragbox-backend/internal/middleware"
	"github.com/connexus-ai/ragbox-backend/internal/model"
	"github.com/connexus-ai/ragbox-backend/internal/repository"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// AuditLister abstracts paginated audit log queries.
type AuditLister interface {
	List(ctx context.Context, f repository.ListFilter) ([]model.AuditLog, int, error)
}

// AuditDeps bundles dependencies for audit handlers.
type AuditDeps struct {
	Lister   AuditLister
	Verifier *service.AuditService
}

// ListAudit returns a handler for GET /api/audit.
// Supports query params: action, severity, startDate, endDate, limit, offset.
func ListAudit(deps AuditDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.UserIDFromContext(r.Context())
		if userID == "" {
			respondJSON(w, http.StatusUnauthorized, envelope{Success: false, Error: "unauthorized"})
			return
		}

		q := r.URL.Query()

		limit, _ := strconv.Atoi(q.Get("limit"))
		offset, _ := strconv.Atoi(q.Get("offset"))

		filter := repository.ListFilter{
			UserID:    userID, // Always scoped to the authenticated user
			Action:    q.Get("action"),
			Severity:  q.Get("severity"),
			StartDate: q.Get("startDate"),
			EndDate:   q.Get("endDate"),
			Limit:     limit,
			Offset:    offset,
		}

		entries, total, err := deps.Lister.List(r.Context(), filter)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to list audit logs"})
			return
		}

		respondJSON(w, http.StatusOK, envelope{
			Success: true,
			Data: map[string]interface{}{
				"entries": entries,
				"total":   total,
				"limit":   filter.Limit,
				"offset":  filter.Offset,
			},
		})
	}
}

// ExportAudit returns a handler for GET /api/audit/export.
// Generates a plain-text report with hash verification summary.
func ExportAudit(deps AuditDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.UserIDFromContext(r.Context())
		if userID == "" {
			respondJSON(w, http.StatusUnauthorized, envelope{Success: false, Error: "unauthorized"})
			return
		}

		q := r.URL.Query()

		filter := repository.ListFilter{
			UserID:    userID,
			Action:    q.Get("action"),
			Severity:  q.Get("severity"),
			StartDate: q.Get("startDate"),
			EndDate:   q.Get("endDate"),
			Limit:     10000, // Export all matching entries (capped)
		}

		entries, _, err := deps.Lister.List(r.Context(), filter)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, envelope{Success: false, Error: "failed to fetch audit logs"})
			return
		}

		// Verify chain integrity if we have entries
		var chainStatus string
		if len(entries) >= 2 {
			result, verifyErr := deps.Verifier.VerifyChain(r.Context(), entries[0].ID, entries[len(entries)-1].ID)
			if verifyErr != nil {
				chainStatus = "VERIFICATION_ERROR"
			} else if result.Valid {
				chainStatus = fmt.Sprintf("INTACT (%d entries verified)", result.EntriesChecked)
			} else {
				chainStatus = fmt.Sprintf("BROKEN at entry %s (index %d)", result.BrokenAt, result.BrokenIndex)
			}
		} else if len(entries) == 1 {
			chainStatus = "INTACT (1 entry)"
		} else {
			chainStatus = "NO ENTRIES"
		}

		// Generate plain-text report
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Header().Set("Content-Disposition", "attachment; filename=audit-report.txt")

		fmt.Fprintf(w, "RAGbox.co Audit Report\n")
		fmt.Fprintf(w, "======================\n\n")
		fmt.Fprintf(w, "User: %s\n", userID)
		fmt.Fprintf(w, "Filters: action=%s severity=%s start=%s end=%s\n",
			filter.Action, filter.Severity, filter.StartDate, filter.EndDate)
		fmt.Fprintf(w, "Chain Integrity: %s\n", chainStatus)
		fmt.Fprintf(w, "Total Entries: %d\n\n", len(entries))
		fmt.Fprintf(w, "%-36s  %-24s  %-8s  %-20s  %s\n",
			"ID", "Action", "Severity", "Timestamp", "Resource")
		fmt.Fprintf(w, "%s\n", "---")

		for _, e := range entries {
			resourceID := ""
			if e.ResourceID != nil {
				resourceID = *e.ResourceID
			}
			fmt.Fprintf(w, "%-36s  %-24s  %-8s  %-20s  %s\n",
				e.ID, e.Action, e.Severity,
				e.CreatedAt.Format("2006-01-02 15:04:05"),
				resourceID,
			)
		}
	}
}
