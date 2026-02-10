package config

import (
	"os"
	"testing"
)

func clearEnv(t *testing.T) {
	t.Helper()
	for _, key := range []string{
		"PORT", "ENVIRONMENT", "DATABASE_URL", "DATABASE_MAX_CONNS",
		"GOOGLE_CLOUD_PROJECT", "GCP_REGION", "VERTEX_AI_LOCATION",
		"VERTEX_AI_MODEL", "VERTEX_AI_EMBEDDING_MODEL", "EMBEDDING_DIMENSIONS",
		"GCS_BUCKET_NAME", "GCS_SIGNED_URL_EXPIRY", "DOCUMENT_AI_PROCESSOR_ID",
		"DOCUMENT_AI_LOCATION", "BIGQUERY_DATASET", "BIGQUERY_TABLE",
		"FIREBASE_PROJECT_ID", "FRONTEND_URL", "CONFIDENCE_THRESHOLD",
		"SELF_RAG_MAX_ITERATIONS", "CHUNK_SIZE_TOKENS", "CHUNK_OVERLAP_PERCENT",
		"PROMPTS_DIR", "DEFAULT_PERSONA", "KMS_KEY_RING", "KMS_KEY_NAME",
		"INTERNAL_AUTH_SECRET",
	} {
		os.Unsetenv(key)
	}
}

func setRequired(t *testing.T) {
	t.Helper()
	t.Setenv("DATABASE_URL", "postgres://user:pass@localhost:5432/ragbox")
	t.Setenv("GOOGLE_CLOUD_PROJECT", "ragbox-sovereign-prod")
}

func TestLoad_MissingDatabaseURL(t *testing.T) {
	clearEnv(t)
	t.Setenv("GOOGLE_CLOUD_PROJECT", "test-project")

	_, err := Load()
	if err == nil {
		t.Fatal("expected error for missing DATABASE_URL")
	}
}

func TestLoad_MissingGCPProject(t *testing.T) {
	clearEnv(t)
	t.Setenv("DATABASE_URL", "postgres://localhost/test")

	_, err := Load()
	if err == nil {
		t.Fatal("expected error for missing GOOGLE_CLOUD_PROJECT")
	}
}

func TestLoad_Defaults(t *testing.T) {
	clearEnv(t)
	setRequired(t)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}

	if cfg.Port != 8080 {
		t.Errorf("Port = %d, want 8080", cfg.Port)
	}
	if cfg.Environment != "development" {
		t.Errorf("Environment = %q, want %q", cfg.Environment, "development")
	}
	if cfg.ConfidenceThreshold != 0.85 {
		t.Errorf("ConfidenceThreshold = %f, want 0.85", cfg.ConfidenceThreshold)
	}
	if cfg.SelfRAGMaxIter != 3 {
		t.Errorf("SelfRAGMaxIter = %d, want 3", cfg.SelfRAGMaxIter)
	}
	if cfg.ChunkSizeTokens != 768 {
		t.Errorf("ChunkSizeTokens = %d, want 768", cfg.ChunkSizeTokens)
	}
	if cfg.ChunkOverlapPercent != 20 {
		t.Errorf("ChunkOverlapPercent = %d, want 20", cfg.ChunkOverlapPercent)
	}
	if cfg.GCPRegion != "us-east4" {
		t.Errorf("GCPRegion = %q, want %q", cfg.GCPRegion, "us-east4")
	}
	if cfg.EmbeddingDimensions != 768 {
		t.Errorf("EmbeddingDimensions = %d, want 768", cfg.EmbeddingDimensions)
	}
	if cfg.DatabaseMaxConns != 25 {
		t.Errorf("DatabaseMaxConns = %d, want 25", cfg.DatabaseMaxConns)
	}
	if cfg.FrontendURL != "http://localhost:3000" {
		t.Errorf("FrontendURL = %q, want %q", cfg.FrontendURL, "http://localhost:3000")
	}
	if cfg.DefaultPersona != "persona_cfo" {
		t.Errorf("DefaultPersona = %q, want %q", cfg.DefaultPersona, "persona_cfo")
	}
}

func TestLoad_CustomValues(t *testing.T) {
	clearEnv(t)
	setRequired(t)
	t.Setenv("PORT", "9090")
	t.Setenv("ENVIRONMENT", "production")
	t.Setenv("INTERNAL_AUTH_SECRET", "test-secret-for-production")
	t.Setenv("CONFIDENCE_THRESHOLD", "0.90")
	t.Setenv("SELF_RAG_MAX_ITERATIONS", "5")
	t.Setenv("FRONTEND_URL", "https://ragbox.co")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}

	if cfg.Port != 9090 {
		t.Errorf("Port = %d, want 9090", cfg.Port)
	}
	if cfg.Environment != "production" {
		t.Errorf("Environment = %q, want %q", cfg.Environment, "production")
	}
	if cfg.ConfidenceThreshold != 0.90 {
		t.Errorf("ConfidenceThreshold = %f, want 0.90", cfg.ConfidenceThreshold)
	}
	if cfg.SelfRAGMaxIter != 5 {
		t.Errorf("SelfRAGMaxIter = %d, want 5", cfg.SelfRAGMaxIter)
	}
	if cfg.FrontendURL != "https://ragbox.co" {
		t.Errorf("FrontendURL = %q, want %q", cfg.FrontendURL, "https://ragbox.co")
	}
}

func TestLoad_InvalidIntFallsBack(t *testing.T) {
	clearEnv(t)
	setRequired(t)
	t.Setenv("PORT", "not-a-number")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}

	if cfg.Port != 8080 {
		t.Errorf("Port = %d, want 8080 (fallback)", cfg.Port)
	}
}

func TestLoad_InvalidFloatFallsBack(t *testing.T) {
	clearEnv(t)
	setRequired(t)
	t.Setenv("CONFIDENCE_THRESHOLD", "bad")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}

	if cfg.ConfidenceThreshold != 0.85 {
		t.Errorf("ConfidenceThreshold = %f, want 0.85 (fallback)", cfg.ConfidenceThreshold)
	}
}

func TestLoad_RequiredFieldsPresent(t *testing.T) {
	clearEnv(t)
	setRequired(t)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}

	if cfg.DatabaseURL != "postgres://user:pass@localhost:5432/ragbox" {
		t.Errorf("DatabaseURL = %q, want set value", cfg.DatabaseURL)
	}
	if cfg.GCPProject != "ragbox-sovereign-prod" {
		t.Errorf("GCPProject = %q, want set value", cfg.GCPProject)
	}
}
