import { executeTool } from '../toolExecutor'
import { apiFetch } from '@/lib/api'
import { parseSSEResponse, type ParsedRAGResponse } from '../sseParser'

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(),
}))

jest.mock('../sseParser', () => ({
  parseSSEResponse: jest.fn(),
}))

jest.mock('../toolRouter', () => ({
  resolveDocumentId: jest.fn(),
}))

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>
const mockParseSSE = parseSSEResponse as jest.MockedFunction<typeof parseSSEResponse>

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const AUTH_HEADERS: HeadersInit = { Authorization: 'Bearer test-token' }

/** Build a mock Response with a given status and JSON body. */
function mockResponse(ok: boolean, body?: unknown): Response {
  return {
    ok,
    json: jest.fn().mockResolvedValue(body ?? {}),
    text: jest.fn().mockResolvedValue(''),
  } as unknown as Response
}

/** Default parseSSEResponse result. */
function sseResult(overrides?: Partial<ParsedRAGResponse>): ParsedRAGResponse {
  return {
    text: overrides?.text ?? 'Parsed answer',
    confidence: overrides?.confidence ?? 0.92,
    citations: overrides?.citations ?? [],
    isSilence: overrides?.isSilence ?? false,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
})

/* ------------------------------------------------------------------ */
/*  chatQuery-based tools                                              */
/* ------------------------------------------------------------------ */

describe('chatQuery-based tools', () => {
  beforeEach(() => {
    mockApiFetch.mockResolvedValue(mockResponse(true))
    mockParseSSE.mockResolvedValue(sseResult())
  })

  it('summarize_document calls /api/chat with correct prompt', async () => {
    const result = await executeTool('summarize_document', { query: 'NDA.pdf' }, AUTH_HEADERS)

    expect(mockApiFetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
      method: 'POST',
    }))

    const body = JSON.parse(mockApiFetch.mock.calls[0][1]!.body as string)
    expect(body.query).toBe('Summarize document: NDA.pdf')
    expect(body.mode).toBe('detailed')
    expect(body.stream).toBe(true)
    expect(result.success).toBe(true)
    expect(result.display).toBe('Parsed answer')
  })

  it('compare_documents interpolates doc1 and doc2 into the prompt', async () => {
    await executeTool('compare_documents', { doc1: 'NDA-v1', doc2: 'NDA-v2' }, AUTH_HEADERS)

    const body = JSON.parse(mockApiFetch.mock.calls[0][1]!.body as string)
    expect(body.query).toBe('Compare "NDA-v1" and "NDA-v2"')
    expect(body.mode).toBe('detailed')
  })

  it('extract_key_dates builds the correct prompt', async () => {
    await executeTool('extract_key_dates', { query: 'Contract.pdf' }, AUTH_HEADERS)

    const body = JSON.parse(mockApiFetch.mock.calls[0][1]!.body as string)
    expect(body.query).toContain('Extract all dates and deadlines from Contract.pdf')
  })

  it('extract_liability_clauses builds the correct prompt', async () => {
    await executeTool('extract_liability_clauses', { query: 'Agreement.pdf' }, AUTH_HEADERS)

    const body = JSON.parse(mockApiFetch.mock.calls[0][1]!.body as string)
    expect(body.query).toContain('liability and indemnification clauses')
    expect(body.query).toContain('Agreement.pdf')
  })

  it('search_documents uses search mode', async () => {
    await executeTool('search_documents', { query: 'termination clause' }, AUTH_HEADERS)

    const body = JSON.parse(mockApiFetch.mock.calls[0][1]!.body as string)
    expect(body.query).toContain('Search my documents for: termination clause')
    expect(body.mode).toBe('search')
  })

  it('find_risks builds risk analysis prompt with severity levels', async () => {
    await executeTool('find_risks', { query: 'Lease.pdf' }, AUTH_HEADERS)

    const body = JSON.parse(mockApiFetch.mock.calls[0][1]!.body as string)
    expect(body.query).toContain('legal, financial, and compliance risks')
    expect(body.query).toContain('Lease.pdf')
    expect(body.query).toContain('High/Medium/Low')
  })

  it('chatQuery returns failure display when API response is not ok', async () => {
    mockApiFetch.mockResolvedValue(mockResponse(false))

    const result = await executeTool('summarize_document', { query: 'x' }, AUTH_HEADERS)

    expect(result.success).toBe(false)
    expect(result.display).toBe('Failed to get response from Mercury.')
  })

  it('chatQuery returns "No results found." when SSE text is empty', async () => {
    mockParseSSE.mockResolvedValue(sseResult({ text: '' }))

    const result = await executeTool('summarize_document', { query: 'x' }, AUTH_HEADERS)

    expect(result.success).toBe(true)
    expect(result.display).toBe('No results found.')
  })
})

