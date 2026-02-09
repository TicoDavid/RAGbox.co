/**
 * Audit Log API - RAGbox.co
 *
 * GET /api/audit - Retrieve audit log entries with filtering and pagination
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { AuditEvent, AuditAction, AuditSeverity } from '@/lib/audit/types'

// In-memory audit log store (replace with database in production)
// This is populated by the audit logger
const auditLogStore: AuditEvent[] = generateDemoAuditLogs()

/**
 * Generate demo audit logs for UI development
 */
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

    const eventId = `evt_${Math.random().toString(36).substring(2, 14)}`
    const hash = Math.random().toString(36).substring(2, 18)
    logs.push({
      id: eventId,
      eventId,
      timestamp,
      userId,
      action,
      resourceId,
      resourceType,
      severity,
      details,
      hash,
      detailsHash: hash,
      ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    } as AuditEvent)
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
 * GET /api/audit
 *
 * Query parameters:
 * - page: number (default 1)
 * - limit: number (default 20, max 100)
 * - action: AuditAction filter
 * - severity: AuditSeverity filter
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - search: search term for details
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await getUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))

    // Filters
    const actionFilter = searchParams.get('action') as AuditAction | null
    const severityFilter = searchParams.get('severity') as AuditSeverity | null
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const searchTerm = searchParams.get('search')?.toLowerCase()

    // Filter logs
    let filteredLogs = [...auditLogStore]

    if (actionFilter) {
      filteredLogs = filteredLogs.filter((log) => log.action === actionFilter)
    }

    if (severityFilter) {
      filteredLogs = filteredLogs.filter((log) => log.severity === severityFilter)
    }

    if (startDate) {
      const start = new Date(startDate).getTime()
      filteredLogs = filteredLogs.filter((log) => new Date(log.timestamp).getTime() >= start)
    }

    if (endDate) {
      const end = new Date(endDate).getTime()
      filteredLogs = filteredLogs.filter((log) => new Date(log.timestamp).getTime() <= end)
    }

    if (searchTerm) {
      filteredLogs = filteredLogs.filter((log) => {
        const detailsStr = JSON.stringify(log.details).toLowerCase()
        return (
          log.action.toLowerCase().includes(searchTerm) ||
          log.eventId.toLowerCase().includes(searchTerm) ||
          detailsStr.includes(searchTerm)
        )
      })
    }

    // Calculate pagination
    const total = filteredLogs.length
    const totalPages = Math.ceil(total / limit)
    const offset = (page - 1) * limit
    const paginatedLogs = filteredLogs.slice(offset, offset + limit)

    return NextResponse.json({
      logs: paginatedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    })
  } catch (error) {
    console.error('Error fetching audit logs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * OPTIONS /api/audit
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
