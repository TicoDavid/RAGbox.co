/**
 * STORY-108: WhatsApp Integration Tests — EPIC-010
 *
 * Mock Vonage webhook payloads. Test:
 * 1. Inbound message routes to Mercury (Go backend /api/chat)
 * 2. Response delivered back to WhatsApp via Vonage
 * 3. Conversation stored in DB (contact + conversation + message persisted)
 *
 * — Sarah, Engineering
 */
export {} // Ensure this file is treated as a module (avoids TS2451 conflict with Next.js route types)

// ── Environment setup (before imports) ───────────────────────────
process.env.WHATSAPP_DEFAULT_USER_ID = 'test-user-id'
process.env.VONAGE_API_KEY = 'test-vonage-key'
process.env.VONAGE_API_SECRET = 'test-vonage-secret'
process.env.VONAGE_WHATSAPP_NUMBER = '14157386102'
process.env.GO_BACKEND_URL = 'http://localhost:8080'
process.env.INTERNAL_AUTH_SECRET = 'test-internal-secret'

// ── Mock Prisma ──────────────────────────────────────────────────

const mockWhatsAppMessageFindFirst = jest.fn()
const mockWhatsAppMessageCreate = jest.fn()
const mockWhatsAppContactUpsert = jest.fn()
const mockWhatsAppConversationUpsert = jest.fn()
const mockWhatsAppConversationUpdate = jest.fn()
const mockWhatsAppMessageUpdate = jest.fn()
const mockMercuryThreadFindFirst = jest.fn()
const mockMercuryThreadCreate = jest.fn()
const mockMercuryThreadUpdate = jest.fn()
const mockMercuryThreadMessageCreate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    whatsAppMessage: {
      findFirst: (...args: unknown[]) => mockWhatsAppMessageFindFirst(...args),
      create: (...args: unknown[]) => mockWhatsAppMessageCreate(...args),
      update: (...args: unknown[]) => mockWhatsAppMessageUpdate(...args),
    },
    whatsAppContact: {
      upsert: (...args: unknown[]) => mockWhatsAppContactUpsert(...args),
    },
    whatsAppConversation: {
      upsert: (...args: unknown[]) => mockWhatsAppConversationUpsert(...args),
      update: (...args: unknown[]) => mockWhatsAppConversationUpdate(...args),
    },
    mercuryThread: {
      findFirst: (...args: unknown[]) => mockMercuryThreadFindFirst(...args),
      create: (...args: unknown[]) => mockMercuryThreadCreate(...args),
      update: (...args: unknown[]) => mockMercuryThreadUpdate(...args),
    },
    mercuryThreadMessage: {
      create: (...args: unknown[]) => mockMercuryThreadMessageCreate(...args),
    },
  },
}))

// ── Mock SSE parser ──────────────────────────────────────────────
jest.mock('@/lib/mercury/sseParser', () => ({
  parseSSEText: jest.fn(() => ({
    text: 'Based on the documents, clause 4.2 states...',
    confidence: 0.89,
    isSilence: false,
    citations: [],
    suggestions: [],
  })),
}))

// ── Helpers ──────────────────────────────────────────────────────

/** Wait for fire-and-forget promises to settle */
async function flushPromises(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => process.nextTick(resolve))
  }
}

function makeVonagePayload(overrides?: Record<string, unknown>) {
  return {
    message_uuid: 'vonage-uuid-123',
    from: { number: '12125551234' },
    to: '14157386102',
    message_type: 'text',
    text: 'What does clause 4.2 say?',
    channel: 'whatsapp',
    timestamp: '2026-02-22T15:00:00Z',
    profile: { name: 'John Doe' },
    ...overrides,
  }
}

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/webhooks/whatsapp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Import route handler ─────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const whatsappRoute = require('../route')
const POST = whatsappRoute.POST as (req: Request) => Promise<Response>

// ── Setup ────────────────────────────────────────────────────────

let fetchCalls: Array<{ url: string; options?: RequestInit }> = []

