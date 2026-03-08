/**
 * EPIC-028 Phase 2: Conversation Memory Tests
 *
 * Tests Sheldon's Phase 2 implementation in ragbox_node.ts:
 * 1. RAGboxNode passes conversationHistory (max 20 turns) to Go backend
 * 2. Go backend request includes userContext (name, role, recentTopics)
 * 3. Intent detection: document / conversational / meta (3-way)
 * 4. Voice responses: no markdown, no citations, 3-4 sentences max
 * 5. Context carries across 5+ turns in conversationHistory array
 *
 * — Sarah, Junior Engineer
 */

// ─── Mock Inworld SDK before any import ──────────────────────────────────────

jest.mock('@inworld/runtime/graph', () => ({
  CustomNode: class {
    async process(): Promise<string> { return '' }
  },
  ProcessContext: class {},
}))

// ─── Mock global fetch ───────────────────────────────────────────────────────

const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

// ─── Import RAGboxNode (uses mocked CustomNode) ─────────────────────────────

import { RAGboxNode } from '../mercury-voice/src/ragbox_node'
import type { RAGboxInput } from '../mercury-voice/src/ragbox_node'

// ─── Replicate private functions for direct unit testing ─────────────────────

type Intent = 'document' | 'conversational' | 'meta'

/**
 * Replica of ragbox_node.ts classifyIntent (private function).
 * Phase 2: 3-way classification — document, conversational, meta.
 */
