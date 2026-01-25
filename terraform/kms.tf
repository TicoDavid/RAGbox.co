/**
 * RAGbox.co - Cloud KMS Configuration
 *
 * Customer-Managed Encryption Keys (CMEK) for:
 * - Document storage encryption
 * - Database encryption
 * - Secret encryption
 */

# KMS Keyring
resource "google_kms_key_ring" "ragbox" {
  name     = "${local.name_prefix}-keyring"
  location = var.region

  depends_on = [google_project_service.apis["cloudkms.googleapis.com"]]
}

# Primary encryption key for documents
resource "google_kms_crypto_key" "documents" {
  name            = "document-key"
  key_ring        = google_kms_key_ring.ragbox.id
  rotation_period = "7776000s" # 90 days

  version_template {
    algorithm        = "GOOGLE_SYMMETRIC_ENCRYPTION"
    protection_level = "SOFTWARE"
  }

  labels = local.common_labels

  lifecycle {
    prevent_destroy = true
  }
}

# Database encryption key
resource "google_kms_crypto_key" "database" {
  name            = "database-key"
  key_ring        = google_kms_key_ring.ragbox.id
  rotation_period = "7776000s" # 90 days

  version_template {
    algorithm        = "GOOGLE_SYMMETRIC_ENCRYPTION"
    protection_level = "SOFTWARE"
  }

  labels = local.common_labels

  lifecycle {
    prevent_destroy = true
  }
}

# Secret Manager encryption key
resource "google_kms_crypto_key" "secrets" {
  name            = "secrets-key"
  key_ring        = google_kms_key_ring.ragbox.id
  rotation_period = "7776000s" # 90 days

  version_template {
    algorithm        = "GOOGLE_SYMMETRIC_ENCRYPTION"
    protection_level = "SOFTWARE"
  }

  labels = local.common_labels

  lifecycle {
    prevent_destroy = true
  }
}

# Allow Cloud Storage service to use document key
resource "google_kms_crypto_key_iam_member" "storage_crypto_key" {
  crypto_key_id = google_kms_crypto_key.documents.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:service-${data.google_project.project.number}@gs-project-accounts.iam.gserviceaccount.com"
}

# Allow Cloud SQL service to use database key
resource "google_kms_crypto_key_iam_member" "sql_crypto_key" {
  crypto_key_id = google_kms_crypto_key.database.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-cloud-sql.iam.gserviceaccount.com"
}

# Allow Secret Manager to use secrets key
resource "google_kms_crypto_key_iam_member" "secretmanager_crypto_key" {
  crypto_key_id = google_kms_crypto_key.secrets.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-secretmanager.iam.gserviceaccount.com"
}
