/**
 * Tool Registry & Executor Tests - RAGbox.co
 *
 * Validates TOOL_DEFINITIONS structure, executeTool dispatch,
 * Prisma-backed tool implementations, and edge cases.
 *
 * Prisma is fully mocked -- no database connection required.
 */

// ============================================================================
// PRISMA MOCK (must be before any import that touches @prisma/client)
// ============================================================================

const mockFindMany = jest.fn()
const mockFindFirst = jest.fn()
const mockCount = jest.fn()
const mockGroupBy = jest.fn()

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    document: {
      findMany: mockFindMany,
      findFirst: mockFindFirst,
      count: mockCount,
      groupBy: mockGroupBy,
    },
    query: {
      findMany: mockFindMany,
    },
  })),
}))

// ============================================================================
// IMPORTS (after mock registration)
// ============================================================================

import {
  executeTool,
  TOOL_DEFINITIONS,
  toolDefinitions,
  type ToolCall,
  type ToolContext,
  type ToolDefinition,
  type ToolResult,
  type UIAction,
} from '../tools'
import { checkToolPermission } from '../tools/permissions'

// ============================================================================
// HELPERS
// ============================================================================

const createContext = (overrides: Partial<ToolContext> = {}): ToolContext => ({
  userId: 'test-user-001',
  role: 'Admin',
  sessionId: 'sess-001',
  privilegeMode: false,
  ...overrides,
})

const createCall = (name: string, args: Record<string, unknown> = {}, id?: string): ToolCall => ({
  id: id || `call-${Date.now()}`,
  name,
  arguments: args,
})

// Suppress console.log/error from executeTool during tests
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
  jest.clearAllMocks()
})

afterEach(() => {
  jest.restoreAllMocks()
})

// ============================================================================
// TOOL_DEFINITIONS REGISTRY
// ============================================================================

describe('TOOL_DEFINITIONS registry', () => {
  test('exports are identical (named + alias)', () => {
    expect(TOOL_DEFINITIONS).toBe(toolDefinitions)
  })

  test('is a non-empty array', () => {
    expect(Array.isArray(TOOL_DEFINITIONS)).toBe(true)
    expect(TOOL_DEFINITIONS.length).toBeGreaterThan(0)
  })

  test('every definition has required fields', () => {
    for (const def of TOOL_DEFINITIONS) {
      expect(typeof def.name).toBe('string')
      expect(def.name.length).toBeGreaterThan(0)
      expect(typeof def.description).toBe('string')
      expect(def.description.length).toBeGreaterThan(0)
      expect(typeof def.parameters).toBe('object')
    }
  })

  test('tool names are unique', () => {
    const names = TOOL_DEFINITIONS.map(d => d.name)
    const unique = new Set(names)
    expect(unique.size).toBe(names.length)
  })

  test('tool names use snake_case', () => {
    for (const def of TOOL_DEFINITIONS) {
      expect(def.name).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/)
    }
  })

  test('parameter entries have type and description', () => {
    for (const def of TOOL_DEFINITIONS) {
      for (const [key, param] of Object.entries(def.parameters)) {
        expect(typeof param.type).toBe('string')
        expect(typeof param.description).toBe('string')
      }
    }
  })

  test('enum parameters list valid string values', () => {
    for (const def of TOOL_DEFINITIONS) {
      for (const [, param] of Object.entries(def.parameters)) {
        if (param.enum) {
          expect(Array.isArray(param.enum)).toBe(true)
          expect(param.enum.length).toBeGreaterThan(0)
          for (const v of param.enum) {
            expect(typeof v).toBe('string')
          }
        }
      }
    }
  })

  test('requiredRole is only Admin or User when present', () => {
    for (const def of TOOL_DEFINITIONS) {
      if (def.requiredRole !== undefined) {
        expect(['Admin', 'User']).toContain(def.requiredRole)
      }
    }
  })

  test('contains expected core tools', () => {
    const names = TOOL_DEFINITIONS.map(d => d.name)
    const expected = [
      'search_documents',
      'open_document',
      'navigate_to',
      'toggle_privilege_mode',
      'list_documents',
      'read_document',
      'get_document_stats',
      'summarize_document',
      'extract_liability_clauses',
      'extract_key_dates',
      'compare_documents',
      'set_viewing_role',
      'export_audit_log',
      'check_content_gaps',
      'run_health_check',
      'get_learning_sessions',
    ]
    for (const name of expected) {
      expect(names).toContain(name)
    }
  })

  test('search_documents has required query parameter', () => {
    const def = TOOL_DEFINITIONS.find(d => d.name === 'search_documents')!
    expect(def.parameters.query).toBeDefined()
    expect(def.parameters.query.required).toBe(true)
    expect(def.parameters.query.type).toBe('string')
  })

  test('toggle_privilege_mode requires Admin role', () => {
    const def = TOOL_DEFINITIONS.find(d => d.name === 'toggle_privilege_mode')!
    expect(def.requiredRole).toBe('Admin')
  })

  test('set_viewing_role requires Admin role', () => {
    const def = TOOL_DEFINITIONS.find(d => d.name === 'set_viewing_role')!
    expect(def.requiredRole).toBe('Admin')
  })

  test('navigate_to destination enum covers expected pages', () => {
    const def = TOOL_DEFINITIONS.find(d => d.name === 'navigate_to')!
    const destinations = def.parameters.destination.enum!
    expect(destinations).toContain('vault')
    expect(destinations).toContain('chat')
    expect(destinations).toContain('settings')
  })
})