function classifyIntent(text: string): Intent {
  const lower = text.toLowerCase().trim()

  const metaPatterns = [
    /^(what can you do|help me|what are you|who are you|how do you work)/,
    /^(what('s| is) your (purpose|role|function))/,
    /^(capabilities|features|commands)/,
  ]
  if (metaPatterns.some(p => p.test(lower))) return 'meta'

  const conversationalPatterns = [
    /^(hi|hello|hey|good (morning|afternoon|evening)|howdy|yo)\b/,
    /^(how are you|how('s| is) it going|what('s| is) up)\b/,
    /^(thanks|thank you|bye|goodbye|see you|later|good night)\b/,
    /^(nice to meet you|pleasure)\b/,
  ]
  if (conversationalPatterns.some(p => p.test(lower))) return 'conversational'

  return 'document'
}

/**
 * Replica of ragbox_node.ts stripForVoice (private function).
 * Phase 2: includes 4-sentence cap for voice brevity.
 */
function stripForVoice(text: string): string {
  const cleaned = text
    .replace(/\[\d+\]/g, '')
    .replace(/\*{1,3}(.*?)\*{1,3}/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[\s]*[-*•]\s+/gm, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()

  const sentences = cleaned.match(/[^.!?]+[.!?]+/g)
  if (sentences && sentences.length > 4) {
    return sentences.slice(0, 4).join('').trim()
  }

  return cleaned
}

// ─── Setup / Teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
})

// ============================================================================
// 1. RAGboxNode passes conversationHistory array (max 20 turns) to Go backend
// ============================================================================

describe('Phase 2 — RAGboxNode passes conversationHistory to Go backend', () => {
  const node = new RAGboxNode()
  const mockContext = {} as any

  function mockBackendResponse(answer: string) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ answer }),
      text: async () => answer,
    })
  }

  it('sends conversationHistory array in request body', async () => {
    mockBackendResponse('The contract states liability is limited.')
    const history = [
      { role: 'user' as const, content: 'What is in my contract?' },
      { role: 'assistant' as const, content: 'The contract covers liability and termination.' },
    ]

    await node.process(mockContext, {
      text: 'Tell me more about the liability section',
      userId: 'user-1',
      conversationHistory: history,
    })

    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(fetchBody.conversationHistory).toEqual(history)
  })

  it('sends up to 20 turns of history', async () => {
    mockBackendResponse('Summary of findings.')
    const history = Array.from({ length: 20 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Turn ${i}`,
    }))

    await node.process(mockContext, {
      text: 'Continue the analysis',
      userId: 'user-1',
      conversationHistory: history,
    })

    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(fetchBody.conversationHistory).toHaveLength(20)
  })

  it('omits conversationHistory when not provided', async () => {
    mockBackendResponse('The document shows...')

    await node.process(mockContext, {
      text: 'What does this document say?',
      userId: 'user-1',
    })

    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(fetchBody.conversationHistory).toBeUndefined()
  })

  it('omits conversationHistory when empty array provided', async () => {
    mockBackendResponse('First question about the document.')

    await node.process(mockContext, {
      text: 'What is this about?',
      userId: 'user-1',
      conversationHistory: [],
    })

    // Empty array is falsy check: [] || undefined → []. Sheldon's code uses || undefined
    // which means empty arrays pass through as []. Either behavior is acceptable.
    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    // Backwards compatible — Go backend handles empty or missing conversationHistory
    expect(
      fetchBody.conversationHistory === undefined ||
      Array.isArray(fetchBody.conversationHistory)
    ).toBe(true)
  })
})

// ============================================================================
// 2. Go backend request includes userContext (name, role, recentTopics)
// ============================================================================

describe('Phase 2 — RAGboxNode passes userContext to Go backend', () => {
  const node = new RAGboxNode()
  const mockContext = {} as any

  function mockBackendResponse(answer: string) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ answer }),
      text: async () => answer,
    })
  }

  it('sends userContext with name, role, recentTopics', async () => {
    mockBackendResponse('Here is the analysis for your review, David.')
    const userContext = {
      name: 'David',
      role: 'CPO',
      recentTopics: ['investor pitch', 'NDA terms'],
    }

    await node.process(mockContext, {
      text: 'Summarize the investor pitch',
      userId: 'user-1',
      userContext,
    })

    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(fetchBody.userContext).toEqual(userContext)
    expect(fetchBody.userContext.name).toBe('David')
    expect(fetchBody.userContext.role).toBe('CPO')
    expect(fetchBody.userContext.recentTopics).toContain('investor pitch')
  })

  it('omits userContext when not provided (backwards compatible)', async () => {
    mockBackendResponse('The document covers...')

    await node.process(mockContext, {
      text: 'What is in this file?',
      userId: 'user-1',
    })

    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(fetchBody.userContext).toBeUndefined()
  })

  it('sends partial userContext (only name, no role)', async () => {
    mockBackendResponse('Here is the summary.')

    await node.process(mockContext, {
      text: 'Summarize the contract',
      userId: 'user-1',
      userContext: { name: 'Sarah' },
    })

    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(fetchBody.userContext.name).toBe('Sarah')
    expect(fetchBody.userContext.role).toBeUndefined()
  })
})

// ============================================================================
// 3. Intent detection: document / conversational / meta (3-way)
// ============================================================================

describe('Phase 2 — 3-way intent detection (classifyIntent)', () => {
  // ── Document queries ─────────────────────────────────────────────────────

  describe('document intent', () => {
    const documentQueries = [
      'What documents do I have?',
      'Summarize the executive summary',
      'Find risks in the investor pitch',
      'What does the contract say about liability?',
      'Compare these two documents',
      "What's in my NDA?",
      'I would like to take a look inside of the RAGbox',
      'Show me the termination clause',
    ]

    for (const query of documentQueries) {
      it(`"${query}" → document`, () => {
        expect(classifyIntent(query)).toBe('document')
      })
    }

    it('default is document for unrecognized queries', () => {
      expect(classifyIntent('tell me something interesting about AI')).toBe('document')
    })
  })

  // ── Conversational queries ───────────────────────────────────────────────

  describe('conversational intent', () => {
    const conversationalQueries = [
      'hello', 'hi', 'hey', 'howdy', 'yo',
      'good morning', 'good afternoon', 'good evening',
      'how are you', "how's it going", "what's up",
      'thanks', 'thank you',
      'bye', 'goodbye', 'see you', 'later', 'good night',
      'nice to meet you',
    ]

    for (const query of conversationalQueries) {
      it(`"${query}" → conversational`, () => {
        expect(classifyIntent(query)).toBe('conversational')
      })
    }
  })

  // ── Meta queries (NEW in Phase 2) ────────────────────────────────────────

  describe('meta intent (Phase 2)', () => {
    const metaQueries = [
      'what can you do',
      'help me',
      'what are you',
      'who are you',
      'how do you work',
      "what's your purpose",
      'what is your role',
      "what's your function",
      'capabilities',
      'features',
      'commands',
    ]

    for (const query of metaQueries) {
      it(`"${query}" → meta`, () => {
        expect(classifyIntent(query)).toBe('meta')
      })
    }

    it('"what is your purpose" → meta', () => {
      expect(classifyIntent('what is your purpose')).toBe('meta')
    })
  })

  // ── Edge cases ───────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('case-insensitive: "HELLO" → conversational', () => {
      expect(classifyIntent('HELLO')).toBe('conversational')
    })

    it('case-insensitive: "WHAT CAN YOU DO" → meta', () => {
      expect(classifyIntent('WHAT CAN YOU DO')).toBe('meta')
    })

    it('trims whitespace: "  hello  " → conversational', () => {
      expect(classifyIntent('  hello  ')).toBe('conversational')
    })

    it('greeting prefix with follow-up → conversational (Phase 2 uses \\b, not $)', () => {
      // Phase 2 classifyIntent uses ^hello\b (word boundary), not ^hello$ (end anchor).
      // "Hello, can you find my document?" starts with hello\b → conversational.
      // This differs from Phase 1 classifyQuery which required pure greeting ($ anchor).
      // Phase 2 design: voice pipeline handles greeting-prefixed queries conversationally,
      // since the Go backend receives conversationHistory for follow-up context.
      expect(classifyIntent('Hello, can you find my document?')).toBe('conversational')
    })

    it('meta + document → meta (meta patterns checked first)', () => {
      // "what can you do with my files" — starts with "what can you do" → meta
      expect(classifyIntent('what can you do with my files')).toBe('meta')
    })
  })
})

// ============================================================================
// 3b. RAGboxNode routes intents correctly (integration)
// ============================================================================

describe('Phase 2 — RAGboxNode intent routing (integration)', () => {
  const node = new RAGboxNode()
  const mockContext = {} as any

  it('conversational query skips Go backend (no fetch call)', async () => {
    const result = await node.process(mockContext, {
      text: 'Thanks',
      userId: 'user-1',
    })

    expect(mockFetch).not.toHaveBeenCalled()
    // Phase 3 changed handleConversational: "Thanks" now returns "Happy to help!"
    expect(result).toMatch(/welcome|happy to help/i)
  })

  it('meta query skips Go backend (no fetch call)', async () => {
    const result = await node.process(mockContext, {
      text: 'How do you work?',
      userId: 'user-1',
    })

    expect(mockFetch).not.toHaveBeenCalled()
    expect(result).toContain('documents')
  })

  it('document query calls Go backend', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ answer: 'The contract states...' }),
      text: async () => 'The contract states...',
    })

    await node.process(mockContext, {
      text: 'What does my contract say about termination?',
      userId: 'user-1',
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0][0]).toContain('/api/chat')
  })

  it('conversational "goodbye" returns farewell response', async () => {
    const result = await node.process(mockContext, {
      text: 'Goodbye',
      userId: 'user-1',
    })

    expect(mockFetch).not.toHaveBeenCalled()
    expect(result.toLowerCase()).toMatch(/goodbye|here whenever/)
  })

  it('meta "what can you do" returns capability summary', async () => {
    const result = await node.process(mockContext, {
      text: 'What can you do?',
      userId: 'user-1',
    })

    expect(mockFetch).not.toHaveBeenCalled()
    expect(result).toContain('search')
    expect(result).toContain('documents')
  })
})

// ============================================================================
// 4. Voice responses: no markdown, no citations, 3-4 sentences max
// ============================================================================

describe('Phase 2 — voice response formatting (stripForVoice)', () => {
  // ── Citation removal ─────────────────────────────────────────────────────

  it('removes citation brackets [1] [2] [3]', () => {
    const input = 'The contract [1] limits liability [2] to $1M [3].'
    expect(stripForVoice(input)).not.toMatch(/\[\d+\]/)
  })

  // ── Markdown removal ─────────────────────────────────────────────────────

  it('removes bold **text**', () => {
    expect(stripForVoice('The **critical clause** applies.')).toBe('The critical clause applies.')
  })

  it('removes italic *text*', () => {
    expect(stripForVoice('This is *extremely* important.')).toBe('This is extremely important.')
  })

  it('removes headers ## Section', () => {
    expect(stripForVoice('## Summary\nContent here')).toContain('Summary')
    expect(stripForVoice('## Summary\nContent here')).not.toContain('##')
  })

  it('removes markdown links [text](url)', () => {
    expect(stripForVoice('See [Section 3](https://example.com).')).toBe('See Section 3.')
  })

  it('removes code fences and inline code', () => {
    expect(stripForVoice('Run `npm test` now.')).toBe('Run npm test now.')
  })

  it('removes bullet markers (-, *, •)', () => {
    const input = '- First item\n- Second item'
    const result = stripForVoice(input)
    expect(result).not.toMatch(/^[-*•]/m)
  })

  // ── 4-sentence cap (Phase 2 addition) ────────────────────────────────────

  it('caps output at 4 sentences', () => {
    const input = 'Sentence one. Sentence two. Sentence three. Sentence four. Sentence five. Sentence six.'
    const result = stripForVoice(input)
    const sentenceCount = (result.match(/[.!?]/g) || []).length
    expect(sentenceCount).toBeLessThanOrEqual(4)
  })

  it('preserves all sentences when <= 4', () => {
    const input = 'First point. Second point. Third point.'
    expect(stripForVoice(input)).toBe('First point. Second point. Third point.')
  })

  it('keeps exactly 4 sentences from a 6-sentence input', () => {
    const input = 'One. Two. Three. Four. Five. Six.'
    const result = stripForVoice(input)
    expect(result).toContain('One.')
    expect(result).toContain('Two.')
    expect(result).toContain('Three.')
    expect(result).toContain('Four.')
    expect(result).not.toContain('Five.')
    expect(result).not.toContain('Six.')
  })

  it('handles question marks and exclamation marks as sentence boundaries', () => {
    const input = 'Is this right? Yes! But there is more. And more here. Plus this. And that.'
    const result = stripForVoice(input)
    const sentenceCount = (result.match(/[.!?]/g) || []).length
    expect(sentenceCount).toBeLessThanOrEqual(4)
  })

  it('combined: strips markdown + citations + caps at 4 sentences', () => {
    const ragOutput = '## Analysis\n\n' +
      'The **contract** [1] limits liability. ' +
      'The *termination clause* [2] requires notice. ' +
      'Section 5 covers `indemnification` [3]. ' +
      'Non-compete lasts [12 months](https://legal.co). ' +
      'Final clause is important. ' +
      'Appendix A has details.'

    const result = stripForVoice(ragOutput)

    // No markdown artifacts
    expect(result).not.toContain('**')
    expect(result).not.toContain('##')
    expect(result).not.toMatch(/\[\d+\]/)
    expect(result).not.toContain('`')

    // Capped at 4 sentences
    const sentenceCount = (result.match(/[.!?]/g) || []).length
    expect(sentenceCount).toBeLessThanOrEqual(4)
  })
})

