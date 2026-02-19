/**
 * Tool Router Tests — Mercury pattern matching
 *
 * Validates that user messages are correctly classified as tool intents
 * or fall through to RAG (return null).
 *
 * Covers: email, SMS, document tools, vault/file queries, help, and
 * natural-language phrasings that should NOT be intercepted.
 */

import { detectToolIntent } from '@/lib/mercury/toolRouter'

// ── Email patterns ─────────────────────────────────────────

describe('email patterns', () => {
  test('email content to address', () => {
    const result = detectToolIntent('email the summary to david@ragbox.co')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('send_email')
    expect(result!.args.content).toBe('the summary')
    expect(result!.args.to).toBe('david@ragbox.co')
  })

  test('send an email content', () => {
    const result = detectToolIntent('send an email hello world')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('send_email')
    expect(result!.args.content).toBe('hello world')
  })

  test('mail content to address', () => {
    const result = detectToolIntent('mail the report to sarah@example.com')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('send_email')
    expect(result!.args.to).toBe('sarah@example.com')
  })
})

// ── SMS patterns ───────────────────────────────────────────

describe('SMS patterns', () => {
  test('text content to phone number', () => {
    const result = detectToolIntent('text hello to +1-555-123-4567')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('send_sms')
    expect(result!.args.content).toBe('hello')
    expect(result!.args.to).toBe('+15551234567')
  })

  test('send a text content', () => {
    const result = detectToolIntent('send a text meeting at 3pm')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('send_sms')
    expect(result!.args.content).toBe('meeting at 3pm')
  })
})

// ── Document tool patterns ─────────────────────────────────

describe('document tool patterns', () => {
  test('summarize document', () => {
    const result = detectToolIntent('summarize NDA-2024.pdf')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('summarize_document')
    expect(result!.args.query).toBe('NDA-2024.pdf')
  })

  test('compare documents', () => {
    const result = detectToolIntent('compare contract-v1 with contract-v2')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('compare_documents')
    expect(result!.args.doc1).toBe('contract-v1')
    expect(result!.args.doc2).toBe('contract-v2')
  })

  test('find dates in document', () => {
    const result = detectToolIntent('find dates in the lease agreement')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('extract_key_dates')
    expect(result!.args.query).toBe('the lease agreement')
  })

  test('extract liability', () => {
    const result = detectToolIntent('find liability clauses')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('extract_liability_clauses')
  })

  test('list documents', () => {
    const result = detectToolIntent('list all documents')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('list_documents')
  })

  test('search documents by keyword', () => {
    const result = detectToolIntent('search for indemnity in documents')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('search_documents')
    expect(result!.args.query).toBe('indemnity')
  })

  test('search documents — alt phrasing', () => {
    const result = detectToolIntent('search documents for termination clause')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('search_documents')
    expect(result!.args.query).toBe('termination clause')
  })

  test('open document by filename', () => {
    const result = detectToolIntent('open contract.pdf')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('open_document')
    expect(result!.args.query).toBe('contract.pdf')
  })

  test('get document status', () => {
    const result = detectToolIntent('get document status of NDA.pdf')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('get_document_status')
    expect(result!.args.query).toBe('NDA.pdf')
  })

  test('upload status', () => {
    const result = detectToolIntent('check upload status')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('upload_status')
  })

  test('check content gaps', () => {
    const result = detectToolIntent('check content gaps')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('check_content_gaps')
  })

  test('show system status', () => {
    const result = detectToolIntent('show system status')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('run_health_check')
  })

  test('export audit log', () => {
    const result = detectToolIntent('export audit log')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('export_audit_log')
  })

  test('show document stats', () => {
    const result = detectToolIntent('show stats')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('get_document_stats')
  })

  test('find risks in document', () => {
    const result = detectToolIntent('find risks in the partnership agreement')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('find_risks')
    expect(result!.args.query).toBe('the partnership agreement')
  })

  test('navigate to panel', () => {
    const result = detectToolIntent('navigate to vault')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('navigate_to')
    expect(result!.args.panel).toBe('vault')
  })

  test('enable privilege mode', () => {
    const result = detectToolIntent('enable privilege')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('toggle_privilege_mode')
    expect(result!.args.enabled).toBe('true')
  })

  test('disable privilege mode', () => {
    const result = detectToolIntent('disable privilege')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('toggle_privilege_mode')
    expect(result!.args.enabled).toBe('false')
  })
})

// ── Natural-language vault meta-queries ────────────────────

