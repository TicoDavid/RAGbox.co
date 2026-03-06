/**
 * EPIC-028: Conversation Memory Tests
 *
 * Tests the RAGboxNode conversation memory stack:
 * 1. loadConversationHistory returns last N turns correctly
 * 2. User context loads name, role, preferences
 * 3. Intent detection classifies greetings as conversational
 * 4. Intent detection classifies document questions as document
 * 5. Voice format stripper removes citations and markdown
 * 6. Exchange saved to MercuryThread after each turn
 *
 * — Sarah, Junior Engineer
 */

// ─── Mock Prisma before any imports that touch it ────────────────────────────

const mockFindFirst = jest.fn()
const mockFindUnique = jest.fn()
const mockFindMany = jest.fn()
const mockCreate = jest.fn()
const mockUpdate = jest.fn()

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    mercuryThread: {
      findFirst: mockFindFirst,
      create: mockCreate,
      update: mockUpdate,
    },
    mercuryThreadMessage: {
      findMany: mockFindMany,
      create: mockCreate,
    },
    mercuryPersona: {
      findUnique: mockFindUnique,
    },
  })),
}))

// ─── Import exported functions (Inworld mocked to avoid SDK dep) ─────────────

jest.mock('@inworld/runtime/graph', () => ({
  GraphBuilder: jest.fn(),
  GraphTypes: { Audio: jest.fn() },
  RemoteSTTNode: jest.fn(),
  RemoteTTSNode: jest.fn(),
  RemoteTTSComponent: jest.fn(),
  CustomNode: class {},
  ProcessContext: class {},
}))

jest.mock('../tools', () => ({
  TOOL_DEFINITIONS: [],
  executeTool: jest.fn(),
}))

import { classifyQuery } from '../voice-pipeline-v3'
import { persistThreadMessage } from '../thread-persistence'

// ─── Replicate private functions for isolated testing ────────────────────────

/** Replica of ragbox_node.ts stripForVoice (private, not exported) */
function stripForVoice(text: string): string {
  return text
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
}

/** Replica of voice-pipeline-v3.ts loadThreadHistory (private, not exported) */
const THREAD_HISTORY_LIMIT = 20

interface MockMessage {
  role: string
  content: string
  createdAt?: Date
}

async function loadThreadHistory(
  userId: string,
  findFirstFn: typeof mockFindFirst,
  findManyFn: typeof mockFindMany,
): Promise<Array<{ role: string; content: string }>> {
  try {
    const thread = await findFirstFn({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    })
    if (!thread) return []

    const messages: MockMessage[] = await findManyFn({
      where: { threadId: thread.id },
      orderBy: { createdAt: 'desc' },
      take: THREAD_HISTORY_LIMIT,
      select: { role: true, content: true },
    })

    return messages.reverse().map(m => ({ role: m.role, content: m.content }))
  } catch {
    return []
  }
}

/** Replica of voice-pipeline-v3.ts fetchMercuryConfig user context loader */
interface MercuryConfig {
  name?: string
  voiceId?: string
  greeting?: string
  personalityPrompt?: string
}

async function loadUserContext(
  findUniqueFn: typeof mockFindUnique,
): Promise<MercuryConfig> {
  try {
    const persona = await findUniqueFn({ where: { tenantId: 'default' } })
    if (persona) {
      const name = [persona.firstName, persona.lastName].filter(Boolean).join(' ')
      return {
        name: name || undefined,
        voiceId: persona.voiceId || undefined,
        greeting: persona.greeting || undefined,
        personalityPrompt: persona.personalityPrompt || undefined,
      }
    }
  } catch {
    // best-effort
  }
  return {}
}

// ─── Reset mocks between tests ──────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
})

// ============================================================================
// 1. loadConversationHistory returns last N turns correctly
// ============================================================================

