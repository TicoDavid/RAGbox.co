import chalk from 'chalk'
import { getConfig } from './config-store.js'

// RAGbox brand colors
const colors = {
  primary: chalk.hex('#00F0FF'),    // Electric Cyan
  warning: chalk.hex('#FFAB00'),    // Amber
  danger: chalk.hex('#FF3D00'),     // Neon Red
  success: chalk.hex('#00FF88'),    // Success Green
  muted: chalk.hex('#888888'),      // Text Muted
}

export function info(message: string): void {
  console.log(colors.primary('ℹ'), message)
}

export function success(message: string): void {
  console.log(colors.success('✓'), message)
}

export function warn(message: string): void {
  console.log(colors.warning('⚠'), message)
}

export function error(message: string): void {
  console.error(colors.danger('✗'), message)
}

export function debug(message: string): void {
  const config = getConfig()
  if (config.verbose) {
    console.log(colors.muted('⋯'), colors.muted(message))
  }
}

export function header(title: string): void {
  console.log()
  console.log(colors.primary('━'.repeat(50)))
  console.log(colors.primary.bold(`  ${title}`))
  console.log(colors.primary('━'.repeat(50)))
  console.log()
}

export function subheader(title: string): void {
  console.log()
  console.log(colors.primary.bold(`▸ ${title}`))
  console.log()
}

export function table(headers: string[], rows: string[][]): void {
  const config = getConfig()

  if (config.outputFormat === 'json') {
    const data = rows.map(row => {
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => {
        obj[h.toLowerCase().replace(/\s+/g, '_')] = row[i]
      })
      return obj
    })
    console.log(JSON.stringify(data, null, 2))
    return
  }

  // Calculate column widths
  const colWidths = headers.map((h, i) => {
    const maxDataWidth = Math.max(...rows.map(r => (r[i] || '').length))
    return Math.max(h.length, maxDataWidth)
  })

  // Print header
  const headerRow = headers
    .map((h, i) => colors.primary.bold(h.padEnd(colWidths[i])))
    .join('  ')
  console.log(headerRow)

  // Print separator
  const separator = colWidths
    .map(w => colors.muted('─'.repeat(w)))
    .join('  ')
  console.log(separator)

  // Print data rows
  rows.forEach(row => {
    const dataRow = row
      .map((cell, i) => (cell || '').padEnd(colWidths[i]))
      .join('  ')
    console.log(dataRow)
  })
}

export function json(data: unknown): void {
  console.log(JSON.stringify(data, null, 2))
}

export function keyValue(pairs: Array<[string, string | number | boolean | undefined]>): void {
  const config = getConfig()

  if (config.outputFormat === 'json') {
    const obj: Record<string, unknown> = {}
    pairs.forEach(([key, value]) => {
      obj[key.toLowerCase().replace(/\s+/g, '_')] = value
    })
    console.log(JSON.stringify(obj, null, 2))
    return
  }

  const maxKeyLength = Math.max(...pairs.map(([k]) => k.length))

  pairs.forEach(([key, value]) => {
    const paddedKey = key.padEnd(maxKeyLength)
    const displayValue = value === undefined ? colors.muted('(not set)') : String(value)
    console.log(`${colors.primary(paddedKey)}  ${displayValue}`)
  })
}

export function citation(
  index: number,
  documentName: string,
  excerpt: string,
  relevance: number
): void {
  console.log()
  console.log(colors.primary(`[${index}]`), colors.warning.bold(documentName))
  console.log(colors.muted('    Relevance:'), `${(relevance * 100).toFixed(1)}%`)
  console.log(colors.muted('    "') + excerpt.slice(0, 200) + (excerpt.length > 200 ? '...' : '') + colors.muted('"'))
}

export function answer(text: string): void {
  console.log()
  // Format answer with proper line wrapping
  const lines = text.split('\n')
  lines.forEach(line => {
    if (line.trim()) {
      console.log('  ' + line)
    } else {
      console.log()
    }
  })
  console.log()
}

export function confidence(score: number, threshold = 0.85): void {
  const percentage = (score * 100).toFixed(1)
  const color = score >= threshold ? colors.success : colors.warning
  const label = score >= threshold ? 'HIGH CONFIDENCE' : 'LOW CONFIDENCE'
  console.log(color(`  Confidence: ${percentage}% (${label})`))
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString()
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}

export function brand(): void {
  console.log()
  console.log(colors.primary.bold('  ╔═══════════════════════════════════════════╗'))
  console.log(colors.primary.bold('  ║') + '                                           ' + colors.primary.bold('║'))
  console.log(colors.primary.bold('  ║') + colors.primary.bold('            RAGbox.co CLI              ') + colors.primary.bold('║'))
  console.log(colors.primary.bold('  ║') + colors.muted('     Your Files Speak. We Make Them Testify.') + colors.primary.bold(' ║'))
  console.log(colors.primary.bold('  ║') + '                                           ' + colors.primary.bold('║'))
  console.log(colors.primary.bold('  ╚═══════════════════════════════════════════╝'))
  console.log()
}