/* ------------------------------------------------------------------ */
/*  list_documents                                                     */
/* ------------------------------------------------------------------ */

describe('list_documents', () => {
  it('returns formatted document list on success', async () => {
    const docs = [
      { originalName: 'Contract.pdf', fileType: 'pdf', sizeBytes: 2048, indexStatus: 'Indexed', createdAt: '2026-01-01' },
      { originalName: 'Brief.docx', fileType: 'docx', sizeBytes: 1048576, indexStatus: 'Processing', createdAt: '2026-01-02' },
    ]
    mockApiFetch.mockResolvedValue(mockResponse(true, { data: docs }))

    const result = await executeTool('list_documents', {}, AUTH_HEADERS)

    expect(mockApiFetch).toHaveBeenCalledWith('/api/documents', expect.anything())
    expect(result.success).toBe(true)
    expect(result.display).toContain('Found **2** documents')
    expect(result.display).toContain('Contract.pdf')
    expect(result.display).toContain('Brief.docx')
  })

  it('returns empty vault message when no documents', async () => {
    mockApiFetch.mockResolvedValue(mockResponse(true, { data: [] }))

    const result = await executeTool('list_documents', {}, AUTH_HEADERS)

    expect(result.success).toBe(true)
    expect(result.display).toContain('vault is empty')
  })

  it('returns failure when API is not ok', async () => {
    mockApiFetch.mockResolvedValue(mockResponse(false))

    const result = await executeTool('list_documents', {}, AUTH_HEADERS)

    expect(result.success).toBe(false)
    expect(result.display).toBe('Failed to fetch documents.')
  })
})

/* ------------------------------------------------------------------ */
/*  get_document_status                                                */
/* ------------------------------------------------------------------ */

describe('get_document_status', () => {
  const docs = [
    { id: '1', originalName: 'Contract.pdf', indexStatus: 'Indexed', sizeBytes: 4096, createdAt: '2026-01-15T00:00:00Z' },
    { id: '2', originalName: 'Brief.docx', indexStatus: 'Processing', sizeBytes: 2048, createdAt: '2026-01-16T00:00:00Z' },
  ]

  it('finds a matching document by name', async () => {
    mockApiFetch.mockResolvedValue(mockResponse(true, { data: docs }))

    const result = await executeTool('get_document_status', { query: 'contract' }, AUTH_HEADERS)

    expect(result.success).toBe(true)
    expect(result.display).toContain('Contract.pdf')
    expect(result.display).toContain('Indexed')
  })

  it('reports when no document matches the query', async () => {
    mockApiFetch.mockResolvedValue(mockResponse(true, { data: docs }))

    const result = await executeTool('get_document_status', { query: 'missing-file' }, AUTH_HEADERS)

    expect(result.success).toBe(true)
    expect(result.display).toContain('No document found matching')
  })

  it('lists all documents when query is empty', async () => {
    mockApiFetch.mockResolvedValue(mockResponse(true, { data: docs }))

    const result = await executeTool('get_document_status', { query: '' }, AUTH_HEADERS)

    expect(result.success).toBe(true)
    expect(result.display).toContain('Document Status')
  })

  it('returns failure when API is not ok', async () => {
    mockApiFetch.mockResolvedValue(mockResponse(false))

    const result = await executeTool('get_document_status', { query: 'x' }, AUTH_HEADERS)

    expect(result.success).toBe(false)
    expect(result.display).toBe('Failed to fetch document status.')
  })
})

