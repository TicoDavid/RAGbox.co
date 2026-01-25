/**
 * RAGbox.co - Cloud Run Configuration
 *
 * Serverless application deployment with:
 * - Auto-scaling
 * - VPC connectivity
 * - Secret integration
 * - Custom domain support
 */

# Cloud Run Service
resource "google_cloud_run_v2_service" "app" {
  name     = "${local.name_prefix}-app"
  location = var.region
  project  = var.project_id

  ingress = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.cloud_run.email

    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.cloud_run_max_instances
    }

    timeout = "${var.cloud_run_timeout}s"

    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "ALL_TRAFFIC"
    }

    containers {
      image = "gcr.io/${var.project_id}/${local.name_prefix}-app:latest"

      ports {
        container_port = 3000
      }

      resources {
        limits = {
          cpu    = var.cloud_run_cpu
          memory = var.cloud_run_memory
        }
        startup_cpu_boost = true
      }

      # Environment variables
      env {
        name  = "NODE_ENV"
        value = var.environment == "prod" ? "production" : "development"
      }

      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }

      env {
        name  = "GCP_REGION"
        value = var.region
      }

      env {
        name  = "GCS_BUCKET_NAME"
        value = google_storage_bucket.documents.name
      }

      env {
        name  = "KMS_KEY_RING"
        value = google_kms_key_ring.ragbox.name
      }

      env {
        name  = "KMS_KEY_NAME"
        value = google_kms_crypto_key.documents.name
      }

      env {
        name  = "VERTEX_AI_LOCATION"
        value = var.region
      }

      env {
        name  = "BIGQUERY_DATASET"
        value = google_bigquery_dataset.audit.dataset_id
      }

      env {
        name  = "CONFIDENCE_THRESHOLD"
        value = "0.85"
      }

      # Secrets
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }

      # Startup probe
      startup_probe {
        http_get {
          path = "/api/health"
          port = 3000
        }
        initial_delay_seconds = 10
        period_seconds        = 5
        failure_threshold     = 30
      }

      # Liveness probe
      liveness_probe {
        http_get {
          path = "/api/health"
          port = 3000
        }
        period_seconds    = 30
        failure_threshold = 3
      }
    }

    max_instance_request_concurrency = var.cloud_run_concurrency
  }

  labels = local.common_labels

  depends_on = [
    google_project_service.apis["run.googleapis.com"],
    google_secret_manager_secret_version.database_url
  ]
}

# Allow unauthenticated access (public web app)
resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.app.name
  location = var.region
  project  = var.project_id
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Custom domain mapping (optional)
resource "google_cloud_run_domain_mapping" "default" {
  count    = var.domain_name != "" ? 1 : 0
  location = var.region
  project  = var.project_id
  name     = var.domain_name

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.app.name
  }
}

# Cloud Scheduler for cron jobs (optional warm-up)
resource "google_cloud_scheduler_job" "warmup" {
  count = var.cloud_run_min_instances == 0 ? 1 : 0

  name        = "${local.name_prefix}-warmup"
  description = "Keep Cloud Run instance warm during business hours"
  schedule    = "*/5 8-20 * * 1-5" # Every 5 min, 8am-8pm, Mon-Fri
  time_zone   = "America/New_York"
  project     = var.project_id
  region      = var.region

  http_target {
    http_method = "GET"
    uri         = "${google_cloud_run_v2_service.app.uri}/api/health"

    oidc_token {
      service_account_email = google_service_account.cloud_run.email
    }
  }
}
