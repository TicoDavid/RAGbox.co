package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	firebase "firebase.google.com/go/v4"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/connexus-ai/ragbox-backend/internal/config"
	"github.com/connexus-ai/ragbox-backend/internal/gcpclient"
	"github.com/connexus-ai/ragbox-backend/internal/handler"
	"github.com/connexus-ai/ragbox-backend/internal/middleware"
	"github.com/connexus-ai/ragbox-backend/internal/repository"
	internalrouter "github.com/connexus-ai/ragbox-backend/internal/router"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

const Version = "0.2.0"

func run() error {
	ctx := context.Background()

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	// Initialize database pool
	pool, err := repository.NewPool(ctx, cfg.DatabaseURL, cfg.DatabaseMaxConns)
	if err != nil {
		return fmt.Errorf("database pool: %w", err)
	}
	defer pool.Close()
	log.Println("database pool connected")

	// Initialize Firebase auth
	app, err := firebase.NewApp(ctx, &firebase.Config{
		ProjectID: cfg.FirebaseProjectID,
	})
	if err != nil {
		return fmt.Errorf("firebase app: %w", err)
	}

	authClient, err := app.Auth(ctx)
	if err != nil {
		return fmt.Errorf("firebase auth client: %w", err)
	}

	authService := service.NewAuthService(authClient)

	// ─── GCP clients ───────────────────────────────────────────────────

	// Vertex AI generative model (Gemini)
	genAI, err := gcpclient.NewGenAIAdapter(ctx, cfg.GCPProject, cfg.VertexAILocation, cfg.VertexAIModel)
	if err != nil {
		return fmt.Errorf("vertex ai genai: %w", err)
	}
	defer genAI.Close()
	log.Println("vertex ai genai client initialized")

	// Validate Vertex AI connection at startup
	log.Println("Validating Vertex AI connection...")
	if err := genAI.HealthCheck(ctx); err != nil {
		return fmt.Errorf("vertex AI health check failed: %w", err)
	}
	log.Println("Vertex AI connection validated successfully")

	// Vertex AI embedding model (REST API with default credentials)
	// Embeddings use a regional endpoint (text-embedding-004 is not on global)
	embeddingAdapter, err := gcpclient.NewEmbeddingAdapter(ctx, cfg.GCPProject, cfg.EmbeddingLocation, cfg.EmbeddingModel)
	if err != nil {
		return fmt.Errorf("vertex ai embedding: %w", err)
	}
	log.Println("vertex ai embedding client initialized")

	// Validate embedding connection at startup
	log.Println("Validating Vertex AI Embeddings connection...")
	if err := embeddingAdapter.HealthCheck(ctx); err != nil {
		return fmt.Errorf("embedding health check failed: %w", err)
	}
	log.Println("Vertex AI Embeddings connection validated successfully")

	// Document AI for text extraction
	var docAIAdapter *gcpclient.DocumentAIAdapter
	if cfg.DocAIProcessorID != "" {
		docAIAdapter, err = gcpclient.NewDocumentAIAdapter(ctx, cfg.GCPProject, cfg.DocAILocation)
		if err != nil {
			return fmt.Errorf("document ai: %w", err)
		}
		defer docAIAdapter.Close()
		log.Println("document ai client initialized")

		log.Println("Validating Document AI connection...")
		if err := docAIAdapter.HealthCheck(ctx); err != nil {
			log.Printf("WARNING: Document AI health check failed: %v (processing will fail)", err)
		} else {
			log.Println("Document AI connection validated successfully")
		}
	} else {
		log.Println("WARNING: DOCUMENT_AI_PROCESSOR_ID not set - document processing disabled")
	}

	// Cloud Storage
	storageAdapter, err := gcpclient.NewStorageAdapter(ctx)
	if err != nil {
		return fmt.Errorf("cloud storage: %w", err)
	}
	defer storageAdapter.Close()
	log.Println("cloud storage client initialized")

	// ─── Repositories ──────────────────────────────────────────────────

	docRepo := repository.NewDocumentRepo(pool)
	folderRepo := repository.NewFolderRepo(pool)
	chunkRepo := repository.NewChunkRepo(pool)
	auditRepo := repository.NewAuditRepo(pool)
	userRepo := repository.NewUserRepo(pool)

	// ─── Services ──────────────────────────────────────────────────────

	// Prompt loader (must come early — fatal if missing required files)
	promptLoader, err := service.NewPromptLoader(cfg.PromptsDir)
	if err != nil {
		return fmt.Errorf("prompt loader: %w", err)
	}
	log.Println("prompt loader initialized")

	// URL expiry
	urlExpiry, err := time.ParseDuration(cfg.GCSSignedURLExpiry)
	if err != nil {
		urlExpiry = 15 * time.Minute
	}

	// Document service (signed URL generation + DB record creation)
	docService := service.NewDocumentService(storageAdapter, docRepo, cfg.GCSBucketName, urlExpiry)

	// Audit service (hash-chain + optional BigQuery)
	auditService, err := service.NewAuditService(auditRepo, nil) // BQ disabled for now
	if err != nil {
		return fmt.Errorf("audit service: %w", err)
	}
	log.Println("audit service initialized")

	// Generator service (Gemini answer generation)
	generatorService := service.NewGeneratorService(genAI, cfg.VertexAIModel)
	generatorService.SetPromptLoader(promptLoader)

	// Self-RAG service (reflection loop)
	selfRAGService := service.NewSelfRAGService(generatorService, cfg.SelfRAGMaxIter, cfg.ConfidenceThreshold)

	// Retriever service (embedding + vector search + re-ranking)
	retrieverService := service.NewRetrieverService(embeddingAdapter, chunkRepo)

	// Forge service (template report generation)
	forgeService := service.NewForgeService(genAI, storageAdapter, cfg.GCSBucketName)

	// Pipeline service (document processing: parse → PII scan → chunk → embed)
	chunkerSvc := service.NewChunkerService(cfg.ChunkSizeTokens, float64(cfg.ChunkOverlapPercent)/100.0)
	embedderSvc := service.NewEmbedderService(embeddingAdapter, chunkRepo)

	var pipelineSvc *service.PipelineService
	if docAIAdapter != nil {
		processorName := fmt.Sprintf("projects/%s/locations/%s/processors/%s",
			cfg.GCPProject, cfg.DocAILocation, cfg.DocAIProcessorID)
		parserSvc := service.NewParserService(docAIAdapter, processorName)
		dlpAdapter := gcpclient.NewStubDLPAdapter()
		redactorSvc := service.NewRedactorService(dlpAdapter, cfg.GCPProject)

		pipelineSvc = service.NewPipelineService(
			docRepo, parserSvc, redactorSvc, chunkerSvc, embedderSvc, auditService, cfg.GCSBucketName,
		)
		log.Println("pipeline service initialized (Document AI parser)")
	} else {
		textParser := gcpclient.NewTextParser(storageAdapter)
		noopRedactor := gcpclient.NewNoopRedactor()

		pipelineSvc = service.NewPipelineService(
			docRepo, textParser, noopRedactor, chunkerSvc, embedderSvc, auditService, cfg.GCSBucketName,
		)
		log.Println("pipeline service initialized (text parser fallback — no Document AI)")
	}

	// Privilege state (in-memory per-user toggle)
	privilegeState := handler.NewPrivilegeState()

	// ─── Prometheus metrics ────────────────────────────────────────────

	reg := prometheus.NewRegistry()
	metrics := middleware.NewMetrics(reg)

	// ─── Rate limiters ────────────────────────────────────────────────

	generalRL := middleware.NewRateLimiter(middleware.RateLimiterConfig{
		MaxRequests: 60,
		Window:      1 * time.Minute,
	})
	defer generalRL.Stop()

	chatRL := middleware.NewRateLimiter(middleware.RateLimiterConfig{
		MaxRequests: 10,
		Window:      1 * time.Minute,
	})
	defer chatRL.Stop()

	forgeRL := middleware.NewRateLimiter(middleware.RateLimiterConfig{
		MaxRequests: 5,
		Window:      1 * time.Minute,
	})
	defer forgeRL.Stop()

	log.Println("rate limiters initialized (general: 60/min, chat: 10/min, forge: 5/min)")

	// ─── Router ────────────────────────────────────────────────────────

	router := internalrouter.New(&internalrouter.Dependencies{
		DB:                 pool,
		AuthService:        authService,
		FrontendURL:        cfg.FrontendURL,
		Version:            Version,
		Metrics:            metrics,
		MetricsReg:         reg,
		InternalAuthSecret: cfg.InternalAuthSecret,

		DocService: docService,
		DocRepo:    docRepo,
		FolderRepo: folderRepo,

		PrivilegeState: privilegeState,

		ChatDeps: handler.ChatDeps{
			Retriever: retrieverService,
			Generator: generatorService,
			SelfRAG:   selfRAGService,
			Metrics:   metrics,
		},

		AuditDeps: handler.AuditDeps{
			Lister:   auditRepo,
			Verifier: auditService,
		},

		ExportDeps: handler.ExportDeps{
			DocRepo:     docRepo,
			AuditLister: auditRepo,
		},

		ForgeSvc:    forgeService,
		PipelineSvc: pipelineSvc,

		IngestDeps: handler.IngestDeps{
			DocRepo:  docRepo,
			Pipeline: pipelineSvc,
		},

		UserEnsurer: userRepo,

		GeneralRateLimiter: generalRL,
		ChatRateLimiter:    chatRL,
		ForgeRateLimiter:   forgeRL,
	})

	// ─── HTTP server ───────────────────────────────────────────────────

	port := fmt.Sprintf("%d", cfg.Port)
	if p := os.Getenv("PORT"); p != "" {
		port = p
	}

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 0, // Disabled for SSE streaming (chat endpoint)
		IdleTimeout:  120 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		log.Printf("ragbox-backend v%s starting on port %s", Version, port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- err
		}
		close(errCh)
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case sig := <-quit:
		log.Printf("received signal %s, shutting down gracefully", sig)
	case err := <-errCh:
		return fmt.Errorf("server error: %w", err)
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("graceful shutdown failed: %w", err)
	}

	log.Println("server stopped")
	return nil
}

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}
