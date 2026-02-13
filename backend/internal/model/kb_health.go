package model

import (
	"encoding/json"
	"time"
)

type HealthCheckType string

const (
	HealthCheckFreshness HealthCheckType = "freshness"
	HealthCheckCoverage  HealthCheckType = "coverage"
	HealthCheckIntegrity HealthCheckType = "integrity"
)

type HealthStatus string

const (
	HealthStatusPassed  HealthStatus = "passed"
	HealthStatusWarning HealthStatus = "warning"
	HealthStatusFailed  HealthStatus = "failed"
)

// KBHealthCheck stores the result of a scheduled vault audit.
type KBHealthCheck struct {
	ID        string          `json:"id"`
	VaultID   string          `json:"vaultId"`
	CheckType string          `json:"checkType"`
	Status    HealthStatus    `json:"status"`
	Details   json.RawMessage `json:"details,omitempty"`
	RunAt     time.Time       `json:"runAt"`
}
