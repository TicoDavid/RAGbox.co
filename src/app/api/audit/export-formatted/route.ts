/**
 * Audit Export (Formatted) API - RAGbox.co
 *
 * GET /api/audit/export-formatted?format=pdf|csv|json&startDate=X&endDate=Y
 *
 * Returns audit entries in the requested format with optional date filtering.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { mapPrismaToAuditEvent } from '@/lib/audit/mappers'
import { generatePdfBuffer } from '@/lib/audit/pdfExport'
import { generateCsvBuffer } from '@/lib/audit/csvExport'

const VALID_FORMATS = new Set(['pdf', 'csv', 'json'])
const MAX_ENTRIES = 5000

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 },
    )
  }

  const userId = (token.id as string) || token.email || ''
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') ?? 'pdf'
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  if (!VALID_FORMATS.has(format)) {
    return NextResponse.json(
      { success: false, error: 'Invalid format. Use pdf, csv, or json.' },
      { status: 400 },
    )
  }

  try {
    const where: Record<string, unknown> = { userId }

    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {}
      if (startDate) createdAt.gte = new Date(startDate)
      if (endDate) {
        // End of day for the endDate
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        createdAt.lte = end
      }
      where.createdAt = createdAt
    }

    const rows = await prisma.auditEntry.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: MAX_ENTRIES,
      select: {
        id: true,
        userId: true,
        action: true,
        resourceId: true,
        severity: true,
        details: true,
        ipAddress: true,
        userAgent: true,
        entryHash: true,
        createdAt: true,
      },
    })

    const events = rows.map(mapPrismaToAuditEvent)
    const dateSuffix = new Date().toISOString().split('T')[0]

    if (format === 'pdf') {
      const buffer = generatePdfBuffer(events, {
        organizationName: 'RAGbox.co',
        exportedBy: userId,
        startDate: startDate ?? undefined,
        endDate: endDate ?? undefined,
      })
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="ragbox_audit_${dateSuffix}.pdf"`,
        },
      })
    }

    if (format === 'csv') {
      const buffer = generateCsvBuffer(events)
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="ragbox_audit_${dateSuffix}.csv"`,
        },
      })
    }

    // JSON
    const jsonBuffer = Buffer.from(JSON.stringify(events, null, 2), 'utf-8')
    return new NextResponse(jsonBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="ragbox_audit_${dateSuffix}.json"`,
      },
    })
  } catch (error) {
    console.error('[Audit Export Formatted] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Export failed' },
      { status: 500 },
    )
  }
}