describe('EPIC-028 — loadConversationHistory', () => {
  it('returns empty array when no thread exists', async () => {
    mockFindFirst.mockResolvedValue(null)
    const result = await loadThreadHistory('user-1', mockFindFirst, mockFindMany)
    expect(result).toEqual([])
  })

  it('returns messages in chronological order (reversed from DESC query)', async () => {
    mockFindFirst.mockResolvedValue({ id: 'thread-1' })
    mockFindMany.mockResolvedValue([
      { role: 'assistant', content: 'answer 3' },
      { role: 'user', content: 'question 3' },
      { role: 'assistant', content: 'answer 2' },
      { role: 'user', content: 'question 2' },
      { role: 'assistant', content: 'answer 1' },
      { role: 'user', content: 'question 1' },
    ])

    const result = await loadThreadHistory('user-1', mockFindFirst, mockFindMany)
    expect(result[0]).toEqual({ role: 'user', content: 'question 1' })
    expect(result[result.length - 1]).toEqual({ role: 'assistant', content: 'answer 3' })
  })

  it('limits to THREAD_HISTORY_LIMIT (20) messages via take param', async () => {
    mockFindFirst.mockResolvedValue({ id: 'thread-1' })
    mockFindMany.mockResolvedValue([])

    await loadThreadHistory('user-1', mockFindFirst, mockFindMany)

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),
    )
  })

  it('queries the most recent thread by updatedAt DESC', async () => {
    mockFindFirst.mockResolvedValue({ id: 'thread-latest' })
    mockFindMany.mockResolvedValue([])

    await loadThreadHistory('user-1', mockFindFirst, mockFindMany)

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        orderBy: { updatedAt: 'desc' },
      }),
    )
  })

  it('returns only role and content (no metadata)', async () => {
    mockFindFirst.mockResolvedValue({ id: 'thread-1' })
    mockFindMany.mockResolvedValue([
      { role: 'user', content: 'test query', confidence: 0.9, channel: 'voice' },
    ])

    const result = await loadThreadHistory('user-1', mockFindFirst, mockFindMany)
    expect(result[0]).toEqual({ role: 'user', content: 'test query' })
    expect(result[0]).not.toHaveProperty('confidence')
    expect(result[0]).not.toHaveProperty('channel')
  })

  it('returns empty array on Prisma error (best-effort)', async () => {
    mockFindFirst.mockRejectedValue(new Error('DB connection failed'))
    const result = await loadThreadHistory('user-1', mockFindFirst, mockFindMany)
    expect(result).toEqual([])
  })
})

// ============================================================================
// 2. User context loads name, role, preferences
// ============================================================================

describe('EPIC-028 — user context (MercuryPersona)', () => {
  it('loads persona name from firstName + lastName', async () => {
    mockFindUnique.mockResolvedValue({
      firstName: 'Evelyn',
      lastName: 'Monroe',
      voiceId: null,
      greeting: null,
      personalityPrompt: 'Be helpful.',
    })

    const ctx = await loadUserContext(mockFindUnique)
    expect(ctx.name).toBe('Evelyn Monroe')
  })

  it('handles firstName-only persona (no lastName)', async () => {
    mockFindUnique.mockResolvedValue({
      firstName: 'Mercury',
      lastName: '',
      voiceId: null,
      greeting: null,
      personalityPrompt: null,
    })

    const ctx = await loadUserContext(mockFindUnique)
    expect(ctx.name).toBe('Mercury')
  })

  it('loads voiceId preference', async () => {
    mockFindUnique.mockResolvedValue({
      firstName: 'Evelyn',
      lastName: 'Monroe',
      voiceId: 'Ashley',
      greeting: null,
      personalityPrompt: null,
    })

    const ctx = await loadUserContext(mockFindUnique)
    expect(ctx.voiceId).toBe('Ashley')
  })

  it('loads greeting preference', async () => {
    mockFindUnique.mockResolvedValue({
      firstName: 'Evelyn',
      lastName: 'Monroe',
      voiceId: null,
      greeting: "Hi, I'm Evelyn Monroe — your AI assistant.",
      personalityPrompt: null,
    })

    const ctx = await loadUserContext(mockFindUnique)
    expect(ctx.greeting).toBe("Hi, I'm Evelyn Monroe — your AI assistant.")
  })

  it('loads personalityPrompt', async () => {
    mockFindUnique.mockResolvedValue({
      firstName: 'Evelyn',
      lastName: 'Monroe',
      voiceId: null,
      greeting: null,
      personalityPrompt: 'You are warm and proactive.',
    })

    const ctx = await loadUserContext(mockFindUnique)
    expect(ctx.personalityPrompt).toBe('You are warm and proactive.')
  })

  it('returns empty config when no persona exists', async () => {
    mockFindUnique.mockResolvedValue(null)
    const ctx = await loadUserContext(mockFindUnique)
    expect(ctx).toEqual({})
  })

  it('returns empty config on DB error (best-effort)', async () => {
    mockFindUnique.mockRejectedValue(new Error('connection reset'))
    const ctx = await loadUserContext(mockFindUnique)
    expect(ctx).toEqual({})
  })
})

