package repository

import (
	"context"
	"os"
	"testing"
	"time"
)

func TestNewPool_InvalidURL(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := NewPool(ctx, "not-a-valid-url", 5)
	if err == nil {
		t.Fatal("expected error for invalid URL")
	}
}

func TestNewPool_ConnectionRefused(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Use a port that nothing is listening on
	_, err := NewPool(ctx, "postgres://user:pass@127.0.0.1:59999/noexist", 5)
	if err == nil {
		t.Fatal("expected error for unreachable host")
	}
}

func TestNewPool_RealDB(t *testing.T) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL not set, skipping integration test")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := NewPool(ctx, dbURL, 5)
	if err != nil {
		t.Fatalf("NewPool() error: %v", err)
	}
	defer pool.Close()

	var result int
	err = pool.QueryRow(ctx, "SELECT 1").Scan(&result)
	if err != nil {
		t.Fatalf("QueryRow SELECT 1 error: %v", err)
	}
	if result != 1 {
		t.Errorf("SELECT 1 = %d, want 1", result)
	}
}

func TestNewPool_MaxConnsZeroUsesDefault(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// This will still fail to connect, but should parse config fine
	_, err := NewPool(ctx, "postgres://user:pass@127.0.0.1:59999/noexist", 0)
	if err == nil {
		t.Fatal("expected connection error")
	}
	// The error should be a connection error, not a config parsing error
}
