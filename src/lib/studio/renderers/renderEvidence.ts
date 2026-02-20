/**
 * Evidence Renderer — JSON → XLSX
 *
 * Converts EvidenceLog JSON into a formatted Excel workbook using exceljs.
 */

import ExcelJS from 'exceljs'
import type { EvidenceLog } from '../types'
import { XLSX_SEVERITY as SEVERITY_COLORS, XLSX_HEADER_BG as HEADER_BG, XLSX_HEADER_FG as HEADER_FG } from './colors'

/**
 * Render an EvidenceLog to a .xlsx Buffer.
 */
export async function renderEvidence(log: EvidenceLog): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'RAGbox Sovereign Studio'
  workbook.created = new Date()

  // ── Evidence Sheet ─────────────────────────────
  const sheet = workbook.addWorksheet('Evidence Log', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  sheet.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Document Source', key: 'documentSource', width: 30 },
    { header: 'Excerpt', key: 'excerpt', width: 50 },
    { header: 'Category', key: 'category', width: 16 },
    { header: 'Significance', key: 'significance', width: 14 },
    { header: 'Page Ref', key: 'pageReference', width: 12 },
    { header: 'Notes', key: 'notes', width: 35 },
  ]

  // Style header row
  const headerRow = sheet.getRow(1)
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FG }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })
  headerRow.height = 28

  // Add data rows
  for (const entry of log.entries) {
    const row = sheet.addRow({
      id: entry.id,
      documentSource: entry.documentSource,
      excerpt: entry.excerpt,
      category: entry.category,
      significance: entry.significance,
      pageReference: entry.pageReference ?? '',
      notes: entry.notes ?? '',
    })

    // Color-code severity cell
    const severityCell = row.getCell('significance')
    const color = SEVERITY_COLORS[entry.significance] ?? SEVERITY_COLORS.low
    severityCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: color },
    }
    severityCell.font = {
      bold: true,
      color: { argb: entry.significance === 'low' ? 'FF000000' : 'FFFFFFFF' },
      size: 10,
    }
    severityCell.alignment = { horizontal: 'center' }

    // Wrap text for excerpt and notes
    row.getCell('excerpt').alignment = { wrapText: true, vertical: 'top' }
    row.getCell('notes').alignment = { wrapText: true, vertical: 'top' }
  }

  // ── Summary Sheet ──────────────────────────────
  const summary = workbook.addWorksheet('Summary')
  summary.columns = [
    { header: 'Metric', key: 'metric', width: 25 },
    { header: 'Value', key: 'value', width: 40 },
  ]

  const summaryHeaderRow = summary.getRow(1)
  summaryHeaderRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FG }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } }
  })

  const counts: Record<string, number> = {}
  for (const e of log.entries) {
    counts[e.significance] = (counts[e.significance] || 0) + 1
  }

  summary.addRow({ metric: 'Report Title', value: log.title })
  summary.addRow({ metric: 'Generated At', value: log.generatedAt })
  summary.addRow({ metric: 'Total Entries', value: log.entries.length })
  summary.addRow({ metric: 'Critical', value: counts.critical ?? 0 })
  summary.addRow({ metric: 'High', value: counts.high ?? 0 })
  summary.addRow({ metric: 'Medium', value: counts.medium ?? 0 })
  summary.addRow({ metric: 'Low', value: counts.low ?? 0 })
  summary.addRow({ metric: '', value: '' })
  summary.addRow({ metric: 'Summary', value: log.summary })

  // Write to buffer
  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}
