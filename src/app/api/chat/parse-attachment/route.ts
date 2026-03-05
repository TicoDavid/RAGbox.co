/**
 * POST /api/chat/parse-attachment
 *
 * Accepts a file upload (multipart/form-data), extracts text content,
 * and returns it. Used for ephemeral inline context injection via the
 * chat paperclip — nothing is stored in the vault, DB, or GCS.
 *
 * Supported: PDF, DOCX, TXT, MD, CSV
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export const runtime = 'nodejs'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB
const MAX_TEXT_LENGTH = 50000

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File exceeds 20 MB limit' }, { status: 400 })
    }

    const name = file.name.toLowerCase()
    let text = ''

    if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv')) {
      text = await file.text()
    } else if (name.endsWith('.pdf')) {
      const arrayBuf = await file.arrayBuffer()
      const { PDFParse } = await import('pdf-parse')
      const parser = new PDFParse({ data: new Uint8Array(arrayBuf), verbosity: 0 })
      const result = await parser.getText()
      text = result.text
      await parser.destroy()
    } else if (name.endsWith('.docx') || name.endsWith('.doc')) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Use PDF, DOCX, TXT, MD, or CSV.' },
        { status: 415 }
      )
    }

    // Truncate to prevent context window overflow
    const truncated = text.length > MAX_TEXT_LENGTH
    if (truncated) {
      text = text.slice(0, MAX_TEXT_LENGTH) + '\n\n[Content truncated...]'
    }

    return NextResponse.json({
      success: true,
      text,
      fileName: file.name,
      length: text.length,
      truncated,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Parse failed'
    return NextResponse.json({ error: `Failed to parse file: ${message}` }, { status: 500 })
  }
}
