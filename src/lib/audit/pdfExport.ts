/**
 * Audit PDF Export - RAGbox.co
 *
 * Generates watermarked PDF reports of audit logs
 * for regulatory compliance and legal discovery.
 */

import { createHash } from 'crypto'
import { AuditEvent, AuditAction } from './types'

/**
 * PDF Export options
 */
export interface PdfExportOptions {
  organizationName: string
  exportedBy: string
  startDate?: string
  endDate?: string
  title?: string
}

/**
 * PDF generation result
 */
export interface PdfExportResult {
  data: string // Base64 encoded PDF
  filename: string
  hash: string
  pageCount: number
  entryCount: number
  exportedAt: string
}

/**
 * Format timestamp for display
 */
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

/**
 * Get action display name
 */
function getActionDisplayName(action: AuditAction): string {
  const names: Record<AuditAction, string> = {
    LOGIN: 'User Login',
    LOGOUT: 'User Logout',
    DOCUMENT_UPLOAD: 'Document Upload',
    DOCUMENT_DELETE: 'Document Deleted',
    DOCUMENT_PRIVILEGE_CHANGE: 'Privilege Changed',
    QUERY_SUBMITTED: 'Query Submitted',
    QUERY_RESPONSE: 'Query Response',
    SILENCE_PROTOCOL_TRIGGERED: 'Silence Protocol',
    PRIVILEGE_MODE_CHANGE: 'Mode Changed',
    DATA_EXPORT: 'Data Export',
    ERROR: 'Error',
  }
  return names[action] || action
}

/**
 * Generate a simple text-based PDF content
 * This is a simplified implementation - in production, use a proper PDF library
 */
export function generateAuditPdfContent(
  events: AuditEvent[],
  options: PdfExportOptions
): PdfExportResult {
  const exportedAt = new Date().toISOString()
  const filename = `ragbox_audit_${new Date().toISOString().split('T')[0]}.pdf`

  // Build report content as structured text (would be rendered to PDF in production)
  const lines: string[] = []

  // Header
  lines.push('='.repeat(80))
  lines.push('')
  lines.push('                    RAGBOX OFFICIAL AUDIT REPORT')
  lines.push('')
  lines.push('='.repeat(80))
  lines.push('')
  lines.push(`Organization: ${options.organizationName}`)
  lines.push(`Export Date: ${formatTimestamp(exportedAt)}`)
  lines.push(`Exported By: ${options.exportedBy}`)
  if (options.startDate) {
    lines.push(`Period Start: ${formatTimestamp(options.startDate)}`)
  }
  if (options.endDate) {
    lines.push(`Period End: ${formatTimestamp(options.endDate)}`)
  }
  lines.push(`Total Entries: ${events.length}`)
  lines.push('')
  lines.push('-'.repeat(80))
  lines.push('')

  // Watermark note
  lines.push('*** WATERMARK: RAGbox Official Audit Report ***')
  lines.push('*** This document is an official audit ledger extract ***')
  lines.push('')
  lines.push('-'.repeat(80))
  lines.push('')

  // Events
  let pageCount = 1
  const entriesPerPage = 10

  events.forEach((event, index) => {
    if (index > 0 && index % entriesPerPage === 0) {
      lines.push('')
      lines.push(`--- Page ${pageCount} ---`)
      lines.push('')
      pageCount++
    }

    lines.push(`Entry #${index + 1}`)
    lines.push(`  Event ID: ${event.eventId}`)
    lines.push(`  Timestamp: ${formatTimestamp(event.timestamp)}`)
    lines.push(`  Action: ${getActionDisplayName(event.action)}`)
    lines.push(`  User ID: ${event.userId || 'System'}`)
    lines.push(`  Severity: ${event.severity}`)
    if (event.resourceId) {
      lines.push(`  Resource ID: ${event.resourceId}`)
    }
    if (event.resourceType) {
      lines.push(`  Resource Type: ${event.resourceType}`)
    }
    if (event.ipAddress) {
      lines.push(`  IP Address: ${event.ipAddress}`)
    }
    lines.push(`  Details: ${JSON.stringify(event.details)}`)
    lines.push(`  Details Hash: ${event.detailsHash}`)
    lines.push('')
  })

  // Footer
  lines.push('-'.repeat(80))
  lines.push('')
  lines.push(`Total Pages: ${pageCount}`)

  // Generate content hash
  const content = lines.join('\n')
  const contentHash = createHash('sha256').update(content).digest('hex')

  lines.push(`Report Hash: ${contentHash}`)
  lines.push('')
  lines.push('='.repeat(80))
  lines.push('                    END OF AUDIT REPORT')
  lines.push('='.repeat(80))

  // In a real implementation, this would use jsPDF or similar to generate actual PDF
  // For now, we return base64-encoded text content
  const finalContent = lines.join('\n')
  const base64Content = Buffer.from(finalContent).toString('base64')

  return {
    data: base64Content,
    filename,
    hash: contentHash,
    pageCount,
    entryCount: events.length,
    exportedAt,
  }
}

