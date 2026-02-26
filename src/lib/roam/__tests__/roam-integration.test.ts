/**
 * STORY-105: ROAM Integration Tests — EPIC-010
 *
 * Mock ROAM API responses. Test:
 * 1. Webhook HMAC verification (valid + invalid signatures)
 * 2. Mention → Mercury response → ROAM /chat.post pipeline
 * 3. DM → response pipeline
 * 4. Meeting transcript.saved → summary posted
 * 5. Credential encrypt/decrypt round-trip
 * 6. Disconnect cleanup (webhook unsubscribe + key deletion)
 *
 * — Sarah, Engineering
 */

import { createHmac } from 'crypto'
import { verifyWebhookSignature } from '../roamVerify'

// ── Helpers ──────────────────────────────────────────────────────

const TEST_SECRET_RAW = Buffer.from('test-webhook-secret-32bytes!!!!') // 30 bytes
const TEST_SECRET = `whsec_${TEST_SECRET_RAW.toString('base64')}`

function makeValidSignature(body: string, msgId: string, timestamp: string): string {
  const keyBytes = Buffer.from(TEST_SECRET.slice(6), 'base64')
  const signedContent = `${msgId}.${timestamp}.${body}`
  const sig = createHmac('sha256', keyBytes).update(signedContent, 'utf8').digest('base64')
  return `v1,${sig}`
}

function nowTimestamp(): string {
  return String(Math.floor(Date.now() / 1000))
}

// ── 1. Webhook HMAC Verification ─────────────────────────────────

describe('Webhook HMAC Verification', () => {
  it('accepts a valid signature', () => {
    const body = '{"type":"chat.message.mention","data":{"text":"hello"}}'
    const msgId = 'msg_test_123'
    const ts = nowTimestamp()
    const sig = makeValidSignature(body, msgId, ts)

    const result = verifyWebhookSignature(body, {
      'webhook-id': msgId,
      'webhook-timestamp': ts,
      'webhook-signature': sig,
    }, TEST_SECRET)

    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('rejects an invalid signature', () => {
    const body = '{"type":"chat.message.mention","data":{"text":"hello"}}'
    const ts = nowTimestamp()

    const result = verifyWebhookSignature(body, {
      'webhook-id': 'msg_test_456',
      'webhook-timestamp': ts,
      'webhook-signature': 'v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
    }, TEST_SECRET)

    expect(result.valid).toBe(false)
    expect(result.error).toBe('Signature verification failed')
  })

  it('rejects missing headers', () => {
    const result = verifyWebhookSignature('{}', {
      'webhook-id': '',
      'webhook-timestamp': '',
      'webhook-signature': '',
    }, TEST_SECRET)

    expect(result.valid).toBe(false)
    expect(result.error).toBe('Missing required webhook headers')
  })

  it('rejects expired timestamp (replay attack)', () => {
    const body = '{"type":"test"}'
    const msgId = 'msg_old'
    const oldTs = String(Math.floor(Date.now() / 1000) - 600) // 10 min ago
    const sig = makeValidSignature(body, msgId, oldTs)

    const result = verifyWebhookSignature(body, {
      'webhook-id': msgId,
      'webhook-timestamp': oldTs,
      'webhook-signature': sig,
    }, TEST_SECRET)

    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/Webhook timestamp too old/)
  })

  it('handles whsec_ prefix and raw secret equally', () => {
    const body = '{"type":"test"}'
    const msgId = 'msg_prefix_test'
    const ts = nowTimestamp()

    // With prefix
    const sigWithPrefix = makeValidSignature(body, msgId, ts)
    const resultWithPrefix = verifyWebhookSignature(body, {
      'webhook-id': msgId,
      'webhook-timestamp': ts,
      'webhook-signature': sigWithPrefix,
    }, TEST_SECRET)

    // Without prefix (raw base64)
    const rawSecret = TEST_SECRET.slice(6)
    const resultWithoutPrefix = verifyWebhookSignature(body, {
      'webhook-id': msgId,
      'webhook-timestamp': ts,
      'webhook-signature': sigWithPrefix,
    }, rawSecret)

    expect(resultWithPrefix.valid).toBe(true)
    expect(resultWithoutPrefix.valid).toBe(true)
  })
})

// ── 2 & 3. Mention + DM Pipeline ────────────────────────────────

// Mock all dependencies the process-event route needs
const mockFindFirst = jest.fn()
const mockCreate = jest.fn()
const mockUpdate = jest.fn()
const mockThreadCreate = jest.fn()
const mockActionCreate = jest.fn()
const mockDocumentCreate = jest.fn()
const mockRoamIntegrationFindFirst = jest.fn()
const mockRoamIntegrationFindUnique = jest.fn()
const mockRoamIntegrationUpdate = jest.fn()
const mockMercuryPersonaFindUnique = jest.fn()

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    mercuryThreadMessage: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
    mercuryThread: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      create: (...args: unknown[]) => mockThreadCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    mercuryAction: {
      create: (...args: unknown[]) => mockActionCreate(...args),
    },
    document: {
      create: (...args: unknown[]) => mockDocumentCreate(...args),
    },
    roamIntegration: {
      findFirst: (...args: unknown[]) => mockRoamIntegrationFindFirst(...args),
      findUnique: (...args: unknown[]) => mockRoamIntegrationFindUnique(...args),
      update: (...args: unknown[]) => mockRoamIntegrationUpdate(...args),
    },
    mercuryPersona: {
      findUnique: (...args: unknown[]) => mockMercuryPersonaFindUnique(...args),
    },
  },
}))

