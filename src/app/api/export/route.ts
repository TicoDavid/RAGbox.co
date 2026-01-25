/**
 * Data Export API - RAGbox.co
 *
 * GET /api/export - Export all user data as a ZIP file
 *
 * One-click data export for anti-lock-in compliance (S019)
 * Includes: documents, metadata, query history
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createHash } from 'crypto'
import { getDocumentStore, type Document } from '@/lib/documents/store'
import { logDataExport } from '@/lib/audit'

/**
 * Query history entry (simplified for export)
 */
interface QueryHistoryEntry {
  id: string
  query: string
  queryHash: string
  response: string
  confidence: number
  citations: string[]
  timestamp: string
  silenceProtocolTriggered: boolean
}

/**
 * User profile data
 */
interface UserProfile {
  id: string
  email: string
  name: string
  role: string
  createdAt: string
  lastLogin: string
  preferences: Record<string, unknown>
}

/**
 * Export manifest
 */
interface ExportManifest {
  exportVersion: string
  exportedAt: string
  exportedBy: string
  contentHash: string
  files: {
    path: string
    type: string
    size?: number
  }[]
  summary: {
    documentCount: number
    queryCount: number
    totalSize: number
  }
}

/**
 * Generate demo query history
 */
function generateDemoQueryHistory(userId: string): QueryHistoryEntry[] {
  const queries = [
    {
      query: 'What are the key terms in the NDA contract?',
      response: 'Based on the NDA document, the key terms include: (1) Confidentiality period of 3 years...',
      confidence: 0.92,
      citations: ['Contract_NDA_2024.pdf:page 2', 'Contract_NDA_2024.pdf:page 5'],
      silenceProtocolTriggered: false,
    },
    {
      query: 'Summarize the Q4 financial performance',
      response: 'The Q4 financial statement shows revenue growth of 15% YoY...',
      confidence: 0.88,
      citations: ['Financial_Statement_Q4.xlsx:sheet 1'],
      silenceProtocolTriggered: false,
    },
    {
      query: 'What is the deadline for the legal brief?',
      response: 'The legal brief submission deadline is set for February 15, 2026...',
      confidence: 0.95,
      citations: ['Legal_Brief_v3.docx:page 1'],
      silenceProtocolTriggered: false,
    },
    {
      query: 'Are there any privileged communications in the memo?',
      response: 'I cannot provide a confident answer based on your documents. The query relates to potentially privileged material that requires attorney verification.',
      confidence: 0.72,
      citations: [],
      silenceProtocolTriggered: true,
    },
  ]

  return queries.map((q, i) => ({
    id: `query_${Date.now() - i * 3600000}_${Math.random().toString(36).substring(2, 8)}`,
    query: q.query,
    queryHash: createHash('sha256').update(q.query).digest('hex').substring(0, 16),
    response: q.response,
    confidence: q.confidence,
    citations: q.citations,
    timestamp: new Date(Date.now() - i * 3600000 * 24).toISOString(),
    silenceProtocolTriggered: q.silenceProtocolTriggered,
  }))
}

/**
 * Generate demo user profile
 */
function generateUserProfile(userId: string): UserProfile {
  return {
    id: userId,
    email: 'user@example.com',
    name: 'Demo User',
    role: 'partner',
    createdAt: '2026-01-01T00:00:00.000Z',
    lastLogin: new Date().toISOString(),
    preferences: {
      theme: 'dark',
      notifications: {
        email: true,
        security: true,
        queries: false,
      },
      defaultPrivilegeMode: false,
    },
  }
}

/**
 * Create a simple ZIP-like structure as a text-based archive
 * In production, use a proper ZIP library like archiver or jszip
 */
