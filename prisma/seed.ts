import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('[Seed] Starting seed...')

  // Create demo user
  const user = await prisma.user.upsert({
    where: { email: 'demo@ragbox.co' },
    update: {},
    create: {
      email: 'demo@ragbox.co',
      name: 'Demo User',
    },
  })
  console.log('[Seed] User:', user.email)

  // Create vault
  const vault = await prisma.vault.upsert({
    where: { id: 'vault_demo_001' },
    update: {},
    create: {
      id: 'vault_demo_001',
      name: 'Legal Documents',
      status: 'open',
      userId: user.id,
    },
  })
  console.log('[Seed] Vault:', vault.name)

  // Create demo documents
  const documents = [
    {
      id: 'doc_seed_001',
      filename: 'NDA_Acme_Corp_2025.pdf',
      originalName: 'NDA_Acme_Corp_2025.pdf',
      mimeType: 'application/pdf',
      fileType: 'application/pdf',
      sizeBytes: 245000,
      indexStatus: 'Indexed' as const,
      extractedText: `NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into as of January 15, 2025,
by and between Acme Corporation ("Disclosing Party") and RAGbox Inc. ("Receiving Party").

1. DEFINITION OF CONFIDENTIAL INFORMATION
"Confidential Information" means any data or information, oral or written, that is
treated as confidential including trade secrets, financial data, business strategies,
customer lists, and proprietary technology.

2. OBLIGATIONS OF RECEIVING PARTY
The Receiving Party agrees to:
(a) Hold all Confidential Information in strict confidence
(b) Not disclose Confidential Information to any third parties
(c) Use Confidential Information solely for the purpose of evaluating a business relationship

3. TERM
This Agreement shall remain in effect for a period of three (3) years from the date
of execution.

4. REMEDIES
The Receiving Party acknowledges that any breach may cause irreparable harm and that
the Disclosing Party shall be entitled to seek equitable relief.`,
      securityTier: 2,
      userId: user.id,
      vaultId: vault.id,
    },
    {
      id: 'doc_seed_002',
      filename: 'Q4_2024_Financial_Summary.pdf',
      originalName: 'Q4_2024_Financial_Summary.pdf',
      mimeType: 'application/pdf',
      fileType: 'application/pdf',
      sizeBytes: 180000,
      indexStatus: 'Indexed' as const,
      extractedText: `Q4 2024 FINANCIAL SUMMARY

Revenue: $4.2M (up 23% YoY)
Operating Expenses: $2.8M
Net Income: $1.4M
Cash Position: $8.7M

Key Highlights:
- Enterprise client count grew from 45 to 67 (+49%)
- Monthly recurring revenue reached $350K
- Customer acquisition cost decreased by 15%
- Annual retention rate: 94%

Segment Breakdown:
Legal sector: $1.8M (43% of revenue)
Financial services: $1.2M (29%)
Healthcare: $0.7M (17%)
Other: $0.5M (11%)

Forecast: Q1 2025 revenue projected at $4.8M based on current pipeline.`,
      securityTier: 3,
      userId: user.id,
      vaultId: vault.id,
    },
    {
      id: 'doc_seed_003',
      filename: 'Employee_Handbook_2025.docx',
      originalName: 'Employee_Handbook_2025.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: 520000,
      indexStatus: 'Indexed' as const,
      extractedText: `EMPLOYEE HANDBOOK 2025

SECTION 1: EMPLOYMENT POLICIES
1.1 Equal Opportunity - We are committed to equal employment opportunity.
1.2 At-Will Employment - Employment is at-will unless otherwise agreed in writing.
1.3 Code of Conduct - All employees must adhere to professional standards.

SECTION 2: COMPENSATION & BENEFITS
2.1 Pay Schedule - Bi-weekly on Fridays
2.2 Health Insurance - Medical, dental, vision provided after 30 days
2.3 401(k) - Company matches up to 4% of salary
2.4 PTO - 20 days annually, accrued monthly

SECTION 3: REMOTE WORK POLICY
3.1 Eligibility - All roles unless explicitly designated on-site
3.2 Equipment - Company provides laptop, monitor, and $500 home office stipend
3.3 Working Hours - Core hours 10am-3pm local time, flexible otherwise

SECTION 4: DATA SECURITY
4.1 All company data must be stored on approved platforms
4.2 Two-factor authentication is mandatory
4.3 Report security incidents to security@company.com within 24 hours`,
      securityTier: 1,
      userId: user.id,
      vaultId: vault.id,
    },
  ]

  for (const doc of documents) {
    await prisma.document.upsert({
      where: { id: doc.id },
      update: {},
      create: doc,
    })
    console.log('[Seed] Document:', doc.filename)
  }

  // Create a folder
  await prisma.folder.upsert({
    where: { id: 'folder_seed_001' },
    update: {},
    create: {
      id: 'folder_seed_001',
      name: 'Contracts',
      userId: user.id,
    },
  })
  console.log('[Seed] Folder: Contracts')

  // Create a template
  await prisma.template.upsert({
    where: { id: 'tmpl_seed_001' },
    update: {},
    create: {
      id: 'tmpl_seed_001',
      name: 'Standard NDA',
      category: 'legal',
      userId: user.id,
      fields: JSON.parse(JSON.stringify([
        { name: 'Disclosing Party', type: 'text', required: true },
        { name: 'Receiving Party', type: 'text', required: true },
        { name: 'Effective Date', type: 'date', required: true },
        { name: 'Term (Years)', type: 'number', required: true, defaultValue: '3' },
        { name: 'Governing Law State', type: 'text', required: false, placeholder: 'e.g. Delaware' },
      ])),
      sections: JSON.parse(JSON.stringify([
        { name: 'Definitions', order: 0, content: 'Define confidential information scope' },
        { name: 'Obligations', order: 1, content: 'Receiving party obligations' },
        { name: 'Term & Termination', order: 2, content: 'Agreement duration and exit' },
        { name: 'Remedies', order: 3, content: 'Breach remedies and enforcement' },
      ])),
      structure: JSON.parse(JSON.stringify({
        pageCount: 3,
        hasHeader: true,
        hasFooter: true,
        hasSignatureBlock: true,
        layout: 'legal',
      })),
      confidence: 0.92,
    },
  })
  console.log('[Seed] Template: Standard NDA')

  console.log('[Seed] Done.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('[Seed] Error:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