describe('vault meta-query patterns', () => {
  test('what files do I have', () => {
    const result = detectToolIntent('what files do I have')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('list_documents')
  })

  test("what's in the vault", () => {
    const result = detectToolIntent("what's in the vault")
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('list_documents')
  })

  test("what's in my box", () => {
    const result = detectToolIntent("what's in my box")
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('list_documents')
  })

  test('vault contents', () => {
    const result = detectToolIntent('vault contents')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('list_documents')
  })

  test('how many documents', () => {
    const result = detectToolIntent('how many documents')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('get_document_stats')
  })

  test('what files are stored', () => {
    const result = detectToolIntent('what files are stored')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('list_documents')
  })

  test('what documents stored (no "are")', () => {
    const result = detectToolIntent('what documents stored')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('list_documents')
  })

  test('list my files', () => {
    const result = detectToolIntent('list my files')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('list_documents')
  })

  test('show me my files', () => {
    const result = detectToolIntent('show me my files')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('list_documents')
  })

  test('show me my documents', () => {
    const result = detectToolIntent('show me my documents')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('list_documents')
  })

  test('show me files', () => {
    const result = detectToolIntent('show me files')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('list_documents')
  })

  test('vault inventory', () => {
    const result = detectToolIntent('vault inventory')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('list_documents')
  })

  test('vault files', () => {
    const result = detectToolIntent('vault files')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('list_documents')
  })

  test('how many files', () => {
    const result = detectToolIntent('how many files')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('get_document_stats')
  })
})

// ── Vault/file search — natural-language phrasings ─────────

describe('vault/file search — natural-language patterns', () => {
  test('which files mention [topic]', () => {
    const result = detectToolIntent('which files mention non-compete')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('search_documents')
    expect(result!.args.query).toBe('non-compete')
  })

  test('what documents discuss [topic]', () => {
    const result = detectToolIntent('what documents discuss termination clauses')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('search_documents')
    expect(result!.args.query).toBe('termination clauses')
  })

  test('which docs contain [topic]', () => {
    const result = detectToolIntent('which docs contain arbitration')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('search_documents')
    expect(result!.args.query).toBe('arbitration')
  })

  test('what files reference [topic]', () => {
    const result = detectToolIntent('what files reference intellectual property')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('search_documents')
    expect(result!.args.query).toBe('intellectual property')
  })

  test('which documents cover [topic]', () => {
    const result = detectToolIntent('which documents cover data privacy')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('search_documents')
    expect(result!.args.query).toBe('data privacy')
  })

  test('do I have anything about [topic]', () => {
    const result = detectToolIntent('do I have anything about severance')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('search_documents')
    expect(result!.args.query).toBe('severance')
  })

  test('is there a file about [topic]', () => {
    const result = detectToolIntent('is there a file about insurance')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('search_documents')
    expect(result!.args.query).toBe('insurance')
  })

  test('do I have any document about [topic]', () => {
    const result = detectToolIntent('do I have any document about HIPAA compliance')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('search_documents')
    expect(result!.args.query).toBe('HIPAA compliance')
  })

  test('show me documents about [topic] → search, not list', () => {
    const result = detectToolIntent('show me documents about employment law')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('search_documents')
    expect(result!.args.query).toBe('employment law')
  })

  test('find files related to [topic]', () => {
    const result = detectToolIntent('find files related to merger agreement')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('search_documents')
    expect(result!.args.query).toBe('merger agreement')
  })

  test('get me docs regarding [topic]', () => {
    const result = detectToolIntent('get me docs regarding tax filings')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('search_documents')
    expect(result!.args.query).toBe('tax filings')
  })
})

// ── Recent/latest vault queries ────────────────────────────

describe('recent/latest vault queries', () => {
  test('show latest documents', () => {
    const result = detectToolIntent('show latest documents')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('list_documents')
  })

  test('list recent uploads', () => {
    const result = detectToolIntent('list recent uploads')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('list_documents')
  })

  test('show me the newest files', () => {
    const result = detectToolIntent('show me the newest files')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('list_documents')
  })

  test('get the last documents', () => {
    const result = detectToolIntent('get the last documents')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('list_documents')
  })

  test("what's the last thing I uploaded", () => {
    const result = detectToolIntent("what's the last thing I uploaded")
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('list_documents')
  })

  test('what was the last file uploaded', () => {
    const result = detectToolIntent('what was the last file uploaded')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('list_documents')
  })
})

// ── Delete/remove vault file ───────────────────────────────

describe('delete/remove vault file patterns', () => {
  test('delete the file [name]', () => {
    const result = detectToolIntent('delete the file old-contract.pdf')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('delete_document')
    expect(result!.args.query).toBe('old-contract.pdf')
  })

  test('remove document [name]', () => {
    const result = detectToolIntent('remove document draft-NDA')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('delete_document')
    expect(result!.args.query).toBe('draft-NDA')
  })

  test('trash the doc [name]', () => {
    const result = detectToolIntent('trash the doc test-upload')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('delete_document')
    expect(result!.args.query).toBe('test-upload')
  })

  test('delete [filename.pdf]', () => {
    const result = detectToolIntent('delete obsolete-report.pdf')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('delete_document')
    expect(result!.args.query).toBe('obsolete-report.pdf')
  })

  test('remove [filename.docx]', () => {
    const result = detectToolIntent('remove memo.docx')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('delete_document')
    expect(result!.args.query).toBe('memo.docx')
  })
})