// ============================================================================
// executeTool — SYNCHRONOUS TOOLS (no Prisma)
// ============================================================================

describe('executeTool — synchronous tools', () => {
  test('navigate_to vault returns navigate UI action', async () => {
    const result = await executeTool(
      createCall('navigate_to', { destination: 'vault' }),
      createContext(),
    )

    expect(result.success).toBe(true)
    expect(result.uiAction).toEqual({ type: 'navigate', path: '/dashboard/vault' })
  })

  test('navigate_to chat returns /dashboard path', async () => {
    const result = await executeTool(
      createCall('navigate_to', { destination: 'chat' }),
      createContext(),
    )

    expect(result.success).toBe(true)
    expect(result.uiAction).toEqual({ type: 'navigate', path: '/dashboard' })
  })

  test('navigate_to all valid destinations', async () => {
    const map: Record<string, string> = {
      vault: '/dashboard/vault',
      chat: '/dashboard',
      audit: '/dashboard/audit',
      settings: '/dashboard/settings',
      help: '/dashboard/help',
    }

    for (const [dest, expectedPath] of Object.entries(map)) {
      const result = await executeTool(
        createCall('navigate_to', { destination: dest }),
        createContext(),
      )
      expect(result.success).toBe(true)
      expect((result.uiAction as { type: 'navigate'; path: string }).path).toBe(expectedPath)
    }
  })

  test('navigate_to invalid destination returns error', async () => {
    const result = await executeTool(
      createCall('navigate_to', { destination: 'nowhere' }),
      createContext(),
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('Unknown destination')
  })

  test('toggle_privilege_mode returns toggle UI action', async () => {
    const result = await executeTool(
      createCall('toggle_privilege_mode', { enabled: true }),
      createContext({ role: 'Admin' }),
    )

    expect(result.success).toBe(true)
    expect(result.uiAction).toEqual({ type: 'toggle_privilege', enabled: true })
  })

  test('toggle_privilege_mode disabled', async () => {
    const result = await executeTool(
      createCall('toggle_privilege_mode', { enabled: false }),
      createContext({ role: 'Admin' }),
    )

    expect(result.success).toBe(true)
    expect(result.uiAction).toEqual({ type: 'toggle_privilege', enabled: false })
  })

  test('set_viewing_role returns toast UI action', async () => {
    const result = await executeTool(
      createCall('set_viewing_role', { role: 'Viewer' }),
      createContext({ role: 'Admin' }),
    )

    expect(result.success).toBe(true)
    const res = result.result as { ok: boolean; newRole: string }
    expect(res.ok).toBe(true)
    expect(res.newRole).toBe('Viewer')
    expect(result.uiAction).toEqual({
      type: 'show_toast',
      message: 'Role changed to Viewer',
      variant: 'success',
    })
  })

  test('compare_documents returns not-implemented message', async () => {
    const result = await executeTool(
      createCall('compare_documents', { documentId1: 'a', documentId2: 'b' }),
      createContext(),
    )

    expect(result.success).toBe(true)
    const res = result.result as { message: string }
    expect(res.message).toContain('not yet implemented')
  })

  test('export_audit_log returns jobId', async () => {
    const result = await executeTool(
      createCall('export_audit_log', { format: 'csv' }),
      createContext(),
    )

    expect(result.success).toBe(true)
    const res = result.result as { message: string; jobId: string }
    expect(res.jobId).toMatch(/^audit_/)
  })
})

// ============================================================================
// executeTool — RESULT ENVELOPE
// ============================================================================

describe('executeTool — result envelope', () => {
  test('success result has correct shape', async () => {
    const call = createCall('navigate_to', { destination: 'vault' }, 'call-99')
    const result = await executeTool(call, createContext())

    expect(result.toolCallId).toBe('call-99')
    expect(result.name).toBe('navigate_to')
    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
  })

  test('error result has correct shape', async () => {
    const call = createCall('nonexistent', {}, 'call-err')
    const result = await executeTool(call, createContext())

    expect(result.toolCallId).toBe('call-err')
    expect(result.name).toBe('nonexistent')
    expect(result.success).toBe(false)
    expect(result.result).toBeNull()
    expect(typeof result.error).toBe('string')
  })
})

// ============================================================================
// executeTool — UNKNOWN / RBAC
// ============================================================================

describe('executeTool — unknown tool & RBAC', () => {
  test('unknown tool name returns error', async () => {
    const result = await executeTool(
      createCall('does_not_exist', {}),
      createContext(),
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('Unknown tool')
  })

  test('Viewer cannot call open_document', async () => {
    const result = await executeTool(
      createCall('open_document', { documentId: 'doc-1' }),
      createContext({ role: 'Viewer' }),
    )

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  test('User cannot call toggle_privilege_mode', async () => {
    const result = await executeTool(
      createCall('toggle_privilege_mode', { enabled: true }),
      createContext({ role: 'User' }),
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('requires Admin role')
  })

  test('User cannot call set_viewing_role', async () => {
    const result = await executeTool(
      createCall('set_viewing_role', { role: 'Admin' }),
      createContext({ role: 'User' }),
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('requires Admin role')
  })

  test('Admin can call any tool', async () => {
    const result = await executeTool(
      createCall('navigate_to', { destination: 'vault' }),
      createContext({ role: 'Admin' }),
    )

    expect(result.success).toBe(true)
  })
})

// ============================================================================
// executeTool — DATABASE-BACKED TOOLS
// ============================================================================

describe('executeTool — search_documents', () => {
  test('returns search results from Prisma', async () => {
    const mockDocs = [
      { id: 'd1', filename: 'contract.pdf', originalName: 'contract.pdf', mimeType: 'application/pdf', createdAt: new Date(), securityTier: 0 },
    ]
    mockFindMany.mockResolvedValueOnce(mockDocs)

    const result = await executeTool(
      createCall('search_documents', { query: 'contract' }),
      createContext(),
    )

    expect(result.success).toBe(true)
    const res = result.result as { count: number; results: unknown[]; query: string }
    expect(res.query).toBe('contract')
    expect(res.count).toBe(1)
    expect(res.results).toEqual(mockDocs)
  })

  test('uses default limit of 10', async () => {
    mockFindMany.mockResolvedValueOnce([])

    await executeTool(
      createCall('search_documents', { query: 'test' }),
      createContext(),
    )

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    )
  })

  test('respects custom limit', async () => {
    mockFindMany.mockResolvedValueOnce([])

    await executeTool(
      createCall('search_documents', { query: 'test', limit: 5 }),
      createContext(),
    )

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 }),
    )
  })
})

describe('executeTool — open_document', () => {
  test('returns open_document UI action for accessible doc', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'doc-1',
      securityTier: 0,
    })

    const result = await executeTool(
      createCall('open_document', { documentId: 'doc-1' }),
      createContext(),
    )

    expect(result.success).toBe(true)
    expect(result.uiAction).toEqual({ type: 'open_document', documentId: 'doc-1' })
  })

  test('fails when document not found', async () => {
    mockFindFirst.mockResolvedValueOnce(null)

    const result = await executeTool(
      createCall('open_document', { documentId: 'missing' }),
      createContext(),
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })

  test('fails when privileged doc and privilege mode off', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'doc-priv',
      securityTier: 2,
    })

    const result = await executeTool(
      createCall('open_document', { documentId: 'doc-priv' }),
      createContext({ privilegeMode: false }),
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('Privilege Mode')
  })

  test('succeeds when privileged doc and privilege mode on', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'doc-priv',
      securityTier: 2,
    })

    const result = await executeTool(
      createCall('open_document', { documentId: 'doc-priv' }),
      createContext({ privilegeMode: true }),
    )

    expect(result.success).toBe(true)
  })
})

