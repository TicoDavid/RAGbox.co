/**
 * RAGbox.co - Billing Alerts
 *
 * GCP billing budget with email alerts at 50%, 75%, and 100% thresholds.
 * Monthly budget cap of $1,000 (configurable).
 */

# Enable Billing Budget API
resource "google_project_service" "billing_budget_api" {
  project            = var.project_id
  service            = "billingbudgets.googleapis.com"
  disable_on_destroy = false
}

# Monthly billing budget
resource "google_billing_budget" "monthly" {
  billing_account = var.billing_account_id
  display_name    = "${local.name_prefix}-monthly-budget"

  budget_filter {
    projects = ["projects/${data.google_project.project.number}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.monthly_budget_usd)
    }
  }

  # Alert at 50% ($500 on default $1000 budget)
  threshold_rules {
    threshold_percent = 0.50
    spend_basis       = "CURRENT_SPEND"
  }

  # Alert at 75% ($750 on default $1000 budget)
  threshold_rules {
    threshold_percent = 0.75
    spend_basis       = "CURRENT_SPEND"
  }

  # Alert at 100% ($1000 on default $1000 budget)
  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "CURRENT_SPEND"
  }

  # Also alert on forecasted overspend
  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "FORECASTED_SPEND"
  }

  # Email notifications
  all_updates_rule {
    monitoring_notification_channels = []
    schema_version                   = 1
    enable_project_level_recipients  = true
  }

  depends_on = [google_project_service.billing_budget_api]
}

# Cloud Monitoring notification channel for budget alerts
resource "google_monitoring_notification_channel" "budget_email" {
  count        = var.billing_alert_email != "" ? 1 : 0
  project      = var.project_id
  display_name = "${local.name_prefix}-billing-alert"
  type         = "email"

  labels = {
    email_address = var.billing_alert_email
  }
}

# Monitoring alert: Cloud Run latency p95 > 2 seconds
resource "google_monitoring_alert_policy" "latency_p95" {
  project      = var.project_id
  display_name = "${local.name_prefix}-latency-p95"
  combiner     = "OR"

  conditions {
    display_name = "Cloud Run request latency p95 > 2s"

    condition_threshold {
      filter          = "resource.type = \"cloud_run_revision\" AND metric.type = \"run.googleapis.com/request_latencies\""
      comparison      = "COMPARISON_GT"
      threshold_value = 2000 # milliseconds
      duration        = "300s"

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_PERCENTILE_95"
        cross_series_reducer = "REDUCE_MEAN"
      }
    }
  }

  notification_channels = var.billing_alert_email != "" ? [google_monitoring_notification_channel.budget_email[0].name] : []

  alert_strategy {
    auto_close = "1800s"
  }
}

# Monitoring alert: Error rate > 5%
resource "google_monitoring_alert_policy" "error_rate" {
  project      = var.project_id
  display_name = "${local.name_prefix}-error-rate"
  combiner     = "OR"

  conditions {
    display_name = "Cloud Run error rate > 5%"

    condition_threshold {
      filter          = "resource.type = \"cloud_run_revision\" AND metric.type = \"run.googleapis.com/request_count\" AND metric.labels.response_code_class != \"2xx\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.05
      duration        = "300s"

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
      }
    }
  }

  notification_channels = var.billing_alert_email != "" ? [google_monitoring_notification_channel.budget_email[0].name] : []

  alert_strategy {
    auto_close = "1800s"
  }
}
