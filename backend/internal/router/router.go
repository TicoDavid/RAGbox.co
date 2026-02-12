package router

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/connexus-ai/ragbox-backend/internal/handler"
	"github.com/connexus-ai/ragbox-backend/internal/middleware"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// Dependencies holds all injected services needed by the router.
type Dependencies struct {
	DB                 handler.DBPinger
	AuthService        *service.AuthService
	FrontendURL        string
	Metrics            *middleware.Metrics
	MetricsReg         *prometheus.Registry
	InternalAuthSecret string

	// Document services
	DocService *service.DocumentService
	DocRepo    service.DocumentRepository

	// Folder
	FolderRepo service.FolderRepository

	// Privilege
	PrivilegeState *handler.PrivilegeState

	// Chat
	ChatDeps handler.ChatDeps

	// Audit
	AuditDeps handler.AuditDeps

	// Export
	ExportDeps handler.ExportDeps

	// Forge
	ForgeSvc *service.ForgeService

	// Pipeline (document processing)
	PipelineSvc *service.PipelineService

	// Ingest trigger
	IngestDeps handler.IngestDeps

	// User auto-provisioning
	UserEnsurer middleware.UserEnsurer

	// Rate limiters (nil = no rate limiting)
	GeneralRateLimiter *middleware.RateLimiter
	ChatRateLimiter    *middleware.RateLimiter
	ForgeRateLimiter   *middleware.RateLimiter
}

// New creates and configures the Chi router with all routes.
func New(deps *Dependencies) *chi.Mux {
	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.SecurityHeaders)
	r.Use(middleware.Logging)
	r.Use(middleware.CORS(deps.FrontendURL))
	if deps.Metrics != nil {
		r.Use(middleware.Monitoring(deps.Metrics))
	}

	// Public routes (no auth)
	r.Get("/api/health", handler.Health(deps.DB))
	if deps.MetricsReg != nil {
		r.Handle("/metrics", middleware.MetricsHandler(deps.MetricsReg))
	}

	// Build shared dependency structs
	docCRUD := handler.DocCRUDDeps{DocRepo: deps.DocRepo}
	folderDeps := handler.FolderDeps{FolderRepo: deps.FolderRepo}

	// Protected routes (require internal service auth or Firebase auth)
	r.Group(func(r chi.Router) {
		r.Use(middleware.InternalOrFirebaseAuth(deps.AuthService, deps.InternalAuthSecret, deps.UserEnsurer))

		// General rate limit for all authenticated endpoints
		if deps.GeneralRateLimiter != nil {
			r.Use(middleware.RateLimit(deps.GeneralRateLimiter))
		}

		// Documents
		r.Get("/api/documents", handler.ListDocuments(docCRUD))
		r.Post("/api/documents/extract", handler.UploadDocument(deps.DocService))
		r.Get("/api/documents/{id}", handler.GetDocument(docCRUD))
		r.Delete("/api/documents/{id}", handler.DeleteDocument(docCRUD))
		r.Post("/api/documents/{id}/recover", handler.RecoverDocument(docCRUD))
		r.Patch("/api/documents/{id}/tier", handler.UpdateDocumentTier(docCRUD))
		r.Patch("/api/documents/{id}/privilege", handler.ToggleDocPrivilege(docCRUD))
		r.Post("/api/documents/{id}/ingest", handler.IngestDocument(deps.IngestDeps))

		// Folders
		r.Get("/api/documents/folders", handler.ListFolders(folderDeps))
		r.Post("/api/documents/folders", handler.CreateFolder(folderDeps))
		r.Delete("/api/documents/folders/{id}", handler.DeleteFolder(folderDeps))

		// Privilege
		r.Get("/api/privilege", handler.GetPrivilege(deps.PrivilegeState))
		r.Post("/api/privilege", handler.TogglePrivilege(deps.PrivilegeState))

		// Chat — stricter rate limit (10/min)
		if deps.ChatRateLimiter != nil {
			r.With(middleware.RateLimit(deps.ChatRateLimiter)).Post("/api/chat", handler.Chat(deps.ChatDeps))
		} else {
			r.Post("/api/chat", handler.Chat(deps.ChatDeps))
		}

		// Audit
		r.Get("/api/audit", handler.ListAudit(deps.AuditDeps))
		r.Get("/api/audit/export", handler.ExportAudit(deps.AuditDeps))

		// Export
		r.Get("/api/export", handler.ExportData(deps.ExportDeps))

		// Forge — strictest rate limit (5/min)
		if deps.ForgeRateLimiter != nil {
			r.With(middleware.RateLimit(deps.ForgeRateLimiter)).Post("/api/forge", handler.ForgeHandler(deps.ForgeSvc))
		} else {
			r.Post("/api/forge", handler.ForgeHandler(deps.ForgeSvc))
		}
	})

	// 404 fallback
	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "route not found",
		})
	})

	return r
}
