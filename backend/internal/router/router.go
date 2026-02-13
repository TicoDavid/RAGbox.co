package router

import (
	"encoding/json"
	"net/http"
	"time"

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
	Version            string
	Metrics            *middleware.Metrics
	MetricsReg         *prometheus.Registry
	InternalAuthSecret string

	// Document services
	DocService *service.DocumentService
	DocRepo    service.DocumentRepository

	// Chunk
	ChunkDeleter handler.ChunkDeleter

	// Storage (download, verify)
	Storage          handler.StorageSigner
	ObjectDownloader handler.ObjectDownloader
	BucketName       string

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
	r.Get("/api/health", handler.Health(deps.DB, deps.Version))
	if deps.MetricsReg != nil {
		r.Handle("/metrics", middleware.MetricsHandler(deps.MetricsReg))
	}

	// Build shared dependency structs
	docCRUD := handler.DocCRUDDeps{
		DocRepo:          deps.DocRepo,
		ChunkDeleter:     deps.ChunkDeleter,
		Storage:          deps.Storage,
		ObjectDownloader: deps.ObjectDownloader,
		BucketName:       deps.BucketName,
	}
	folderDeps := handler.FolderDeps{FolderRepo: deps.FolderRepo}

	// Protected routes (require internal service auth or Firebase auth)
	r.Group(func(r chi.Router) {
		r.Use(middleware.InternalOrFirebaseAuth(deps.AuthService, deps.InternalAuthSecret, deps.UserEnsurer))

		// General rate limit for all authenticated endpoints
		if deps.GeneralRateLimiter != nil {
			r.Use(middleware.RateLimit(deps.GeneralRateLimiter))
		}

		// Non-SSE routes get a 30s write timeout to prevent slow-read attacks.
		// Chat (SSE) is registered separately below without the timeout.
		timeout30s := middleware.Timeout(30 * time.Second)

		// Documents
		r.With(timeout30s).Get("/api/documents", handler.ListDocuments(docCRUD))
		r.With(timeout30s).Post("/api/documents/extract", handler.UploadDocument(deps.DocService))
		r.With(timeout30s).Get("/api/documents/{id}", handler.GetDocument(docCRUD))
		r.With(timeout30s).Patch("/api/documents/{id}", handler.UpdateDocument(docCRUD))
		r.With(timeout30s).Delete("/api/documents/{id}", handler.DeleteDocument(docCRUD))
		r.With(timeout30s).Post("/api/documents/{id}/recover", handler.RecoverDocument(docCRUD))
		r.With(timeout30s).Patch("/api/documents/{id}/tier", handler.UpdateDocumentTier(docCRUD))
		// Note: GET /documents/{id}/privilege is not needed — privilege status is included in GET /documents/{id}
		r.With(timeout30s).Patch("/api/documents/{id}/privilege", handler.ToggleDocPrivilege(docCRUD))
		r.With(timeout30s).Delete("/api/documents/{id}/chunks", handler.DeleteChunks(docCRUD))
		r.With(timeout30s).Get("/api/documents/{id}/download", handler.DownloadDocument(docCRUD))
		r.With(timeout30s).Post("/api/documents/{id}/verify", handler.VerifyIntegrity(docCRUD))
		r.With(timeout30s).Post("/api/documents/{id}/star", handler.ToggleStar(docCRUD))
		// Ingest may take longer (pipeline processing)
		r.With(middleware.Timeout(120 * time.Second)).Post("/api/documents/{id}/ingest", handler.IngestDocument(deps.IngestDeps))

		// Folders
		r.With(timeout30s).Get("/api/documents/folders", handler.ListFolders(folderDeps))
		r.With(timeout30s).Post("/api/documents/folders", handler.CreateFolder(folderDeps))
		r.With(timeout30s).Delete("/api/documents/folders/{id}", handler.DeleteFolder(folderDeps))

		// Privilege
		r.With(timeout30s).Get("/api/privilege", handler.GetPrivilege(deps.PrivilegeState))
		r.With(timeout30s).Post("/api/privilege", handler.TogglePrivilege(deps.PrivilegeState))

		// Chat — SSE streaming, NO write timeout. Stricter rate limit (10/min).
		if deps.ChatRateLimiter != nil {
			r.With(middleware.RateLimit(deps.ChatRateLimiter)).Post("/api/chat", handler.Chat(deps.ChatDeps))
		} else {
			r.Post("/api/chat", handler.Chat(deps.ChatDeps))
		}

		// Audit
		r.With(timeout30s).Get("/api/audit", handler.ListAudit(deps.AuditDeps))
		r.With(timeout30s).Get("/api/audit/export", handler.ExportAudit(deps.AuditDeps))

		// Export (ZIP generation can take a while)
		r.With(middleware.Timeout(60 * time.Second)).Get("/api/export", handler.ExportData(deps.ExportDeps))

		// Forge — AI generation, 60s timeout. Strictest rate limit (5/min).
		forgeMiddleware := []func(http.Handler) http.Handler{middleware.Timeout(60 * time.Second)}
		if deps.ForgeRateLimiter != nil {
			forgeMiddleware = append(forgeMiddleware, middleware.RateLimit(deps.ForgeRateLimiter))
		}
		r.With(forgeMiddleware...).Post("/api/forge", handler.ForgeHandler(deps.ForgeSvc))
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
