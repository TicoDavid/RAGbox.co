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
  },
}))

const mockSendMessage = jest.fn()
jest.mock('@/lib/roam/roamClient', () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}))

jest.mock('@/lib/roam/roamFormat', () => ({
  formatForRoam: jest.fn((text: string) => text),
  formatSilenceForRoam: jest.fn(() => 'SILENCE'),
  formatErrorForRoam: jest.fn(() => 'ERROR'),
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

    // Reply should have been sent to ROAM
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: 'group-123',
        text: expect.any(String),
      }),
    )

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

    // Reply sent to DM group
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: 'dm-alice-mercury',
      }),
    )
  })
})

// ── 4. Meeting transcript.saved → summary posted ─────────────────

describe('Meeting transcript.saved → summary', () => {
  it.todo('fetches transcript → summarizes via Mercury → posts to group (STORY-103)')
  // Will be implemented when Sheldon delivers STORY-103.
  // Expected flow:
  //   1. transcript.saved event arrives with transcript_id
  //   2. GET /transcript.info fetches full transcript
  //   3. POST /api/chat with "summarize this meeting" prompt
  //   4. POST /chat.post with summary + action items
  //   5. Store transcript document in Vault
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

// ── 6. Disconnect cleanup ────────────────────────────────────────

describe('Disconnect cleanup', () => {
  it.todo('unsubscribes webhook + deletes stored key (STORY-101)')
  // Will be implemented when Sheldon delivers STORY-101.
  // Expected flow:
  //   1. POST /api/integrations/roam/disconnect
  //   2. Calls ROAM /webhook.unsubscribe with stored subscription_id
  //   3. Clears encrypted API key from DB
  //   4. Sets status to 'disconnected'
  //   5. Audit log entry written
})