// ============================================================================
// 3. Intent detection classifies greetings as conversational
// ============================================================================

describe('EPIC-028 — intent detection: greetings → conversational', () => {
  const greetings = [
    'hello', 'hi', 'hey', 'howdy', 'greetings',
    'good morning', 'good afternoon', 'good evening',
    'how are you', "how's it going", "what's up",
    'thanks', 'thank you', 'bye', 'goodbye', 'see you',
    'yes', 'no', 'ok', 'okay', 'sure', 'great', 'got it',
    'can you hear me', 'testing', 'is this working', 'are you there',
    'who are you', "what's your name", 'what can you do', 'tell me about yourself',
  ]

  for (const greeting of greetings) {
    it(`"${greeting}" → conversational`, () => {
      expect(classifyQuery(greeting)).toBe('conversational')
    })
  }

  it('case-insensitive: "HELLO" → conversational', () => {
    expect(classifyQuery('HELLO')).toBe('conversational')
  })

  it('with punctuation: "hello!" → conversational', () => {
    expect(classifyQuery('hello!')).toBe('conversational')
  })
})

// ============================================================================
// 4. Intent detection classifies document questions as document
// ============================================================================

describe('EPIC-028 — intent detection: document questions → document', () => {
  const documentQueries = [
    'what does the contract say about liability',
    'summarize the executive summary',
    'find risks in the investor pitch',
    'compare these two documents',
    "what's in my NDA",
    'I would like to take a look inside of the RAGbox',
    'show me what files I have',
    'extract key terms from the agreement',
    'what documents can you see',
    'Hello, can you find my document?',
    'Thanks, now summarize the lease',
    'tell me about the document you have',
    'I need to study the investor pitch script.docx',
  ]

  for (const query of documentQueries) {
    it(`"${query}" → document`, () => {
      expect(classifyQuery(query)).toBe('document')
    })
  }

  it('default is document for ambiguous queries', () => {
    expect(classifyQuery('tell me something interesting')).toBe('document')
  })

  it('greeting + document intent → document (not pure greeting)', () => {
    expect(classifyQuery('Hey, what does my NDA say about non-compete?')).toBe('document')
  })
})

// ============================================================================
// 5. Voice format stripper removes citations and markdown
// ============================================================================

