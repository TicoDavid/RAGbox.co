/**
 * RAGbox.co - Cloud Storage Configuration
 *
 * Secure document storage with:
 * - CMEK encryption
 * - Versioning
 * - Lifecycle policies
 * - Uniform bucket-level access
 */

# Primary document storage bucket
resource "google_storage_bucket" "documents" {
  name          = "${local.name_prefix}-documents-${random_id.suffix.hex}"
  location      = var.storage_location
  storage_class = var.storage_class
  project       = var.project_id

  # Security: Uniform bucket-level access
  uniform_bucket_level_access = true

  # Security: Public access prevention
  public_access_prevention = "enforced"

  # Versioning for document recovery
  versioning {
    enabled = var.storage_versioning_enabled
  }

  # CMEK encryption
  encryption {
    default_kms_key_name = google_kms_crypto_key.documents.id
  }

  # Lifecycle rules
  dynamic "lifecycle_rule" {
    for_each = var.storage_lifecycle_days > 0 ? [1] : []
    content {
      action {
        type          = "SetStorageClass"
        storage_class = "ARCHIVE"
      }
      condition {
        age = var.storage_lifecycle_days
      }
    }
  }

  # Delete old versions after 30 days
  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      age         = 30
      with_state  = "ARCHIVED"
      num_newer_versions = 3
    }
  }

  # CORS for browser uploads
  cors {
    origin          = var.domain_name != "" ? ["https://${var.domain_name}"] : ["*"]
    method          = ["GET", "HEAD", "PUT", "POST", "DELETE"]
    response_header = ["*"]
    max_age_seconds = 3600
  }

  labels = local.common_labels

  depends_on = [
    google_project_service.apis["storage.googleapis.com"],
    google_kms_crypto_key_iam_member.storage_crypto_key
  ]

  lifecycle {
    prevent_destroy = true
  }
}

# Temporary upload bucket (for resumable uploads)
resource "google_storage_bucket" "temp" {
  name          = "${local.name_prefix}-temp-${random_id.suffix.hex}"
  location      = var.storage_location
  storage_class = "STANDARD"
  project       = var.project_id

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  # Automatically delete temp files after 24 hours
  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      age = 1
    }
  }

  labels = local.common_labels

  depends_on = [google_project_service.apis["storage.googleapis.com"]]
}

# Terraform state bucket (created separately but referenced)
# Note: Create this bucket manually before running terraform init:
# gsutil mb -p PROJECT_ID gs://ragbox-terraform-state
# gsutil versioning set on gs://ragbox-terraform-state
