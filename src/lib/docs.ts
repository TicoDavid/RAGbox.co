import fs from 'fs'
import path from 'path'

export interface TocEntry {
  id: string
  text: string
  level: number
}

export interface DocMeta {
  slug: string
  title: string
  description: string
}

export interface Doc extends DocMeta {
  content: string
}

const DOCS_DIR = path.join(process.cwd(), 'content', 'docs')

// Map slugs to metadata
const DOC_METADATA: Record<string, { title: string; description: string }> = {
  'getting-started': {
    title: 'Protocol Alpha: Initialization',
    description: 'Quick start guide for new sovereign operators',
  },
  'api-reference': {
    title: 'API Reference v1.0',
    description: 'Complete REST API documentation for RAGbox v1 endpoints',
  },
  'security-compliance': {
    title: 'The Fortress Architecture',
    description: 'Encryption, compliance, and data sovereignty',
  },
  'best-practices': {
    title: 'Tactical Prompting',
    description: 'Master the art of intelligence extraction',
  },
  'mcp-server-spec': {
    title: 'MCP Server Spec',
    description: 'Model Context Protocol integration guide for AI agents',
  },
}

/**
 * Get all available documentation slugs
 */
export function getAllDocSlugs(): string[] {
  try {
    const files = fs.readdirSync(DOCS_DIR)
    return files
      .filter((file) => file.endsWith('.md'))
      .map((file) => file.replace(/\.md$/, ''))
  } catch {
    return []
  }
}

/**
 * Get metadata for all docs (for listings)
 */
export function getAllDocsMeta(): DocMeta[] {
  const slugs = getAllDocSlugs()
  return slugs.map((slug) => ({
    slug,
    title: DOC_METADATA[slug]?.title || slug,
    description: DOC_METADATA[slug]?.description || '',
  }))
}

/**
 * Get a single doc by slug
 */
export function getDocBySlug(slug: string): Doc | null {
  try {
    const filePath = path.join(DOCS_DIR, `${slug}.md`)
    const content = fs.readFileSync(filePath, 'utf-8')

    return {
      slug,
      title: DOC_METADATA[slug]?.title || slug,
      description: DOC_METADATA[slug]?.description || '',
      content,
    }
  } catch {
    return null
  }
}

/**
 * Check if a doc exists
 */
export function docExists(slug: string): boolean {
  try {
    const filePath = path.join(DOCS_DIR, `${slug}.md`)
    return fs.existsSync(filePath)
  } catch {
    return false
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/**
 * Extract h2/h3 headings from markdown for table of contents
 */
export function extractHeadings(markdown: string): TocEntry[] {
  const entries: TocEntry[] = []
  const lines = markdown.split('\n')
  let inCodeBlock = false

  for (const line of lines) {
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue

    const match = line.match(/^(#{2,3})\s+(.+)/)
    if (match) {
      const text = match[2].replace(/\*\*/g, '').replace(/`/g, '')
      entries.push({
        id: slugify(text),
        text,
        level: match[1].length,
      })
    }
  }
  return entries
}
