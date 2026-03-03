/**
 * EPIC-023: Two-Mode Voice Query Classification Tests
 *
 * Tests for Sheldon's conversational vs. document query classifier.
 * Conversational queries bypass RAG entirely and get natural responses.
 * Document queries go through the full RAG pipeline with citations.
 *
 * Classifier logic replicated from EPIC-023 spec. Once Sheldon exports
 * classifyQuery from voice-pipeline-v3, replace the replicated function
 * with: import { classifyQuery } from '../voice-pipeline-v3'
 *
 * Data flow:
 *   STT transcript → classifyQuery(text) → 'conversational' | 'document'
 *   conversational → conversational system prompt (no RAG, no grounding)
 *   document → existing RAG pipeline with Silence Protocol
 *
 * — Sarah, QA
 */

// ─── Replicated classifier from EPIC-023 spec ───────────────────────────────
// This is the expected behavior defined in the sprint order.
// TODO: Replace with import { classifyQuery } from '../voice-pipeline-v3'
//       once Sheldon commits his implementation.

type QueryType = 'conversational' | 'document'

function classifyQuery(text: string): QueryType {
  const lower = text.toLowerCase().trim()

  // Empty / whitespace → safe conversational default
  if (!lower) return 'conversational'

  // Platform / help questions are conversational even if they mention "document"
  const PLATFORM_PATTERNS = [
    /^how do i /,
    /^help me /,
    /^can you help/,
    /^how can i /,
    /^how do you /,
  ]
  for (const pattern of PLATFORM_PATTERNS) {
    if (pattern.test(lower)) return 'conversational'
  }

  // Document signals — keywords that indicate the user wants RAG retrieval
  const DOC_PATTERNS = [
    // Explicit document types
    /\b(document|file|contract|report|agreement|lease|nda|pitch|memo)\b/,
    // Analysis verbs
    /\b(summarize|summary|extract|compare|risks?|clause|section)\b/,
    // Document reference phrases
    /\bfind in\b/,
    /\baccording to\b/,
    /\bwhat does it say\b/,
    /\bwhat does the\b/,
    /\bin my vault\b/,
    /\bin the vault\b/,
  ]
  for (const pattern of DOC_PATTERNS) {
    if (pattern.test(lower)) return 'document'
  }

  // Everything else is conversational (greetings, small talk, about-me, etc.)
  return 'conversational'
}

// ============================================================================
// CONVERSATIONAL QUERIES — bypass RAG entirely
// ============================================================================

describe('Query Classification — Conversational (EPIC-023)', () => {

  it('"hello" classified as conversational', () => {
    expect(classifyQuery('hello')).toBe('conversational')
  })

  it('"can you hear me" classified as conversational', () => {
    expect(classifyQuery('can you hear me')).toBe('conversational')
  })

  it('"who are you" classified as conversational', () => {
    expect(classifyQuery('who are you')).toBe('conversational')
  })

  it('"how are you doing today" classified as conversational', () => {
    expect(classifyQuery('how are you doing today')).toBe('conversational')
  })

  it('"thanks Mercury" classified as conversational', () => {
    expect(classifyQuery('thanks Mercury')).toBe('conversational')
  })

  it('"how do I upload a document" classified as conversational (platform question)', () => {
    // Platform help questions are conversational even with "document" keyword
    expect(classifyQuery('how do I upload a document')).toBe('conversational')
  })

  it('"hi" classified as conversational', () => {
    expect(classifyQuery('hi')).toBe('conversational')
  })

  it('"hey" classified as conversational', () => {
    expect(classifyQuery('hey')).toBe('conversational')
  })

  it('"good morning" classified as conversational', () => {
    expect(classifyQuery('good morning')).toBe('conversational')
  })

  it('"goodbye" classified as conversational', () => {
    expect(classifyQuery('goodbye')).toBe('conversational')
  })

  it('"thank you" classified as conversational', () => {
    expect(classifyQuery('thank you')).toBe('conversational')
  })

  it('"what can you do" classified as conversational', () => {
    expect(classifyQuery('what can you do')).toBe('conversational')
  })

  it('"what\'s your name" classified as conversational', () => {
    expect(classifyQuery("what's your name")).toBe('conversational')
  })

  it('"I\'m frustrated" classified as conversational', () => {
    expect(classifyQuery("I'm frustrated")).toBe('conversational')
  })

  it('"what do you think about AI" classified as conversational', () => {
    expect(classifyQuery('what do you think about AI')).toBe('conversational')
  })

  it('"help me with my account" classified as conversational (platform question)', () => {
    expect(classifyQuery('help me with my account')).toBe('conversational')
  })
})

