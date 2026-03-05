/**
 * Sarah — E24-011: Email & SMS Tool Tests
 *
 * Tests the Mercury tool router (intent detection) and tool executor
 * for email and SMS actions, including confirmation flow and audit.
 */

import { detectToolIntent, type ToolIntent } from '@/lib/mercury/toolRouter'

// ============================================================================
// TOOL ROUTER — Pattern Matching
// ============================================================================

describe('E24-011: Tool Router — detectToolIntent', () => {
  describe('Email patterns', () => {
    test('detects "email X to Y" pattern', () => {
      const result = detectToolIntent('email the summary of the contract to jane@acme.com')
      expect(result).not.toBeNull()
      expect(result!.tool).toBe('send_email')
      expect(result!.args.to).toBe('jane@acme.com')
      expect(result!.args.content).toContain('summary')
    })

    test('detects "send email X to Y" pattern', () => {
      const result = detectToolIntent('send email quarterly report to cfo@company.com')
      expect(result).not.toBeNull()
      expect(result!.tool).toBe('send_email')
      expect(result!.args.to).toBe('cfo@company.com')
    })

    test('detects "send an email X to Y" pattern', () => {
      const result = detectToolIntent('send an email about the budget to finance@co.org')
      expect(result).not.toBeNull()
      expect(result!.tool).toBe('send_email')
      expect(result!.args.to).toBe('finance@co.org')
    })

    test('detects "mail X to Y" pattern', () => {
      const result = detectToolIntent('mail the risk analysis to legal@firm.com')
      expect(result).not.toBeNull()
      expect(result!.tool).toBe('send_email')
    })

    test('detects email without recipient (content only)', () => {
      const result = detectToolIntent('email the contract summary')
      expect(result).not.toBeNull()
      expect(result!.tool).toBe('send_email')
      expect(result!.args.content).toContain('contract summary')
      expect(result!.args.to).toBeUndefined()
    })

    test('email has priority over summarize', () => {
      // "email the summary of X to Y" should route to send_email, not summarize
      const result = detectToolIntent('email the summary of the agreement to test@test.com')
      expect(result!.tool).toBe('send_email')
    })

    test('returns confidence 0.9', () => {
      const result = detectToolIntent('email test to user@test.com')
      expect(result!.confidence).toBe(0.9)
    })
  })

  describe('SMS patterns', () => {
    test('detects "text X to Y" pattern', () => {
      const result = detectToolIntent('text the key dates to +1-555-123-4567')
      expect(result).not.toBeNull()
      expect(result!.tool).toBe('send_sms')
      expect(result!.args.content).toContain('key dates')
      expect(result!.args.to).toBe('+15551234567') // stripped formatting
    })

    test('detects "sms X to Y" pattern', () => {
      const result = detectToolIntent('sms the deadline reminder to +44 7911 123456')
      expect(result).not.toBeNull()
      expect(result!.tool).toBe('send_sms')
    })

    test('detects "send a text X to Y" pattern', () => {
      const result = detectToolIntent('send a text about the meeting to +12025551234')
      expect(result).not.toBeNull()
      expect(result!.tool).toBe('send_sms')
    })

    test('detects "send sms X to Y" pattern', () => {
      const result = detectToolIntent('send sms update to +1 800 555 0100')
      expect(result).not.toBeNull()
      expect(result!.tool).toBe('send_sms')
    })

    test('SMS without recipient (content only)', () => {
      const result = detectToolIntent('text the summary')
      expect(result).not.toBeNull()
      expect(result!.tool).toBe('send_sms')
      expect(result!.args.to).toBeUndefined()
    })

    test('phone number formatting strips non-digits', () => {
      const result = detectToolIntent('text hello to (555) 123-4567')
      expect(result).not.toBeNull()
      expect(result!.args.to).toBe('5551234567')
    })
  })

  describe('Document tool patterns', () => {
    test('detects summarize command', () => {
      const result = detectToolIntent('summarize the Q3 report')
      expect(result).not.toBeNull()
      expect(result!.tool).toBe('summarize_document')
      expect(result!.args.query).toContain('Q3 report')
    })

    test('detects compare command', () => {
      const result = detectToolIntent('compare contract-v1 with contract-v2')
      expect(result).not.toBeNull()
      expect(result!.tool).toBe('compare_documents')
      expect(result!.args.doc1).toBe('contract-v1')
      expect(result!.args.doc2).toBe('contract-v2')
    })

    test('detects extract key dates', () => {
      const result = detectToolIntent('find dates in the lease agreement')
      expect(result).not.toBeNull()
      expect(result!.tool).toBe('extract_key_dates')
    })

    test('detects list documents', () => {
      const result = detectToolIntent('list my documents')
      expect(result).not.toBeNull()
      expect(result!.tool).toBe('list_documents')
    })

    test('detects search documents', () => {
      const result = detectToolIntent('search for liability clauses in documents')
      expect(result).not.toBeNull()
      expect(result!.tool).toBe('search_documents')
    })

    test('detects find risks', () => {
      const result = detectToolIntent('find risks in the NDA')
      expect(result).not.toBeNull()
      expect(result!.tool).toBe('find_risks')
    })

    test('detects export audit log', () => {
      const result = detectToolIntent('export the audit log')
      expect(result).not.toBeNull()
      expect(result!.tool).toBe('export_audit_log')
    })

    test('detects help command', () => {
      const result = detectToolIntent('/help')
      expect(result).not.toBeNull()
      expect(result!.tool).toBe('show_help')
    })

    test('detects delete document', () => {
      const result = detectToolIntent('delete the file contract.pdf')
      expect(result).not.toBeNull()
      expect(result!.tool).toBe('delete_document')
    })
  })

  describe('Natural language vault queries', () => {
    test('"show me my files" → list_documents', () => {
      const result = detectToolIntent('show me my files')
      expect(result).not.toBeNull()
      expect(result!.tool).toBe('list_documents')
    })

    test('"what files do I have" → list_documents', () => {
      const result = detectToolIntent('what files do I have')
      expect(result).not.toBeNull()
      expect(result!.tool).toBe('list_documents')
    })

    test('"how many documents" → get_document_stats', () => {
      const result = detectToolIntent('how many documents do I have')
      expect(result).not.toBeNull()
      expect(result!.tool).toBe('get_document_stats')
    })

    test('"which files mention liability" → search_documents', () => {
      const result = detectToolIntent('which files mention liability')
      expect(result).not.toBeNull()
      expect(result!.tool).toBe('search_documents')
      expect(result!.args.query).toContain('liability')
    })

    test('"what\'s in my vault" → list_documents', () => {
      const result = detectToolIntent("what's in my vault")
      expect(result).not.toBeNull()
      expect(result!.tool).toBe('list_documents')
    })
  })

  describe('RAG queries (no tool intent)', () => {
    test('plain question returns null', () => {
      const result = detectToolIntent('What are the payment terms in the Acme contract?')
      expect(result).toBeNull()
    })

    test('complex analytical question returns null', () => {
      const result = detectToolIntent('How does the liability cap in section 5 compare to industry standards?')
      expect(result).toBeNull()
    })

    test('greeting returns null', () => {
      const result = detectToolIntent('Hello Mercury')
      expect(result).toBeNull()
    })
  })
})

