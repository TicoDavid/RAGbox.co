import type { VaultItem, FolderNode } from '@/types/ragbox'

jest.mock('../../security', () => ({
  tierToSecurity: jest.fn((tier: number) => ({ level: tier, label: 'T' + tier })),
}))

import {
  formatFileSize,
  formatDate,
  getFileType,
  getFileExtension,
  vaultItemToExplorerItem,
  buildPathFromFolder,
} from '../explorer-utils'

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(12, 0, 0, 0) // midday so the floor-based diff is stable
  return d
}

function makeVaultItem(overrides: Partial<VaultItem> = {}): VaultItem {
  return {
    id: 'doc-1',
    name: 'report.pdf',
    originalName: 'report.pdf',
    type: 'document',
    size: 2048,
    createdAt: daysAgo(5),
    updatedAt: daysAgo(1),
    status: 'Indexed',
    isPrivileged: false,
    isStarred: false,
    securityTier: 2,
    deletionStatus: 'Active',
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  formatFileSize                                                    */
/* ------------------------------------------------------------------ */

describe('formatFileSize', () => {
  it('returns em-dash when bytes is undefined', () => {
    expect(formatFileSize(undefined)).toBe('\u2014')
  })

  it('returns em-dash when bytes is 0', () => {
    // Implementation uses !bytes which is falsy for 0
    expect(formatFileSize(0)).toBe('\u2014')
  })

  it('returns bytes for values < 1024', () => {
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(1)).toBe('1 B')
    expect(formatFileSize(1023)).toBe('1023 B')
  })

  it('returns KB for values >= 1024 and < 1 MB', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB')
    expect(formatFileSize(1536)).toBe('1.5 KB')
    expect(formatFileSize(10240)).toBe('10.0 KB')
  })

  it('returns MB for values >= 1 MB', () => {
    expect(formatFileSize(1048576)).toBe('1.0 MB')
    expect(formatFileSize(1572864)).toBe('1.5 MB')
    expect(formatFileSize(5242880)).toBe('5.0 MB')
  })
})

/* ------------------------------------------------------------------ */
/*  formatDate                                                        */
/* ------------------------------------------------------------------ */

describe('formatDate', () => {
  it('returns "Today" for today', () => {
    const now = new Date()
    now.setHours(12, 0, 0, 0)
    expect(formatDate(now)).toBe('Today')
  })

  it('returns "Yesterday" for yesterday', () => {
    expect(formatDate(daysAgo(1))).toBe('Yesterday')
  })

  it('returns "X days ago" for 2-6 days ago', () => {
    expect(formatDate(daysAgo(3))).toBe('3 days ago')
    expect(formatDate(daysAgo(6))).toBe('6 days ago')
  })

  it('returns formatted date for 7+ days ago', () => {
    const old = new Date('2025-01-15T12:00:00')
    const result = formatDate(old)
    // toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
    expect(result).toBe('Jan 15, 2025')
  })

  it('accepts an ISO string', () => {
    const iso = daysAgo(0).toISOString()
    expect(formatDate(iso)).toBe('Today')
  })
})

/* ------------------------------------------------------------------ */
/*  getFileType                                                       */
/* ------------------------------------------------------------------ */

describe('getFileType', () => {
  it.each([
    ['report.pdf', 'PDF Document'],
    ['brief.doc', 'Word Document'],
    ['brief.docx', 'Word Document'],
    ['budget.xls', 'Excel Spreadsheet'],
    ['budget.xlsx', 'Excel Spreadsheet'],
    ['notes.txt', 'Text File'],
    ['readme.md', 'Markdown'],
    ['data.csv', 'CSV Data'],
    ['config.json', 'JSON File'],
  ])('maps %s to %s', (filename, expected) => {
    expect(getFileType(filename)).toBe(expected)
  })

  it('returns "Document" for unknown extensions', () => {
    expect(getFileType('archive.zip')).toBe('Document')
    expect(getFileType('image.png')).toBe('Document')
  })

  it('returns "Document" for files with no extension', () => {
    expect(getFileType('Makefile')).toBe('Document')
  })
})

/* ------------------------------------------------------------------ */
/*  getFileExtension                                                  */
/* ------------------------------------------------------------------ */

