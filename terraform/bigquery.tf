/**
 * RAGbox.co - BigQuery Configuration
 *
 * Audit logging dataset with:
 * - WORM compliance (append-only)
 * - 7-year retention
 * - Partitioned tables
 */

# BigQuery Dataset for Audit Logs
resource "google_bigquery_dataset" "audit" {
  dataset_id    = "${replace(local.name_prefix, "-", "_")}_audit"
  friendly_name = "RAGbox Audit Logs"
  description   = "Immutable audit logs for compliance (WORM-compatible)"
  location      = var.storage_location
  project       = var.project_id

  # Default table expiration: 7 years
  default_table_expiration_ms = var.audit_retention_days * 24 * 60 * 60 * 1000

  labels = local.common_labels

  depends_on = [google_project_service.apis["bigquery.googleapis.com"]]
}

# Audit Log Table
resource "google_bigquery_table" "audit_log" {
  dataset_id          = google_bigquery_dataset.audit.dataset_id
  table_id            = "audit_log"
  project             = var.project_id
  deletion_protection = var.enable_deletion_protection

  # Time partitioning by day
  time_partitioning {
    type          = "DAY"
    field         = "timestamp"
    expiration_ms = var.audit_retention_days * 24 * 60 * 60 * 1000
  }

  # Clustering for query performance
  clustering = ["action", "user_id"]

  schema = jsonencode([
    {
      name        = "event_id"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Unique event identifier"
    },
    {
      name        = "timestamp"
      type        = "TIMESTAMP"
      mode        = "REQUIRED"
      description = "Event timestamp (UTC)"
    },
    {
      name        = "user_id"
      type        = "STRING"
      mode        = "NULLABLE"
      description = "User ID (null for system events)"
    },
    {
      name        = "action"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Action type (LOGIN, QUERY, UPLOAD, etc.)"
    },
    {
      name        = "resource_id"
      type        = "STRING"
      mode        = "NULLABLE"
      description = "Related resource ID"
    },
    {
      name        = "resource_type"
      type        = "STRING"
      mode        = "NULLABLE"
      description = "Resource type (document, query, etc.)"
    },
    {
      name        = "severity"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Log severity (INFO, WARNING, ERROR, CRITICAL)"
    },
    {
      name        = "details"
      type        = "STRING"
      mode        = "NULLABLE"
      description = "JSON details payload"
    },
    {
      name        = "details_hash"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "SHA-256 hash of details for integrity"
    },
    {
      name        = "ip_address"
      type        = "STRING"
      mode        = "NULLABLE"
      description = "Client IP address"
    },
    {
      name        = "user_agent"
      type        = "STRING"
      mode        = "NULLABLE"
      description = "Client user agent"
    },
    {
      name        = "session_id"
      type        = "STRING"
      mode        = "NULLABLE"
      description = "Session identifier"
    },
    {
      name        = "inserted_at"
      type        = "TIMESTAMP"
      mode        = "REQUIRED"
      description = "Server-side insertion timestamp"
    }
  ])

  labels = local.common_labels
}

# Query Statistics Table (for analytics)
resource "google_bigquery_table" "query_stats" {
  dataset_id          = google_bigquery_dataset.audit.dataset_id
  table_id            = "query_statistics"
  project             = var.project_id
  deletion_protection = var.enable_deletion_protection

  time_partitioning {
    type          = "DAY"
    field         = "query_timestamp"
    expiration_ms = var.audit_retention_days * 24 * 60 * 60 * 1000
  }

  clustering = ["user_id"]

  schema = jsonencode([
    {
      name = "query_id"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "user_id"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "query_timestamp"
      type = "TIMESTAMP"
      mode = "REQUIRED"
    },
    {
      name = "query_hash"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "response_hash"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "confidence_score"
      type = "FLOAT64"
      mode = "REQUIRED"
    },
    {
      name = "silence_protocol_triggered"
      type = "BOOL"
      mode = "REQUIRED"
    },
    {
      name = "chunks_used"
      type = "INT64"
      mode = "REQUIRED"
    },
    {
      name = "latency_ms"
      type = "INT64"
      mode = "REQUIRED"
    },
    {
      name = "model"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "privilege_mode"
      type = "BOOL"
      mode = "REQUIRED"
    }
  ])

  labels = local.common_labels
}

# View for compliance reporting
resource "google_bigquery_table" "compliance_view" {
  dataset_id = google_bigquery_dataset.audit.dataset_id
  table_id   = "compliance_summary"
  project    = var.project_id

  view {
    query          = <<-EOF
      SELECT
        DATE(timestamp) as date,
        action,
        COUNT(*) as event_count,
        COUNT(DISTINCT user_id) as unique_users,
        COUNTIF(severity = 'ERROR' OR severity = 'CRITICAL') as error_count,
        COUNTIF(action = 'SILENCE_PROTOCOL_TRIGGERED') as silence_triggers
      FROM `${var.project_id}.${google_bigquery_dataset.audit.dataset_id}.audit_log`
      WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
      GROUP BY date, action
      ORDER BY date DESC, event_count DESC
    EOF
    use_legacy_sql = false
  }

  labels = local.common_labels

  depends_on = [google_bigquery_table.audit_log]
}
