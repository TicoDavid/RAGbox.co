/**
 * Sarah — EPIC-028 Phase 3, Task 2: Enhanced intent detection tests
 */

import { classifyIntent } from '../ragbox_node'

describe('classifyIntent — document queries', () => {
  it('"what\'s in my contract?" classifies as document', () => {
    const result = classifyIntent("what's in my contract?")
    expect(result.intent).toBe('document')
  })

  it('"summarize the lease agreement" classifies as document', () => {
    const result = classifyIntent('summarize the lease agreement')
    expect(result.intent).toBe('document')
  })

  it('default intent is document with 0.8 confidence', () => {
    const result = classifyIntent('random unknown query about something')
    expect(result.intent).toBe('document')
    expect(result.confidence).toBe(0.8)
  })
})

describe('classifyIntent — conversational queries', () => {
  it('"how are you?" classifies as conversational', () => {
    const result = classifyIntent('how are you?')
    expect(result.intent).toBe('conversational')
  })

  it('"thanks" classifies as conversational', () => {
    const result = classifyIntent('thanks')
    expect(result.intent).toBe('conversational')
  })

  it('"goodbye" classifies as conversational', () => {
    const result = classifyIntent('goodbye')
    expect(result.intent).toBe('conversational')
  })

  it('conversational has 0.85 confidence', () => {
    const result = classifyIntent('how are you?')
    expect(result.confidence).toBe(0.85)
  })
})

describe('classifyIntent — meta queries', () => {
  it('"what can you do?" classifies as meta', () => {
    const result = classifyIntent('what can you do?')
    expect(result.intent).toBe('meta')
  })

  it('"who are you" classifies as meta', () => {
    const result = classifyIntent('who are you')
    expect(result.intent).toBe('meta')
  })

  it('"capabilities" classifies as meta', () => {
    const result = classifyIntent('capabilities')
    expect(result.intent).toBe('meta')
  })

  it('meta has 0.95 confidence', () => {
    const result = classifyIntent('what can you do?')
    expect(result.confidence).toBe(0.95)
  })
})

describe('classifyIntent — greeting queries', () => {
  it('"good morning" classifies as greeting', () => {
    const result = classifyIntent('good morning')
    expect(result.intent).toBe('greeting')
  })

  it('"hello" classifies as greeting', () => {
    const result = classifyIntent('hello')
    expect(result.intent).toBe('greeting')
  })

  it('"hi there" classifies as greeting', () => {
    const result = classifyIntent('hi there')
    expect(result.intent).toBe('greeting')
  })

  it('greeting has 0.9 confidence', () => {
    const result = classifyIntent('hello')
    expect(result.confidence).toBe(0.9)
  })
})

describe('classifyIntent — followup queries', () => {
  const history = [
    { role: 'user' as const, content: 'tell me about the contract' },
    { role: 'assistant' as const, content: 'The contract states...' },
  ]

  it('"tell me more" classifies as followup (with history)', () => {
    const result = classifyIntent('tell me more', history)
    expect(result.intent).toBe('followup')
  })

  it('"expand on that" classifies as followup (with history)', () => {
    const result = classifyIntent('expand on that', history)
    expect(result.intent).toBe('followup')
  })

  it('"tell me more" classifies as document without history', () => {
    const result = classifyIntent('tell me more')
    // Without history, followup patterns don't match — falls through to document
    expect(result.intent).toBe('document')
  })

  it('followup has 0.85 confidence', () => {
    const result = classifyIntent('tell me more', history)
    expect(result.confidence).toBe(0.85)
  })
})

describe('classifyIntent — confidence threshold', () => {
  it('ambiguous query defaults to document (confidence 0.8 >= 0.7 threshold)', () => {
    const result = classifyIntent('some random question about things')
    // Default document intent has confidence 0.8 which is >= 0.7 threshold
    expect(result.intent).toBe('document')
    expect(result.confidence).toBeGreaterThanOrEqual(0.7)
  })

  it('all intents return a confidence score between 0 and 1', () => {
    const queries = [
      'what can you do?',
      'hello',
      'how are you?',
      'tell me about the contract',
    ]
    for (const query of queries) {
      const result = classifyIntent(query)
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
    }
  })
})