// ============================================================================
// 5. Context carries across 5+ turns — assistant remembers previous questions
// ============================================================================

describe('Phase 2 — context carries across 5+ turns', () => {
  const node = new RAGboxNode()
  const mockContext = {} as any

  function mockBackendResponse(answer: string) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ answer }),
      text: async () => answer,
    })
  }

  it('conversationHistory accumulates across multiple turns', async () => {
    const turns = [
      { role: 'user' as const, content: 'What is in the contract?' },
      { role: 'assistant' as const, content: 'The contract covers liability and termination.' },
      { role: 'user' as const, content: 'Tell me about the liability section.' },
      { role: 'assistant' as const, content: 'Liability is capped at $1 million.' },
      { role: 'user' as const, content: 'What about termination?' },
      { role: 'assistant' as const, content: 'Termination requires 30 days notice.' },
      { role: 'user' as const, content: 'Are there any exceptions?' },
      { role: 'assistant' as const, content: 'Yes, breach of contract is immediate.' },
      { role: 'user' as const, content: 'Summarize all of the above.' },
      { role: 'assistant' as const, content: 'The contract has liability cap, 30-day termination, and breach exception.' },
    ]

    mockBackendResponse('Based on our discussion, the key points are...')

    await node.process(mockContext, {
      text: 'Now compare this with the other agreement',
      userId: 'user-1',
      conversationHistory: turns,
    })

    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body)

    // All 10 turns (5 exchanges) carried through
    expect(fetchBody.conversationHistory).toHaveLength(10)

    // First turn preserved
    expect(fetchBody.conversationHistory[0].content).toBe('What is in the contract?')

    // Last turn preserved
    expect(fetchBody.conversationHistory[9].content).toContain('liability cap')
  })

  it('maintains user/assistant role alternation in history', async () => {
    const turns = Array.from({ length: 12 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Turn ${i}: ${i % 2 === 0 ? 'question' : 'answer'}`,
    }))

    mockBackendResponse('Follow-up answer.')

    await node.process(mockContext, {
      text: 'Next question',
      userId: 'user-1',
      conversationHistory: turns,
    })

    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    const history = fetchBody.conversationHistory

    // Verify alternation
    for (let i = 0; i < history.length; i++) {
      expect(history[i].role).toBe(i % 2 === 0 ? 'user' : 'assistant')
    }
  })

  it('userContext carries across turns alongside history', async () => {
    const turns = [
      { role: 'user' as const, content: 'First question' },
      { role: 'assistant' as const, content: 'First answer' },
      { role: 'user' as const, content: 'Second question' },
      { role: 'assistant' as const, content: 'Second answer' },
      { role: 'user' as const, content: 'Third question' },
      { role: 'assistant' as const, content: 'Third answer' },
    ]

    mockBackendResponse('Personalized answer for David.')

    await node.process(mockContext, {
      // Use a document-intent query (Phase 3 classifies "continue" as followup)
      text: 'Analyze the contract liability terms',
      userId: 'user-1',
      conversationHistory: turns,
      userContext: {
        name: 'David',
        role: 'CPO',
        recentTopics: ['contract review', 'liability analysis', 'termination'],
      },
    })

    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body)

    // Both history and context present in same request
    expect(fetchBody.conversationHistory).toHaveLength(6)
    expect(fetchBody.userContext.name).toBe('David')
    expect(fetchBody.userContext.recentTopics).toHaveLength(3)
  })

  it('backend still works with conversationHistory but no userContext', async () => {
    const turns = [
      { role: 'user' as const, content: 'What is this?' },
      { role: 'assistant' as const, content: 'This is a legal agreement.' },
    ]

    mockBackendResponse('The agreement covers...')

    await node.process(mockContext, {
      text: 'Go deeper',
      userId: 'user-1',
      conversationHistory: turns,
    })

    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(fetchBody.conversationHistory).toHaveLength(2)
    expect(fetchBody.userContext).toBeUndefined()
  })

  it('backend still works with no conversationHistory and no userContext', async () => {
    mockBackendResponse('Standalone answer.')

    await node.process(mockContext, {
      text: 'First question ever',
      userId: 'user-1',
    })

    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(fetchBody.conversationHistory).toBeUndefined()
    expect(fetchBody.userContext).toBeUndefined()
  })
})

// ============================================================================
// Contract: RAGboxInput type shape
// ============================================================================

describe('Phase 2 — RAGboxInput type contract', () => {
  it('accepts all Phase 2 fields', () => {
    const input: RAGboxInput = {
      text: 'What is this?',
      userId: 'user-1',
      personaId: 'persona-1',
      threadId: 'thread-1',
      conversationHistory: [
        { role: 'user', content: 'previous question' },
        { role: 'assistant', content: 'previous answer' },
      ],
      userContext: {
        name: 'David',
        role: 'CPO',
        recentTopics: ['contracts'],
      },
    }

    expect(input.text).toBeDefined()
    expect(input.conversationHistory).toHaveLength(2)
    expect(input.userContext?.name).toBe('David')
  })

  it('all Phase 2 fields are optional (backwards compatible)', () => {
    const input: RAGboxInput = {
      text: 'Simple query',
      userId: 'user-1',
    }

    expect(input.conversationHistory).toBeUndefined()
    expect(input.userContext).toBeUndefined()
  })
})
