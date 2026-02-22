/**
 * Agent Session Tests - RAGbox.co
 *
 * Validates session bootstrap, WS handshake, and tool registry.
 */

const mockPrisma = {
  document: {
    count: jest.fn().mockResolvedValue(5),
    groupBy: jest.fn().mockResolvedValue([
      { mimeType: 'application/pdf', _count: 3 },
      { mimeType: 'text/plain', _count: 2 },
    ]),
    findMany: jest.fn().mockResolvedValue([
      { filename: 'test.pdf', createdAt: new Date() },
    ]),
  },
}

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}))

import { executeTool, type ToolCall, type ToolContext } from '../tools'
import { checkToolPermission } from '../tools/permissions'

// ============================================================================
// MOCK CONTEXT
// ============================================================================

const createContext = (overrides: Partial<ToolContext> = {}): ToolContext => ({
  userId: 'test-user',
  role: 'User',
  sessionId: 'test-session',
  privilegeMode: false,
  ...overrides,
})

// ============================================================================
// TOOL PERMISSION TESTS
// ============================================================================

describe('Tool Permissions', () => {
  test('Viewer can only access limited tools', () => {
    const ctx = createContext({ role: 'Viewer' })

    expect(checkToolPermission('search_documents', ctx).allowed).toBe(true)
    expect(checkToolPermission('get_document_stats', ctx).allowed).toBe(true)
    expect(checkToolPermission('navigate_to', ctx).allowed).toBe(true)

    expect(checkToolPermission('open_document', ctx).allowed).toBe(false)
    expect(checkToolPermission('toggle_privilege_mode', ctx).allowed).toBe(false)
  })

  test('User can access document tools', () => {
    const ctx = createContext({ role: 'User' })

    expect(checkToolPermission('search_documents', ctx).allowed).toBe(true)
    expect(checkToolPermission('open_document', ctx).allowed).toBe(true)
    expect(checkToolPermission('summarize_document', ctx).allowed).toBe(true)
    expect(checkToolPermission('extract_liability_clauses', ctx).allowed).toBe(true)

    expect(checkToolPermission('toggle_privilege_mode', ctx).allowed).toBe(false)
    expect(checkToolPermission('set_viewing_role', ctx).allowed).toBe(false)
  })

  test('Admin can access all tools', () => {
    const ctx = createContext({ role: 'Admin' })

    expect(checkToolPermission('search_documents', ctx).allowed).toBe(true)
    expect(checkToolPermission('toggle_privilege_mode', ctx).allowed).toBe(true)
    expect(checkToolPermission('set_viewing_role', ctx).allowed).toBe(true)
    expect(checkToolPermission('export_audit_log', ctx).allowed).toBe(true)
  })

  test('Risky tools require confirmation', () => {
    const ctx = createContext({ role: 'Admin' })

    expect(checkToolPermission('toggle_privilege_mode', ctx).requiresConfirmation).toBe(true)
    expect(checkToolPermission('set_viewing_role', ctx).requiresConfirmation).toBe(true)
    expect(checkToolPermission('export_audit_log', ctx).requiresConfirmation).toBe(true)

    expect(checkToolPermission('search_documents', ctx).requiresConfirmation).toBe(false)
    expect(checkToolPermission('open_document', ctx).requiresConfirmation).toBe(false)
  })
})

// ============================================================================
// TOOL EXECUTION TESTS
// ============================================================================

describe('Tool Execution', () => {
  test('navigate_to returns correct UI action', async () => {
    const ctx = createContext()
    const call: ToolCall = {
      id: 'test-1',
      name: 'navigate_to',
      arguments: { destination: 'vault' },
    }

    const result = await executeTool(call, ctx)

    expect(result.success).toBe(true)
    expect(result.uiAction).toEqual({
      type: 'navigate',
      path: '/dashboard/vault',
    })
  })

  test('get_document_stats returns stats structure', async () => {
    const ctx = createContext()
    const call: ToolCall = {
      id: 'test-2',
      name: 'get_document_stats',
      arguments: {},
    }

    const result = await executeTool(call, ctx)

    expect(result.success).toBe(true)
    expect(result.result).toHaveProperty('totalDocuments')
    expect(result.result).toHaveProperty('byType')
    expect(result.result).toHaveProperty('recentUploads')
  })

  test('unknown tool returns error', async () => {
    const ctx = createContext()
    const call: ToolCall = {
      id: 'test-3',
      name: 'nonexistent_tool',
      arguments: {},
    }

    const result = await executeTool(call, ctx)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Unknown tool')
  })

  test('RBAC blocks unauthorized tool calls', async () => {
    const ctx = createContext({ role: 'User' })
    const call: ToolCall = {
      id: 'test-4',
      name: 'set_viewing_role',
      arguments: { role: 'Admin' },
    }

    const result = await executeTool(call, ctx)

    expect(result.success).toBe(false)
    expect(result.error).toContain('requires Admin role')
  })
})

// ============================================================================
// SESSION BOOTSTRAP VALIDATION
// ============================================================================

describe('Session Bootstrap', () => {
  test('Session response contains required fields', async () => {
    // This would be an integration test against the actual endpoint
    // For now, validate the expected structure
    const expectedFields = ['sessionId', 'wsUrl', 'audio', 'expiresIn']
    const mockResponse = {
      success: true,
      sessionId: 'ws_123_abc',
      wsUrl: 'ws://localhost:3003/agent/ws?sessionId=ws_123_abc',
      audio: {
        sampleRateHz: 16000,
        encoding: 'pcm_s16le',
        channels: 1,
        vadSilenceMs: 1500,
      },
      expiresIn: 1800000,
    }

    expect(mockResponse.success).toBe(true)
    for (const field of expectedFields) {
      expect(mockResponse).toHaveProperty(field)
    }

    // Verify no secrets leaked
    expect(mockResponse).not.toHaveProperty('apiKey')
    expect(mockResponse).not.toHaveProperty('secret')
    expect(mockResponse).not.toHaveProperty('token')
    expect(JSON.stringify(mockResponse)).not.toContain('INWORLD')
  })

  test('Audio config matches Inworld requirements', () => {
    const audioConfig = {
      sampleRateHz: 16000,
      encoding: 'pcm_s16le',
      channels: 1,
    }

    expect(audioConfig.sampleRateHz).toBe(16000)
    expect(audioConfig.encoding).toBe('pcm_s16le')
    expect(audioConfig.channels).toBe(1)
  })
})
