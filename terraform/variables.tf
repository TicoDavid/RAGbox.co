/**
 * RAGbox.co - Terraform Variables
 *
 * Input variables for infrastructure configuration.
 */

# Project Configuration
variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region for resources"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP Zone for zonal resources"
  type        = string
  default     = "us-central1-a"
}

variable "app_name" {
  description = "Application name used for resource naming"
  type        = string
  default     = "ragbox"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

# Cloud Run Configuration
variable "cloud_run_cpu" {
  description = "CPU allocation for Cloud Run (e.g., 1, 2, 4)"
  type        = string
  default     = "2"
}

variable "cloud_run_memory" {
  description = "Memory allocation for Cloud Run (e.g., 512Mi, 1Gi, 2Gi)"
  type        = string
  default     = "2Gi"
}

variable "cloud_run_min_instances" {
  description = "Minimum number of Cloud Run instances"
  type        = number
  default     = 0
}

variable "cloud_run_max_instances" {
  description = "Maximum number of Cloud Run instances"
  type        = number
  default     = 100
}

variable "cloud_run_concurrency" {
  description = "Maximum concurrent requests per instance"
  type        = number
  default     = 80
}

variable "cloud_run_timeout" {
  description = "Request timeout in seconds"
  type        = number
  default     = 300
}

# Database Configuration
variable "db_tier" {
  description = "Cloud SQL machine tier"
  type        = string
  default     = "db-custom-2-4096" # 2 vCPU, 4GB RAM
}

variable "db_disk_size" {
  description = "Database disk size in GB"
  type        = number
  default     = 100
}

variable "db_disk_type" {
  description = "Database disk type"
  type        = string
  default     = "PD_SSD"
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "ragbox"
}

variable "db_user" {
  description = "Database admin username"
  type        = string
  default     = "ragbox_admin"
}

variable "db_backup_enabled" {
  description = "Enable automated backups"
  type        = bool
  default     = true
}

variable "db_backup_start_time" {
  description = "Start time for backup window (HH:MM format, UTC)"
  type        = string
  default     = "03:00"
}

variable "db_maintenance_window_day" {
  description = "Day of week for maintenance (1=Monday, 7=Sunday)"
  type        = number
  default     = 7
}

variable "db_maintenance_window_hour" {
  description = "Hour of day for maintenance (0-23, UTC)"
  type        = number
  default     = 4
}

# Storage Configuration
variable "storage_location" {
  description = "Location for Cloud Storage bucket"
  type        = string
  default     = "US"
}

variable "storage_class" {
  description = "Storage class for bucket"
  type        = string
  default     = "STANDARD"
}

variable "storage_versioning_enabled" {
  description = "Enable object versioning"
  type        = bool
  default     = true
}

variable "storage_lifecycle_days" {
  description = "Days before objects are moved to archive (0 to disable)"
  type        = number
  default     = 0
}

# Network Configuration
variable "vpc_cidr" {
  description = "CIDR range for VPC network"
  type        = string
  default     = "10.0.0.0/16"
}

variable "vpc_connector_cidr" {
  description = "CIDR range for VPC connector"
  type        = string
  default     = "10.8.0.0/28"
}

# Domain Configuration
variable "domain_name" {
  description = "Custom domain name for the application"
  type        = string
  default     = ""
}

# Audit Configuration
variable "audit_retention_days" {
  description = "Number of days to retain audit logs in BigQuery"
  type        = number
  default     = 2557 # 7 years
}

# Feature Flags
variable "enable_high_availability" {
  description = "Enable high availability configuration"
  type        = bool
  default     = true
}

variable "enable_deletion_protection" {
  description = "Enable deletion protection for critical resources"
  type        = bool
  default     = true
}
