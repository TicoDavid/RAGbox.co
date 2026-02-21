package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config holds all application configuration loaded from environment variables.
// It is immutable after Load() returns.
type Config struct {
	Port                int
	Environment         string
	DatabaseURL         string
	DatabaseMaxConns    int
	GCPProject          string
	GCPRegion           string
	VertexAILocation    string
	VertexAIModel       string
	EmbeddingLocation   string
	EmbeddingModel      string
	EmbeddingDimensions int
	GCSBucketName       string
	GCSSignedURLExpiry  string
	DocAIProcessorID    string
	DocAILocation       string
	BigQueryDataset     string
	BigQueryTable       string
	FirebaseProjectID   string
	FrontendURL         string
	ConfidenceThreshold float64
	SelfRAGMaxIter      int
	ChunkSizeTokens     int
	ChunkOverlapPercent int
	PromptsDir          string
	DefaultPersona      string
	KMSKeyRing          string
	KMSKeyName          string
	InternalAuthSecret     string
	DeepgramAPIKey         string
	VonageAPIKey           string
	VonageAPISecret        string
	VonageSMSFromNumber    string
	VonageWhatsAppFromNumber string
	VonageDefaultTenant      string
}

// Load reads configuration from environment variables.
// Required variables (DATABASE_URL, GOOGLE_CLOUD_PROJECT) cause an error if missing.
// Optional variables use sensible defaults.
func Load() (*Config, error) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return nil, fmt.Errorf("config.Load: DATABASE_URL is required")
	}

	gcpProject := os.Getenv("GOOGLE_CLOUD_PROJECT")
	if gcpProject == "" {
		return nil, fmt.Errorf("config.Load: GOOGLE_CLOUD_PROJECT is required")
	}

	cfg := &Config{
		Port:                envInt("PORT", 8080),
		Environment:         envStr("ENVIRONMENT", "development"),
		DatabaseURL:         dbURL,
		DatabaseMaxConns:    envInt("DATABASE_MAX_CONNS", 25),
		GCPProject:          gcpProject,
		GCPRegion:           envStr("GCP_REGION", "us-east4"),
		VertexAILocation:    envStr("VERTEX_AI_LOCATION", "global"),
		VertexAIModel:       envStr("VERTEX_AI_MODEL", "gemini-3-pro-preview"),
		EmbeddingLocation:   envStr("VERTEX_AI_EMBEDDING_LOCATION", envStr("GCP_REGION", "us-east4")),
		EmbeddingModel:      envStr("VERTEX_AI_EMBEDDING_MODEL", "text-embedding-004"),
		EmbeddingDimensions: envInt("EMBEDDING_DIMENSIONS", 768),
		GCSBucketName:       envStr("GCS_BUCKET_NAME", ""),
		GCSSignedURLExpiry:  envStr("GCS_SIGNED_URL_EXPIRY", "15m"),
		DocAIProcessorID:    envStr("DOCUMENT_AI_PROCESSOR_ID", ""),
		DocAILocation:       envStr("DOCUMENT_AI_LOCATION", "us"),
		BigQueryDataset:     envStr("BIGQUERY_DATASET", "ragbox_audit"),
		BigQueryTable:       envStr("BIGQUERY_TABLE", "audit_events"),
		FirebaseProjectID:   envStr("FIREBASE_PROJECT_ID", ""),
		FrontendURL:         envStr("FRONTEND_URL", "http://localhost:3000"),
		ConfidenceThreshold: envFloat("SILENCE_THRESHOLD", 0.60),
		SelfRAGMaxIter:      envInt("SELF_RAG_MAX_ITERATIONS", 1),
		ChunkSizeTokens:     envInt("CHUNK_SIZE_TOKENS", 768),
		ChunkOverlapPercent: envInt("CHUNK_OVERLAP_PERCENT", 20),
		PromptsDir:          envStr("PROMPTS_DIR", "./internal/service/prompts"),
		DefaultPersona:      envStr("DEFAULT_PERSONA", "persona_cfo"),
		KMSKeyRing:          envStr("KMS_KEY_RING", "ragbox-keys"),
		KMSKeyName:          envStr("KMS_KEY_NAME", "document-key"),
		InternalAuthSecret:       envStr("INTERNAL_AUTH_SECRET", ""),
		DeepgramAPIKey:           envStr("DEEPGRAM_API_KEY", ""),
		VonageAPIKey:             envStr("VONAGE_API_KEY", ""),
		VonageAPISecret:          envStr("VONAGE_API_SECRET", ""),
		VonageSMSFromNumber:      envStr("VONAGE_SMS_FROM_NUMBER", ""),
		VonageWhatsAppFromNumber: envStr("VONAGE_WHATSAPP_FROM_NUMBER", ""),
		VonageDefaultTenant:      envStr("VONAGE_DEFAULT_TENANT", ""),
	}

	// Internal auth secret is required in non-development environments
	if cfg.Environment != "development" && cfg.InternalAuthSecret == "" {
		return nil, fmt.Errorf("config.Load: INTERNAL_AUTH_SECRET is required in %s environment", cfg.Environment)
	}

	return cfg, nil
}

func envStr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

func envFloat(key string, fallback float64) float64 {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	f, err := strconv.ParseFloat(v, 64)
	if err != nil {
		return fallback
	}
	return f
}
