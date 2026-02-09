# Tactical Prompting

> *"A precision query extracts more truth than a thousand vague questions."*

Mercury is not a search engine. She is an interrogation specialist. The quality of your intelligence depends on the precision of your prompts.

---

## The Interrogator's Framework

### 1. Be Specific, Not General

**Weak:**
> "Tell me about the contract"

**Strong:**
> "What are the liability limitations in Section 7.2 of the Acme Services Agreement dated March 2024?"

**Why it works:** Mercury can pinpoint exact clauses instead of summarizing the entire document.

---

### 2. Specify Your Output Format

**Weak:**
> "What are the key risks?"

**Strong:**
> "List the top 5 financial risks mentioned in the Q3 report, formatted as bullet points with page references."

**Why it works:** You control the structure of the response.

---

### 3. Use Operational Modes

RAGbox supports specialized interrogation modes for different scenarios:

#### Forensic Audit Mode
*Best for: Financial discrepancies, compliance violations, fraud detection*

```
[FORENSIC AUDIT]
Analyze all expense reports from Q2 2024.
Flag any entries exceeding $10,000 without dual approval.
Cross-reference against the Travel Policy v3.
```

#### Whistleblower Mode
*Best for: Anomaly detection, hidden patterns, unusual behavior*

```
[WHISTLEBLOWER]
Scan all email attachments from the legal folder.
Identify any documents modified after their stated "final" date.
Report discrepancies with timestamps.
```

#### Executive Brief Mode
*Best for: Board summaries, investor updates, C-suite communication*

```
[EXECUTIVE BRIEF]
Summarize the M&A due diligence findings.
Maximum 3 paragraphs. No jargon.
Include go/no-go recommendation.
```

---

## Document Preparation

### Upload Clean PDFs

Mercury's accuracy depends on document quality.

**Best Practices:**
- Use OCR-processed PDFs (not image-only scans)
- Remove password protection before upload
- Split large documents (>200 pages) into logical sections
- Use descriptive filenames: `Acme_NDA_2024-03-15.pdf`

**Avoid:**
- Handwritten notes (unless OCR'd)
- Screenshots of text
- Watermarked documents (interferes with parsing)

### Organize with Folders

Structure your Vault for efficient retrieval:

```
Vault/
├── Contracts/
│   ├── Active/
│   └── Archived/
├── Financial Reports/
│   ├── Quarterly/
│   └── Annual/
├── Legal/
│   ├── Litigation/
│   └── Compliance/
└── HR/
    ├── Policies/
    └── Employee Files/
```

---

## Query Patterns That Win

### Pattern 1: The Comparative
*Find differences between documents*

```
Compare the indemnification clauses between:
- Vendor Agreement v1 (January)
- Vendor Agreement v2 (March)
Highlight all material changes.
```

### Pattern 2: The Timeline
*Build chronological understanding*

```
Create a timeline of all communications between
our legal team and Acme Corp regarding the
patent dispute, sorted by date.
```

### Pattern 3: The Red Flag Hunter
*Proactive risk identification*

```
Scan all active contracts and flag any that:
- Expire within 90 days
- Contain auto-renewal clauses
- Have uncapped liability
```

### Pattern 4: The Cross-Reference
*Find connections across documents*

```
Find all mentions of "Force Majeure" across
our entire contract portfolio. Group by:
- Trigger events defined
- Notice periods required
- Termination rights granted
```

### Pattern 5: The Contradiction Finder
*Identify inconsistencies*

```
Compare the claims in our Marketing Materials folder
against the technical specifications in the Product Docs folder.
Flag any statements that contradict the specs.
```

---

## Working with Citations

Mercury provides inline citations like `[1]`, `[2]`, `[3]`.

### Best Practices:
- **Click citations** to jump to source passages
- **Verify critical claims** by reading the original context
- **Export with citations** for audit trails

### Citation Format in Artifacts:
When generating reports, citations are automatically formatted as footnotes with full document references.

---

## Privilege Mode Protocol

When working with attorney-client privileged documents:

1. **Toggle Privilege Mode ON** (gold key icon)
2. **Screen border pulses** to remind you of elevated access
3. **All queries are logged** to the Immutable Audit Ledger
4. **Toggle OFF immediately** when done
5. **Never screenshot** privileged results

---

## Performance Tips

### Speed Up Responses:
- Query specific documents by name rather than entire Vault
- Use filters: `In the Acme contract specifically, what...`
- Prefer closed questions over open-ended exploration

### Improve Accuracy:
- Provide context: `Given that we're in litigation with Acme...`
- Specify time frames: `Based on documents from 2024...`
- Ask for confidence scores: `Rate your certainty 1-10`

---

## Common Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| Vague queries | Mercury guesses what you want | Be specific |
| Uploading scans | Text extraction fails | Use OCR first |
| Ignoring citations | Can't verify claims | Always check sources |
| Leaving Privilege on | Unnecessary audit entries | Toggle off when done |
| One mega-document | Slow processing, poor chunking | Split into sections |

---

## Advanced: Custom System Prompts

Enterprise users can configure persistent system prompts:

```json
{
  "system_prompt": "You are a legal analyst specializing in M&A transactions. Always cite Delaware corporate law when relevant. Flag any anti-trust concerns proactively.",
  "temperature": 0.2,
  "citation_style": "legal_bluebook"
}
```

Contact your account manager to enable custom prompts.

---

*Master these techniques, and Mercury becomes an extension of your mind.*