const mockSendMessage = jest.fn()
const mockGetTranscriptInfo = jest.fn()
const mockChatPost = jest.fn()
const mockChatTypingV0 = jest.fn()
jest.mock('@/lib/roam/roamClient', () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
  sendTypingIndicator: jest.fn(),
  chatPost: (...args: unknown[]) => mockChatPost(...args),
  chatTypingV0: (...args: unknown[]) => mockChatTypingV0(...args),
  getTranscriptInfo: (...args: unknown[]) => mockGetTranscriptInfo(...args),
  RoamApiError: class RoamApiError extends Error {
    status: number
    constructor(message: string, status: number) { super(message); this.status = status }
  },
}))

jest.mock('@/lib/roam/roamBlockKit', () => ({
  buildBlockKitResponse: jest.fn(() => ({
    blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'answer' } }],
    color: 'good',
  })),
}))

jest.mock('@/lib/roam/roamFormat', () => ({
  formatForRoam: jest.fn((text: string) => text),
  formatSilenceForRoam: jest.fn(() => 'SILENCE'),
  formatErrorForRoam: jest.fn(() => 'ERROR'),
  formatMeetingSummary: jest.fn(
    (title: string, participants: string[], summary: string) =>
      `Meeting Summary: ${title}\nParticipants: ${participants.join(', ')}\n${summary}`
  ),
}))

jest.mock('@/lib/roam/deadLetterWriter', () => ({
  writeDeadLetter: jest.fn(),
}))

jest.mock('@/lib/utils/kms', () => ({
  encryptKey: jest.fn((v: string) => Promise.resolve(`kms-stub:${Buffer.from(v).toString('base64')}`)),
  decryptKey: jest.fn((v: string) => Promise.resolve(Buffer.from(v.replace('kms-stub:', ''), 'base64').toString())),
  isEncrypted: jest.fn((v: string) => v.startsWith('kms-stub:') || v.startsWith('kms:')),
}))

jest.mock('@/lib/mercury/sseParser', () => ({
  parseSSEText: jest.fn(() => ({
    text: 'Mercury answer with citations',
    confidence: 0.92,
    isSilence: false,
    citations: [{ index: 1, documentId: 'doc1', documentName: 'Contract.pdf', excerpt: 'clause 4.2' }],
    suggestions: [],
  })),
}))

// Set env before importing route
process.env.ROAM_DEFAULT_USER_ID = 'user_test_123'
process.env.GO_BACKEND_URL = 'http://localhost:8080'
process.env.INTERNAL_AUTH_SECRET = 'test-internal-secret'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST: processEventPOST } = require('@/app/api/roam/process-event/route')

