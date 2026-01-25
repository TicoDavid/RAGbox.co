/**
 * Audit Export API - RAGbox.co
 *
 * GET /api/audit/export - Export audit logs as PDF
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { AuditEvent, AuditAction, AuditSeverity } from '@/lib/audit/types'
import { generatePdfBuffer } from '@/lib/audit/pdfExport'
import { logDataExport } from '@/lib/audit'

// Import the audit log store from the main audit route
// In production, this would query the database
function generateDemoAuditLogs(): AuditEvent[] {
  const actions: AuditAction[] = [
    'LOGIN',
    'DOCUMENT_UPLOAD',
    'QUERY_SUBMITTED',
    'QUERY_RESPONSE',
    'PRIVILEGE_MODE_CHANGE',
    'DOCUMENT_PRIVILEGE_CHANGE',
    'SILENCE_PROTOCOL_TRIGGERED',
    'DOCUMENT_DELETE',
  ]

  const users = ['user_123', 'user_456', 'user_789']
  const documents = ['Contract_NDA.pdf', 'Financial_Report.xlsx', 'Legal_Brief.docx']

  const logs: AuditEvent[] = []
  const now = Date.now()

  for (let i = 0; i < 50; i++) {
    const action = actions[Math.floor(Math.random() * actions.length)]
    const userId = users[Math.floor(Math.random() * users.length)]
    const timestamp = new Date(now - i * 1000 * 60 * Math.random() * 60).toISOString()

    const details: Record<string, unknown> = {}
    let resourceId: string | undefined
    let resourceType: string | undefined
    let severity: AuditSeverity = 'INFO'

    switch (action) {
      case 'DOCUMENT_UPLOAD':
        resourceType = 'document'
        resourceId = `doc_${Math.random().toString(36).substring(2, 10)}`
        details.filename = documents[Math.floor(Math.random() * documents.length)]
        details.size = Math.floor(Math.random() * 5000000)
        break
      case 'QUERY_SUBMITTED':
        resourceType = 'query'
        details.queryHash = Math.random().toString(36).substring(2, 18)
        details.queryPreview = 'What are the key terms in...'
        break
      case 'QUERY_RESPONSE':
        resourceType = 'query'
        details.confidence = 0.7 + Math.random() * 0.3
        details.chunksUsed = Math.floor(Math.random() * 5) + 1
        details.latencyMs = Math.floor(Math.random() * 2000)
        break
      case 'PRIVILEGE_MODE_CHANGE':
        details.enabled = Math.random() > 0.5
        severity = 'WARNING'
        break
      case 'DOCUMENT_PRIVILEGE_CHANGE':
        resourceType = 'document'
        resourceId = `doc_${Math.random().toString(36).substring(2, 10)}`
        details.filename = documents[Math.floor(Math.random() * documents.length)]
        details.privileged = Math.random() > 0.5
        severity = 'WARNING'
        break
      case 'SILENCE_PROTOCOL_TRIGGERED':
        resourceType = 'query'
        details.confidence = 0.5 + Math.random() * 0.35
        details.reason = 'Low confidence score'
        severity = 'WARNING'
        break
      case 'LOGIN':
        details.method = Math.random() > 0.5 ? 'google' : 'email'
        break
      case 'DOCUMENT_DELETE':
        resourceType = 'document'
        resourceId = `doc_${Math.random().toString(36).substring(2, 10)}`
        details.filename = documents[Math.floor(Math.random() * documents.length)]
        severity = 'WARNING'
        break
    }

    logs.push({
      eventId: `evt_${Math.random().toString(36).substring(2, 14)}`,
      timestamp,
      userId,
      action,
      resourceId,
      resourceType,
      severity,
      details,
      detailsHash: Math.random().toString(36).substring(2, 66),
      ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    })
  }

  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
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

  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0] || 'anonymous'
  return `session_${ip}`
}

/**
 * Extract client IP for audit logging
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0] || 'unknown'
}

/**
 * GET /api/audit/export
 *
 * Query parameters:
 * - startDate: ISO date string (optional)
 * - endDate: ISO date string (optional)
 * - action: AuditAction filter (optional)
 * - severity: AuditSeverity filter (optional)
 * - format: 'pdf' | 'json' (default 'pdf')
 * - organization: Organization name (default 'RAGbox Organization')
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await getUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    // Parse filters
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const actionFilter = searchParams.get('action') as AuditAction | null
    const severityFilter = searchParams.get('severity') as AuditSeverity | null
    const format = searchParams.get('format') || 'pdf'
    const organization = searchParams.get('organization') || 'RAGbox Organization'

    // Get audit logs (in production, query from database)
    let logs = generateDemoAuditLogs()

    // Apply filters
    if (actionFilter) {
      logs = logs.filter((log) => log.action === actionFilter)
    }

    if (severityFilter) {
      logs = logs.filter((log) => log.severity === severityFilter)
    }

    if (startDate) {
      const start = new Date(startDate).getTime()
      logs = logs.filter((log) => new Date(log.timestamp).getTime() >= start)
    }

    if (endDate) {
      const end = new Date(endDate).getTime()
      logs = logs.filter((log) => new Date(log.timestamp).getTime() <= end)
    }

    // Log the export action
    const ipAddress = getClientIP(request)
    try {
      await logDataExport(userId, 'audit_report', logs.length, ipAddress)
    } catch (auditError) {
      console.error('Failed to log export:', auditError)
    }

    // Return JSON format if requested
    if (format === 'json') {
      return NextResponse.json({
        organization,
        exportedAt: new Date().toISOString(),
        exportedBy: userId,
        startDate,
        endDate,
        entryCount: logs.length,
        entries: logs,
      })
    }

    // Generate PDF
    const pdfBuffer = generatePdfBuffer(logs, {
      organizationName: organization,
      exportedBy: userId,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    })

    // Generate filename
    const dateStr = new Date().toISOString().split('T')[0]
    const filename = `ragbox_audit_report_${dateStr}.pdf`

    // Return PDF response (convert Buffer to Uint8Array for NextResponse)
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Report-Hash': require('crypto')
          .createHash('sha256')
          .update(pdfBuffer)
          .digest('hex'),
      },
    })
  } catch (error) {
    console.error('Error exporting audit report:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * OPTIONS /api/audit/export
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