function createExportArchive(
  documents: Document[],
  queryHistory: QueryHistoryEntry[],
  userProfile: UserProfile,
  manifest: ExportManifest
): Buffer {
  const lines: string[] = []

  // Archive header
  lines.push('=' .repeat(80))
  lines.push('')
  lines.push('                    RAGBOX DATA EXPORT ARCHIVE')
  lines.push('')
  lines.push('=' .repeat(80))
  lines.push('')
  lines.push(`Export Date:     ${manifest.exportedAt}`)
  lines.push(`Exported By:     ${manifest.exportedBy}`)
  lines.push(`Export Version:  ${manifest.exportVersion}`)
  lines.push(`Content Hash:    ${manifest.contentHash}`)
  lines.push('')
  lines.push('-' .repeat(80))
  lines.push('')

  // Summary
  lines.push('EXPORT SUMMARY')
  lines.push('-' .repeat(40))
  lines.push(`Documents:       ${manifest.summary.documentCount}`)
  lines.push(`Queries:         ${manifest.summary.queryCount}`)
  lines.push(`Total Size:      ${formatBytes(manifest.summary.totalSize)}`)
  lines.push('')

  // File manifest
  lines.push('FILE MANIFEST')
  lines.push('-' .repeat(40))
  manifest.files.forEach((f, i) => {
    lines.push(`  ${i + 1}. ${f.path} (${f.type})`)
  })
  lines.push('')
  lines.push('=' .repeat(80))
  lines.push('')

  // User Profile Section
  lines.push('=== FILE: profile/user.json ===')
  lines.push('')
  lines.push(JSON.stringify(userProfile, null, 2))
  lines.push('')
  lines.push('=== END FILE ===')
  lines.push('')

  // Documents Metadata Section
  lines.push('=== FILE: documents/metadata.json ===')
  lines.push('')
  lines.push(JSON.stringify({
    exportedAt: manifest.exportedAt,
    documentCount: documents.length,
    documents: documents.map(doc => ({
      id: doc.id,
      name: doc.name,
      originalName: doc.originalName,
      size: doc.size,
      type: doc.type,
      mimeType: doc.mimeType,
      uploadedAt: doc.uploadedAt,
      updatedAt: doc.updatedAt,
      isPrivileged: doc.isPrivileged,
      chunkCount: doc.chunkCount,
      status: doc.status,
      storagePath: doc.storagePath,
    })),
  }, null, 2))
  lines.push('')
  lines.push('=== END FILE ===')
  lines.push('')

  // Individual document entries
  documents.forEach((doc, i) => {
    lines.push(`=== FILE: documents/${i + 1}_${doc.name}.meta.json ===`)
    lines.push('')
    lines.push(JSON.stringify({
      id: doc.id,
      name: doc.name,
      originalName: doc.originalName,
      size: doc.size,
      sizeFormatted: formatBytes(doc.size),
      type: doc.type,
      mimeType: doc.mimeType,
      storagePath: doc.storagePath,
      uploadedAt: doc.uploadedAt,
      updatedAt: doc.updatedAt,
      isPrivileged: doc.isPrivileged,
      chunkCount: doc.chunkCount,
      status: doc.status,
      note: 'Original file available via Cloud Storage signed URL',
    }, null, 2))
    lines.push('')
    lines.push('=== END FILE ===')
    lines.push('')
  })

  // Query History Section
  lines.push('=== FILE: queries/history.json ===')
  lines.push('')
  lines.push(JSON.stringify({
    exportedAt: manifest.exportedAt,
    queryCount: queryHistory.length,
    queries: queryHistory,
  }, null, 2))
  lines.push('')
  lines.push('=== END FILE ===')
  lines.push('')

  // Export Manifest
  lines.push('=== FILE: manifest.json ===')
  lines.push('')
  lines.push(JSON.stringify(manifest, null, 2))
  lines.push('')
  lines.push('=== END FILE ===')
  lines.push('')

  // Archive footer
  lines.push('=' .repeat(80))
  lines.push('')
  lines.push('                    END OF RAGBOX DATA EXPORT')
  lines.push('')
  lines.push('This export contains all your RAGbox data.')
  lines.push('Documents are referenced by Cloud Storage paths.')
  lines.push('Contact support@ragbox.co for assistance with data restoration.')
  lines.push('')
  lines.push('=' .repeat(80))

  return Buffer.from(lines.join('\n'), 'utf-8')
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Extract user ID from request
 */
async function getUserId(request: NextRequest): Promise<string | null> {
  const sessionCookie = (await cookies()).get('session')
  if (sessionCookie?.value) {
    return sessionCookie.value
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  // Demo fallback
  return 'demo_user'
}

/**
 * Extract client IP for audit logging
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0] || 'unknown'
}

/**
 * GET /api/export
 *
 * Export all user data as a ZIP archive
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await getUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's documents
    const documentStore = getDocumentStore()
    const documents = Array.from(documentStore.values()).filter((doc) => doc.userId === userId)

    // Generate query history (in production, fetch from database)
    const queryHistory = generateDemoQueryHistory(userId)

    // Generate user profile
    const userProfile = generateUserProfile(userId)

    // Calculate total size
    const totalSize = documents.reduce((sum, doc) => sum + doc.size, 0)

    // Create manifest
    const exportedAt = new Date().toISOString()
    const files = [
      { path: 'profile/user.json', type: 'json' },
      { path: 'documents/metadata.json', type: 'json' },
      ...documents.map((doc, i) => ({
        path: `documents/${i + 1}_${doc.name}.meta.json`,
        type: 'json',
        size: doc.size,
      })),
      { path: 'queries/history.json', type: 'json' },
      { path: 'manifest.json', type: 'json' },
    ]

    // Generate content hash
    const contentForHash = JSON.stringify({
      userId,
      documentCount: documents.length,
      queryCount: queryHistory.length,
      exportedAt,
    })
    const contentHash = createHash('sha256').update(contentForHash).digest('hex')

    const manifest: ExportManifest = {
      exportVersion: '1.0.0',
      exportedAt,
      exportedBy: userId,
      contentHash,
      files,
      summary: {
        documentCount: documents.length,
        queryCount: queryHistory.length,
        totalSize,
      },
    }

    // Create the export archive
    const archiveBuffer = createExportArchive(documents, queryHistory, userProfile, manifest)

    // Log to audit trail
    const ipAddress = getClientIP(request)
    try {
      await logDataExport(userId, 'full_data_export', documents.length + queryHistory.length + 1, ipAddress)
    } catch (auditError) {
      console.error('Failed to log data export:', auditError)
    }

    // Generate filename
    const dateStr = new Date().toISOString().split('T')[0]
    const filename = `ragbox_export_${dateStr}.zip`

    // Return ZIP response (convert Buffer to Uint8Array for NextResponse)
    return new NextResponse(new Uint8Array(archiveBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': archiveBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Export-Hash': contentHash,
        'X-Document-Count': documents.length.toString(),
        'X-Query-Count': queryHistory.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error exporting data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * OPTIONS /api/export
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