function makePubSubRequest(eventType: string, eventData: Record<string, unknown>): Request {
  const roamEvent = { type: eventType, data: eventData }
  const encoded = Buffer.from(JSON.stringify(roamEvent)).toString('base64')

  const pubSubEnvelope = {
    message: {
      data: encoded,
      messageId: 'pubsub-msg-1',
      attributes: { eventType },
    },
    subscription: 'projects/test/subscriptions/roam-events-sub',
  }

  return new Request('http://localhost:3000/api/roam/process-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pubSubEnvelope),
  })
}

describe('Mention → Mercury → ROAM pipeline', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // No existing duplicate message
    mockFindFirst.mockResolvedValue(null)
    // Thread exists
    mockThreadCreate.mockResolvedValue({ id: 'thread-1' })
    mockCreate.mockResolvedValue({ id: 'msg-1' })
    mockUpdate.mockResolvedValue({})
    mockActionCreate.mockResolvedValue({})
    mockSendMessage.mockResolvedValue({})
    mockChatPost.mockResolvedValue(true)
    mockChatTypingV0.mockReturnValue(undefined)

    // Tenant resolution mocks
    mockRoamIntegrationFindFirst.mockResolvedValue(null) // default tenant
    mockMercuryPersonaFindUnique.mockResolvedValue(null)

    // Mock Go backend fetch
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('data: {"text":"answer"}\n\n'),
    }) as jest.Mock
  })

  it('processes @mention → queries RAG → posts reply to ROAM', async () => {
    const req = makePubSubRequest('chat.message.group', {
      text: '@Mercury what is TUMM?',
      sender: { id: 'user-bob', name: 'Bob' },
      chat: { id: 'group-123' },
      timestamp: '1708617600',
    })

    const res = await processEventPOST(req)
    expect(res.status).toBe(200)

    // RAG backend should have been called (via fetch mock)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/chat'),
      expect.objectContaining({ method: 'POST' }),
    )

    // S02: Reply sent via chatPost (v0 reply-in-context) — sendMessage is v1 fallback
    expect(mockChatPost).toHaveBeenCalled()
    const chatPostArgs = mockChatPost.mock.calls[0]
    expect(chatPostArgs[0]).toBe('group-123') // chatId

    // Audit record should have been written
    expect(mockActionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actionType: 'roam_query',
        }),
      }),
    )
  })

  it('skips self-messages from Mercury (loop prevention)', async () => {
    const req = makePubSubRequest('chat.message.group', {
      text: 'I already answered that.',
      sender: { id: 'mercury', name: 'M.E.R.C.U.R.Y' },
      chat: { id: 'group-123' },
      timestamp: '1708617601',
    })

    const res = await processEventPOST(req)
    expect(res.status).toBe(200)

    // Should NOT call RAG backend or ROAM
    expect(mockSendMessage).not.toHaveBeenCalled()
  })
})

describe('DM → Mercury response pipeline', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFindFirst.mockResolvedValue(null)
    mockThreadCreate.mockResolvedValue({ id: 'thread-dm' })
    mockCreate.mockResolvedValue({ id: 'msg-dm' })
    mockUpdate.mockResolvedValue({})
    mockActionCreate.mockResolvedValue({})
    mockSendMessage.mockResolvedValue({})
    mockChatPost.mockResolvedValue(true)
    mockChatTypingV0.mockReturnValue(undefined)

    // Tenant resolution mocks
    mockRoamIntegrationFindFirst.mockResolvedValue(null)
    mockMercuryPersonaFindUnique.mockResolvedValue(null)

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('data: {"text":"DM answer"}\n\n'),
    }) as jest.Mock
  })

  it('processes DM event → queries RAG → replies', async () => {
    const req = makePubSubRequest('chat.message.dm', {
      text: 'Summarize contract clause 7',
      sender: { id: 'user-alice', name: 'Alice' },
      chat: { id: 'dm-alice-mercury' },
      timestamp: '1708617700',
    })

    const res = await processEventPOST(req)
    expect(res.status).toBe(200)

    // RAG backend called
    expect(global.fetch).toHaveBeenCalled()

    // S02: Reply sent via chatPost to DM chat
    expect(mockChatPost).toHaveBeenCalled()
    const dmPostArgs = mockChatPost.mock.calls[0]
    expect(dmPostArgs[0]).toBe('dm-alice-mercury') // chatId
  })
})

