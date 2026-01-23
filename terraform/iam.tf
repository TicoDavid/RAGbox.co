/**
 * RAGbox.co - IAM Configuration
 *
 * Service accounts and IAM bindings following
 * principle of least privilege.
 */

# Cloud Run Service Account
resource "google_service_account" "cloud_run" {
  account_id   = "${local.name_prefix}-cloudrun"
  display_name = "RAGbox Cloud Run Service Account"
  description  = "Service account for Cloud Run application"
  project      = var.project_id
}

# Cloud Functions Service Account
resource "google_service_account" "cloud_functions" {
  account_id   = "${local.name_prefix}-functions"
  display_name = "RAGbox Cloud Functions Service Account"
  description  = "Service account for Cloud Functions (document processing)"
  project      = var.project_id
}

# CI/CD Service Account (for Cloud Build)
resource "google_service_account" "cicd" {
  account_id   = "${local.name_prefix}-cicd"
  display_name = "RAGbox CI/CD Service Account"
  description  = "Service account for Cloud Build CI/CD"
  project      = var.project_id
}

# ============================================
# Cloud Run Service Account Permissions
# ============================================

# Cloud SQL Client
resource "google_project_iam_member" "cloudrun_sql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Cloud Storage Object Admin (for documents bucket)
resource "google_storage_bucket_iam_member" "cloudrun_storage" {
  bucket = google_storage_bucket.documents.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Cloud Storage Object Admin (for temp bucket)
resource "google_storage_bucket_iam_member" "cloudrun_temp_storage" {
  bucket = google_storage_bucket.temp.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Vertex AI User
resource "google_project_iam_member" "cloudrun_vertexai" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Secret Manager Secret Accessor
resource "google_project_iam_member" "cloudrun_secrets" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Cloud KMS Encrypter/Decrypter
resource "google_kms_crypto_key_iam_member" "cloudrun_kms" {
  crypto_key_id = google_kms_crypto_key.documents.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:${google_service_account.cloud_run.email}"
}

# BigQuery Data Editor (for audit logs)
resource "google_bigquery_dataset_iam_member" "cloudrun_bigquery" {
  dataset_id = google_bigquery_dataset.audit.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = "serviceAccount:${google_service_account.cloud_run.email}"
  project    = var.project_id
}

# Cloud Logging Writer
resource "google_project_iam_member" "cloudrun_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# ============================================
# Cloud Functions Service Account Permissions
# ============================================

# Document AI User
resource "google_project_iam_member" "functions_documentai" {
  project = var.project_id
  role    = "roles/documentai.apiUser"
  member  = "serviceAccount:${google_service_account.cloud_functions.email}"
}

# Cloud Storage Object Viewer (for documents bucket)
resource "google_storage_bucket_iam_member" "functions_storage" {
  bucket = google_storage_bucket.documents.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.cloud_functions.email}"
}

# Vertex AI User (for embeddings)
resource "google_project_iam_member" "functions_vertexai" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.cloud_functions.email}"
}

# Cloud SQL Client
resource "google_project_iam_member" "functions_sql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloud_functions.email}"
}

# Secret Manager Secret Accessor
resource "google_project_iam_member" "functions_secrets" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.cloud_functions.email}"
}

# ============================================
# CI/CD Service Account Permissions
# ============================================

# Cloud Run Admin
resource "google_project_iam_member" "cicd_cloudrun" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.cicd.email}"
}

# Cloud Build Editor
resource "google_project_iam_member" "cicd_cloudbuild" {
  project = var.project_id
  role    = "roles/cloudbuild.builds.editor"
  member  = "serviceAccount:${google_service_account.cicd.email}"
}

# Service Account User (to deploy as Cloud Run SA)
resource "google_service_account_iam_member" "cicd_impersonate_cloudrun" {
  service_account_id = google_service_account.cloud_run.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.cicd.email}"
}

# Container Registry Admin
resource "google_project_iam_member" "cicd_registry" {
  project = var.project_id
  role    = "roles/artifactregistry.admin"
  member  = "serviceAccount:${google_service_account.cicd.email}"
}

# Storage Admin (for Container Registry)
resource "google_project_iam_member" "cicd_storage" {
  project = var.project_id
  role    = "roles/storage.admin"
  member  = "serviceAccount:${google_service_account.cicd.email}"
}

# Secret Manager Admin (for creating/updating secrets during deployment)
resource "google_project_iam_member" "cicd_secrets" {
  project = var.project_id
  role    = "roles/secretmanager.admin"
  member  = "serviceAccount:${google_service_account.cicd.email}"
}
