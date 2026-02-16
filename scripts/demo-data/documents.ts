/**
 * Demo Documents - RAGbox.co
 *
 * 10 realistic documents for investor demo + 4 content gaps.
 */

export interface DemoDocument {
  filename: string
  title: string
  content: string
  mimeType: string
  isPrivileged?: boolean
}

export interface DemoContentGap {
  queryText: string
  occurrences: number
  confidenceScore: number
  suggestedTopics: string[]
}

// ============================================================================
// 10 DEMO DOCUMENTS
// ============================================================================

export const DEMO_DOCUMENTS: DemoDocument[] = [
  {
    filename: 'Acme_Corp_MSA_2025.pdf',
    title: 'Acme Corp Master Service Agreement',
    mimeType: 'application/pdf',
    content: `MASTER SERVICE AGREEMENT

Between: Acme Corporation ("Client") and ConnexUS Inc. ("Provider")
Effective Date: January 15, 2025
Agreement Number: MSA-2025-0042

1. SCOPE OF SERVICES
Provider shall deliver virtual representative (V-Rep) technology services, including AI-powered sales automation, call routing, and customer engagement analytics.

2. TERM AND TERMINATION
This Agreement shall commence on the Effective Date and continue for an initial term of thirty-six (36) months. Either party may terminate with ninety (90) days written notice.

3. FEES AND PAYMENT
3.1 Monthly Platform Fee: $8,500/month
3.2 Per V-Rep License: $450/month per active V-Rep
3.3 Overage Charges: $0.12 per minute beyond the included 10,000 minutes per V-Rep per month
3.4 Payment Terms: Net 30 from invoice date

4. SERVICE LEVEL AGREEMENTS
4.1 Platform Uptime: 99.9% monthly availability
4.2 Priority 1 Incidents: Response within 15 minutes, resolution within 4 hours
4.3 Priority 2 Incidents: Response within 1 hour, resolution within 24 hours
4.4 Priority 3 Incidents: Response within 4 hours, resolution within 72 hours

5. DATA PROTECTION
All customer data shall be encrypted at rest (AES-256) and in transit (TLS 1.3). Provider maintains SOC 2 Type II certification.

6. INTELLECTUAL PROPERTY
6.1 Client retains all rights to its data and customizations
6.2 Provider retains all rights to the underlying platform technology
6.3 Custom integrations developed during the term are jointly owned

7. LIMITATION OF LIABILITY
Neither party's aggregate liability shall exceed the total fees paid in the twelve (12) months preceding the claim.

8. CONFIDENTIALITY
Both parties agree to maintain strict confidentiality of all proprietary information for a period of five (5) years following termination.

9. FORCE MAJEURE
Neither party shall be liable for delays caused by circumstances beyond reasonable control, including natural disasters, pandemics, or government actions.

10. GOVERNING LAW
This Agreement shall be governed by the laws of the State of Delaware.

11. DISPUTE RESOLUTION
All disputes shall be resolved through binding arbitration in Wilmington, Delaware.

12. INDEMNIFICATION
12.1 Provider Indemnification: Provider shall indemnify Client against third-party claims arising from Provider's negligence or willful misconduct.
12.2 Client Indemnification: Client shall indemnify Provider against claims arising from Client's misuse of the platform.
12.3 Indemnification Process: The indemnified party must (a) provide prompt written notice of any claim within ten (10) business days, (b) grant the indemnifying party sole control of the defense, and (c) cooperate fully at the indemnifying party's expense. Failure to provide timely notice does not relieve the indemnifying party of its obligations unless materially prejudiced. The indemnifying party shall not settle any claim that imposes non-monetary obligations on the indemnified party without prior written consent.

13. NOTICES
All notices shall be delivered via certified mail or recognized overnight courier to the addresses listed in Exhibit A.

SIGNATURES:
_________________________
Acme Corporation

_________________________
ConnexUS Inc.`,
  },

  {
    filename: 'Vendor_Compliance_Policy_v3.2.pdf',
    title: 'Vendor Compliance Policy v3.2',
    mimeType: 'application/pdf',
    content: `VENDOR COMPLIANCE POLICY
Version 3.2 | Effective: March 1, 2025

1. PURPOSE
This policy establishes requirements for all third-party vendors accessing ConnexUS systems or handling ConnexUS data.

2. VENDOR CLASSIFICATION
2.1 Tier 1 (Critical): Vendors with access to PII or financial data
2.2 Tier 2 (Standard): Vendors with system access but no PII exposure
2.3 Tier 3 (Low Risk): Vendors with no direct system or data access

3. COMPLIANCE REQUIREMENTS
3.1 All Tier 1 vendors must maintain SOC 2 Type II certification
3.2 All vendors must complete annual security questionnaires
3.3 Background checks required for all vendor personnel with system access
3.4 Vendors must report security incidents within 24 hours
3.5 Annual penetration testing required for Tier 1 and Tier 2 vendors

4. DATA HANDLING
4.1 Encryption at rest: AES-256 minimum
4.2 Encryption in transit: TLS 1.2 minimum (TLS 1.3 preferred)
4.3 Data retention: Maximum 90 days after contract termination
4.4 Data destruction: Certificate of destruction required within 30 days

5. ACCESS CONTROL
5.1 Principle of least privilege for all vendor accounts
5.2 Multi-factor authentication mandatory
5.3 Quarterly access reviews
5.4 Immediate revocation upon contract termination

6. AUDIT RIGHTS
ConnexUS reserves the right to audit vendor compliance at any time with 30 days notice. Vendors must cooperate fully with audit requests.

7. NON-COMPLIANCE
Failure to comply with this policy may result in immediate contract termination and legal action.

Approved by: Chief Information Security Officer
Last Review: February 15, 2025
Next Review: August 15, 2025`,
  },

  {
    filename: 'HIPAA_BAA_Template.pdf',
    title: 'HIPAA Business Associate Agreement',
    mimeType: 'application/pdf',
    isPrivileged: true,
    content: `BUSINESS ASSOCIATE AGREEMENT
HIPAA Compliance Addendum

1. DEFINITIONS
1.1 "Protected Health Information" (PHI) means individually identifiable health information transmitted or maintained in any form.
1.2 "Business Associate" means ConnexUS Inc., which creates, receives, maintains, or transmits PHI on behalf of a Covered Entity.

2. OBLIGATIONS OF BUSINESS ASSOCIATE
2.1 Not use or disclose PHI other than as permitted by this Agreement
2.2 Implement administrative, physical, and technical safeguards
2.3 Report any unauthorized use or disclosure within 48 hours
2.4 Ensure subcontractors agree to same restrictions
2.5 Make PHI available for individual access rights requests within 15 business days
2.6 Maintain audit logs of all PHI access for minimum 6 years

3. PERMITTED USES AND DISCLOSURES
3.1 Performance of services under the Service Agreement
3.2 As required by law
3.3 For proper management and administration of Business Associate

4. SECURITY REQUIREMENTS
4.1 Encryption: AES-256 at rest, TLS 1.3 in transit
4.2 Access controls: Role-based, MFA required
4.3 Audit logging: All access recorded and retained 6 years
4.4 Risk assessments: Annual, with remediation plans
4.5 Workforce training: Annual HIPAA training for all staff with PHI access

5. BREACH NOTIFICATION
5.1 Discovery of breach: Notify Covered Entity within 48 hours
5.2 Content of notice: Description, types of information, steps taken, mitigation measures
5.3 Individual notification: Assist Covered Entity with required notifications

6. TERM AND TERMINATION
6.1 Agreement terminates when underlying service agreement ends
6.2 Upon termination, return or destroy all PHI within 30 days
6.3 If return/destruction not feasible, protections extend indefinitely

7. REGULATORY COMPLIANCE
Business Associate shall comply with HIPAA Privacy Rule (45 CFR Part 160 and Part 164), HITECH Act, and applicable state laws.`,
  },

  {
    filename: 'Q4_2025_Financial_Summary.pdf',
    title: 'Q4 2025 Financial Summary',
    mimeType: 'application/pdf',
    content: `CONNEXUS INC. — Q4 2025 FINANCIAL SUMMARY
Confidential | Prepared for Board Review

REVENUE METRICS
Annual Recurring Revenue (ARR): $374,000
Quarterly Revenue: $93,500
Monthly Recurring Revenue (MRR): $31,167
Revenue Growth (QoQ): 18.2%
Revenue Growth (YoY): 142%

PLATFORM METRICS
Active V-Reps: 38
Active Organizations: 14
Average Revenue Per Organization: $26,714/year
V-Rep Utilization Rate: 73%
Average Calls Per V-Rep: 847/month

COST STRUCTURE
Cloud Infrastructure (GCP): $4,200/month
AI/ML Compute (Vertex AI): $2,800/month
Voice Services (Deepgram): $1,100/month
Third-party APIs: $650/month
Total COGS: $8,750/month (28% of MRR)

GROSS MARGIN
Gross Margin: 72%
Target Gross Margin (Series A): 75%

CUSTOMER ACQUISITION
New Customers (Q4): 4
Churned Customers (Q4): 0
Net Revenue Retention: 118%
Customer Acquisition Cost (CAC): $2,100
Lifetime Value (LTV): $48,000
LTV/CAC Ratio: 22.9x

CASH POSITION
Cash on Hand: $180,000
Monthly Burn Rate: $28,000
Runway: 6.4 months

KEY WINS
1. Scale Agile Solutions signed — largest deal to date ($72K ARR)
2. HIPAA compliance certification achieved
3. WhatsApp integration launched (Mercury voice channel)
4. Zero churn for 3rd consecutive quarter

RISKS
1. Runway below 9-month target — fundraising priority
2. GCP costs increasing with V-Rep scale
3. Single-region deployment (us-east4) — DR plan needed`,
  },

  {
    filename: 'Engineering_Onboarding_Guide.pdf',
    title: 'Engineering Onboarding Guide',
    mimeType: 'application/pdf',
    content: `ENGINEERING ONBOARDING GUIDE
ConnexUS Inc. | Last Updated: January 2026

WELCOME TO THE TEAM

1. DEVELOPMENT ENVIRONMENT
1.1 Required tools: Node.js 22+, Go 1.25+, Docker, gcloud CLI
1.2 IDE: VS Code with recommended extensions (see .vscode/extensions.json)
1.3 Git workflow: Feature branches, squash merge to main

2. ARCHITECTURE OVERVIEW
2.1 Frontend: Next.js 14 (App Router) on Cloud Run
2.2 Backend: Go microservice on Cloud Run
2.3 Database: Cloud SQL PostgreSQL with pgvector
2.4 AI Pipeline: Vertex AI (Gemini 2.0 Flash + text-embedding-004)
2.5 Voice: Deepgram (STT + TTS) via WebSocket
2.6 Storage: GCS with CMEK encryption

3. KEY REPOSITORIES
3.1 ragbox-co: Frontend (Next.js) + Voice Server
3.2 ragbox-backend: Go backend (RAG pipeline, auth, CRUD)

4. LOCAL DEVELOPMENT
4.1 Clone repos and install dependencies
4.2 Copy .env.example to .env.local
4.3 Run: npm run dev:all (starts Next.js + voice server)
4.4 Backend: cd backend && go run cmd/server/main.go

5. DEPLOYMENT
5.1 Push to main triggers Cloud Build automatically
5.2 Frontend deploys to ragbox-app Cloud Run service
5.3 Backend deploys to ragbox-backend Cloud Run service
5.4 Database migrations run via prisma migrate deploy

6. TESTING
6.1 Unit tests: npm test / go test ./...
6.2 Integration tests: Require DATABASE_URL env var
6.3 E2E tests: npm run test:e2e (Playwright)
6.4 Coverage target: 80% minimum

7. CODE REVIEW PROCESS
7.1 All PRs require at least one approval
7.2 CI must pass (lint, type check, tests)
7.3 Security review required for auth/data changes

8. ON-CALL ROTATION
8.1 Weekly rotation among engineering team
8.2 PagerDuty for P1 alerts
8.3 Runbook at /docs/runbooks/

9. SECURITY
9.1 Never commit secrets — use GCP Secret Manager
9.2 All API endpoints require authentication
9.3 PII must be encrypted at rest and in transit
9.4 Annual security training mandatory`,
  },

  {
    filename: 'Data_Processing_Agreement_GDPR.pdf',
    title: 'Data Processing Agreement (GDPR)',
    mimeType: 'application/pdf',
    isPrivileged: true,
    content: `DATA PROCESSING AGREEMENT
Pursuant to Article 28 of Regulation (EU) 2016/679 (GDPR)

1. PARTIES
Data Controller: [Client Entity]
Data Processor: ConnexUS Inc.

2. SUBJECT MATTER AND DURATION
2.1 Nature of processing: Storage, retrieval, and AI analysis of business documents
2.2 Purpose: Providing RAG-based knowledge management services
2.3 Duration: Co-terminous with the Service Agreement
2.4 Categories of data subjects: Client employees, customers, business contacts
2.5 Types of personal data: Names, email addresses, phone numbers, job titles

3. PROCESSOR OBLIGATIONS
3.1 Process personal data only on documented instructions from Controller
3.2 Ensure confidentiality of processing personnel
3.3 Implement appropriate technical and organizational measures:
    - Encryption: AES-256 at rest, TLS 1.3 in transit
    - Access control: Role-based with MFA
    - Pseudonymization where feasible
    - Regular security testing
3.4 Assist Controller with data subject rights requests within 10 business days
3.5 Delete all personal data within 30 days of agreement termination
3.6 Make available all information necessary to demonstrate compliance

4. SUB-PROCESSORS
4.1 Current sub-processors: Google Cloud Platform (infrastructure), Deepgram (voice processing)
4.2 Prior written consent required for new sub-processors
4.3 Controller has 30 days to object to new sub-processors
4.4 Processor remains liable for sub-processor compliance

5. DATA TRANSFERS
5.1 Data processed in US-East4 (Google Cloud, Ashburn, Virginia)
5.2 EU-US Data Privacy Framework certification maintained
5.3 Standard Contractual Clauses available upon request

6. BREACH NOTIFICATION
6.1 Notify Controller within 48 hours of becoming aware of a breach
6.2 Provide: nature of breach, categories affected, likely consequences, measures taken

7. DATA PROTECTION IMPACT ASSESSMENTS
Processor shall assist Controller with DPIAs where processing is likely to result in high risk.

8. AUDIT RIGHTS
Controller may audit Processor's compliance annually with 30 days notice. Processor shall cooperate fully.`,
  },

  {
    filename: 'Scale_Agile_Partnership_Agreement.pdf',
    title: 'Scale Agile Solutions Partnership Agreement',
    mimeType: 'application/pdf',
    content: `PARTNERSHIP AGREEMENT

Between: Scale Agile Solutions LLC ("Partner") and ConnexUS Inc. ("Company")
Effective Date: November 1, 2025
Agreement Number: PA-2025-0008

1. PARTNERSHIP SCOPE
Partner shall serve as an authorized reseller and implementation partner for ConnexUS V-Rep technology in the insurance vertical.

2. TERRITORY
2.1 Exclusive territory: Southeast United States (FL, GA, AL, SC, NC, TN)
2.2 Non-exclusive: All other US states

3. REVENUE SHARE
3.1 Direct sales by Partner: 30% commission on first-year revenue
3.2 Renewal commission: 15% on years 2+
3.3 Implementation services: Partner retains 100% of professional services fees
3.4 Minimum annual commitment: $72,000 in referred revenue

4. OBLIGATIONS
4.1 Partner shall maintain at least 2 certified V-Rep implementation specialists
4.2 Partner shall complete quarterly business reviews
4.3 Company shall provide training, documentation, and sandbox environments
4.4 Company shall not solicit Partner's customers directly within the exclusive territory

5. INSURANCE VERTICAL REQUIREMENTS
5.1 V-Rep configurations for insurance carrier integrations
5.2 Compliance with state insurance regulations
5.3 Integration with Applied Epic, Vertafore AMS360, and HawkSoft
5.4 Real-time quote comparison across multiple carriers

6. PERFORMANCE METRICS
6.1 Minimum 4 new customer activations per quarter
6.2 Customer satisfaction score above 4.5/5.0
6.3 Implementation timeline within 30 days of contract signing

7. TERM
Initial term: 24 months, auto-renewing for successive 12-month periods.

8. TERMINATION
Either party may terminate with 90 days written notice. Commissions on existing customers survive termination for 12 months.`,
  },

  {
    filename: 'Platform_Security_Whitepaper.pdf',
    title: 'Platform Security Whitepaper',
    mimeType: 'application/pdf',
    content: `RAGBOX PLATFORM SECURITY WHITEPAPER
Version 2.0 | February 2026

EXECUTIVE SUMMARY
RAGbox is built with security-first architecture, designed to meet the stringent requirements of legal, financial, and healthcare organizations.

1. INFRASTRUCTURE SECURITY
1.1 Cloud Provider: Google Cloud Platform (GCP)
1.2 Region: us-east4 (Northern Virginia)
1.3 Network: VPC with private subnets, no public IP addresses on compute instances
1.4 WAF: Cloud Armor with OWASP Top 10 rule sets
1.5 DDoS Protection: GCP native DDoS mitigation

2. DATA ENCRYPTION
2.1 At Rest: AES-256 via Customer-Managed Encryption Keys (CMEK)
2.2 In Transit: TLS 1.3 for all connections
2.3 Key Management: Cloud KMS with automatic key rotation every 90 days
2.4 Database: Column-level encryption for PII fields

3. AUTHENTICATION & AUTHORIZATION
3.1 Identity Provider: Firebase Authentication
3.2 Session Management: JWT with 30-minute expiry, refresh tokens
3.3 MFA: TOTP-based two-factor authentication
3.4 Role-Based Access: Partner, Associate, Auditor roles with granular permissions
3.5 Privilege Mode: Binary toggle for attorney-client privilege protection

4. DOCUMENT PROCESSING SECURITY
4.1 Upload: Virus scanning via Cloud DLP
4.2 Processing: Document AI in isolated environment
4.3 PII Detection: Automatic redaction of SSN, credit cards, phone numbers
4.4 Chunking: SHA-256 content hashing for integrity verification

5. RAG PIPELINE SECURITY
5.1 Vector embeddings stored in pgvector (no raw text in vector DB)
5.2 Query filtering by user permissions before vector search
5.3 Privilege-aware retrieval: Privileged chunks excluded in normal mode
5.4 Confidence threshold: Silence Protocol triggers below 85%

6. AUDIT & COMPLIANCE
6.1 Immutable audit log: SHA-256 hash chain (SEC 17a-4 WORM-compatible)
6.2 All access logged: User, action, resource, timestamp, IP address
6.3 BigQuery export for long-term retention
6.4 Audit log export: PDF reports for regulators
6.5 Data retention: 7 years default, configurable per organization

7. COMPLIANCE CERTIFICATIONS
7.1 SOC 2 Type II (in progress)
7.2 HIPAA BAA available
7.3 GDPR compliant (DPA available)
7.4 CCPA compliant

8. INCIDENT RESPONSE
8.1 24/7 monitoring via Prometheus + Grafana
8.2 Automated alerting for anomalous access patterns
8.3 Incident response plan with 4-hour SLA for P1 issues
8.4 Post-incident review within 48 hours`,
  },

  {
    filename: 'Customer_Success_Playbook.pdf',
    title: 'Customer Success Playbook',
    mimeType: 'application/pdf',
    content: `CUSTOMER SUCCESS PLAYBOOK
ConnexUS Inc. | Q1 2026 Edition

1. ONBOARDING (Days 1-30)
1.1 Day 1: Welcome call, account setup, admin training
1.2 Day 3: Initial V-Rep configuration workshop
1.3 Day 7: First V-Rep goes live (supervised)
1.4 Day 14: Full V-Rep fleet deployment
1.5 Day 30: First business review, KPI baseline established

2. ADOPTION (Days 31-90)
2.1 Weekly check-ins for first month
2.2 Bi-weekly check-ins for months 2-3
2.3 Custom dashboard setup for client KPIs
2.4 Integration with existing CRM (Salesforce, HubSpot)
2.5 Training materials customized per organization

3. EXPANSION (Days 91+)
3.1 Quarterly business reviews
3.2 Usage analytics review
3.3 ROI calculation and reporting
3.4 Upsell opportunities: Additional V-Reps, premium features, voice channels
3.5 Referral program activation

4. HEALTH SCORING
4.1 Green (Healthy): >80% utilization, regular logins, positive CSAT
4.2 Yellow (At Risk): 50-80% utilization, declining engagement
4.3 Red (Critical): <50% utilization, support escalations, contract questions

5. ESCALATION PROCESS
5.1 CSM identifies risk signal
5.2 Internal sync with Sales and Product
5.3 Executive sponsor engagement if needed
5.4 Action plan within 48 hours
5.5 Weekly monitoring until Green status restored

6. CHURN PREVENTION
6.1 90-day early warning system
6.2 Proactive feature training
6.3 Custom integration development
6.4 Flexible contract terms for at-risk accounts
6.5 Executive relationship building

7. KEY METRICS
7.1 Net Revenue Retention target: >110%
7.2 Gross Retention target: >95%
7.3 Time to Value: <14 days
7.4 CSAT target: >4.5/5.0
7.5 NPS target: >50`,
  },

  {
    filename: 'Insurance_Carrier_Integration_Spec.pdf',
    title: 'Insurance Carrier Integration Specification',
    mimeType: 'application/pdf',
    content: `INSURANCE CARRIER INTEGRATION SPECIFICATION
ConnexUS V-Rep Platform | Version 1.4

1. OVERVIEW
This specification defines the technical requirements for integrating V-Reps with insurance carrier quoting and policy management systems.

2. SUPPORTED CARRIERS
2.1 Progressive Commercial: REST API v3
2.2 Hartford: SOAP/XML, ACORD AL3 format
2.3 Travelers: REST API v2, OAuth 2.0
2.4 Liberty Mutual: REST API, API key auth
2.5 Nationwide: ACORD XML, certificate-based auth
2.6 AmTrust: REST API v1

3. INTEGRATION ARCHITECTURE
3.1 V-Rep collects prospect information via voice conversation
3.2 Data normalized to ACORD standard format
3.3 Parallel quote requests to configured carriers
3.4 Response aggregation and comparison
3.5 V-Rep presents top 3 options to prospect

4. DATA MAPPING
4.1 Business Classification: NAICS to carrier-specific codes
4.2 Coverage Types: GL, BOP, WC, Commercial Auto, Umbrella
4.3 Premium Calculation: Annual, monthly, quarterly payment options
4.4 Effective dates: Configurable start date, standard 12-month policy term

5. API RATE LIMITS
5.1 Progressive: 100 requests/minute
5.2 Hartford: 50 requests/minute
5.3 Travelers: 200 requests/minute
5.4 Liberty Mutual: 150 requests/minute
5.5 Nationwide: 75 requests/minute

6. ERROR HANDLING
6.1 Timeout: 30 seconds per carrier
6.2 Retry: Up to 3 attempts with exponential backoff
6.3 Fallback: If carrier unavailable, V-Rep informs prospect and schedules callback
6.4 Logging: All API interactions logged for compliance

7. VOICE RECORDING POLICY
7.1 All V-Rep conversations recorded for compliance
7.2 Recordings stored in GCS with CMEK encryption
7.3 Retention period: 7 years (state insurance regulation minimum)
7.4 Access: Authorized personnel only, audit-logged

8. COMPLIANCE
8.1 State licensing requirements verified per transaction
8.2 Disclosure scripts read before quoting
8.3 Do-not-call list integration
8.4 E-consent for electronic delivery of documents`,
  },
]

// ============================================================================
// 4 CONTENT GAPS
// ============================================================================

export const DEMO_CONTENT_GAPS: DemoContentGap[] = [
  {
    queryText: 'What is the SLA for priority 1 incidents?',
    occurrences: 3,
    confidenceScore: 0.92,
    suggestedTopics: ['SLA Policy', 'Incident Response', 'Service Level Agreement'],
  },
  {
    queryText: 'What is the data retention policy for voice recordings?',
    occurrences: 2,
    confidenceScore: 0.87,
    suggestedTopics: ['Voice Recording Policy', 'Data Retention', 'Compliance'],
  },
  {
    queryText: 'How do I reset my API key?',
    occurrences: 2,
    confidenceScore: 0.78,
    suggestedTopics: ['API Key Management', 'Self-Service', 'Developer Documentation'],
  },
  {
    queryText: 'What happens if my V-Rep exceeds the monthly call limit?',
    occurrences: 1,
    confidenceScore: 0.71,
    suggestedTopics: ['V-Rep Limits', 'Overage Charges', 'Usage Policy'],
  },
]