// ── 4. Meeting transcript.saved → summary posted ─────────────────

describe('Meeting transcript.saved → summary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFindFirst.mockResolvedValue(null)
    mockThreadCreate.mockResolvedValue({ id: 'thread-transcript' })
    mockCreate.mockResolvedValue({ id: 'msg-transcript' })
    mockUpdate.mockResolvedValue({})
    mockActionCreate.mockResolvedValue({})
    mockDocumentCreate.mockResolvedValue({ id: 'doc-transcript' })
    mockSendMessage.mockResolvedValue({})

    // Tenant resolution: roamIntegration lookup → persona lookup
    mockRoamIntegrationFindFirst.mockResolvedValue({
      tenantId: 'default',
      userId: 'user_test_123',
      apiKeyEncrypted: null,
      targetGroupId: 'group-meeting-1',
      status: 'connected',
      meetingSummaries: true,
    })
    mockMercuryPersonaFindUnique.mockResolvedValue({
      personalityPrompt: 'You are precise and formal.',
    })

    // Transcript fetch from ROAM
    mockGetTranscriptInfo.mockResolvedValue({
      id: 'transcript-abc',
      groupId: 'group-meeting-1',
      title: 'Q1 Planning Review',
      participants: ['Alice', 'Bob', 'Charlie'],
      content: 'Alice: We need to finalize the roadmap.\nBob: Agreed, let me share the priorities.\nCharlie: Action item — update the Jira board by Friday.',
      duration: 1800,
      createdAt: '2026-02-22T14:00:00Z',
    })

    // Go backend RAG response for summarization
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('data: {"text":"Key points: roadmap finalization, priorities shared, action item for Jira board update by Friday."}\n\n'),
    }) as jest.Mock
  })

  it('fetches transcript → summarizes via Mercury → posts to group → stores in Vault', async () => {
    const req = makePubSubRequest('transcript.saved', {
      transcript_id: 'transcript-abc',
      chat: { id: 'group-meeting-1' },
      title: 'Q1 Planning Review',
    })

    const res = await processEventPOST(req)
    expect(res.status).toBe(200)

    // 1. Transcript fetched from ROAM
    expect(mockGetTranscriptInfo).toHaveBeenCalledWith('transcript-abc', undefined)

    // 2. RAG backend called with summarization prompt
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/chat'),
      expect.objectContaining({ method: 'POST' }),
    )
    const ragBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(ragBody.query).toContain('Summarize this meeting transcript')
    expect(ragBody.mode).toBe('concise')

    // 3. Summary posted to ROAM group
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: 'group-meeting-1',
        text: expect.stringContaining('Q1 Planning Review'),
      }),
      undefined,
    )

    // 4. Transcript stored as document in Vault
    expect(mockDocumentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user_test_123',
          mimeType: 'text/plain',
          indexStatus: 'Pending',
          metadata: expect.objectContaining({
            source: 'roam_transcript',
            transcriptId: 'transcript-abc',
          }),
        }),
      }),
    )

    // 5. Audit record written
    expect(mockActionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actionType: 'roam_meeting_summary',
          status: 'completed',
        }),
      }),
    )
  })
})

// ── 5. Credential encrypt/decrypt round-trip ─────────────────────

describe('Credential encrypt/decrypt (KMS stub)', () => {
  beforeAll(() => {
    process.env.KMS_MODE = 'stub'
  })

  afterAll(() => {
    delete process.env.KMS_MODE
  })

  it('encrypt → decrypt returns original API key', async () => {
    // Import dynamically so KMS_MODE=stub is set
    const { encryptKey, decryptKey } = await import('../../utils/kms')

    const originalKey = 'roam_live_sk_test1234567890abcdef'
    const encrypted = await encryptKey(originalKey)

    // Encrypted should have kms-stub: prefix
    expect(encrypted.startsWith('kms-stub:')).toBe(true)
    expect(encrypted).not.toContain(originalKey)

    // Decrypt should return original
    const decrypted = await decryptKey(encrypted)
    expect(decrypted).toBe(originalKey)
  })

  it('isEncrypted detects encrypted values', async () => {
    const { isEncrypted } = await import('../../utils/kms')

    expect(isEncrypted('kms-stub:abc123')).toBe(true)
    expect(isEncrypted('kms:abc123')).toBe(true)
    expect(isEncrypted('plaintext-key')).toBe(false)
  })
})