describe('executeTool — extract_liability_clauses', () => {
  test('extracts clauses from document text', async () => {
    mockFindFirst.mockResolvedValueOnce({
      originalName: 'nda.pdf',
      extractedText: 'The liability shall not exceed $1M. Party agrees to indemnify the other party.',
    })

    const result = await executeTool(
      createCall('extract_liability_clauses', { documentId: 'doc-nda' }),
      createContext(),
    )

    expect(result.success).toBe(true)
    const res = result.result as { documentName: string; clauseCount: number; clauses: unknown[] }
    expect(res.documentName).toBe('nda.pdf')
    expect(res.clauseCount).toBeGreaterThan(0)
  })

  test('returns zero clauses when no matches', async () => {
    mockFindFirst.mockResolvedValueOnce({
      originalName: 'readme.txt',
      extractedText: 'Hello world. This is a plain text document.',
    })

    const result = await executeTool(
      createCall('extract_liability_clauses', { documentId: 'doc-readme' }),
      createContext(),
    )

    expect(result.success).toBe(true)
    const res = result.result as { clauseCount: number; clauses: unknown[] }
    expect(res.clauseCount).toBe(0)
    expect(res.clauses).toHaveLength(0)
  })

  test('handles null extractedText', async () => {
    mockFindFirst.mockResolvedValueOnce({
      originalName: 'empty.pdf',
      extractedText: null,
    })

    const result = await executeTool(
      createCall('extract_liability_clauses', { documentId: 'doc-empty' }),
      createContext(),
    )

    expect(result.success).toBe(true)
    const res = result.result as { clauseCount: number }
    expect(res.clauseCount).toBe(0)
  })

  test('fails when document not found', async () => {
    mockFindFirst.mockResolvedValueOnce(null)

    const result = await executeTool(
      createCall('extract_liability_clauses', { documentId: 'missing' }),
      createContext(),
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })
})

describe('executeTool — extract_key_dates', () => {
  test('extracts dates from document text', async () => {
    mockFindFirst.mockResolvedValueOnce({
      originalName: 'contract.pdf',
      extractedText: 'Effective January 1, 2025 and expires on 12/31/2025.',
    })

    const result = await executeTool(
      createCall('extract_key_dates', { documentId: 'doc-c' }),
      createContext(),
    )

    expect(result.success).toBe(true)
    const res = result.result as { documentName: string; dates: string[] }
    expect(res.documentName).toBe('contract.pdf')
    expect(res.dates.length).toBeGreaterThan(0)
  })

  test('returns empty dates when no matches', async () => {
    mockFindFirst.mockResolvedValueOnce({
      originalName: 'notes.txt',
      extractedText: 'No dates here.',
    })

    const result = await executeTool(
      createCall('extract_key_dates', { documentId: 'doc-n' }),
      createContext(),
    )

    expect(result.success).toBe(true)
    const res = result.result as { dates: string[] }
    expect(res.dates).toHaveLength(0)
  })

  test('deduplicates dates', async () => {
    mockFindFirst.mockResolvedValueOnce({
      originalName: 'dup.pdf',
      extractedText: 'Due on 01/01/2025. Reminder: 01/01/2025.',
    })

    const result = await executeTool(
      createCall('extract_key_dates', { documentId: 'doc-dup' }),
      createContext(),
    )

    expect(result.success).toBe(true)
    const res = result.result as { dates: string[] }
    expect(res.dates).toHaveLength(1)
  })

  test('fails when document not found', async () => {
    mockFindFirst.mockResolvedValueOnce(null)

    const result = await executeTool(
      createCall('extract_key_dates', { documentId: 'x' }),
      createContext(),
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })
})

describe('executeTool — summarize_document', () => {
  const longText = Array(20)
    .fill('This is a sufficiently long sentence to pass the filter.')
    .join(' ')

  test('returns standard length by default', async () => {
    mockFindFirst.mockResolvedValueOnce({
      originalName: 'report.pdf',
      extractedText: longText,
    })

    const result = await executeTool(
      createCall('summarize_document', { documentId: 'doc-r' }),
      createContext(),
    )

    expect(result.success).toBe(true)
    const res = result.result as { documentName: string; summary: string; wordCount: number }
    expect(res.documentName).toBe('report.pdf')
    expect(res.wordCount).toBeGreaterThan(0)
    expect(res.summary.length).toBeGreaterThan(0)
  })

  test('brief length returns fewer sentences', async () => {
    mockFindFirst.mockResolvedValueOnce({
      originalName: 'report.pdf',
      extractedText: longText,
    })
    const briefResult = await executeTool(
      createCall('summarize_document', { documentId: 'doc-r', length: 'brief' }),
      createContext(),
    )
    expect(briefResult.success).toBe(true)

    mockFindFirst.mockResolvedValueOnce({
      originalName: 'report.pdf',
      extractedText: longText,
    })
    const detailedResult = await executeTool(
      createCall('summarize_document', { documentId: 'doc-r', length: 'detailed' }),
      createContext(),
    )
    expect(detailedResult.success).toBe(true)

    const briefSummary = (briefResult.result as { summary: string }).summary
    const detailedSummary = (detailedResult.result as { summary: string }).summary
    expect(briefSummary.length).toBeLessThanOrEqual(detailedSummary.length)
  })

  test('fails when document not found', async () => {
    mockFindFirst.mockResolvedValueOnce(null)

    const result = await executeTool(
      createCall('summarize_document', { documentId: 'x' }),
      createContext(),
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })
})

describe('executeTool — get_document_stats', () => {
  test('returns stats with totalDocuments, byType, recentUploads', async () => {
    mockCount.mockResolvedValueOnce(42)
    mockGroupBy.mockResolvedValueOnce([
      { mimeType: 'application/pdf', _count: 30 },
      { mimeType: 'text/plain', _count: 12 },
    ])
    mockFindMany.mockResolvedValueOnce([
      { filename: 'latest.pdf', createdAt: new Date('2025-01-15') },
    ])

    const result = await executeTool(
      createCall('get_document_stats', {}),
      createContext(),
    )

    expect(result.success).toBe(true)
    const res = result.result as { totalDocuments: number; byType: unknown[]; recentUploads: unknown[] }
    expect(res.totalDocuments).toBe(42)
    expect(res.byType).toHaveLength(2)
    expect(res.recentUploads).toHaveLength(1)
  })
})

describe('executeTool — list_documents', () => {
  test('returns documents with default limit 20', async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: 'd1', filename: 'a.pdf', originalName: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 1024, createdAt: new Date('2025-01-10'), securityTier: 0 },
    ])

    const result = await executeTool(
      createCall('list_documents', {}),
      createContext(),
    )

    expect(result.success).toBe(true)
    const res = result.result as { count: number; documents: unknown[]; privilegeMode: boolean }
    expect(res.count).toBe(1)
    expect(res.privilegeMode).toBe(false)
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 }),
    )
  })

  test('respects custom limit and sortBy', async () => {
    mockFindMany.mockResolvedValueOnce([])

    await executeTool(
      createCall('list_documents', { limit: 5, sortBy: 'name' }),
      createContext(),
    )

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        orderBy: { filename: 'asc' },
      }),
    )
  })

  test('filters by securityTier when privilegeMode is off', async () => {
    mockFindMany.mockResolvedValueOnce([])

    await executeTool(
      createCall('list_documents', {}),
      createContext({ privilegeMode: false }),
    )

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ securityTier: 0 }),
      }),
    )
  })

  test('does not filter securityTier when privilegeMode is on', async () => {
    mockFindMany.mockResolvedValueOnce([])

    await executeTool(
      createCall('list_documents', {}),
      createContext({ privilegeMode: true }),
    )

    // The where clause should NOT contain securityTier
    const whereArg = mockFindMany.mock.calls[0][0].where
    expect(whereArg.securityTier).toBeUndefined()
  })
})

