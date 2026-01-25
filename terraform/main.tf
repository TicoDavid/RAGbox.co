/**
 * RAGbox.co - Main Terraform Configuration
 *
 * This is the root module for RAGbox infrastructure on GCP.
 * Orchestrates all GCP services required for the platform.
 */

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "gcs" {
    bucket = "ragbox-terraform-state"
    prefix = "terraform/state"
  }
}

# Google Provider
provider "google" {
  project = var.project_id
  region  = var.region
}

# Google Beta Provider (for features in beta)
provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# Random suffix for unique resource names
resource "random_id" "suffix" {
  byte_length = 4
}

# Enable required GCP APIs
resource "google_project_service" "apis" {
  for_each = toset([
    "compute.googleapis.com",
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "storage.googleapis.com",
    "cloudkms.googleapis.com",
    "secretmanager.googleapis.com",
    "aiplatform.googleapis.com",
    "documentai.googleapis.com",
    "vpcaccess.googleapis.com",
    "bigquery.googleapis.com",
    "logging.googleapis.com",
    "identitytoolkit.googleapis.com",
    "firebase.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# Data source for project info
data "google_project" "project" {
  project_id = var.project_id
}

locals {
  # Resource naming
  name_prefix = "${var.app_name}-${var.environment}"

  # Common labels
  common_labels = {
    app         = var.app_name
    environment = var.environment
    managed_by  = "terraform"
  }
}