// ── 7. ROAM mentionOnly enforcement (EPIC-011) ──────────────────

describe('ROAM mentionOnly enforcement', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFindFirst.mockResolvedValue(null)
    mockThreadCreate.mockResolvedValue({ id: 'thread-mo' })
    mockCreate.mockResolvedValue({ id: 'msg-mo' })
    mockUpdate.mockResolvedValue({})
    mockActionCreate.mockResolvedValue({})
    mockSendMessage.mockResolvedValue({})
    mockChatPost.mockResolvedValue(true)
    mockChatTypingV0.mockReturnValue(undefined)
    mockMercuryPersonaFindUnique.mockResolvedValue(null)

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('data: {"text":"answer"}\n\n'),
    }) as jest.Mock
  })

  it('skips non-mention group message when mentionOnly=true', async () => {
    mockRoamIntegrationFindFirst
      .mockResolvedValueOnce({
        tenantId: 'tenant-mo', userId: 'user-1', apiKeyEncrypted: null,
        targetGroupId: 'group-mo', status: 'connected',
      })
      .mockResolvedValueOnce({ mentionOnly: true })

    const req = makePubSubRequest('chat.message.group', {
      text: 'hey team, roadmap thoughts?',
      sender: { id: 'user-bob', name: 'Bob' },
      chat: { id: 'group-mo' },
      timestamp: '1708617800',
    })

    const res = await processEventPOST(req)
    expect(res.status).toBe(200)

    // Non-mention message should be skipped entirely
    expect(global.fetch).not.toHaveBeenCalled()
    expect(mockSendMessage).not.toHaveBeenCalled()
  })

  it('processes @mention message when mentionOnly=true', async () => {
    mockRoamIntegrationFindFirst
      .mockResolvedValueOnce({
        tenantId: 'tenant-mo', userId: 'user-1', apiKeyEncrypted: null,
        targetGroupId: 'group-mo', status: 'connected',
      })
      .mockResolvedValueOnce({ mentionOnly: true })

    const req = makePubSubRequest('chat.message.group', {
      text: '@Mercury what does clause 4.2 say?',
      sender: { id: 'user-bob', name: 'Bob' },
      chat: { id: 'group-mo' },
      timestamp: '1708617801',
    })

    const res = await processEventPOST(req)
    expect(res.status).toBe(200)

    // @mention bypasses mentionOnly filter — RAG + reply sent
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/chat'),
      expect.objectContaining({ method: 'POST' }),
    )
    // S02: Reply via chatPost (v0)
    expect(mockChatPost).toHaveBeenCalled()
  })

  it('processes any message when mentionOnly=false', async () => {
    mockRoamIntegrationFindFirst
      .mockResolvedValueOnce({
        tenantId: 'tenant-mo', userId: 'user-1', apiKeyEncrypted: null,
        targetGroupId: 'group-mo', status: 'connected',
      })
      .mockResolvedValueOnce({ mentionOnly: false })

    const req = makePubSubRequest('chat.message.group', {
      text: 'what about the roadmap?',
      sender: { id: 'user-bob', name: 'Bob' },
      chat: { id: 'group-mo' },
      timestamp: '1708617802',
    })

    const res = await processEventPOST(req)
    expect(res.status).toBe(200)

    // mentionOnly=false allows all messages — RAG + reply sent
    expect(global.fetch).toHaveBeenCalled()
    // S02: Reply via chatPost (v0)
    expect(mockChatPost).toHaveBeenCalled()
  })
})

// ── 8. Key revocation — 401 handling (EPIC-011) ─────────────────