/* ------------------------------------------------------------------ */
/*  upload_status                                                      */
/* ------------------------------------------------------------------ */

describe('upload_status', () => {
  it('reports pending uploads', async () => {
    const docs = [
      { originalName: 'big.pdf', indexStatus: 'Processing', createdAt: '2026-01-15' },
      { originalName: 'done.pdf', indexStatus: 'Indexed', createdAt: '2026-01-14' },
    ]
    mockApiFetch.mockResolvedValue(mockResponse(true, { data: docs }))

    const result = await executeTool('upload_status', {}, AUTH_HEADERS)

    expect(result.success).toBe(true)
    expect(result.display).toContain('1** upload(s) in progress')
    expect(result.display).toContain('big.pdf')
  })

  it('reports all indexed when no pending uploads', async () => {
    const docs = [{ originalName: 'done.pdf', indexStatus: 'Indexed', createdAt: '2026-01-14' }]
    mockApiFetch.mockResolvedValue(mockResponse(true, { data: docs }))

    const result = await executeTool('upload_status', {}, AUTH_HEADERS)

    expect(result.success).toBe(true)
    expect(result.display).toContain('All documents are indexed')
  })

  it('returns failure when API is not ok', async () => {
    mockApiFetch.mockResolvedValue(mockResponse(false))

    const result = await executeTool('upload_status', {}, AUTH_HEADERS)

    expect(result.success).toBe(false)
    expect(result.display).toBe('Failed to fetch upload status.')
  })
})

/* ------------------------------------------------------------------ */
/*  check_content_gaps                                                 */
/* ------------------------------------------------------------------ */

describe('check_content_gaps', () => {
  it('returns formatted gaps list', async () => {
    const gaps = [
      { queryText: 'What is the refund policy?', confidenceScore: 0.35, suggestedTopics: ['Refunds', 'Returns'] },
    ]
    mockApiFetch.mockResolvedValue(mockResponse(true, { data: gaps }))

    const result = await executeTool('check_content_gaps', {}, AUTH_HEADERS)

    expect(mockApiFetch).toHaveBeenCalledWith('/api/content-gaps?status=open', expect.anything())
    expect(result.success).toBe(true)
    expect(result.display).toContain('1** content gaps')
    expect(result.display).toContain('refund policy')
    expect(result.display).toContain('35%')
  })

  it('reports no gaps when list is empty', async () => {
    mockApiFetch.mockResolvedValue(mockResponse(true, { data: [] }))

    const result = await executeTool('check_content_gaps', {}, AUTH_HEADERS)

    expect(result.success).toBe(true)
    expect(result.display).toContain('No content gaps detected')
  })

  it('returns failure when API is not ok', async () => {
    mockApiFetch.mockResolvedValue(mockResponse(false))

    const result = await executeTool('check_content_gaps', {}, AUTH_HEADERS)

    expect(result.success).toBe(false)
    expect(result.display).toBe('Failed to fetch content gaps.')
  })
})

/* ------------------------------------------------------------------ */
/*  run_health_check                                                   */
/* ------------------------------------------------------------------ */

describe('run_health_check', () => {
  it('returns vault health info', async () => {
    const vaults = [{ id: 'v1', name: 'My Vault', documentCount: 12 }]
    mockApiFetch.mockResolvedValue(mockResponse(true, { data: vaults }))

    const result = await executeTool('run_health_check', {}, AUTH_HEADERS)

    expect(mockApiFetch).toHaveBeenCalledWith('/api/vaults', expect.anything())
    expect(result.success).toBe(true)
    expect(result.display).toContain('My Vault')
    expect(result.display).toContain('12')
    expect(result.display).toContain('operational')
  })

  it('reports when no vaults exist', async () => {
    mockApiFetch.mockResolvedValue(mockResponse(true, { data: [] }))

    const result = await executeTool('run_health_check', {}, AUTH_HEADERS)

    expect(result.success).toBe(true)
    expect(result.display).toContain('No vaults found')
  })

  it('returns failure when API is not ok', async () => {
    mockApiFetch.mockResolvedValue(mockResponse(false))

    const result = await executeTool('run_health_check', {}, AUTH_HEADERS)

    expect(result.success).toBe(false)
    expect(result.display).toBe('Failed to fetch vaults.')
  })
})

