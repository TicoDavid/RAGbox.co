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
	DB          handler.DBPinger
	AuthService *service.AuthService
	FrontendURL string
	Metrics     *middleware.Metrics
	MetricsReg  *prometheus.Registry
}

// New creates and configures the Chi router with all routes.
func New(deps *Dependencies) *chi.Mux {
	r := chi.NewRouter()

	// Global middleware
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

	// Protected routes (require Firebase auth)
	r.Group(func(r chi.Router) {
		r.Use(middleware.FirebaseAuth(deps.AuthService))

		// Documents
		r.Get("/api/documents", placeholder("list_documents"))
		r.Post("/api/documents/extract", placeholder("upload_document"))
		r.Get("/api/documents/{id}", placeholder("get_document"))
		r.Delete("/api/documents/{id}", placeholder("delete_document"))
		r.Post("/api/documents/{id}/recover", placeholder("recover_document"))
		r.Patch("/api/documents/{id}/tier", placeholder("update_tier"))
		r.Post("/api/documents/promote", placeholder("promote_tier"))
		r.Patch("/api/documents/{id}/privilege", placeholder("toggle_doc_privilege"))

		// Folders
		r.Get("/api/documents/folders", placeholder("list_folders"))
		r.Post("/api/documents/folders", placeholder("create_folder"))
		r.Delete("/api/documents/folders/{id}", placeholder("delete_folder"))

		// Privilege
		r.Get("/api/privilege", placeholder("get_privilege"))
		r.Post("/api/privilege", placeholder("toggle_privilege"))

		// Chat
		r.Post("/api/chat", placeholder("chat"))

		// Audit
		r.Get("/api/audit", placeholder("list_audit"))
		r.Get("/api/audit/export", placeholder("export_audit"))

		// Export
		r.Get("/api/export", placeholder("export_data"))

		// Forge
		r.Post("/api/forge", placeholder("forge_generate"))
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

// placeholder returns a handler that responds with a "not implemented" message.
// These will be replaced with real handlers as epics are built.
func placeholder(name string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotImplemented)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   name + " not yet implemented",
		})
	}
}