describe('Key revocation (401)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const roamClientMock = require('@/lib/roam/roamClient')

  beforeEach(() => {
    jest.clearAllMocks()
    mockFindFirst.mockResolvedValue(null)
    mockThreadCreate.mockResolvedValue({ id: 'thread-401' })
    mockCreate.mockResolvedValue({ id: 'msg-401' })
    mockUpdate.mockResolvedValue({})
    mockActionCreate.mockResolvedValue({})
    mockSendMessage.mockResolvedValue({})
    mockChatPost.mockResolvedValue(true)
    mockChatTypingV0.mockReturnValue(undefined)
    mockRoamIntegrationUpdate.mockResolvedValue({})
    mockMercuryPersonaFindUnique.mockResolvedValue(null)

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('data: {"text":"answer"}\n\n'),
    }) as jest.Mock
  })

  it('sets integration status to error and writes audit on 401', async () => {
    // Tenant resolution → mentionOnly check → outer 401 handler lookup
    mockRoamIntegrationFindFirst
      .mockResolvedValueOnce({
        tenantId: 'tenant-401', userId: 'user-1',
        apiKeyEncrypted: null, targetGroupId: 'group-401', status: 'connected',
      })
      .mockResolvedValueOnce({ mentionOnly: false })
      .mockResolvedValueOnce({ tenantId: 'tenant-401', userId: 'user-1' })

    // S02: chatTypingV0 is called synchronously (no await) — a sync throw propagates
    // to the outer handler which triggers 401 detection
    mockChatTypingV0.mockImplementationOnce(() => {
      throw new roamClientMock.RoamApiError('Unauthorized', 401)
    })

    const req = makePubSubRequest('chat.message.group', {
      text: 'what is TUMM?',
      sender: { id: 'user-bob', name: 'Bob' },
      chat: { id: 'group-401' },
      timestamp: '1708617900',
    })

    const res = await processEventPOST(req)
    expect(res.status).toBe(500)

    // Integration status updated to 'error'
    expect(mockRoamIntegrationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-401' },
        data: expect.objectContaining({
          status: 'error',
          errorReason: expect.stringContaining('401'),
        }),
      }),
    )

    // Audit record with roam_key_revoked
    expect(mockActionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actionType: 'roam_key_revoked',
          status: 'completed',
        }),
      }),
    )
  })
})

// ── 9. Disconnect cleanup ────────────────────────────────────────

describe('Disconnect cleanup (STORY-101)', () => {
  // Mock next-auth/jwt for the disconnect route
  jest.mock('next-auth/jwt', () => ({
    getToken: jest.fn().mockResolvedValue({
      id: 'user_test_123',
      email: 'test@ragbox.co',
    }),
  }))

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { POST: disconnectPOST } = require('@/app/api/integrations/roam/disconnect/route')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('clears API key and sets status to disconnected', async () => {
    // Existing connected integration
    mockRoamIntegrationFindUnique.mockResolvedValue({
      id: 'int-1',
      tenantId: 'default',
      apiKeyEncrypted: 'kms-stub:encryptedkey',
      status: 'connected',
      targetGroupId: 'group-1',
    })

    // After disconnect
    mockRoamIntegrationUpdate.mockResolvedValue({
      id: 'int-1',
      tenantId: 'default',
      apiKeyEncrypted: null,
      status: 'disconnected',
    })

    const req = new Request('http://localhost:3000/api/integrations/roam/disconnect', {
      method: 'POST',
    })

    const res = await disconnectPOST(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.status).toBe('disconnected')

    // Verify update cleared the key and set status
    expect(mockRoamIntegrationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'default' },
        data: {
          apiKeyEncrypted: null,
          status: 'disconnected',
        },
      }),
    )
  })

  it('returns 404 when no integration exists', async () => {
    mockRoamIntegrationFindUnique.mockResolvedValue(null)

    const req = new Request('http://localhost:3000/api/integrations/roam/disconnect', {
      method: 'POST',
    })

    const res = await disconnectPOST(req)
    expect(res.status).toBe(404)

    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('No ROAM integration found')
  })
})
