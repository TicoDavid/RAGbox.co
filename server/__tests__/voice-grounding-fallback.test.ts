/**
 * BUG-042 Bug B: Grounding Refusal Interceptor Tests
 *
 * Tests that the production interceptGroundingRefusal function in
 * voice-pipeline-v3.ts correctly detects RAG grounding refusals and
 * returns natural Mercury persona responses instead.
 *
 * — Sheldon, Chief Engineer
 */

import { interceptGroundingRefusal } from '../voice-pipeline-v3'

// ============================================================================
// CORE INTERCEPTION
// ============================================================================

describe('Grounding Refusal Interceptor (BUG-042 Bug B)', () => {

  it('intercepts Silence Protocol refusal text', () => {
    const refusal = 'I cannot provide a sufficiently grounded answer to this query based on your documents.'
    const result = interceptGroundingRefusal(refusal, 'Hello, how are you?', 'Mercury')

    expect(result).not.toContain('cannot provide a sufficiently grounded')
    expect(result.length).toBeGreaterThan(20)
  })

  it('passes through valid RAG answers untouched', () => {
    const ragAnswer = 'Based on your uploaded contract, the renewal date is March 15.'
    const result = interceptGroundingRefusal(ragAnswer, 'When does my contract renew?', 'Mercury')

    expect(result).toBe(ragAnswer)
  })

  it('passes through RAG answers with citations untouched', () => {
    const citedAnswer =
      'According to the Master Services Agreement [1], the indemnification clause (Section 4.2) ' +
      'requires 30 days written notice [2]. The financial addendum confirms a cap of $500,000 [3].'

    const result = interceptGroundingRefusal(citedAnswer, 'What does the indemnification clause say?', 'Mercury')

    expect(result).toBe(citedAnswer)
    expect(result).toContain('[1]')
    expect(result).toContain('[2]')
    expect(result).toContain('[3]')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // REFUSAL PATTERNS
  // ──────────────────────────────────────────────────────────────────────────

  it('catches all known refusal patterns', () => {
    const refusalTexts = [
      'I cannot provide a sufficiently grounded answer based on the available documents.',
      "I don't have enough information in the available documents to answer that.",
      'The requested information was not found in the available documents.',
      "I don't have any documents to reference for this query.",
      'No relevant documents were found for your query.',
      'I was unable to find relevant information in your vault.',
      'I could not find any matching content in your documents.',
      'No documents were found that match your query.',
      "I don't have access to any documents that could answer this.",
      'Based on the available documents, I cannot answer this question.',
      'There is insufficient context to provide an accurate response.',
      'SILENCE_PROTOCOL triggered — no matching chunks.',
    ]

    for (const refusal of refusalTexts) {
      const result = interceptGroundingRefusal(refusal, 'test query', 'Mercury')
      expect(result).not.toBe(refusal)
      expect(result.length).toBeGreaterThan(10)
    }
  })

  it('intercepts empty responses', () => {
    const result = interceptGroundingRefusal('', 'test query', 'Mercury')
    expect(result.length).toBeGreaterThan(10)
  })

  it('intercepts very short responses', () => {
    const result = interceptGroundingRefusal('N/A', 'test query', 'Mercury')
    expect(result.length).toBeGreaterThan(10)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // QUERY CLASSIFICATION — persona-appropriate responses
  // ──────────────────────────────────────────────────────────────────────────

  it('responds naturally to greeting queries', () => {
    const refusal = 'I cannot provide a sufficiently grounded answer.'
    const greetings = ['Hello!', 'Hi there', 'Hey Mercury', 'Good morning', "What's up"]

    for (const greeting of greetings) {
      const result = interceptGroundingRefusal(refusal, greeting, 'Mercury')
      // Greeting response should mention the agent name
      expect(result).toContain('Mercury')
      expect(result).not.toContain('cannot provide')
    }
  })

  it('responds naturally to identity questions', () => {
    const refusal = 'I cannot provide a sufficiently grounded answer.'
    const questions = ['Who are you?', 'What can you do?', 'Tell me about yourself']

    for (const q of questions) {
      const result = interceptGroundingRefusal(refusal, q, 'Mercury')
      expect(result).toContain('Mercury')
      expect(result).toContain('document')
    }
  })

  it('responds naturally to small talk', () => {
    const refusal = 'I cannot provide a sufficiently grounded answer.'
    const smallTalk = ['How are you?', "How's it going?", "What's new?"]

    for (const q of smallTalk) {
      const result = interceptGroundingRefusal(refusal, q, 'Mercury')
      expect(result.length).toBeGreaterThan(20)
      expect(result).not.toContain('cannot provide')
    }
  })

  it('responds to thank you', () => {
    const refusal = 'I cannot provide a sufficiently grounded answer.'
    const result = interceptGroundingRefusal(refusal, 'Thank you for the help!', 'Mercury')
    expect(result).not.toContain('cannot provide')
    expect(result.length).toBeGreaterThan(10)
  })

  it('responds to goodbye', () => {
    const refusal = 'I cannot provide a sufficiently grounded answer.'
    const result = interceptGroundingRefusal(refusal, 'Goodbye, talk later!', 'Mercury')
    expect(result).not.toContain('cannot provide')
    expect(result.length).toBeGreaterThan(10)
  })

  it('responds to help requests', () => {
    const refusal = 'I cannot provide a sufficiently grounded answer.'
    const result = interceptGroundingRefusal(refusal, 'Can you help me with something?', 'Mercury')
    expect(result).not.toContain('cannot provide')
    expect(result).toContain('help')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // AGENT NAME PERSONALIZATION
  // ──────────────────────────────────────────────────────────────────────────

  it('uses custom agent name in greeting responses', () => {
    const refusal = 'I cannot provide a sufficiently grounded answer.'
    const result = interceptGroundingRefusal(refusal, 'Hello!', 'Evelyn Monroe')

    expect(result).toContain('Evelyn Monroe')
    expect(result).not.toContain('Mercury')
  })

  it('uses custom agent name in identity responses', () => {
    const refusal = 'I cannot provide a sufficiently grounded answer.'
    const result = interceptGroundingRefusal(refusal, 'Who are you?', 'Atlas')

    expect(result).toContain('Atlas')
    expect(result).not.toContain('Mercury')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // NON-START-ANCHORED MATCHING
  // ──────────────────────────────────────────────────────────────────────────

  it('matches greetings that do NOT start the string', () => {
    const refusal = 'I cannot provide a sufficiently grounded answer.'

    // User says "Mercury, hello!" — "hello" is mid-string
    const result = interceptGroundingRefusal(refusal, 'Mercury, hello!', 'Mercury')
    expect(result).toContain('Mercury')
    expect(result).not.toContain('cannot provide')
  })

  it('matches queries with preamble text', () => {
    const refusal = 'I cannot provide a sufficiently grounded answer.'

    // "So, who are you exactly?" — "who are you" is mid-string
    const result = interceptGroundingRefusal(refusal, 'So, who are you exactly?', 'Mercury')
    expect(result).toContain('Mercury')
    expect(result).toContain('document')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // DEFAULT FALLBACK
  // ──────────────────────────────────────────────────────────────────────────

  it('falls back gracefully for unclassified queries', () => {
    const refusal = 'I cannot provide a sufficiently grounded answer.'
    const oddQueries = [
      'What is the meaning of life?',
      'So what are you going to do to make it up to me? Take a mic to the marathon.',
      'Tell me a joke about lawyers',
    ]

    for (const q of oddQueries) {
      const result = interceptGroundingRefusal(refusal, q, 'Mercury')
      expect(result).not.toContain('cannot provide')
      expect(result.length).toBeGreaterThan(20)
    }
  })

  it('provides varied responses for different default queries', () => {
    const refusal = 'I cannot provide a sufficiently grounded answer.'
    const results = new Set<string>()

    // Different queries should produce at least some variety
    for (const q of ['query alpha', 'query beta', 'query gamma', 'query delta', 'query epsilon']) {
      results.add(interceptGroundingRefusal(refusal, q, 'Mercury'))
    }

    // With 3 default fallback options and 5 queries, we should get > 1 unique
    expect(results.size).toBeGreaterThan(1)
  })
})
