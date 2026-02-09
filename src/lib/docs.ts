import fs from 'fs'
import path from 'path'

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
    title: 'The Sovereign Uplink (API)',
    description: 'Programmatic access to the RAGbox intelligence system',
  },
  'security-compliance': {
    title: 'The Fortress Architecture',
    description: 'Encryption, compliance, and data sovereignty',
  },
  'best-practices': {
    title: 'Tactical Prompting',
    description: 'Master the art of intelligence extraction',
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
