// src/app/api/documents/extract/route.ts
import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'
import { storageClient } from '@/lib/gcp/storage-client'

// Runtime configuration for Node.js
export const runtime = 'nodejs'
export const maxDuration = 60

async function getUserId() {
  const { cookies } = await import('next/headers')
  const sessionCookie = (await cookies()).get('session')
  return sessionCookie?.value ? sessionCookie.value : 'demo_user'
}

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // Dynamic import for pdf-parse (handles both CJS and ESM)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParseModule = require('pdf-parse')
  const pdfParse = pdfParseModule.default || pdfParseModule
  const data = await pdfParse(buffer)
  return data.text
}

async function extractText(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  // Plain text and CSV
  if (
    mimeType === 'text/plain' ||
    fileName.endsWith('.txt') ||
    mimeType === 'text/csv' ||
    fileName.endsWith('.csv')
  ) {
    return buffer.toString('utf-8')
  }

  // PDF
  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
    try {
      return await extractTextFromPDF(buffer)
    } catch (error) {
      console.error('[Extract] PDF parse error:', error)
      throw new Error('Failed to extract text from PDF')
    }
  }

  // DOCX
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileName.endsWith('.docx')
  ) {
    try {
      const result = await mammoth.extractRawText({ buffer })
      return result.value
    } catch (error) {
      console.error('[Extract] DOCX parse error:', error)
      throw new Error('Failed to extract text from DOCX')
    }
  }

  // Legacy DOC
  if (mimeType === 'application/msword' || fileName.endsWith('.doc')) {
    return `[Document: ${fileName}] - Legacy .doc format. Please convert to .docx for full text extraction.`
  }

  // Markdown and JSON
  if (
    mimeType === 'text/markdown' ||
    fileName.endsWith('.md') ||
    mimeType === 'application/json' ||
    fileName.endsWith('.json')
  ) {
    return buffer.toString('utf-8')
  }

  // Excel files
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel' ||
    fileName.endsWith('.xlsx') ||
    fileName.endsWith('.xls')
  ) {
    return `[Spreadsheet: ${fileName}] - Excel file detected. For full text extraction, export as CSV.`
  }

  // Unsupported format
  return `[File: ${fileName}] - Unsupported format (${mimeType}). Supported: PDF, DOCX, TXT, CSV, MD, JSON`
}

function splitTextIntoChunks(
  text: string,
  chunkSize: number,
  overlapSize: number
): string[] {
  if (!text || text.length === 0) return []
  if (text.length <= chunkSize) return [text]

  const chunks: string[] = []
  let startIndex = 0

  while (startIndex < text.length) {
    let endIndex = startIndex + chunkSize

    // Try to break at natural boundaries
    if (endIndex < text.length) {
      const breakPoints = ['\n\n', '\n', '. ', '! ', '? ']
      for (const breakPoint of breakPoints) {
        const lastBreak = text.lastIndexOf(breakPoint, endIndex)
        if (lastBreak > startIndex + chunkSize / 2) {
          endIndex = lastBreak + breakPoint.length
          break
        }
      }
    }

    chunks.push(text.slice(startIndex, endIndex).trim())

    // Move forward with overlap
    startIndex = endIndex - overlapSize
    if (startIndex >= text.length - overlapSize) break
  }

  return chunks.filter((chunk) => chunk.length > 0)
}

/**
 * POST /api/documents/extract
 *
 * Extracts text content from uploaded files (PDF, DOCX, TXT)
 * Uploads original file to GCS, returns extracted text for RAG indexing
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // File size limit: 100MB
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 100MB' },
        { status: 413 }
      )
    }

    console.log(`[Extract] Processing: ${file.name} (${file.type}, ${file.size} bytes)`)

    // Read file into Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Get user ID for GCS path
    const userId = await getUserId()

    // Upload to GCS
    let gcsUri: string | undefined
    let storagePath: string | undefined
    try {
      const uploadResult = await storageClient.uploadFile(
        buffer,
        file.name,
        file.type || 'application/octet-stream',
        userId
      )
      gcsUri = uploadResult.gcsUri
      storagePath = uploadResult.gcsUri
      console.log(`[Extract] Uploaded to GCS: ${gcsUri}`)
    } catch (gcsError) {
      console.error('[Extract] GCS upload failed (continuing with extraction):', gcsError)
    }

    // Extract text
    const extractedText = await extractText(buffer, file.type, file.name)

    // Split into chunks for RAG
    const chunks = splitTextIntoChunks(extractedText, 2000, 200)

    console.log(
      `[Extract] Extracted ${extractedText.length} chars, ${chunks.length} chunks from ${file.name}`
    )

    return NextResponse.json({
      success: true,
      data: {
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        textLength: extractedText.length,
        text: extractedText,
        chunks,
        chunkCount: chunks.length,
        gcsUri,
        storagePath,
      },
    })
  } catch (error: unknown) {
    console.error('[Extract] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