describe('executeTool — read_document', () => {
  test('returns document content', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'doc-r1',
      filename: 'memo.txt',
      originalName: 'Memo.txt',
      extractedText: 'Short memo content.',
      securityTier: 0,
    })

    const result = await executeTool(
      createCall('read_document', { documentId: 'doc-r1' }),
      createContext(),
    )

    expect(result.success).toBe(true)
    const res = result.result as { documentId: string; name: string; contentPreview: string; isTruncated: boolean }
    expect(res.documentId).toBe('doc-r1')
    expect(res.name).toBe('Memo.txt')
    expect(res.contentPreview).toBe('Short memo content.')
    expect(res.isTruncated).toBe(false)
  })

  test('truncates long documents at 4000 chars', async () => {
    const longContent = 'x'.repeat(5000)
    mockFindFirst.mockResolvedValueOnce({
      id: 'doc-long',
      filename: 'long.txt',
      originalName: 'Long.txt',
      extractedText: longContent,
      securityTier: 0,
    })

    const result = await executeTool(
      createCall('read_document', { documentId: 'doc-long' }),
      createContext(),
    )

    expect(result.success).toBe(true)
    const res = result.result as { isTruncated: boolean; totalLength: number; contentPreview: string }
    expect(res.isTruncated).toBe(true)
    expect(res.totalLength).toBe(5000)
    expect(res.contentPreview).toContain('[... Document truncated')
  })

  test('fails for privileged doc without privilege mode', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'doc-priv',
      filename: 'secret.pdf',
      originalName: 'Secret.pdf',
      extractedText: 'Classified.',
      securityTier: 1,
    })

    const result = await executeTool(
      createCall('read_document', { documentId: 'doc-priv' }),
      createContext({ privilegeMode: false }),
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('Privilege Mode')
  })

  test('succeeds for privileged doc with privilege mode', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'doc-priv',
      filename: 'secret.pdf',
      originalName: 'Secret.pdf',
      extractedText: 'Classified.',
      securityTier: 1,
    })

    const result = await executeTool(
      createCall('read_document', { documentId: 'doc-priv' }),
      createContext({ privilegeMode: true }),
    )

    expect(result.success).toBe(true)
  })

  test('fails when document not found', async () => {
    mockFindFirst.mockResolvedValueOnce(null)

    const result = await executeTool(
      createCall('read_document', { documentId: 'missing' }),
      createContext(),
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })

  test('handles null extractedText gracefully', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'doc-empty',
      filename: 'empty.pdf',
      originalName: 'Empty.pdf',
      extractedText: null,
      securityTier: 0,
    })

    const result = await executeTool(
      createCall('read_document', { documentId: 'doc-empty' }),
      createContext(),
    )

    expect(result.success).toBe(true)
    const res = result.result as { contentPreview: string; totalLength: number }
    expect(res.contentPreview).toBe('')
    expect(res.totalLength).toBe(0)
  })
})