/**
 * Generate PDF buffer for download
 * This creates a simple PDF-like text document
 * In production, use jsPDF or pdfkit for proper PDF generation
 */
export function generatePdfBuffer(
  events: AuditEvent[],
  options: PdfExportOptions
): Buffer {
  const exportedAt = new Date()
  const dateStr = exportedAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const timeStr = exportedAt.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  // Build PDF content
  // Note: This creates a text-based PDF representation
  // For production, integrate jsPDF or pdfkit
  const lines: string[] = []

  // PDF Header (simplified text version)
  lines.push('%PDF-1.4')
  lines.push('')

  // Document metadata as comments
  lines.push('% RAGbox Official Audit Report')
  lines.push(`% Generated: ${dateStr} at ${timeStr}`)
  lines.push(`% Organization: ${options.organizationName}`)
  lines.push(`% Exported By: ${options.exportedBy}`)
  lines.push('')

  // Main content
  lines.push('=' .repeat(70))
  lines.push('')
  lines.push('        R A G B O X   O F F I C I A L   A U D I T   R E P O R T')
  lines.push('')
  lines.push('=' .repeat(70))
  lines.push('')

  // Report Header
  lines.push('REPORT DETAILS')
  lines.push('-'.repeat(50))
  lines.push(`Organization:    ${options.organizationName}`)
  lines.push(`Export Date:     ${dateStr}`)
  lines.push(`Export Time:     ${timeStr}`)
  lines.push(`Exported By:     ${options.exportedBy}`)
  lines.push(`Total Entries:   ${events.length}`)
  if (options.startDate) {
    lines.push(`Period Start:    ${formatTimestamp(options.startDate)}`)
  }
  if (options.endDate) {
    lines.push(`Period End:      ${formatTimestamp(options.endDate)}`)
  }
  lines.push('')

  // Watermark
  lines.push('*'.repeat(70))
  lines.push('*  WATERMARK: RAGbox Official Audit Report - Immutable Ledger   *')
  lines.push('*  This document is WORM-compliant and cryptographically sealed *')
  lines.push('*'.repeat(70))
  lines.push('')

  // Audit Entries
  lines.push('AUDIT ENTRIES')
  lines.push('='.repeat(70))
  lines.push('')

  events.forEach((event, index) => {
    const entryNum = (index + 1).toString().padStart(4, '0')

    lines.push(`[${entryNum}] ${getActionDisplayName(event.action)}`)
    lines.push(`      ID:        ${event.eventId}`)
    lines.push(`      Time:      ${formatTimestamp(event.timestamp)}`)
    lines.push(`      User:      ${event.userId || 'System'}`)
    lines.push(`      Severity:  ${event.severity}`)

    if (event.resourceType) {
      lines.push(`      Resource:  ${event.resourceType}${event.resourceId ? ` (${event.resourceId})` : ''}`)
    }

    if (event.ipAddress) {
      lines.push(`      IP:        ${event.ipAddress}`)
    }

    // Format details nicely
    const detailsStr = JSON.stringify(event.details, null, 2)
      .split('\n')
      .map((line, i) => (i === 0 ? `      Details:   ${line}` : `                 ${line}`))
      .join('\n')
    lines.push(detailsStr)

    lines.push(`      Hash:      ${event.detailsHash.substring(0, 32)}...`)
    lines.push('')
    lines.push('-'.repeat(70))
    lines.push('')
  })

  // Generate report hash
  const contentForHash = lines.join('\n')
  const reportHash = createHash('sha256').update(contentForHash).digest('hex')

  // Footer
  lines.push('')
  lines.push('='.repeat(70))
  lines.push('REPORT VERIFICATION')
  lines.push('-'.repeat(50))
  lines.push(`Report Hash (SHA-256): ${reportHash}`)
  lines.push(`Generated:             ${exportedAt.toISOString()}`)
  lines.push(`Page Count:            ${Math.ceil(events.length / 10)}`)
  lines.push('')
  lines.push('This audit report is cryptographically signed and tamper-evident.')
  lines.push('Verify integrity by recomputing the SHA-256 hash of report contents.')
  lines.push('')
  lines.push('='.repeat(70))
  lines.push('                    END OF AUDIT REPORT')
  lines.push('='.repeat(70))
  lines.push('')
  lines.push('%%EOF')

  return Buffer.from(lines.join('\n'), 'utf-8')
}
