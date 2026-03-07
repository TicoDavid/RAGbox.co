#!/usr/bin/env node
/**
 * Ingest 8 legal PDFs into RAGbox via the Go backend API.
 * Usage: node scripts/ingest-legal-pdfs.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const GO_BACKEND = process.env.GO_BACKEND_URL || 'https://ragbox-backend-100739220279.us-east4.run.app'
const AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET || ''
const USER_ID = process.env.SEED_USER_ID || '105836695160618550214'

const PDF_DIR = path.resolve(__dirname, '..', 'public', 'demo', 'legal-vault')

const PDFS = [
  '01_Mutual_NDA.pdf',
  '02_Commercial_Lease.pdf',
  '03_Client_Engagement_Letter.pdf',
  '04_Employment_Agreement.pdf',
  '05_LLC_Operating_Agreement.pdf',
  '06_Data_Processing_Agreement.pdf',
  '07_Consulting_Services_Agreement.pdf',
  '08_Compliance_Policy_Manual.pdf',
]

async function uploadPDF(filename) {
  const filePath = path.join(PDF_DIR, filename)
  const fileBuffer = fs.readFileSync(filePath)
  const sizeBytes = fileBuffer.length

  // Step 1: Get signed upload URL + create document record
  console.log(`\n[1/3] Creating document record for ${filename} (${sizeBytes} bytes)...`)
  const extractRes = await fetch(`${GO_BACKEND}/api/documents/extract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Auth': AUTH_SECRET,
      'X-User-ID': USER_ID,
    },
    body: JSON.stringify({
      filename,
      contentType: 'application/pdf',
      sizeBytes,
    }),
  })

  if (!extractRes.ok) {
    const errText = await extractRes.text()
    throw new Error(`Extract failed (${extractRes.status}): ${errText}`)
  }

  const extractData = await extractRes.json()
  const { url: signedUrl, documentId } = extractData.data
  console.log(`    Document ID: ${documentId}`)

  // Step 2: Upload PDF binary to GCS via signed URL
  console.log(`[2/3] Uploading to GCS...`)
  const uploadRes = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    body: fileBuffer,
  })

  if (!uploadRes.ok) {
    const errText = await uploadRes.text()
    throw new Error(`GCS upload failed (${uploadRes.status}): ${errText}`)
  }
  console.log(`    GCS upload: OK`)

  // Step 3: Trigger ingestion pipeline
  console.log(`[3/3] Triggering pipeline...`)
  const ingestRes = await fetch(`${GO_BACKEND}/api/documents/${documentId}/ingest`, {
    method: 'POST',
    headers: {
      'X-Internal-Auth': AUTH_SECRET,
      'X-User-ID': USER_ID,
      'Content-Length': '0',
    },
  })

  if (!ingestRes.ok) {
    const errText = await ingestRes.text()
    throw new Error(`Ingest trigger failed (${ingestRes.status}): ${errText}`)
  }

  const ingestData = await ingestRes.json()
  console.log(`    Pipeline status: ${ingestData.data?.status || 'triggered'}`)

  return { filename, documentId, sizeBytes }
}

async function main() {
  if (!AUTH_SECRET) {
    console.error('ERROR: INTERNAL_AUTH_SECRET env var required')
    process.exit(1)
  }

  console.log('=== RAGbox Legal PDF Ingestion ===')
  console.log(`Backend: ${GO_BACKEND}`)
  console.log(`User ID: ${USER_ID}`)
  console.log(`PDF Dir: ${PDF_DIR}`)
  console.log(`PDFs:    ${PDFS.length}`)

  const results = []

  for (const pdf of PDFS) {
    try {
      const result = await uploadPDF(pdf)
      results.push({ ...result, status: 'OK' })
    } catch (error) {
      console.error(`  ERROR: ${error.message}`)
      results.push({ filename: pdf, status: 'FAILED', error: error.message })
    }
  }

  console.log('\n=== Summary ===')
  console.log('File                                    | ID                                   | Status')
  console.log('-'.repeat(95))
  for (const r of results) {
    const name = r.filename.padEnd(39)
    const id = (r.documentId || 'N/A').padEnd(36)
    console.log(`${name} | ${id} | ${r.status}`)
  }

  const ok = results.filter(r => r.status === 'OK').length
  const failed = results.filter(r => r.status === 'FAILED').length
  console.log(`\nTotal: ${ok} OK, ${failed} FAILED`)
}

main().catch(console.error)