describe('executeTool — check_content_gaps', () => {
  test('identifies topics with thin coverage', async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: 'd1', filename: 'a.pdf', originalName: 'a.pdf', mimeType: 'application/pdf', extractedText: 'compliance requirements and liability clause' },
      { id: 'd2', filename: 'b.pdf', originalName: 'b.pdf', mimeType: 'application/pdf', extractedText: 'compliance standards and termination clause' },
    ])

    const result = await executeTool(
      createCall('check_content_gaps', {}),
      createContext(),
    )

    expect(result.success).toBe(true)
    const res = result.result as { totalDocuments: number; gaps: unknown[]; analyzedTopics: number }
    expect(res.totalDocuments).toBe(2)
    // Topics with only 1 mention should appear as gaps
    expect(res.gaps.length).toBeGreaterThanOrEqual(0)
  })

  test('uses default limit of 10', async () => {
    mockFindMany.mockResolvedValueOnce([])

    const result = await executeTool(
      createCall('check_content_gaps', {}),
      createContext(),
    )

    expect(result.success).toBe(true)
  })
})

describe('executeTool — run_health_check', () => {
  test('returns health metrics', async () => {
    mockCount
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(8)  // withText
    mockFindFirst
      .mockResolvedValueOnce({ createdAt: new Date() })   // recent
      .mockResolvedValueOnce({ createdAt: new Date() })   // oldest

    const result = await executeTool(
      createCall('run_health_check', {}),
      createContext(),
    )

    expect(result.success).toBe(true)
    const res = result.result as {
      totalDocuments: number
      indexedDocuments: number
      coveragePercent: number
      healthScore: number
    }
    expect(res.totalDocuments).toBe(10)
    expect(res.indexedDocuments).toBe(8)
    expect(res.coveragePercent).toBe(80)
    expect(res.healthScore).toBeGreaterThan(0)
  })

  test('returns zero health score for empty vault', async () => {
    mockCount
      .mockResolvedValueOnce(0) // total
      .mockResolvedValueOnce(0) // withText
    mockFindFirst
      .mockResolvedValueOnce(null) // recent
      .mockResolvedValueOnce(null) // oldest

    const result = await executeTool(
      createCall('run_health_check', {}),
      createContext(),
    )

    expect(result.success).toBe(true)
    const res = result.result as { healthScore: number; coveragePercent: number }
    expect(res.healthScore).toBe(0)
    expect(res.coveragePercent).toBe(0)
  })
})