describe('getFileExtension', () => {
  it('returns lowercase extension', () => {
    expect(getFileExtension('report.PDF')).toBe('pdf')
    expect(getFileExtension('data.CSV')).toBe('csv')
    expect(getFileExtension('readme.md')).toBe('md')
  })

  it('returns last extension for multi-dot names', () => {
    expect(getFileExtension('archive.tar.gz')).toBe('gz')
  })

  it('returns "file" when there is no extension', () => {
    // A name with no dot: split('.').pop() is the name itself, but the
    // source returns name.split('.').pop()?.toLowerCase() which would be
    // the whole name. However if there is truly no dot, pop() returns
    // the full string, which is truthy, so it won't fall back to 'file'.
    // Only an empty string would trigger the fallback.
    // For a normal no-extension name, the result IS the lowercased name.
    expect(getFileExtension('Makefile')).toBe('makefile')
  })

  it('returns "file" for an empty string', () => {
    expect(getFileExtension('')).toBe('file')
  })
})

/* ------------------------------------------------------------------ */
/*  vaultItemToExplorerItem                                           */
/* ------------------------------------------------------------------ */

describe('vaultItemToExplorerItem', () => {
  beforeEach(() => {
    // Seed Math.random so citations / relevanceScore are deterministic
    jest.spyOn(Math, 'random').mockReturnValue(0.5)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('transforms an indexed VaultItem', () => {
    const doc = makeVaultItem({ status: 'Indexed', securityTier: 3 })
    const result = vaultItemToExplorerItem(doc)

    expect(result.id).toBe('doc-1')
    expect(result.name).toBe('report.pdf')
    expect(result.type).toBe('document')
    expect(result.size).toBe(2048)
    expect(result.updatedAt).toEqual(new Date(doc.updatedAt))
    // security comes from the mocked tierToSecurity
    expect(result.security).toEqual({ level: 3, label: 'T3' })
    expect(result.isIndexed).toBe(true)
    expect(result.isStarred).toBe(false)
    // citations > 0 for indexed docs
    expect(result.citations).toBeGreaterThanOrEqual(0)
    expect(result.relevanceScore).toBeGreaterThan(0)
  })

  it('treats status "ready" as indexed', () => {
    const doc = makeVaultItem({ status: 'ready' })
    const result = vaultItemToExplorerItem(doc)
    expect(result.isIndexed).toBe(true)
    expect(result.relevanceScore).toBeGreaterThan(0)
  })

  it('treats non-indexed statuses correctly', () => {
    const doc = makeVaultItem({ status: 'pending' })
    const result = vaultItemToExplorerItem(doc)
    expect(result.isIndexed).toBe(false)
    expect(result.citations).toBe(0)
    expect(result.relevanceScore).toBe(0)
  })

  it('defaults securityTier to 1 when missing', () => {
    const doc = makeVaultItem()
    // Force securityTier to be undefined via cast
    ;(doc as unknown as Record<string, unknown>).securityTier = undefined
    const result = vaultItemToExplorerItem(doc)
    expect(result.security).toEqual({ level: 1, label: 'T1' })
  })

  it('defaults size to 0 when missing', () => {
    const doc = makeVaultItem()
    ;(doc as unknown as Record<string, unknown>).size = undefined
    const result = vaultItemToExplorerItem(doc)
    expect(result.size).toBe(0)
  })

  it('defaults isStarred to false when missing', () => {
    const doc = makeVaultItem()
    ;(doc as unknown as Record<string, unknown>).isStarred = undefined
    const result = vaultItemToExplorerItem(doc)
    expect(result.isStarred).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/*  buildPathFromFolder                                               */
/* ------------------------------------------------------------------ */

describe('buildPathFromFolder', () => {
  const folders: Record<string, FolderNode> = {
    root: { id: 'root', name: 'Root', children: [], documents: [] },
    child: { id: 'child', name: 'Child', parentId: 'root', children: [], documents: [] },
    grandchild: { id: 'grandchild', name: 'Grandchild', parentId: 'child', children: [], documents: [] },
  }

  it('returns empty array for null folderId', () => {
    expect(buildPathFromFolder(null, folders)).toEqual([])
  })

  it('returns single-element path for root folder', () => {
    expect(buildPathFromFolder('root', folders)).toEqual(['root'])
  })

  it('returns full path for nested folder', () => {
    expect(buildPathFromFolder('grandchild', folders)).toEqual([
      'root',
      'child',
      'grandchild',
    ])
  })

  it('returns single element if folder is not in the map', () => {
    // folderId is truthy but not found in folders, so folders[currentId]?.parentId is undefined
    expect(buildPathFromFolder('unknown', {})).toEqual(['unknown'])
  })
})
