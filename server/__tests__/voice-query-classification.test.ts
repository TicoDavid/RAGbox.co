/**
 * BUG-046: Two-Mode Voice Query Classification Tests (Inverted Logic)
 *
 * CRITICAL FIX: Document query is now the DEFAULT. Only pure greetings
 * and small talk are conversational. This matches Sheldon's inverted
 * classifyQuery from BUG-046.
 *
 * CPO test evidence (Deploy 25): Evelyn couldn't access the vault because
 * classifyQuery defaulted to conversational. Natural language requests like
 * "I would like to take a look inside of the RAGbox" were routed away from
 * RAG. Now: if it's not a pure greeting/small-talk, it goes to RAG.
 *
 * CPO's words: "She is the same as the chat window but uses her voice."
 *
 * TODO: Replace with import { classifyQuery } from '../voice-pipeline-v3'
 *       once Sheldon exports the function.
 *
 * — Sarah, QA
 */

// ─── Replicated classifier from BUG-046 spec (inverted logic) ───────────────
// Document is the default. Only narrow conversational patterns bypass RAG.

type QueryType = 'conversational' | 'document'

function classifyQuery(text: string): QueryType {
  const q = text.toLowerCase().trim()

  // Empty / whitespace → safe conversational default
  if (!q) return 'conversational'

  // CONVERSATIONAL: Only pure greetings and small talk
  const conversationalPatterns = [
    /^(hi|hello|hey|howdy|greetings|good\s+(morning|afternoon|evening))[\s!?.]*$/,
    /^(how are you|how's it going|what's up)[\s!?.]*$/,
    /^(thank(s| you)|bye|goodbye|see you|take care)[\s!?.]*$/,
    /^(yes|no|ok|okay|sure|great|got it|perfect|awesome)[\s!?.]*$/,
    /\b(can you hear|hear me|testing|is this working|are you there)\b/,
    /\b(who are you|what's your name|what can you do|tell me about yourself)\b/,
  ]

  for (const pattern of conversationalPatterns) {
    if (pattern.test(q)) return 'conversational'
  }

  // EVERYTHING ELSE → document query (let RAG handle it)
  return 'document'
}

// ============================================================================
// CPO TEST QUERIES — these MUST all classify as document (BUG-046 evidence)
// ============================================================================

describe('BUG-046 — CPO Test Queries (MUST be document)', () => {

  it('"I would like to take a look inside of the RAGbox" → document', () => {
    expect(classifyQuery('I would like to take a look inside of the RAGbox')).toBe('document')
  })

  it('"I need to study the investor pitch script.docx" → document', () => {
    expect(classifyQuery('I need to study the investor pitch script.docx')).toBe('document')
  })

  it('"full details on the investor pitch script" → document', () => {
    expect(classifyQuery('full details on the investor pitch script')).toBe('document')
  })

  it('"What documents can you see?" → document', () => {
    expect(classifyQuery('What documents can you see?')).toBe('document')
  })
})

// ============================================================================
// CONVERSATIONAL — only pure greetings and small talk bypass RAG
// ============================================================================

describe('Query Classification — Conversational (BUG-046 inverted)', () => {

  // Pure greetings (anchored — entire string must be just the greeting)
  it('"hello" → conversational', () => {
    expect(classifyQuery('hello')).toBe('conversational')
  })

  it('"hi" → conversational', () => {
    expect(classifyQuery('hi')).toBe('conversational')
  })

  it('"hey" → conversational', () => {
    expect(classifyQuery('hey')).toBe('conversational')
  })

  it('"good morning" → conversational', () => {
    expect(classifyQuery('good morning')).toBe('conversational')
  })

  it('"good afternoon" → conversational', () => {
    expect(classifyQuery('good afternoon')).toBe('conversational')
  })

  it('"good evening" → conversational', () => {
    expect(classifyQuery('good evening')).toBe('conversational')
  })

  // Pure small talk (anchored)
  it('"how are you" → conversational (exact phrase)', () => {
    expect(classifyQuery('how are you')).toBe('conversational')
  })

  it('"how are you?" → conversational (with punctuation)', () => {
    expect(classifyQuery('how are you?')).toBe('conversational')
  })

  it('"what\'s up" → conversational', () => {
    expect(classifyQuery("what's up")).toBe('conversational')
  })

  // Farewells (anchored)
  it('"goodbye" → conversational', () => {
    expect(classifyQuery('goodbye')).toBe('conversational')
  })

  it('"bye" → conversational', () => {
    expect(classifyQuery('bye')).toBe('conversational')
  })

  it('"thank you" → conversational', () => {
    expect(classifyQuery('thank you')).toBe('conversational')
  })

  it('"thanks" → conversational', () => {
    expect(classifyQuery('thanks')).toBe('conversational')
  })

  it('"see you" → conversational', () => {
    expect(classifyQuery('see you')).toBe('conversational')
  })

  // Pleasantries (anchored)
  it('"ok" → conversational', () => {
    expect(classifyQuery('ok')).toBe('conversational')
  })

  it('"great" → conversational', () => {
    expect(classifyQuery('great')).toBe('conversational')
  })

  it('"got it" → conversational', () => {
    expect(classifyQuery('got it')).toBe('conversational')
  })

  it('"sure" → conversational', () => {
    expect(classifyQuery('sure')).toBe('conversational')
  })

  it('"awesome" → conversational', () => {
    expect(classifyQuery('awesome')).toBe('conversational')
  })

  // Audio checks (word boundary — can appear in longer sentences)
  it('"can you hear me" → conversational', () => {
    expect(classifyQuery('can you hear me')).toBe('conversational')
  })

  it('"testing" → conversational', () => {
    expect(classifyQuery('testing')).toBe('conversational')
  })

  it('"is this working" → conversational', () => {
    expect(classifyQuery('is this working')).toBe('conversational')
  })

  it('"are you there" → conversational', () => {
    expect(classifyQuery('are you there')).toBe('conversational')
  })

  // About Mercury (word boundary — can appear in longer sentences)
  it('"who are you" → conversational', () => {
    expect(classifyQuery('who are you')).toBe('conversational')
  })

  it('"what\'s your name" → conversational', () => {
    expect(classifyQuery("what's your name")).toBe('conversational')
  })

  it('"what can you do" → conversational', () => {
    expect(classifyQuery('what can you do')).toBe('conversational')
  })

  it('"tell me about yourself" → conversational', () => {
    expect(classifyQuery('tell me about yourself')).toBe('conversational')
  })

  // Empty / whitespace → safe conversational default
  it('empty string → conversational', () => {
    expect(classifyQuery('')).toBe('conversational')
  })

  it('whitespace-only → conversational', () => {
    expect(classifyQuery('   ')).toBe('conversational')
  })
})

// ============================================================================
// DOCUMENT — everything that isn't a pure greeting goes to RAG
// ============================================================================

describe('Query Classification — Document (BUG-046 inverted)', () => {

  // Explicit document requests
  it('"what does the contract say about liability" → document', () => {
    expect(classifyQuery('what does the contract say about liability')).toBe('document')
  })

  it('"summarize the executive summary" → document', () => {
    expect(classifyQuery('summarize the executive summary')).toBe('document')
  })

  it('"find risks in the investor pitch" → document', () => {
    expect(classifyQuery('find risks in the investor pitch')).toBe('document')
  })

  it('"compare these two documents" → document', () => {
    expect(classifyQuery('compare these two documents')).toBe('document')
  })

  it('"what\'s in my NDA" → document', () => {
    expect(classifyQuery("what's in my NDA")).toBe('document')
  })

  it('"find the termination clause" → document', () => {
    expect(classifyQuery('find the termination clause')).toBe('document')
  })

  it('"extract key terms from the agreement" → document', () => {
    expect(classifyQuery('extract key terms from the agreement')).toBe('document')
  })

  // Natural language requests (the ones that broke in Deploy 25)
  it('"I want to look inside the RAGbox" → document', () => {
    expect(classifyQuery('I want to look inside the RAGbox')).toBe('document')
  })

  it('"what files do I have" → document', () => {
    expect(classifyQuery('what files do I have')).toBe('document')
  })

  it('"show me what you have" → document', () => {
    expect(classifyQuery('show me what you have')).toBe('document')
  })

  it('"tell me about the document you have" → document', () => {
    expect(classifyQuery('tell me about the document you have')).toBe('document')
  })

  // Queries that OLD logic misclassified as conversational (BUG-046 root cause)
  it('"how do I upload a document" → document (no platform exception)', () => {
    // Old logic had platform patterns — inverted logic sends everything to RAG
    expect(classifyQuery('how do I upload a document')).toBe('document')
  })

  it('"help me with my account" → document', () => {
    expect(classifyQuery('help me with my account')).toBe('document')
  })

  it('"I\'m frustrated" → document', () => {
    expect(classifyQuery("I'm frustrated")).toBe('document')
  })

  it('"what do you think about AI" → document', () => {
    expect(classifyQuery('what do you think about AI')).toBe('document')
  })

  it('"what can you tell me" → document', () => {
    expect(classifyQuery('what can you tell me')).toBe('document')
  })

  // Greeting + document intent → document (greeting is NOT pure)
  it('"Hello, can you find my document?" → document', () => {
    expect(classifyQuery('Hello, can you find my document?')).toBe('document')
  })

  it('"Thanks, now summarize the lease" → document', () => {
    expect(classifyQuery('Thanks, now summarize the lease')).toBe('document')
  })

  it('"Hey, what does my NDA say about non-compete?" → document', () => {
    expect(classifyQuery('Hey, what does my NDA say about non-compete?')).toBe('document')
  })

  // Extra words after greeting → NOT pure greeting → document
  it('"how are you doing today" → document (not pure "how are you")', () => {
    expect(classifyQuery('how are you doing today')).toBe('document')
  })

  it('"thanks Mercury" → document (not pure "thanks")', () => {
    expect(classifyQuery('thanks Mercury')).toBe('document')
  })

  // File extensions
  it('"open the budget.xlsx" → document', () => {
    expect(classifyQuery('open the budget.xlsx')).toBe('document')
  })

  it('"read contract_v2.pdf" → document', () => {
    expect(classifyQuery('read contract_v2.pdf')).toBe('document')
  })
})

// ============================================================================
// EDGE CASES — normalization, case sensitivity, boundaries
// ============================================================================

describe('Query Classification — Edge Cases (BUG-046)', () => {

  it('case insensitive — "HELLO" → conversational', () => {
    expect(classifyQuery('HELLO')).toBe('conversational')
  })

  it('case insensitive — "SUMMARIZE THE REPORT" → document', () => {
    expect(classifyQuery('SUMMARIZE THE REPORT')).toBe('document')
  })

  it('case insensitive — "GOOD MORNING" → conversational', () => {
    expect(classifyQuery('GOOD MORNING')).toBe('conversational')
  })

  it('punctuation on greetings — "hello!" → conversational', () => {
    expect(classifyQuery('hello!')).toBe('conversational')
  })

  it('punctuation on greetings — "hey?" → conversational', () => {
    expect(classifyQuery('hey?')).toBe('conversational')
  })

  it('"hello there" → document (extra word, not pure greeting)', () => {
    expect(classifyQuery('hello there')).toBe('document')
  })

  it('"thank you very much" → document (extra words, not pure "thank you")', () => {
    expect(classifyQuery('thank you very much')).toBe('document')
  })

  it('"hey, who are you?" → conversational (about-Mercury uses word boundary)', () => {
    // "who are you" is a \b word boundary pattern, not anchored
    expect(classifyQuery('hey, who are you?')).toBe('conversational')
  })

  it('"hey, can you hear me?" → conversational (audio check uses word boundary)', () => {
    expect(classifyQuery('hey, can you hear me?')).toBe('conversational')
  })

  it('"Didn\'t quite hear that. What did you say?" → document', () => {
    // From CPO test evidence — marked OK, RAG can handle it
    expect(classifyQuery("Didn't quite hear that. What did you say?")).toBe('document')
  })

  it('trailing spaces trimmed — "  hello  " → conversational', () => {
    expect(classifyQuery('  hello  ')).toBe('conversational')
  })
})

// ============================================================================
// CONTRACT — return type validation
// ============================================================================

describe('Query Classification — Contract (BUG-046)', () => {

  it('always returns "conversational" or "document"', () => {
    const queries = [
      'hello', 'summarize the report', '', '   ',
      'I would like to take a look inside of the RAGbox',
      'goodbye', 'What documents can you see?',
      'full details on the investor pitch script',
    ]
    for (const q of queries) {
      const result = classifyQuery(q)
      expect(['conversational', 'document']).toContain(result)
    }
  })

  it('return type is a string, not undefined or null', () => {
    expect(typeof classifyQuery('hello')).toBe('string')
    expect(typeof classifyQuery('look inside the RAGbox')).toBe('string')
    expect(typeof classifyQuery('')).toBe('string')
  })
})
