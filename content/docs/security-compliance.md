# The Fortress Architecture

> *"Your secrets are our profession. We guard them with our infrastructure."*

RAGbox was designed from the ground up for industries where data breaches are not just embarrassing — they're catastrophic. Legal. Financial. Healthcare. Government.

---

## Encryption

### At Rest
- **Algorithm:** AES-256-GCM
- **Key Management:** Google Cloud KMS with automatic rotation
- **Scope:** All documents, embeddings, and metadata

### In Transit
- **Protocol:** TLS 1.3 (minimum)
- **Cipher Suites:** ECDHE+AESGCM only
- **Certificate:** Let's Encrypt with HSTS preloading

### Customer-Managed Keys (Enterprise)
Bring your own encryption keys via Cloud KMS integration. We never see your keys.

---

## Compliance Certifications

| Framework | Status | Scope |
|-----------|--------|-------|
| **SOC 2 Type II** | Certified | Full platform |
| **HIPAA** | BAA Available | Healthcare clients |
| **GDPR** | Compliant | EU data processing |
| **CCPA** | Compliant | California residents |
| **FedRAMP** | In Progress | Government clients |

### Audit Reports
SOC 2 reports available upon request via signed NDA.

---

## Data Residency

### Available Regions:
- **US-Central1** (Iowa) — Default
- **US-East4** (Virginia)
- **Europe-West1** (Belgium) — GDPR-friendly
- **Asia-Northeast1** (Tokyo)

### Data Isolation:
- Each tenant operates in isolated compute and storage
- No shared vector databases
- Network-level isolation via VPC Service Controls

---

## Zero Retention Policy

**We do not train on your data. Period.**

- Your documents are never used for model training
- Query logs are retained for 30 days (configurable)
- Full data deletion available on request

### Data Deletion:
```bash
# Request full data purge
curl -X DELETE https://api.ragbox.co/v1/account/data \
  -H "Authorization: Bearer sk-ragbox-xxx" \
  -d '{"confirm": true}'
```

Data is purged within 72 hours, with cryptographic proof of deletion.

---

## Immutable Audit Ledger

Every action in RAGbox is logged to a tamper-proof audit system.

### What We Log:
- Document uploads and deletions
- Query submissions and responses
- Privileged mode activations
- API key usage
- Login attempts and session changes

### Log Format:
```json
{
  "timestamp": "2024-01-15T14:32:07.123Z",
  "actor": "user_abc123",
  "action": "DOCUMENT_ACCESS",
  "resource": "doc_xyz789",
  "privileged": true,
  "ip": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "signature": "sha256:abc123..."
}
```

### Log Retention:
- Standard: 1 year
- Compliance: 7 years
- Legal Hold: Indefinite

### Export Options:
- JSON (raw)
- PDF (formatted, with attestation)
- SIEM integration (Splunk, Datadog)

---

## Access Controls

### Role-Based Access (RBAC):
| Role | Capabilities |
|------|-------------|
| Viewer | Read documents, run queries |
| Analyst | Upload documents, create artifacts |
| Admin | Manage users, access privileged docs |
| Owner | Full control, billing, API keys |

### Privilege Mode:
Attorney-client privileged documents are segregated by default. Only Admins+ can activate Privilege Mode, and every access is logged.

### Multi-Factor Authentication:
- TOTP (Google Authenticator, Authy)
- Hardware keys (YubiKey, FIDO2)
- SMS (not recommended, but available)

---

## Infrastructure Security

### Cloud Provider:
Google Cloud Platform (GCP) with:
- ISO 27001, 27017, 27018 certified
- PCI DSS Level 1 compliant
- 99.99% SLA uptime

### Network Security:
- Cloud Armor WAF
- DDoS protection (L3/L4 and L7)
- Private Service Connect for enterprise

### Vulnerability Management:
- Automated dependency scanning
- Weekly penetration testing
- Bug bounty program (invite-only)

---

## Incident Response

### Response Timeline:
| Severity | Response | Resolution Target |
|----------|----------|------------------|
| Critical | 15 min | 4 hours |
| High | 1 hour | 24 hours |
| Medium | 4 hours | 72 hours |
| Low | 24 hours | Best effort |

### Breach Notification:
In compliance with GDPR Article 33, affected parties notified within 72 hours.

---

## Security Contacts

- **Security Team:** security@ragbox.co
- **Bug Bounty:** bounty@ragbox.co
- **Compliance Inquiries:** compliance@ragbox.co
- **Emergency Hotline:** +1 (888) 555-7284

---

*Your data fortress stands ready. We take the bullets so you don't have to.*
