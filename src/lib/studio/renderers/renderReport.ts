/**
 * Report Renderer — Markdown → DOCX
 *
 * Converts AI-generated Markdown into a Word document using the `docx` package.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
} from 'docx'

/**
 * Parse a Markdown string into DOCX paragraphs.
 * Handles: # headings, ## headings, ### headings, bullets, tables, body text.
 */
function markdownToDocxElements(md: string): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = []
  const lines = md.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Skip empty lines
    if (!line.trim()) {
      i++
      continue
    }

    // Table detection: line starts with | and next line is separator
    if (line.trim().startsWith('|') && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1].trim())) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i])
        i++
      }
      const table = parseMarkdownTable(tableLines)
      if (table) elements.push(table)
      continue
    }

    // Headings
    if (line.startsWith('### ')) {
      elements.push(
        new Paragraph({
          text: line.slice(4).trim(),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 },
        }),
      )
      i++
      continue
    }
    if (line.startsWith('## ')) {
      elements.push(
        new Paragraph({
          text: line.slice(3).trim(),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
        }),
      )
      i++
      continue
    }
    if (line.startsWith('# ')) {
      elements.push(
        new Paragraph({
          text: line.slice(2).trim(),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
      )
      i++
      continue
    }

    // Bullet / numbered list
    if (/^[-*]\s/.test(line.trim()) || /^\d+\.\s/.test(line.trim())) {
      const text = line.trim().replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '')
      elements.push(
        new Paragraph({
          children: parseInlineFormatting(text),
          bullet: { level: 0 },
          spacing: { before: 40, after: 40 },
        }),
      )
      i++
      continue
    }

    // Body paragraph
    elements.push(
      new Paragraph({
        children: parseInlineFormatting(line),
        spacing: { before: 60, after: 60 },
      }),
    )
    i++
  }

  return elements
}

/**
 * Parse inline **bold** and plain text into TextRun children.
 */
function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = []
  const parts = text.split(/(\*\*[^*]+\*\*)/)

  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true }))
    } else if (part) {
      runs.push(new TextRun({ text: part }))
    }
  }

  return runs
}

/**
 * Parse Markdown table lines into a docx Table.
 */
function parseMarkdownTable(tableLines: string[]): Table | null {
  const rows = tableLines
    .filter((l) => !/^\|[\s:|-]+\|$/.test(l.trim())) // skip separator
    .map((l) =>
      l
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim()),
    )

  if (rows.length === 0) return null

  const borderStyle = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: '999999',
  }
  const borders = {
    top: borderStyle,
    bottom: borderStyle,
    left: borderStyle,
    right: borderStyle,
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      (cells, rowIdx) =>
        new TableRow({
          children: cells.map(
            (cell) =>
              new TableCell({
                borders,
                width: { size: Math.floor(100 / cells.length), type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: cell,
                        bold: rowIdx === 0,
                        size: 20,
                      }),
                    ],
                    alignment: AlignmentType.LEFT,
                  }),
                ],
              }),
          ),
        }),
    ),
  })
}

/**
 * Render Markdown content to a .docx Buffer.
 */
export async function renderReport(markdown: string): Promise<Buffer> {
  const elements = markdownToDocxElements(markdown)

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        children: [
          // Watermark header
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'RAGBOX SOVEREIGN STUDIO',
                size: 16,
                color: '999999',
                font: 'Arial',
              }),
            ],
            spacing: { after: 400 },
          }),
          ...elements,
        ],
      },
    ],
  })

  return Buffer.from(await Packer.toBuffer(doc))
}