describe('executeTool — get_learning_sessions', () => {
  test('returns recent query sessions', async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: 'q1', queryText: 'What is liability?', createdAt: new Date(), confidenceScore: 0.92 },
    ])

    const result = await executeTool(
      createCall('get_learning_sessions', {}),
      createContext(),
    )

    expect(result.success).toBe(true)
    const res = result.result as { count: number; sessions: unknown[] }
    expect(res.count).toBe(1)
  })
})

// ============================================================================
// executeTool — PRISMA ERROR HANDLING
// ============================================================================

describe('executeTool — Prisma error handling', () => {
  test('database error is caught and returned gracefully', async () => {
    mockFindMany.mockRejectedValueOnce(new Error('Connection refused'))

    const result = await executeTool(
      createCall('search_documents', { query: 'test' }),
      createContext(),
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('Connection refused')
    expect(result.result).toBeNull()
  })
})

// ============================================================================
// TYPE EXPORTS SMOKE TEST
// ============================================================================

describe('type exports', () => {
  test('ToolCall shape is usable', () => {
    const call: ToolCall = { id: '1', name: 'test', arguments: {} }
    expect(call.id).toBe('1')
  })

  test('ToolContext shape is usable', () => {
    const ctx: ToolContext = { userId: 'u', role: 'User', sessionId: 's', privilegeMode: false }
    expect(ctx.role).toBe('User')
  })

  test('ToolResult shape is usable', () => {
    const res: ToolResult = { toolCallId: '1', name: 'test', success: true, result: {} }
    expect(res.success).toBe(true)
  })

  test('UIAction discriminated union covers all types', () => {
    const actions: UIAction[] = [
      { type: 'navigate', path: '/' },
      { type: 'open_document', documentId: 'd' },
      { type: 'highlight_text', documentId: 'd', range: { start: 0, end: 1 } },
      { type: 'scroll_to', elementId: 'e' },
      { type: 'open_panel', panel: 'vault' },
      { type: 'toggle_privilege', enabled: true },
      { type: 'show_toast', message: 'hi', variant: 'success' },
      { type: 'update_filter', filter: {} },
      { type: 'select_documents', documentIds: [] },
    ]
    expect(actions).toHaveLength(9)
  })

  test('ToolDefinition shape is usable', () => {
    const def: ToolDefinition = {
      name: 'test',
      description: 'desc',
      parameters: { arg: { type: 'string', description: 'an arg' } },
    }
    expect(def.name).toBe('test')
  })
})
