/**
 * Document Text Extraction API
 *
 * POST /api/documents/extract
 *
 * Extracts text content from uploaded files (PDF, DOCX, TXT)
 * Returns the extracted text for RAG indexing
 */

import { NextRequest, NextResponse } from 'next/server';
import { PDFParse } from 'pdf-parse';
import * as mammothModule from 'mammoth';

// Handle mammoth ESM/CJS exports
const mammoth = (mammothModule as unknown as { default?: typeof mammothModule }).default || mammothModule;

export const runtime = 'nodejs';

// Maximum file size for extraction (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Extract text from a file based on its type
 */
async function extractText(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
  // Plain text files
  if (mimeType === 'text/plain' || fileName.endsWith('.txt')) {
    return buffer.toString('utf-8');
  }

  // CSV files
  if (mimeType === 'text/csv' || fileName.endsWith('.csv')) {
    return buffer.toString('utf-8');
  }

  // PDF files
  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
    try {
      const pdfParser = new PDFParse(buffer);
      const pdfData = await pdfParser.getText();
      return pdfData.text;
    } catch (error) {
      console.error('[Extract] PDF parse error:', error);
      throw new Error('Failed to extract text from PDF');
    }
  }

  // DOCX files
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileName.endsWith('.docx')
  ) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      console.error('[Extract] DOCX parse error:', error);
      throw new Error('Failed to extract text from DOCX');
    }
  }

  // DOC files (older Word format) - limited support
  if (mimeType === 'application/msword' || fileName.endsWith('.doc')) {
    // mammoth doesn't support old .doc format well
    // For MVP, we'll return a note
    return `[Document: ${fileName}] - Legacy .doc format. Please convert to .docx for full text extraction.`;
  }

  // Markdown files
  if (mimeType === 'text/markdown' || fileName.endsWith('.md')) {
    return buffer.toString('utf-8');
  }

  // JSON files
  if (mimeType === 'application/json' || fileName.endsWith('.json')) {
    return buffer.toString('utf-8');
  }

  // Excel files - basic support (just note for now)
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel' ||
    fileName.endsWith('.xlsx') ||
    fileName.endsWith('.xls')
  ) {
    return `[Spreadsheet: ${fileName}] - Excel file detected. For full text extraction, export as CSV.`;
  }

  // Unsupported type
  return `[File: ${fileName}] - Unsupported format (${mimeType}). Supported: PDF, DOCX, TXT, CSV, MD, JSON`;
}

/**
 * POST /api/documents/extract
 *
 * Accepts multipart form data with a single file
 * Returns extracted text content
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 413 }
      );
    }

    console.log(`[Extract] Processing: ${file.name} (${file.type}, ${file.size} bytes)`);

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text
    const extractedText = await extractText(buffer, file.type, file.name);

    // Chunk the text if it's too long (for better RAG performance)
    const chunks = chunkText(extractedText, 2000, 200);

    console.log(`[Extract] Extracted ${extractedText.length} chars, ${chunks.length} chunks from ${file.name}`);

    return NextResponse.json({
      success: true,
      data: {
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        textLength: extractedText.length,
        text: extractedText,
        chunks: chunks,
        chunkCount: chunks.length,
      }
    });

  } catch (error) {
    console.error('[Extract] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * Split text into overlapping chunks for better RAG retrieval
 */
function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  if (!text || text.length === 0) return [];
  if (text.length <= chunkSize) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    // Try to break at a sentence or paragraph boundary
    if (end < text.length) {
      const breakPoints = ['\n\n', '\n', '. ', '! ', '? '];
      for (const breakPoint of breakPoints) {
        const lastBreak = text.lastIndexOf(breakPoint, end);
        if (lastBreak > start + chunkSize / 2) {
          end = lastBreak + breakPoint.length;
          break;
        }
      }
    }

    chunks.push(text.slice(start, end).trim());
    start = end - overlap;

    // Prevent infinite loop
    if (start >= text.length - overlap) break;
  }

  return chunks.filter(chunk => chunk.length > 0);
}
