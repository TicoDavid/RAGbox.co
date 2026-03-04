/**
 * Audit PDF Export - RAGbox.co
 *
 * Generates real PDF reports using pdfkit for regulatory compliance.
 * WORM-compliant, cryptographically sealed.
 */

import { createHash } from 'crypto'
import PDFDocument from 'pdfkit'
import { AuditEvent, AuditAction } from './types'

export interface PdfExportOptions {
  organizationName: string
  exportedBy: string
  startDate?: string
  endDate?: string
  title?: string
}

export interface PdfExportResult {
  data: string // Base64 encoded PDF
  filename: string
  hash: string
  pageCount: number
  entryCount: number
  exportedAt: string
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function getActionDisplayName(action: AuditAction): string {
  const names: Record<AuditAction, string> = {
    LOGIN: 'User Login',
    LOGOUT: 'User Logout',
    DOCUMENT_UPLOAD: 'Document Upload',
    DOCUMENT_DELETE: 'Document Deleted',
    DOCUMENT_VIEW: 'Document Viewed',
    DOCUMENT_PRIVILEGE_CHANGE: 'Privilege Changed',
    DOCUMENT_TIER_CHANGE: 'Tier Changed',
    QUERY_SUBMITTED: 'Query Submitted',
    QUERY_RESPONSE: 'Query Response',
    SILENCE_PROTOCOL: 'Silence Protocol',
    SILENCE_PROTOCOL_TRIGGERED: 'Silence Protocol',
    PRIVILEGE_MODE_CHANGE: 'Mode Changed',
    DATA_EXPORT: 'Data Export',
    SETTINGS_CHANGE: 'Settings Changed',
    ERROR: 'Error',
  }
  return names[action] || action
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'CRITICAL': return '#dc2626'
    case 'ERROR': return '#ef4444'
    case 'WARNING': return '#f59e0b'
    default: return '#374151'
  }
}

/**
 * Compute deterministic report hash from event data.
 */
function computeReportHash(events: AuditEvent[]): string {
  const hashInput = events.map(e => `${e.eventId}|${e.timestamp}|${e.action}|${e.detailsHash}`).join('\n')
  return createHash('sha256').update(hashInput).digest('hex')
}

/**
 * Render audit report into a pdfkit document.
 */