/* ------------------------------------------------------------------ */
/*  get_document_stats                                                 */
/* ------------------------------------------------------------------ */

describe('get_document_stats', () => {
  it('returns aggregated statistics', async () => {
    const docs = [
      { fileType: 'pdf', sizeBytes: 1024, indexStatus: 'Indexed', createdAt: '2026-01-01' },
      { fileType: 'pdf', sizeBytes: 2048, indexStatus: 'Indexed', createdAt: '2026-01-02' },
      { fileType: 'docx', sizeBytes: 512, indexStatus: 'Processing', createdAt: '2026-01-03' },
    ]
    mockApiFetch.mockResolvedValue(mockResponse(true, { data: docs }))

    const result = await executeTool('get_document_stats', {}, AUTH_HEADERS)

    expect(result.success).toBe(true)
    expect(result.display).toContain('**3** documents')
    expect(result.display).toContain('pdf: 2')
    expect(result.display).toContain('docx: 1')
    expect(result.display).toContain('Indexed: 2')
    expect(result.display).toContain('Processing: 1')
    expect((result.data as Record<string, unknown>).totalSize).toBe(3584)
  })

  it('returns failure when API is not ok', async () => {
    mockApiFetch.mockResolvedValue(mockResponse(false))

    const result = await executeTool('get_document_stats', {}, AUTH_HEADERS)

    expect(result.success).toBe(false)
    expect(result.display).toBe('Failed to fetch document stats.')
  })
})

/* ------------------------------------------------------------------ */
/*  check_confidence                                                   */
/* ------------------------------------------------------------------ */

describe('check_confidence', () => {
  it('returns informational display about confidence scoring', async () => {
    const result = await executeTool('check_confidence', {}, AUTH_HEADERS)

    expect(result.success).toBe(true)
    expect(result.display).toContain('confidence score')
    expect(result.display).toContain('85%')
    expect(result.display).toContain('Silence Protocol')
  })
})

/* ------------------------------------------------------------------ */
/*  recent_activity                                                    */
/* ------------------------------------------------------------------ */

describe('recent_activity', () => {
  it('returns formatted audit entries', async () => {
    const entries = [
      { action: 'UPLOAD', description: 'Uploaded NDA.pdf', createdAt: '2026-01-20T10:00:00Z', severity: 'info' },
      { action: 'QUERY', description: 'Queried vault', createdAt: '2026-01-20T11:00:00Z', severity: 'info' },
    ]
    mockApiFetch.mockResolvedValue(mockResponse(true, { data: entries }))

    const result = await executeTool('recent_activity', {}, AUTH_HEADERS)

    expect(mockApiFetch).toHaveBeenCalledWith('/api/audit?limit=10', expect.anything())
    expect(result.success).toBe(true)
    expect(result.display).toContain('Recent Activity')
    expect(result.display).toContain('UPLOAD')
    expect(result.display).toContain('QUERY')
  })

  it('reports no activity when entries are empty', async () => {
    mockApiFetch.mockResolvedValue(mockResponse(true, { data: [] }))

    const result = await executeTool('recent_activity', {}, AUTH_HEADERS)

    expect(result.success).toBe(true)
    expect(result.display).toContain('No recent activity found')
  })

  it('returns failure when API is not ok', async () => {
    mockApiFetch.mockResolvedValue(mockResponse(false))

    const result = await executeTool('recent_activity', {}, AUTH_HEADERS)

    expect(result.success).toBe(false)
    expect(result.display).toBe('Failed to fetch recent activity.')
  })
})

/* ------------------------------------------------------------------ */
/*  Static tools: navigate_to, toggle_privilege_mode, export_audit_log */
/* ------------------------------------------------------------------ */