describe('EPIC-028 — stripForVoice (citation + markdown removal)', () => {
  it('removes citation markers [1], [2], [3]', () => {
    const input = 'The contract states [1] that liability is limited [2] to $1M [3].'
    const result = stripForVoice(input)
    expect(result).not.toMatch(/\[\d+\]/)
    expect(result).toContain('The contract states')
    expect(result).toContain('that liability is limited')
  })

  it('removes markdown bold **text**', () => {
    expect(stripForVoice('The **key clause** is here.')).toBe('The key clause is here.')
  })

  it('removes markdown italic *text*', () => {
    expect(stripForVoice('This is *important* information.')).toBe('This is important information.')
  })

  it('removes markdown bold+italic ***text***', () => {
    expect(stripForVoice('***Critical finding*** noted.')).toBe('Critical finding noted.')
  })

  it('removes markdown headers ## Header', () => {
    expect(stripForVoice('## Summary\nThe document covers...')).toBe('Summary The document covers...')
  })

  it('removes markdown links [text](url) → text', () => {
    expect(stripForVoice('See [Section 3](https://example.com) for details.'))
      .toBe('See Section 3 for details.')
  })

  it('removes code fences ```code```', () => {
    const input = 'Before\n```\nconst x = 1;\n```\nAfter'
    const result = stripForVoice(input)
    expect(result).not.toContain('```')
    expect(result).not.toContain('const x')
    expect(result).toContain('Before')
    expect(result).toContain('After')
  })

  it('removes inline code `backticks`', () => {
    expect(stripForVoice('Use the `findMany` method.')).toBe('Use the findMany method.')
  })

  it('removes bullet markers', () => {
    const input = '- Item one\n- Item two\n* Item three'
    const result = stripForVoice(input)
    expect(result).not.toMatch(/^[-*]/m)
    expect(result).toContain('Item one')
    expect(result).toContain('Item two')
  })

  it('collapses multiple newlines into periods', () => {
    const input = 'Paragraph one.\n\nParagraph two.'
    const result = stripForVoice(input)
    expect(result).toBe('Paragraph one.. Paragraph two.')
  })

  it('collapses multiple spaces', () => {
    expect(stripForVoice('too    many   spaces')).toBe('too many spaces')
  })

  it('trims leading/trailing whitespace', () => {
    expect(stripForVoice('  hello world  ')).toBe('hello world')
  })

  it('returns empty string for empty input', () => {
    expect(stripForVoice('')).toBe('')
  })

  it('handles combined RAG output (citations + markdown + bullets)', () => {
    const ragOutput = `## Key Findings

The contract [1] specifies **three conditions**:
- Liability cap of *$1 million* [2]
- Termination clause [3] requires \`30 days\` notice
- Non-compete for [12 months](https://legal.example.com)

See the [full document](https://docs.example.com) for details.`

    const result = stripForVoice(ragOutput)
    expect(result).not.toMatch(/\[\d+\]/)
    expect(result).not.toContain('**')
    expect(result).not.toContain('*')
    expect(result).not.toContain('`')
    expect(result).not.toContain('##')
    expect(result).not.toContain('](')
    expect(result).toContain('three conditions')
    expect(result).toContain('30 days')
  })
})

// ============================================================================
// 6. Exchange saved to MercuryThread after each turn
// ============================================================================

