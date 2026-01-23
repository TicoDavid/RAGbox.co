# RAGbox.co - Terraform Infrastructure

Infrastructure as Code for deploying RAGbox on Google Cloud Platform.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         GCP Project                             │
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │  Cloud Run  │────│ VPC Connector│────│   Cloud SQL        │ │
│  │   (App)     │    └─────────────┘    │   PostgreSQL       │ │
│  └──────┬──────┘                       │   + pgvector       │ │
│         │                              └─────────────────────┘ │
│         │                                                       │
│  ┌──────▼──────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │   Cloud     │    │  Vertex AI  │    │    BigQuery         │ │
│  │   Storage   │    │ (Gemini +   │    │  (Audit Logs)       │ │
│  │  (CMEK)     │    │ Embeddings) │    └─────────────────────┘ │
│  └─────────────┘    └─────────────┘                            │
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │  Cloud KMS  │    │   Secret    │    │    Document AI      │ │
│  │ (Encryption)│    │   Manager   │    │   (Text Extract)    │ │
│  └─────────────┘    └─────────────┘    └─────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **GCP Project** with billing enabled
2. **Terraform** >= 1.6.0 installed
3. **gcloud CLI** authenticated with appropriate permissions
4. **Required IAM roles** for the deploying user:
   - `roles/owner` or specific roles for each service

## Quick Start

### 1. Create Terraform State Bucket

```bash
# Create bucket for Terraform state (one-time setup)
PROJECT_ID=your-project-id
gsutil mb -p $PROJECT_ID gs://${PROJECT_ID}-terraform-state
gsutil versioning set on gs://${PROJECT_ID}-terraform-state
```

### 2. Configure Variables

Create a `terraform.tfvars` file:

```hcl
project_id   = "your-project-id"
region       = "us-central1"
environment  = "prod"
domain_name  = "ragbox.co"  # Optional: your custom domain
```

### 3. Initialize and Apply

```bash
# Initialize Terraform
terraform init

# Review the plan
terraform plan -out=tfplan

# Apply the infrastructure
terraform apply tfplan
```

## File Structure

```
terraform/
├── main.tf          # Provider config, APIs, locals
├── variables.tf     # Input variables
├── outputs.tf       # Output values
├── network.tf       # VPC, subnets, connectors
├── storage.tf       # Cloud Storage buckets
├── database.tf      # Cloud SQL PostgreSQL
├── cloudrun.tf      # Cloud Run service
├── kms.tf           # Cloud KMS keys
├── iam.tf           # Service accounts & bindings
├── bigquery.tf      # Audit logging dataset
└── README.md        # This file
```

## Configuration Options

### Environment-specific Configurations

| Variable | Dev | Staging | Prod |
|----------|-----|---------|------|
| `cloud_run_min_instances` | 0 | 1 | 2 |
| `cloud_run_max_instances` | 10 | 50 | 100 |
| `db_tier` | db-f1-micro | db-custom-2-4096 | db-custom-4-8192 |
| `enable_high_availability` | false | true | true |
| `enable_deletion_protection` | false | true | true |

### Example: Development Environment

```hcl
# terraform.tfvars.dev
project_id                  = "ragbox-dev"
environment                 = "dev"
cloud_run_min_instances     = 0
cloud_run_max_instances     = 10
db_tier                     = "db-f1-micro"
enable_high_availability    = false
enable_deletion_protection  = false
```

### Example: Production Environment

```hcl
# terraform.tfvars.prod
project_id                  = "ragbox-prod"
environment                 = "prod"
domain_name                 = "ragbox.co"
cloud_run_min_instances     = 2
cloud_run_max_instances     = 100
db_tier                     = "db-custom-4-8192"
enable_high_availability    = true
enable_deletion_protection  = true
```

## Post-Deployment Steps

### 1. Enable pgvector Extension

Connect to the database and run:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. Run Prisma Migrations

```bash
# Get DATABASE_URL from Secret Manager
export DATABASE_URL=$(gcloud secrets versions access latest \
  --secret=ragbox-prod-database-url)

# Run migrations
npx prisma migrate deploy
```

### 3. Configure Firebase

The Firebase project needs manual setup:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Add your GCP project
3. Enable Authentication (Google, Microsoft providers)
4. Add your domain to authorized domains

### 4. Deploy Application

```bash
# Build and deploy to Cloud Run
gcloud builds submit --config=cloudbuild.yaml
```

## Security Features

- **CMEK Encryption**: All data at rest encrypted with customer-managed keys
- **Private Networking**: Database accessible only via VPC connector
- **Least Privilege IAM**: Each service account has minimal required permissions
- **Secret Management**: Credentials stored in Secret Manager, not env vars
- **Audit Logging**: All operations logged to BigQuery (7-year retention)

## Costs Estimate

| Component | Monthly Cost (Prod) |
|-----------|---------------------|
| Cloud Run (2 min instances) | ~$50-100 |
| Cloud SQL (db-custom-2-4096) | ~$50-80 |
| Cloud Storage | ~$20 (1TB) |
| Vertex AI | ~$50-200 (usage) |
| BigQuery | ~$10-30 |
| KMS | ~$1-5 |
| **Total** | **~$180-450/month** |

*Costs vary based on usage. Enable billing alerts!*

## Troubleshooting

### Common Issues

1. **API not enabled**
   ```bash
   gcloud services enable compute.googleapis.com
   ```

2. **Permission denied**
   ```bash
   gcloud projects add-iam-policy-binding $PROJECT_ID \
     --member="user:you@example.com" \
     --role="roles/owner"
   ```

3. **VPC connector creation fails**
   - Ensure the connector CIDR doesn't overlap with other ranges
   - Check that the VPC Access API is enabled

4. **Cloud SQL private IP fails**
   - Service Networking connection may take a few minutes
   - Run `terraform apply` again after a short wait

### Debugging Commands

```bash
# Check Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision" --limit=50

# Check Cloud SQL status
gcloud sql instances describe ragbox-prod-postgres-xxxx

# List secrets
gcloud secrets list

# Get Terraform state
terraform state list
```

## Maintenance

### Rotate Encryption Keys

```bash
# Create new key version (auto-rotation configured for 90 days)
gcloud kms keys versions create \
  --key=document-key \
  --keyring=ragbox-prod-keyring \
  --location=us-central1
```

### Database Backups

Automated backups are enabled by default:
- Daily backups at 3:00 AM UTC
- Point-in-time recovery enabled
- 30-day retention

Manual backup:
```bash
gcloud sql backups create --instance=ragbox-prod-postgres-xxxx
```

### Scaling

Adjust Cloud Run scaling in `terraform.tfvars`:
```hcl
cloud_run_min_instances = 5
cloud_run_max_instances = 200
cloud_run_cpu           = "4"
cloud_run_memory        = "4Gi"
```

## Support

For issues with this infrastructure:
1. Check the troubleshooting guide above
2. Review GCP status at https://status.cloud.google.com
3. Open an issue in the repository