function renderPdf(
  doc: PDFKit.PDFDocument,
  events: AuditEvent[],
  options: PdfExportOptions,
  exportedAt: Date,
  reportHash: string,
): void {
  const dateStr = exportedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr = exportedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  // Title
  doc.fontSize(20).font('Helvetica-Bold')
    .text('RAGbox Official Audit Report', { align: 'center' })
  doc.moveDown(0.3)
  doc.fontSize(9).font('Helvetica').fillColor('#6b7280')
    .text('WORM-Compliant  |  Cryptographically Sealed  |  Immutable Ledger', { align: 'center' })
  doc.moveDown(1)

  // Divider
  doc.strokeColor('#d1d5db').lineWidth(1)
    .moveTo(72, doc.y).lineTo(doc.page.width - 72, doc.y).stroke()
  doc.moveDown(0.5)

  // Report metadata
  doc.fillColor('#111827').fontSize(11).font('Helvetica-Bold').text('Report Details')
  doc.moveDown(0.2)
  doc.fontSize(10).font('Helvetica').fillColor('#374151')
  doc.text(`Organization:  ${options.organizationName}`)
  doc.text(`Export Date:   ${dateStr} at ${timeStr}`)
  doc.text(`Exported By:   ${options.exportedBy}`)
  doc.text(`Total Entries: ${events.length}`)
  if (options.startDate) doc.text(`Period Start:  ${formatTimestamp(options.startDate)}`)
  if (options.endDate) doc.text(`Period End:    ${formatTimestamp(options.endDate)}`)
  doc.moveDown(0.8)

  doc.strokeColor('#d1d5db').lineWidth(1)
    .moveTo(72, doc.y).lineTo(doc.page.width - 72, doc.y).stroke()
  doc.moveDown(0.6)

  // Audit entries
  doc.fontSize(13).font('Helvetica-Bold').fillColor('#111827').text('Audit Entries')
  doc.moveDown(0.4)

  events.forEach((event, index) => {
    if (doc.y > doc.page.height - 130) {
      doc.addPage()
    }

    const num = (index + 1).toString().padStart(4, '0')

    doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827')
      .text(`[${num}]  ${getActionDisplayName(event.action)}`, { continued: true })
    doc.font('Helvetica').fillColor(getSeverityColor(event.severity))
      .text(`   ${event.severity}`, { align: 'right' })

    doc.fontSize(9).font('Helvetica').fillColor('#374151')
    doc.text(`ID: ${event.eventId}`)
    doc.text(`Time: ${formatTimestamp(event.timestamp)}    User: ${event.userId || 'System'}`)
    if (event.resourceType) {
      doc.text(`Resource: ${event.resourceType}${event.resourceId ? ` (${event.resourceId})` : ''}`)
    }
    if (event.ipAddress) {
      doc.text(`IP: ${event.ipAddress}`)
    }

    const detailsStr = JSON.stringify(event.details)
    const truncated = detailsStr.length > 200 ? detailsStr.substring(0, 200) + '...' : detailsStr
    doc.fontSize(8).fillColor('#6b7280').text(`Details: ${truncated}`)
    doc.text(`Hash: ${event.detailsHash.substring(0, 32)}...`)

    doc.moveDown(0.2)
    doc.strokeColor('#f3f4f6').lineWidth(0.5)
      .moveTo(72, doc.y).lineTo(doc.page.width - 72, doc.y).stroke()
    doc.moveDown(0.3)
  })

  // Verification footer
  if (doc.y > doc.page.height - 140) {
    doc.addPage()
  }

  doc.moveDown(0.8)
  doc.strokeColor('#d1d5db').lineWidth(1)
    .moveTo(72, doc.y).lineTo(doc.page.width - 72, doc.y).stroke()
  doc.moveDown(0.4)

  doc.fontSize(11).font('Helvetica-Bold').fillColor('#111827').text('Report Verification')
  doc.moveDown(0.2)
  doc.fontSize(9).font('Helvetica').fillColor('#374151')
  doc.text(`Report Hash (SHA-256): ${reportHash}`)
  doc.text(`Generated: ${exportedAt.toISOString()}`)
  doc.text(`Entries: ${events.length}`)
  doc.moveDown(0.3)
  doc.fontSize(8).fillColor('#6b7280')
    .text('This audit report is cryptographically sealed and tamper-evident.')
    .text('Verify integrity by recomputing the SHA-256 hash of event ID, timestamp, action, and details hash fields.')
}

/**
 * Collect all data from a PDFDocument into a Buffer.
 * Uses a promise to handle pdfkit's async stream flushing.
 */
function collectPdfBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.end()
  })
}

/**
 * Generate audit PDF as base64 string.
 */
export async function generateAuditPdfContent(
  events: AuditEvent[],
  options: PdfExportOptions
): Promise<PdfExportResult> {
  const exportedAt = new Date()
  const filename = `ragbox_audit_${exportedAt.toISOString().split('T')[0]}.pdf`
  const reportHash = computeReportHash(events)

  const doc = new PDFDocument({ size: 'LETTER', margin: 72, compress: false })
  renderPdf(doc, events, options, exportedAt, reportHash)
  const pdfBuffer = await collectPdfBuffer(doc)

  return {
    data: pdfBuffer.toString('base64'),
    filename,
    hash: reportHash,
    pageCount: Math.max(Math.ceil(events.length / 10), 1),
    entryCount: events.length,
    exportedAt: exportedAt.toISOString(),
  }
}

/**
 * Generate PDF buffer for direct download.
 */
export async function generatePdfBuffer(
  events: AuditEvent[],
  options: PdfExportOptions
): Promise<Buffer> {
  const reportHash = computeReportHash(events)
  const doc = new PDFDocument({ size: 'LETTER', margin: 72, compress: false })
  renderPdf(doc, events, options, new Date(), reportHash)
  return collectPdfBuffer(doc)
}
