/**
 * Document Text Extraction API
 *
 * POST /api/documents/extract
 *
 * Extracts text content from uploaded files (PDF, DOCX, TXT)
 * Uploads original file to GCS, returns extracted text for RAG indexing
 */

import { NextRequest, NextResponse } from 'next/server'
import { PDFParse } from 'pdf-parse'
import * as mammothModule from 'mammoth'
import { storageClient } from '@/lib/gcp/storage-client'
import { cookies } from 'next/headers'

const mammoth = (mammothModule as unknown as { default?: typeof mammothModule }).default || mammothModule

export const runtime = 'nodejs'

const MAX_FILE_SIZE = 10 * 1024 * 1024

async function getUserId(): Promise<string> {
  const sessionCookie = (await cookies()).get('session')
  if (sessionCookie?.value) {
    return sessionCookie.value
  }
  return 'demo_user'
}

async function extractText(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
  if (mimeType === 'text/plain' || fileName.endsWith('.txt')) {
    return buffer.toString('utf-8')
  }

  if (mimeType === 'text/csv' || fileName.endsWith('.csv')) {
    return buffer.toString('utf-8')
  }

  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
    try {
      const uint8Array = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
      const pdfParser = new PDFParse(uint8Array)
      const pdfData = await pdfParser.getText()
      return pdfData.text
    } catch (error) {
      console.error('[Extract] PDF parse error:', error)
      throw new Error('Failed to extract text from PDF')
    }
  }

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

  if (mimeType === 'application/msword' || fileName.endsWith('.doc')) {
    return `[Document: ${fileName}] - Legacy .doc format. Please convert to .docx for full text extraction.`
  }

  if (mimeType === 'text/markdown' || fileName.endsWith('.md')) {
    return buffer.toString('utf-8')
  }

  if (mimeType === 'application/json' || fileName.endsWith('.json')) {
    return buffer.toString('utf-8')
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel' ||
    fileName.endsWith('.xlsx') ||
    fileName.endsWith('.xls')
  ) {
    return `[Spreadsheet: ${fileName}] - Excel file detected. For full text extraction, export as CSV.`
  }

  return `[File: ${fileName}] - Unsupported format (${mimeType}). Supported: PDF, DOCX, TXT, CSV, MD, JSON`
}

/**
 * POST /api/documents/extract
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

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 413 }
      )
    }

    console.log(`[Extract] Processing: ${file.name} (${file.type}, ${file.size} bytes)`)

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload original file to GCS
    let gcsUri: string | undefined
    let storagePath: string | undefined
    const userId = await getUserId()

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
    const chunks = chunkText(extractedText, 2000, 200)

    console.log(`[Extract] Extracted ${extractedText.length} chars, ${chunks.length} chunks from ${file.name}`)

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
  } catch (error) {
    console.error('[Extract] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

/**
 * Split text into overlapping chunks for RAG retrieval
 */
function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  if (!text || text.length === 0) return []
  if (text.length <= chunkSize) return [text]

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = start + chunkSize

    if (end < text.length) {
      const breakPoints = ['\n\n', '\n', '. ', '! ', '? ']
      for (const breakPoint of breakPoints) {
        const lastBreak = text.lastIndexOf(breakPoint, end)
        if (lastBreak > start + chunkSize / 2) {
          end = lastBreak + breakPoint.length
          break
        }
      }
    }

    chunks.push(text.slice(start, end).trim())
    start = end - overlap

    if (start >= text.length - overlap) break
  }

  return chunks.filter(chunk => chunk.length > 0)
}