// ── Help ───────────────────────────────────────────────────

describe('help patterns', () => {
  test('/help command', () => {
    const result = detectToolIntent('/help')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('show_help')
  })

  test('help keyword', () => {
    const result = detectToolIntent('help')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('show_help')
  })

  test('what can you do', () => {
    const result = detectToolIntent('what can you do')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('show_help')
  })
})

// ── Conversational catch-alls (no ^ anchor) ─────────────────

describe('conversational catch-all patterns', () => {
  test('David exact: "Can you tell me how many files I have to work with please" → get_document_stats', () => {
    const result = detectToolIntent('Can you tell me how many files I have to work with please')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('get_document_stats')
  })

  test('David exact: "What files can you see in the vault?" → list_documents', () => {
    const result = detectToolIntent('What files can you see in the vault?')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('list_documents')
  })

  test('could you show me what documents I have', () => {
    const result = detectToolIntent('could you show me what documents I have')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('list_documents')
  })

  test('please list my files', () => {
    const result = detectToolIntent('please list my files')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('list_documents')
  })

  test('I want to know how many documents are available', () => {
    const result = detectToolIntent('I want to know how many documents are available')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('get_document_stats')
  })

  test('which documents do you have on file', () => {
    const result = detectToolIntent('which documents do you have on file')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('list_documents')
  })

  test('files I have to work with today', () => {
    const result = detectToolIntent('files I have to work with today')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('list_documents')
  })

  test('specific search still beats catch-all: "which files mention insurance"', () => {
    const result = detectToolIntent('which files mention insurance')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('search_documents')
    expect(result!.args.query).toBe('insurance')
  })

  test('specific search still beats catch-all: "show me documents about employment law"', () => {
    const result = detectToolIntent('show me documents about employment law')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('search_documents')
    expect(result!.args.query).toBe('employment law')
  })
})

// ── RAG fallthrough (null) — should NOT match tool patterns ─

describe('RAG fallthrough — queries that should NOT trigger tools', () => {
  test('simple factual question', () => {
    expect(detectToolIntent('what is the termination clause in my NDA?')).toBeNull()
  })

  test('legal analysis question', () => {
    expect(detectToolIntent('can the landlord terminate early under section 4?')).toBeNull()
  })

  test('summarize-like but mid-sentence (not a command)', () => {
    expect(detectToolIntent('can you tell me about the key provisions?')).toBeNull()
  })

  test('conversational follow-up', () => {
    expect(detectToolIntent('what about the indemnification section?')).toBeNull()
  })

  test('yes/no answer', () => {
    expect(detectToolIntent('yes')).toBeNull()
  })

  test('short affirmation', () => {
    expect(detectToolIntent('ok')).toBeNull()
  })

  test('empty string', () => {
    expect(detectToolIntent('')).toBeNull()
  })

  test('whitespace only', () => {
    expect(detectToolIntent('   ')).toBeNull()
  })

  test('general knowledge question', () => {
    expect(detectToolIntent('what is attorney-client privilege?')).toBeNull()
  })

  test('question starting with how', () => {
    expect(detectToolIntent('how does the non-compete apply to me?')).toBeNull()
  })
})

// ── Edge cases (Dr. Insane hardening) ──────────────────────

describe('edge cases — security and robustness', () => {
  test('empty string input → no match', () => {
    expect(detectToolIntent('')).toBeNull()
  })

  test('single ambiguous word "files" → no match', () => {
    expect(detectToolIntent('files')).toBeNull()
  })

  test('SQL injection attempt → no match', () => {
    expect(detectToolIntent("'; DROP TABLE documents;--")).toBeNull()
  })

  test('very long input (500+ chars) → no match or graceful handling', () => {
    const longInput = 'a'.repeat(600)
    const result = detectToolIntent(longInput)
    // Should not throw, and should not match any tool pattern
    expect(result).toBeNull()
  })

  test('David\'s exact phrase: "what files are available in the rag box" → matches list_documents', () => {
    const result = detectToolIntent('what files are available in the rag box')
    expect(result).not.toBeNull()
    expect(result!.tool).toBe('list_documents')
  })
})

// ── Confidence ─────────────────────────────────────────────

describe('confidence score', () => {
  test('all matched intents have confidence 0.9', () => {
    const tests = [
      'list documents',
      'search for fraud in vault',
      'summarize NDA.pdf',
      'email report to boss@co.com',
      '/help',
      'which files mention insurance',
      'show latest documents',
      'delete the file old.pdf',
    ]
    for (const msg of tests) {
      const result = detectToolIntent(msg)
      expect(result).not.toBeNull()
      expect(result!.confidence).toBe(0.9)
    }
  })
})
