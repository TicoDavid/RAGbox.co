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
	"github.com/connexus-ai/ragbox-backend/internal/middleware"
	"github.com/connexus-ai/ragbox-backend/internal/repository"
	internalrouter "github.com/connexus-ai/ragbox-backend/internal/router"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

const Version = "0.1.0"

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

	// Initialize Prometheus metrics
	reg := prometheus.NewRegistry()
	metrics := middleware.NewMetrics(reg)

	// Build router with all dependencies
	router := internalrouter.New(&internalrouter.Dependencies{
		DB:          pool,
		AuthService: authService,
		FrontendURL: cfg.FrontendURL,
		Metrics:     metrics,
		MetricsReg:  reg,
	})

	port := fmt.Sprintf("%d", cfg.Port)
	if p := os.Getenv("PORT"); p != "" {
		port = p
	}

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
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