describe('EPIC-028 — persistThreadMessage (exchange → MercuryThread)', () => {
  // Use separate mocks for thread-persistence module's PrismaClient instance
  const threadCreateMock = jest.fn()
  const messageCreateMock = jest.fn()
  const threadUpdateMock = jest.fn()
  const threadFindFirstMock = jest.fn()

  beforeEach(() => {
    // thread-persistence.ts creates its own PrismaClient — we need to
    // configure the mocked constructor's return for it
    const { PrismaClient } = require('@prisma/client')
    PrismaClient.mockImplementation(() => ({
      mercuryThread: {
        findFirst: threadFindFirstMock,
        create: threadCreateMock,
        update: threadUpdateMock,
      },
      mercuryThreadMessage: {
        create: messageCreateMock,
      },
    }))
  })

  it('finds existing thread for the user', async () => {
    threadFindFirstMock.mockResolvedValue({ id: 'thread-abc' })
    messageCreateMock.mockResolvedValue({})
    threadUpdateMock.mockResolvedValue({})

    // Re-import to get fresh PrismaClient instance with our mocks
    jest.resetModules()
    jest.mock('@prisma/client', () => ({
      PrismaClient: jest.fn().mockImplementation(() => ({
        mercuryThread: {
          findFirst: threadFindFirstMock,
          create: threadCreateMock,
          update: threadUpdateMock,
        },
        mercuryThreadMessage: {
          create: messageCreateMock,
        },
      })),
    }))
    const { persistThreadMessage: persist } = require('../thread-persistence')

    await persist({
      userId: 'user-1',
      role: 'user',
      channel: 'voice',
      content: 'What is in my contract?',
      direction: 'inbound',
    })

    expect(threadFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        orderBy: { updatedAt: 'desc' },
      }),
    )
  })

  it('creates thread if none exists', async () => {
    threadFindFirstMock.mockResolvedValue(null)
    threadCreateMock.mockResolvedValue({ id: 'new-thread' })
    messageCreateMock.mockResolvedValue({})
    threadUpdateMock.mockResolvedValue({})

    jest.resetModules()
    jest.mock('@prisma/client', () => ({
      PrismaClient: jest.fn().mockImplementation(() => ({
        mercuryThread: {
          findFirst: threadFindFirstMock,
          create: threadCreateMock,
          update: threadUpdateMock,
        },
        mercuryThreadMessage: {
          create: messageCreateMock,
        },
      })),
    }))
    const { persistThreadMessage: persist } = require('../thread-persistence')

    await persist({
      userId: 'user-new',
      role: 'user',
      channel: 'voice',
      content: 'Hello',
      direction: 'inbound',
    })

    expect(threadCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-new',
        }),
      }),
    )
  })

  it('persists message with correct role and channel', async () => {
    threadFindFirstMock.mockResolvedValue({ id: 'thread-1' })
    messageCreateMock.mockResolvedValue({})
    threadUpdateMock.mockResolvedValue({})

    jest.resetModules()
    jest.mock('@prisma/client', () => ({
      PrismaClient: jest.fn().mockImplementation(() => ({
        mercuryThread: {
          findFirst: threadFindFirstMock,
          create: threadCreateMock,
          update: threadUpdateMock,
        },
        mercuryThreadMessage: {
          create: messageCreateMock,
        },
      })),
    }))
    const { persistThreadMessage: persist } = require('../thread-persistence')

    await persist({
      userId: 'user-1',
      role: 'assistant',
      channel: 'voice',
      content: 'The contract states liability is capped at $1M.',
      confidence: 0.92,
      direction: 'outbound',
    })

    expect(messageCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          threadId: 'thread-1',
          role: 'assistant',
          channel: 'voice',
          content: 'The contract states liability is capped at $1M.',
          confidence: 0.92,
          direction: 'outbound',
        }),
      }),
    )
  })

  it('touches thread updatedAt after message insert', async () => {
    threadFindFirstMock.mockResolvedValue({ id: 'thread-1' })
    messageCreateMock.mockResolvedValue({})
    threadUpdateMock.mockResolvedValue({})

    jest.resetModules()
    jest.mock('@prisma/client', () => ({
      PrismaClient: jest.fn().mockImplementation(() => ({
        mercuryThread: {
          findFirst: threadFindFirstMock,
          create: threadCreateMock,
          update: threadUpdateMock,
        },
        mercuryThreadMessage: {
          create: messageCreateMock,
        },
      })),
    }))
    const { persistThreadMessage: persist } = require('../thread-persistence')

    await persist({
      userId: 'user-1',
      role: 'user',
      channel: 'voice',
      content: 'test',
      direction: 'inbound',
    })

    expect(threadUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'thread-1' },
        data: expect.objectContaining({
          updatedAt: expect.any(Date),
        }),
      }),
    )
  })

  it('does not throw on DB error (best-effort)', async () => {
    threadFindFirstMock.mockRejectedValue(new Error('connection refused'))

    jest.resetModules()
    jest.mock('@prisma/client', () => ({
      PrismaClient: jest.fn().mockImplementation(() => ({
        mercuryThread: {
          findFirst: threadFindFirstMock,
          create: threadCreateMock,
          update: threadUpdateMock,
        },
        mercuryThreadMessage: {
          create: messageCreateMock,
        },
      })),
    }))
    const { persistThreadMessage: persist } = require('../thread-persistence')

    // Should not throw — best-effort persistence
    await expect(persist({
      userId: 'user-1',
      role: 'user',
      channel: 'voice',
      content: 'test',
      direction: 'inbound',
    })).resolves.toBeUndefined()
  })
})
