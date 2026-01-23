/**
 * RAGbox.co - Cloud SQL PostgreSQL Configuration
 *
 * PostgreSQL with pgvector extension for:
 * - Document metadata storage
 * - Vector embeddings storage
 * - Audit log storage
 */

# Generate random password for database
resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Cloud SQL PostgreSQL Instance
resource "google_sql_database_instance" "postgres" {
  name             = "${local.name_prefix}-postgres-${random_id.suffix.hex}"
  database_version = "POSTGRES_15"
  region           = var.region
  project          = var.project_id

  deletion_protection = var.enable_deletion_protection

  settings {
    tier              = var.db_tier
    availability_type = var.enable_high_availability ? "REGIONAL" : "ZONAL"
    disk_size         = var.db_disk_size
    disk_type         = var.db_disk_type
    disk_autoresize   = true

    # CMEK encryption
    encryption_key_name = google_kms_crypto_key.database.id

    # Database flags for pgvector
    database_flags {
      name  = "cloudsql.enable_pg_cron"
      value = "on"
    }

    database_flags {
      name  = "max_connections"
      value = "100"
    }

    database_flags {
      name  = "shared_preload_libraries"
      value = "vector"
    }

    # Backup configuration
    backup_configuration {
      enabled                        = var.db_backup_enabled
      start_time                     = var.db_backup_start_time
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7

      backup_retention_settings {
        retained_backups = 30
        retention_unit   = "COUNT"
      }
    }

    # Maintenance window
    maintenance_window {
      day          = var.db_maintenance_window_day
      hour         = var.db_maintenance_window_hour
      update_track = "stable"
    }

    # Networking (Private IP)
    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.vpc.id
      require_ssl     = true
    }

    # Insights for monitoring
    insights_config {
      query_insights_enabled  = true
      query_plans_per_minute  = 5
      query_string_length     = 4500
      record_application_tags = true
      record_client_address   = true
    }

    user_labels = local.common_labels
  }

  depends_on = [
    google_project_service.apis["sqladmin.googleapis.com"],
    google_kms_crypto_key_iam_member.sql_crypto_key,
    google_service_networking_connection.private_vpc_connection
  ]
}

# Create the main database
resource "google_sql_database" "ragbox" {
  name     = var.db_name
  instance = google_sql_database_instance.postgres.name
  project  = var.project_id
}

# Create the admin user
resource "google_sql_user" "admin" {
  name     = var.db_user
  instance = google_sql_database_instance.postgres.name
  password = random_password.db_password.result
  project  = var.project_id
}

# Store database password in Secret Manager
resource "google_secret_manager_secret" "db_password" {
  secret_id = "${local.name_prefix}-db-password"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = local.common_labels

  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}

# Store database connection string in Secret Manager
resource "google_secret_manager_secret" "database_url" {
  secret_id = "${local.name_prefix}-database-url"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = local.common_labels

  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret_version" "database_url" {
  secret = google_secret_manager_secret.database_url.id
  secret_data = format(
    "postgresql://%s:%s@%s/%s?sslmode=require",
    var.db_user,
    random_password.db_password.result,
    google_sql_database_instance.postgres.private_ip_address,
    var.db_name
  )
}

# Read replica for production (optional)
resource "google_sql_database_instance" "postgres_replica" {
  count = var.enable_high_availability && var.environment == "prod" ? 1 : 0

  name                 = "${local.name_prefix}-postgres-replica-${random_id.suffix.hex}"
  database_version     = "POSTGRES_15"
  region               = var.region
  project              = var.project_id
  master_instance_name = google_sql_database_instance.postgres.name

  deletion_protection = var.enable_deletion_protection

  settings {
    tier            = var.db_tier
    disk_size       = var.db_disk_size
    disk_type       = var.db_disk_type
    disk_autoresize = true

    encryption_key_name = google_kms_crypto_key.database.id

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.vpc.id
      require_ssl     = true
    }

    user_labels = local.common_labels
  }
}