// ============================================================================
// TOOL EXECUTOR — Confirmation Flow
// ============================================================================

// Mock apiFetch for executeTool
jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(),
}))

// Mock parseSSEResponse
jest.mock('@/lib/mercury/sseParser', () => ({
  parseSSEResponse: jest.fn(),
}))

import { executeTool, type ToolResult } from '@/lib/mercury/toolExecutor'
import { apiFetch } from '@/lib/api'
import { parseSSEResponse } from '@/lib/mercury/sseParser'

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>
const mockParseSSE = parseSSEResponse as jest.MockedFunction<typeof parseSSEResponse>

const fakeHeaders: HeadersInit = { Authorization: 'Bearer test-token' }

describe('E24-011: Tool Executor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('send_email', () => {
    test('returns requiresConfirmation=true with email payload', async () => {
      // Use content that does NOT match /summary|summarize|extract|compare|report/
      // to avoid triggering the RAG chatQuery path
      const result = await executeTool(
        'send_email',
        { content: 'the quarterly budget numbers', to: 'cfo@company.com' },
        fakeHeaders,
      )

      expect(result.success).toBe(true)
      expect(result.requiresConfirmation).toBe(true)
      expect(result.confirmationPayload).toBeDefined()
      expect(result.confirmationPayload!.type).toBe('send_email')
      expect(result.confirmationPayload!.to).toBe('cfo@company.com')
    })

    test('asks for recipient when not provided', async () => {
      const result = await executeTool('send_email', { content: 'test' }, fakeHeaders)

      expect(result.success).toBe(true)
      expect(result.requiresConfirmation).toBeUndefined()
      expect(result.display).toContain('Who should I send it to')
    })

    test('generates subject from content', async () => {
      const result = await executeTool(
        'send_email',
        { content: 'quarterly budget analysis', to: 'test@test.com' },
        fakeHeaders,
      )

      expect(result.confirmationPayload!.subject).toContain('Mercury:')
      expect(result.confirmationPayload!.subject).toContain('quarterly budget analysis')
    })

    test('resolves document summary via RAG when content references documents', async () => {
      // Mock the RAG chat query used for document-related emails
      mockApiFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(
          'event: token\ndata: {"text":"The summary shows..."}\n\n'
        ),
      } as unknown as Response)

      mockParseSSE.mockResolvedValue({
        text: 'The summary shows quarterly revenue increased 15%.',
        confidence: 0.91,
        citations: [],
        isSilence: false,
      })

      const result = await executeTool(
        'send_email',
        { content: 'summary of Q3 report', to: 'cfo@co.com' },
        fakeHeaders,
      )

      expect(result.requiresConfirmation).toBe(true)
      expect(result.confirmationPayload!.body).toContain('quarterly revenue')
    })
  })

  describe('send_sms', () => {
    test('returns requiresConfirmation=true with SMS payload', async () => {
      const result = await executeTool(
        'send_sms',
        { content: 'Deadline is March 15', to: '+15551234567' },
        fakeHeaders,
      )

      expect(result.success).toBe(true)
      expect(result.requiresConfirmation).toBe(true)
      expect(result.confirmationPayload!.type).toBe('send_sms')
      expect(result.confirmationPayload!.to).toBe('+15551234567')
      expect(result.confirmationPayload!.body).toBe('Deadline is March 15')
    })

    test('asks for phone number when not provided', async () => {
      const result = await executeTool('send_sms', { content: 'test message' }, fakeHeaders)

      expect(result.success).toBe(true)
      expect(result.requiresConfirmation).toBeUndefined()
      expect(result.display).toContain('phone number')
    })
  })

  describe('list_documents', () => {
    test('returns formatted document list', async () => {
      mockApiFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: {
            documents: [
              { originalName: 'contract.pdf', fileType: 'pdf', sizeBytes: 1024, indexStatus: 'Indexed', createdAt: '2026-01-01' },
              { originalName: 'report.docx', fileType: 'docx', sizeBytes: 2048, indexStatus: 'Indexed', createdAt: '2026-01-02' },
            ],
          },
        }),
      } as unknown as Response)

      const result = await executeTool('list_documents', {}, fakeHeaders)

      expect(result.success).toBe(true)
      expect(result.display).toContain('2')
      expect(result.display).toContain('contract.pdf')
      expect(result.display).toContain('report.docx')
    })

    test('returns empty vault message when no documents', async () => {
      mockApiFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { documents: [] } }),
      } as unknown as Response)

      const result = await executeTool('list_documents', {}, fakeHeaders)
      expect(result.display).toContain('empty')
    })
  })

  describe('navigate_to', () => {
    test('returns navigation action', async () => {
      const result = await executeTool('navigate_to', { panel: 'vault' }, fakeHeaders)

      expect(result.success).toBe(true)
      expect(result.action?.type).toBe('navigate')
      expect(result.action?.payload.panel).toBe('vault')
    })
  })

  describe('toggle_privilege_mode', () => {
    test('enables privilege mode', async () => {
      const result = await executeTool('toggle_privilege_mode', { enabled: 'true' }, fakeHeaders)

      expect(result.success).toBe(true)
      expect(result.action?.type).toBe('toggle_privilege')
      expect(result.action?.payload.enabled).toBe(true)
    })

    test('disables privilege mode', async () => {
      const result = await executeTool('toggle_privilege_mode', { enabled: 'false' }, fakeHeaders)

      expect(result.action?.payload.enabled).toBe(false)
    })
  })

  describe('show_help', () => {
    test('returns help text with action categories', async () => {
      const result = await executeTool('show_help', {}, fakeHeaders)

      expect(result.success).toBe(true)
      expect(result.display).toContain('documents')
      expect(result.display).toContain('Email')
      expect(result.display).toContain('audit')
    })
  })

  describe('unknown tool', () => {
    test('returns error for unknown tool name', async () => {
      const result = await executeTool('nonexistent_tool', {}, fakeHeaders)

      expect(result.success).toBe(false)
      expect(result.display).toContain('Unknown tool')
    })
  })

  describe('error handling', () => {
    test('catches and wraps execution errors', async () => {
      mockApiFetch.mockRejectedValue(new Error('Network failure'))

      const result = await executeTool('list_documents', {}, fakeHeaders)

      expect(result.success).toBe(false)
      expect(result.display).toContain('Error')
      expect(result.display).toContain('Network failure')
    })
  })
})