beforeEach(() => {
  jest.clearAllMocks()
  fetchCalls = []

  // Default: no duplicate
  mockWhatsAppMessageFindFirst.mockResolvedValue(null)

  // Contact upsert returns unblocked contact
  mockWhatsAppContactUpsert.mockResolvedValue({
    id: 'contact-1',
    userId: 'test-user-id',
    phoneNumber: '+12125551234',
    displayName: 'John Doe',
    isBlocked: false,
  })

  // Conversation upsert returns active conversation
  mockWhatsAppConversationUpsert.mockResolvedValue({
    id: 'conv-1',
    userId: 'test-user-id',
    contactId: 'contact-1',
    autoReply: true,
    status: 'active',
  })

  // Message + conversation writes succeed
  mockWhatsAppMessageCreate.mockResolvedValue({ id: 'msg-1' })
  mockWhatsAppConversationUpdate.mockResolvedValue({})

  // Mercury thread writes
  mockMercuryThreadFindFirst.mockResolvedValue({ id: 'thread-1' })
  mockMercuryThreadCreate.mockResolvedValue({ id: 'thread-1' })
  mockMercuryThreadUpdate.mockResolvedValue({})
  mockMercuryThreadMessageCreate.mockResolvedValue({})

  // Mock global.fetch for Go backend + Vonage
  global.fetch = jest.fn(async (url: string | URL | Request, options?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url.toString()
    fetchCalls.push({ url: urlStr, options })

    // Go backend RAG response
    if (urlStr.includes('/api/chat')) {
      return {
        ok: true,
        text: () => Promise.resolve('data: {"text":"Based on clause 4.2..."}\n\n'),
      }
    }

    // Vonage send response
    if (urlStr.includes('nexmo.com') || urlStr.includes('vonage')) {
      return {
        ok: true,
        json: () => Promise.resolve({ message_uuid: 'vonage-reply-uuid-456' }),
        text: () => Promise.resolve(''),
      }
    }

    return { ok: false, text: () => Promise.resolve('Not found'), status: 404 }
  }) as jest.Mock
})

// ── Tests ────────────────────────────────────────────────────────

describe('WhatsApp Integration', () => {
  it('inbound message routes to Mercury via Go backend /api/chat', async () => {
    const payload = makeVonagePayload()
    const req = makeRequest(payload)

    const res = await POST(req)
    expect(res.status).toBe(200)

    await flushPromises()

    // Go backend should have been called with the user's question
    const ragCall = fetchCalls.find((c) => c.url.includes('/api/chat'))
    expect(ragCall).toBeDefined()
    expect(ragCall!.options?.method).toBe('POST')

    const ragBody = JSON.parse(ragCall!.options!.body as string)
    expect(ragBody.query).toBe('What does clause 4.2 say?')
    expect(ragBody.mode).toBe('concise')
  })

  it('response delivered back to WhatsApp via Vonage', async () => {
    const payload = makeVonagePayload()
    const req = makeRequest(payload)

    const res = await POST(req)
    expect(res.status).toBe(200)

    await flushPromises()

    // Vonage Messages API should have been called
    const vonageCall = fetchCalls.find((c) => c.url.includes('nexmo.com'))
    expect(vonageCall).toBeDefined()
    expect(vonageCall!.options?.method).toBe('POST')

    const vonageBody = JSON.parse(vonageCall!.options!.body as string)
    expect(vonageBody.channel).toBe('whatsapp')
    expect(vonageBody.to).toBe('12125551234') // + stripped
    expect(vonageBody.from).toBe('14157386102')
    expect(vonageBody.message_type).toBe('text')
    expect(vonageBody.text).toBeTruthy()
  })

  it('conversation stored in DB (contact + conversation + messages)', async () => {
    const payload = makeVonagePayload()
    const req = makeRequest(payload)

    const res = await POST(req)
    expect(res.status).toBe(200)

    await flushPromises()

    // 1. Contact upserted
    expect(mockWhatsAppContactUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_phoneNumber: { userId: 'test-user-id', phoneNumber: '+12125551234' },
        },
      }),
    )

    // 2. Conversation upserted
    expect(mockWhatsAppConversationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_contactId: { userId: 'test-user-id', contactId: 'contact-1' },
        },
      }),
    )

    // 3. Inbound message persisted
    expect(mockWhatsAppMessageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conversationId: 'conv-1',
          direction: 'inbound',
          messageType: 'text',
          content: 'What does clause 4.2 say?',
        }),
      }),
    )

    // 4. Outbound (auto-reply) message persisted
    // The second create call should be the outbound auto-reply
    const createCalls = mockWhatsAppMessageCreate.mock.calls
    expect(createCalls.length).toBeGreaterThanOrEqual(2)
    const outbound = createCalls[1][0]
    expect(outbound.data.direction).toBe('outbound')
    expect(outbound.data.content).toBeTruthy()
  })
})