// ============================================================================
// DOCUMENT QUERIES — full RAG pipeline with citations
// ============================================================================

describe('Query Classification — Document Query (EPIC-023)', () => {

  it('"what does the contract say about liability" classified as document', () => {
    expect(classifyQuery('what does the contract say about liability')).toBe('document')
  })

  it('"summarize the executive summary" classified as document', () => {
    expect(classifyQuery('summarize the executive summary')).toBe('document')
  })

  it('"find risks in the investor pitch" classified as document', () => {
    expect(classifyQuery('find risks in the investor pitch')).toBe('document')
  })

  it('"compare these two documents" classified as document', () => {
    expect(classifyQuery('compare these two documents')).toBe('document')
  })

  it('"tell me about the document you have" classified as document', () => {
    expect(classifyQuery('tell me about the document you have')).toBe('document')
  })

  it('"what\'s in my NDA" classified as document', () => {
    expect(classifyQuery("what's in my NDA")).toBe('document')
  })

  it('"find the termination clause" classified as document', () => {
    expect(classifyQuery('find the termination clause')).toBe('document')
  })

  it('"what does section 4 say" classified as document', () => {
    expect(classifyQuery('what does section 4 say')).toBe('document')
  })

  it('"show me the contract details" classified as document', () => {
    expect(classifyQuery('show me the contract details')).toBe('document')
  })

  it('"extract key terms from the agreement" classified as document', () => {
    expect(classifyQuery('extract key terms from the agreement')).toBe('document')
  })

  it('"according to the report" classified as document', () => {
    expect(classifyQuery('according to the report, what are the projections')).toBe('document')
  })

  it('"find in my vault" classified as document', () => {
    expect(classifyQuery('find in my vault the indemnification clause')).toBe('document')
  })
})

// ============================================================================
// EDGE CASES — mixed intent, boundaries, normalization
// ============================================================================

describe('Query Classification — Edge Cases (EPIC-023)', () => {

  it('"Hello, can you find my document?" → document (intent wins over greeting)', () => {
    expect(classifyQuery('Hello, can you find my document?')).toBe('document')
  })

  it('"Thanks, now summarize the lease" → document (intent wins over thanks)', () => {
    expect(classifyQuery('Thanks, now summarize the lease')).toBe('document')
  })

  it('"Hey, what does my NDA say about non-compete?" → document', () => {
    expect(classifyQuery('Hey, what does my NDA say about non-compete?')).toBe('document')
  })

  it('"what can you tell me" → conversational (no doc keywords)', () => {
    expect(classifyQuery('what can you tell me')).toBe('conversational')
  })

  it('empty string → conversational (safe default)', () => {
    expect(classifyQuery('')).toBe('conversational')
  })

  it('whitespace-only → conversational (safe default)', () => {
    expect(classifyQuery('   ')).toBe('conversational')
  })

  it('case insensitive — "SUMMARIZE THE REPORT" → document', () => {
    expect(classifyQuery('SUMMARIZE THE REPORT')).toBe('document')
  })

  it('case insensitive — "HELLO" → conversational', () => {
    expect(classifyQuery('HELLO')).toBe('conversational')
  })

  it('"how do I find a file" → conversational (platform pattern overrides doc keyword)', () => {
    expect(classifyQuery('how do I find a file')).toBe('conversational')
  })

  it('"how can I upload my contract" → conversational (platform question)', () => {
    expect(classifyQuery('how can I upload my contract')).toBe('conversational')
  })
})

// ============================================================================
// CLASSIFIER CONTRACT — return type validation
// ============================================================================

describe('Query Classification — Contract (EPIC-023)', () => {

  it('always returns "conversational" or "document"', () => {
    const queries = [
      'hello', 'summarize the report', '', '   ',
      'what does the contract say', 'goodbye',
      'How do I upload a document', 'compare these files',
    ]
    for (const q of queries) {
      const result = classifyQuery(q)
      expect(['conversational', 'document']).toContain(result)
    }
  })

  it('return type is a string, not undefined or null', () => {
    expect(typeof classifyQuery('hello')).toBe('string')
    expect(typeof classifyQuery('summarize the report')).toBe('string')
    expect(typeof classifyQuery('')).toBe('string')
  })
})