describe('navigate_to', () => {
  it('returns action with type navigate and panel payload', async () => {
    const result = await executeTool('navigate_to', { panel: 'vault' }, AUTH_HEADERS)

    expect(result.success).toBe(true)
    expect(result.display).toContain('Navigating to vault')
    expect(result.action).toEqual({ type: 'navigate', payload: { panel: 'vault' } })
  })
})

describe('toggle_privilege_mode', () => {
  it('returns enabled message and payload when args.enabled is "true"', async () => {
    const result = await executeTool('toggle_privilege_mode', { enabled: 'true' }, AUTH_HEADERS)

    expect(result.success).toBe(true)
    expect(result.display).toBe('Privilege mode enabled.')
    expect(result.action).toEqual({ type: 'toggle_privilege', payload: { enabled: true } })
  })

  it('returns disabled message and payload when args.enabled is "false"', async () => {
    const result = await executeTool('toggle_privilege_mode', { enabled: 'false' }, AUTH_HEADERS)

    expect(result.success).toBe(true)
    expect(result.display).toBe('Privilege mode disabled.')
    expect(result.action).toEqual({ type: 'toggle_privilege', payload: { enabled: false } })
  })
})

describe('export_audit_log', () => {
  it('returns export action', async () => {
    const result = await executeTool('export_audit_log', {}, AUTH_HEADERS)

    expect(result.success).toBe(true)
    expect(result.display).toBe('Exporting audit log...')
    expect(result.action).toEqual({ type: 'export_audit', payload: {} })
  })
})

/* ------------------------------------------------------------------ */
/*  open_document                                                      */
/* ------------------------------------------------------------------ */

describe('open_document', () => {
  it('returns navigate action with documentId when found', async () => {
    const { resolveDocumentId } = jest.requireMock('../toolRouter') as { resolveDocumentId: jest.Mock }
    resolveDocumentId.mockResolvedValue('doc-abc')

    const result = await executeTool('open_document', { query: 'NDA.pdf' }, AUTH_HEADERS)

    expect(resolveDocumentId).toHaveBeenCalledWith('NDA.pdf', AUTH_HEADERS)
    expect(result.success).toBe(true)
    expect(result.display).toBe('Opening document...')
    expect(result.action).toEqual({ type: 'open_document', payload: { documentId: 'doc-abc' } })
  })

  it('returns failure when document not found', async () => {
    const { resolveDocumentId } = jest.requireMock('../toolRouter') as { resolveDocumentId: jest.Mock }
    resolveDocumentId.mockResolvedValue(null)

    const result = await executeTool('open_document', { query: 'ghost.pdf' }, AUTH_HEADERS)

    expect(result.success).toBe(false)
    expect(result.display).toContain('Could not find a document matching')
  })
})

/* ------------------------------------------------------------------ */
/*  delete_document                                                    */
/* ------------------------------------------------------------------ */

describe('delete_document', () => {
  it('returns confirmation prompt with documentId when found', async () => {
    const { resolveDocumentId } = jest.requireMock('../toolRouter') as { resolveDocumentId: jest.Mock }
    resolveDocumentId.mockResolvedValue('doc-xyz')

    const result = await executeTool('delete_document', { query: 'old.pdf' }, AUTH_HEADERS)

    expect(result.success).toBe(true)
    expect(result.requiresConfirmation).toBe(true)
    expect(result.confirmationPayload).toEqual({ type: 'delete_document', documentId: 'doc-xyz' })
    expect(result.display).toContain('cannot be undone')
  })

  it('returns failure when document not found', async () => {
    const { resolveDocumentId } = jest.requireMock('../toolRouter') as { resolveDocumentId: jest.Mock }
    resolveDocumentId.mockResolvedValue(null)

    const result = await executeTool('delete_document', { query: 'nope' }, AUTH_HEADERS)

    expect(result.success).toBe(false)
    expect(result.display).toContain('Could not find a document')
  })
})

/* ------------------------------------------------------------------ */
/*  send_email                                                         */
/* ------------------------------------------------------------------ */

