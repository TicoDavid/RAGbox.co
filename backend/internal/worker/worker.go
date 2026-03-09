// Package worker provides a shared HTTP server framework for Pub/Sub push workers.
// Each Cloud Run worker service imports this to reduce boilerplate.
package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

// PubSubMessage is the envelope Pub/Sub sends to push endpoints.
type PubSubMessage struct {
	Message struct {
		Data []byte `json:"data"`
	} `json:"message"`
}

// Handler processes raw message data from a Pub/Sub push subscription.
type Handler func(ctx context.Context, data []byte) error

// Run starts the worker HTTP server with health check and Pub/Sub push endpoint.
// It blocks until a SIGTERM/SIGINT signal is received, then gracefully shuts down.
func Run(name string, handler Handler) {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		fmt.Fprint(w, "ok")
	})

	// Pub/Sub push endpoint
	mux.HandleFunc("POST /", func(w http.ResponseWriter, r *http.Request) {
		var msg PubSubMessage
		if err := json.NewDecoder(r.Body).Decode(&msg); err != nil {
			slog.Error("decode failed", "worker", name, "error", err)
			w.WriteHeader(400) // Bad request — don't retry
			return
		}

		if err := handler(r.Context(), msg.Message.Data); err != nil {
			slog.Error("processing failed", "worker", name, "error", err)
			w.WriteHeader(500) // NACK — Pub/Sub will retry
			return
		}

		w.WriteHeader(200) // ACK
	})

	srv := &http.Server{Addr: ":" + port, Handler: mux}

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
		<-sigCh
		slog.Info("shutting down", "worker", name)
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		srv.Shutdown(ctx)
	}()

	slog.Info("worker starting", "worker", name, "port", port)
	if err := srv.ListenAndServe(); err != http.ErrServerClosed {
		slog.Error("server error", "worker", name, "error", err)
		os.Exit(1)
	}
}