describe('send_email', () => {
  it('returns confirmation with requiresConfirmation: true', async () => {
    const result = await executeTool('send_email', { to: 'user@example.com', content: 'Hello there' }, AUTH_HEADERS)

    expect(result.success).toBe(true)
    expect(result.requiresConfirmation).toBe(true)
    expect(result.confirmationPayload).toMatchObject({ type: 'send_email', to: 'user@example.com' })
    expect(result.display).toContain('user@example.com')
  })

  it('asks for recipient when "to" is not provided', async () => {
    const result = await executeTool('send_email', { content: 'Hello' }, AUTH_HEADERS)

    expect(result.success).toBe(true)
    expect(result.requiresConfirmation).toBeUndefined()
    expect(result.display).toContain('Who should I send it to')
  })

  it('uses RAG to generate body when content references a summary', async () => {
    mockApiFetch.mockResolvedValue(mockResponse(true))
    mockParseSSE.mockResolvedValue(sseResult({ text: 'RAG-generated summary text' }))

    const result = await executeTool('send_email', { to: 'a@b.com', content: 'summary of the NDA' }, AUTH_HEADERS)

    expect(mockApiFetch).toHaveBeenCalledWith('/api/chat', expect.anything())
    expect(result.success).toBe(true)
    expect(result.requiresConfirmation).toBe(true)
    expect((result.confirmationPayload as Record<string, unknown>).body).toBe('RAG-generated summary text')
  })

  it('uses raw content as body when content does not reference a summary', async () => {
    const result = await executeTool('send_email', { to: 'a@b.com', content: 'plain text message' }, AUTH_HEADERS)

    expect(mockApiFetch).not.toHaveBeenCalled()
    expect(result.requiresConfirmation).toBe(true)
    expect((result.confirmationPayload as Record<string, unknown>).body).toBe('plain text message')
  })
})

/* ------------------------------------------------------------------ */
/*  send_sms                                                           */
/* ------------------------------------------------------------------ */

describe('send_sms', () => {
  it('returns confirmation with requiresConfirmation: true', async () => {
    const result = await executeTool('send_sms', { to: '+15551234567', content: 'Test SMS' }, AUTH_HEADERS)

    expect(result.success).toBe(true)
    expect(result.requiresConfirmation).toBe(true)
    expect(result.confirmationPayload).toMatchObject({ type: 'send_sms', to: '+15551234567', body: 'Test SMS' })
  })

  it('asks for phone number when "to" is not provided', async () => {
    const result = await executeTool('send_sms', { content: 'Test' }, AUTH_HEADERS)

    expect(result.success).toBe(true)
    expect(result.requiresConfirmation).toBeUndefined()
    expect(result.display).toContain('phone number')
  })
})

/* ------------------------------------------------------------------ */
/*  show_help                                                          */
/* ------------------------------------------------------------------ */

describe('show_help', () => {
  it('returns help text with command categories', async () => {
    const result = await executeTool('show_help', {}, AUTH_HEADERS)

    expect(result.success).toBe(true)
    expect(result.display).toContain('what I can do for you')
    expect(result.display).toContain('your documents')
    expect(result.display).toContain('Take action')
    expect(result.display).toContain('Go deeper')
  })
})

/* ------------------------------------------------------------------ */
/*  Unknown tool / Error handling                                      */
/* ------------------------------------------------------------------ */

describe('unknown tool', () => {
  it('returns error ToolResult with tool name in display', async () => {
    const result = await executeTool('nonexistent_tool', {}, AUTH_HEADERS)

    expect(result.success).toBe(false)
    expect(result.data).toBeNull()
    expect(result.display).toBe('Unknown tool: nonexistent_tool')
  })
})

describe('error handling', () => {
  it('catches thrown errors and returns error ToolResult', async () => {
    mockApiFetch.mockRejectedValue(new Error('Network failure'))

    const result = await executeTool('list_documents', {}, AUTH_HEADERS)

    expect(result.success).toBe(false)
    expect(result.display).toContain('Error executing list_documents')
    expect(result.display).toContain('Network failure')
  })

  it('handles non-Error thrown values', async () => {
    mockApiFetch.mockRejectedValue('string error')

    const result = await executeTool('list_documents', {}, AUTH_HEADERS)

    expect(result.success).toBe(false)
    expect(result.display).toContain('Unknown error')
  })
})
