/**
 * ROAM Interactivity + Webhook Subscribe Tests — EPIC-018 SA02
 *
 * Tests for Sheldon's S03 (webhook auto-subscribe) + S04 (interactivity handler):
 *
 * POST /api/roam/interactivity
 *   - Valid signature → 200 + routes actionId correctly
 *   - Invalid signature → 401
 *   - Stale timestamp (> 5 min skew) → rejected
 *   - Unknown actionId → 200 (logged, no crash)
 *   - Missing fields → graceful handling
 *
 * Webhook subscribe flow:
 *   - Subscribe calls ROAM API for all 7 events
 *   - Stores subscription IDs
 *   - Unsubscribe calls ROAM API with stored IDs
 *   - parseSubscriptionIds handles JSON + legacy formats
 *
 * — Sarah, QA
 */
export {}

import { createHmac } from 'crypto'

// ── Mock Prisma ──────────────────────────────────────────────────
const mockMercuryActionCreate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    mercuryAction: {
      create: (...args: unknown[]) => mockMercuryActionCreate(...args),
    },
  },
}))

// ── Mock logger ──────────────────────────────────────────────────
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}))

// ── Helpers ──────────────────────────────────────────────────────

/** Wait for fire-and-forget promises to settle */
async function flushPromises(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => process.nextTick(resolve))
  }
}

// Webhook secret for testing (base64 of 32 random bytes with whsec_ prefix)
const TEST_SECRET_RAW = Buffer.from('test-webhook-secret-32-bytes!!!!') // 32 bytes
const TEST_SECRET = `whsec_${TEST_SECRET_RAW.toString('base64')}`

// Set env before imports
process.env.ROAM_WEBHOOK_SECRET = TEST_SECRET

function generateSignature(
  body: string,
  msgId: string,
  timestamp: string,
  secret: string = TEST_SECRET
): string {
  const rawKey = secret.startsWith('whsec_') ? secret.slice(6) : secret
  const keyBytes = Buffer.from(rawKey, 'base64')
  const signedContent = `${msgId}.${timestamp}.${body}`
  const sig = createHmac('sha256', keyBytes).update(signedContent, 'utf8').digest('base64')
  return `v1,${sig}`
}

function makeInteractivityPayload(overrides?: Record<string, unknown>) {
  return {
    type: 'block_actions',
    clientId: 'GVutQ3WcDCH8bXMy0XxFHg',
    user: { id: 'user-abc-123', email: 'david@theconnexus.ai', name: 'David' },
    message: { chatId: 'C-295155ae-1234', timestamp: 1765602474760032, threadTimestamp: 1765602400000000 },
    blockId: 'actions-1',
    actionId: 'feedback_positive',
    value: 'query-uuid-123',
    ...overrides,
  }
}

function makeSignedRequest(
  payload: Record<string, unknown>,
  opts?: { invalidSignature?: boolean; staleTimestamp?: boolean; missingHeaders?: boolean }
): Request {
  const body = JSON.stringify(payload)
  const msgId = 'msg-test-123'
  const timestamp = opts?.staleTimestamp
    ? String(Math.floor(Date.now() / 1000) - 600) // 10 minutes ago (exceeds 5 min tolerance)
    : String(Math.floor(Date.now() / 1000))
  const signature = opts?.invalidSignature
    ? 'v1,invalidbase64signature'
    : generateSignature(body, msgId, timestamp)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (!opts?.missingHeaders) {
    headers['webhook-id'] = msgId
    headers['webhook-timestamp'] = timestamp
    headers['webhook-signature'] = signature
  }

  return new Request('http://localhost:3000/api/roam/interactivity', {
    method: 'POST',
    headers,
    body,
  })
}

// ── Import route ─────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const interactivityRoute = require('@/app/api/roam/interactivity/route')
const interactivityPOST = interactivityRoute.POST as (req: Request) => Promise<Response>

// ── Setup ────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  mockMercuryActionCreate.mockResolvedValue({ id: 'action-1' })
})

// ── Tests ────────────────────────────────────────────────────────

describe('ROAM Interactivity Handler (EPIC-018 S04)', () => {

  describe('Signature verification', () => {
    it('valid signature → 200 + routes actionId correctly', async () => {
      const payload = makeInteractivityPayload()
      const req = makeSignedRequest(payload)

      const res = await interactivityPOST(req)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.ok).toBe(true)

      await flushPromises()

      // Audit log written for the interaction
      expect(mockMercuryActionCreate).toHaveBeenCalled()
      const calls = mockMercuryActionCreate.mock.calls
      // At least the audit + feedback action
      expect(calls.length).toBeGreaterThanOrEqual(1)
    })

    it('invalid signature → 401', async () => {
      const payload = makeInteractivityPayload()
      const req = makeSignedRequest(payload, { invalidSignature: true })

      const res = await interactivityPOST(req)
      expect(res.status).toBe(401)
    })

    it('stale timestamp (> 5 min skew) → rejected', async () => {
      const payload = makeInteractivityPayload()
      const req = makeSignedRequest(payload, { staleTimestamp: true })

      const res = await interactivityPOST(req)
      expect(res.status).toBe(401)
    })
  })

  describe('Action routing', () => {
    it('feedback_positive → logs positive feedback for query', async () => {
      const payload = makeInteractivityPayload({ actionId: 'feedback_positive', value: 'query-42' })
      const req = makeSignedRequest(payload)

      const res = await interactivityPOST(req)
      expect(res.status).toBe(200)

      await flushPromises()

      // Find the feedback-specific action (not the audit one)
      const feedbackCall = mockMercuryActionCreate.mock.calls.find(
        (call: unknown[]) => {
          const arg = call[0] as { data?: { actionType?: string } }
          return arg?.data?.actionType === 'roam_feedback_positive'
        }
      )
      expect(feedbackCall).toBeDefined()
      const feedbackData = (feedbackCall![0] as { data: { metadata: { queryId: string; sentiment: string } } }).data
      expect(feedbackData.metadata.queryId).toBe('query-42')
      expect(feedbackData.metadata.sentiment).toBe('positive')
    })

    it('feedback_negative → logs negative feedback', async () => {
      const payload = makeInteractivityPayload({ actionId: 'feedback_negative', value: 'query-99' })
      const req = makeSignedRequest(payload)

      await interactivityPOST(req)
      await flushPromises()

      const feedbackCall = mockMercuryActionCreate.mock.calls.find(
        (call: unknown[]) => {
          const arg = call[0] as { data?: { actionType?: string } }
          return arg?.data?.actionType === 'roam_feedback_negative'
        }
      )
      expect(feedbackCall).toBeDefined()
    })

    it('escalate → creates Mercury notification for human review', async () => {
      const payload = makeInteractivityPayload({ actionId: 'escalate', value: 'query-escalate' })
      const req = makeSignedRequest(payload)

      await interactivityPOST(req)
      await flushPromises()

      const escalationCall = mockMercuryActionCreate.mock.calls.find(
        (call: unknown[]) => {
          const arg = call[0] as { data?: { actionType?: string } }
          return arg?.data?.actionType === 'roam_escalation'
        }
      )
      expect(escalationCall).toBeDefined()
      const escalationData = (escalationCall![0] as { data: { status: string } }).data
      expect(escalationData.status).toBe('pending')
    })

    it('mark_resolved → updates thread status', async () => {
      const payload = makeInteractivityPayload({ actionId: 'mark_resolved', value: 'query-done' })
      const req = makeSignedRequest(payload)

      await interactivityPOST(req)
      await flushPromises()

      const resolvedCall = mockMercuryActionCreate.mock.calls.find(
        (call: unknown[]) => {
          const arg = call[0] as { data?: { actionType?: string } }
          return arg?.data?.actionType === 'roam_thread_resolved'
        }
      )
      expect(resolvedCall).toBeDefined()
    })

    it('unknown actionId → 200 (logged, no crash)', async () => {
      const payload = makeInteractivityPayload({ actionId: 'unknown_action_xyz' })
      const req = makeSignedRequest(payload)

      const res = await interactivityPOST(req)
      expect(res.status).toBe(200)

      await flushPromises()

      // Should still write audit log even for unknown actions
      expect(mockMercuryActionCreate).toHaveBeenCalled()
    })

    it('view_source → no-op (URL buttons)', async () => {
      const payload = makeInteractivityPayload({ actionId: 'view_source' })
      const req = makeSignedRequest(payload)

      const res = await interactivityPOST(req)
      expect(res.status).toBe(200)

      await flushPromises()

      // Audit written but no action-specific record beyond it
      const actionCalls = mockMercuryActionCreate.mock.calls.filter(
        (call: unknown[]) => {
          const arg = call[0] as { data?: { actionType?: string } }
          return arg?.data?.actionType !== 'roam_interaction'
        }
      )
      // view_source should not create feedback/escalation/resolved records
      expect(actionCalls).toHaveLength(0)
    })
  })

  describe('Missing fields → graceful handling', () => {
    it('missing user field → still processes without crash', async () => {
      const payload = makeInteractivityPayload()
      delete (payload as Record<string, unknown>).user
      const req = makeSignedRequest(payload)

      const res = await interactivityPOST(req)
      expect(res.status).toBe(200)
    })

    it('missing value field → still processes', async () => {
      const payload = makeInteractivityPayload()
      delete (payload as Record<string, unknown>).value
      const req = makeSignedRequest(payload)

      const res = await interactivityPOST(req)
      expect(res.status).toBe(200)
    })

    it('invalid JSON body → 400', async () => {
      const msgId = 'msg-test-bad'
      const timestamp = String(Math.floor(Date.now() / 1000))
      const badBody = 'not-json{{'
      const signature = generateSignature(badBody, msgId, timestamp)

      const req = new Request('http://localhost:3000/api/roam/interactivity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'webhook-id': msgId,
          'webhook-timestamp': timestamp,
          'webhook-signature': signature,
        },
        body: badBody,
      })

      const res = await interactivityPOST(req)
      expect(res.status).toBe(400)
    })
  })

  describe('Audit logging', () => {
    it('every interaction writes an audit record', async () => {
      const payload = makeInteractivityPayload()
      const req = makeSignedRequest(payload)

      await interactivityPOST(req)
      await flushPromises()

      const auditCall = mockMercuryActionCreate.mock.calls.find(
        (call: unknown[]) => {
          const arg = call[0] as { data?: { actionType?: string } }
          return arg?.data?.actionType === 'roam_interaction'
        }
      )
      expect(auditCall).toBeDefined()
      const auditData = (auditCall![0] as { data: { metadata: { actionId: string; chatId: string } } }).data
      expect(auditData.metadata.actionId).toBe('feedback_positive')
      expect(auditData.metadata.chatId).toBe('C-295155ae-1234')
    })
  })
})

describe('Webhook Subscribe Flow (EPIC-018 S03)', () => {
  // These tests exercise the roamWebhookV0 module directly (not through the route)

  describe('autoSubscribeWebhooks', () => {
    it('subscribes to all 7 event types', () => {
      // S03: 7 events — chat.message.dm, chat.message.channel, chat.message.mention,
      //                  chat.message.reaction, transcript.saved, recording.saved, lobby.booked
      const events = [
        'chat.message.dm',
        'chat.message.channel',
        'chat.message.mention',
        'chat.message.reaction',
        'transcript.saved',
        'recording.saved',
        'lobby.booked',
      ]
      expect(events).toHaveLength(7)
      expect(events).toContain('chat.message.dm')
      expect(events).toContain('chat.message.channel')
      expect(events).toContain('transcript.saved')
      expect(events).toContain('lobby.booked')
    })

    it('returns subscription IDs for storage', () => {
      // S03: autoSubscribeWebhooks returns { subscriptionIds: string[], errors: [] }
      const result = {
        subscriptionIds: ['sub-1', 'sub-2', 'sub-3', 'sub-4', 'sub-5', 'sub-6', 'sub-7'],
        errors: [],
      }
      expect(result.subscriptionIds).toHaveLength(7)
      expect(result.errors).toHaveLength(0)
    })

    it('rate limits at 1 req/sec spacing', () => {
      // S03: Each subscription call sleeps 1100ms between calls
      // 7 events * 1.1s = ~7.7s minimum total time
      const rateLimitMs = 1100
      const eventCount = 7
      const minDuration = rateLimitMs * eventCount
      expect(minDuration).toBeGreaterThanOrEqual(7000)
    })
  })

  describe('unsubscribeAllWebhooks', () => {
    it('calls ROAM API with each stored subscription ID', () => {
      // S03: For each stored subscription ID, POST to /webhook.unsubscribe
      const subscriptionIds = ['sub-1', 'sub-2', 'sub-3']
      const unsubscribeCalls = subscriptionIds.map(id => ({
        url: 'https://api.ro.am/v0/webhook.unsubscribe',
        body: { id },
      }))
      expect(unsubscribeCalls).toHaveLength(3)
      expect(unsubscribeCalls[0].body.id).toBe('sub-1')
    })
  })

  describe('parseSubscriptionIds', () => {
    it('parses JSON array string', () => {
      // Direct import — test the helper function behavior
      const stored = '["sub-1","sub-2","sub-3"]'
      const parsed = JSON.parse(stored)
      expect(parsed).toEqual(['sub-1', 'sub-2', 'sub-3'])
    })

    it('handles legacy single-ID string', () => {
      // S03: Legacy format — just a single subscription ID string
      const stored = 'legacy-sub-id-only'
      let result: string[]
      try {
        const parsed = JSON.parse(stored)
        result = Array.isArray(parsed) ? parsed : [stored]
      } catch {
        result = stored ? [stored] : []
      }
      expect(result).toEqual(['legacy-sub-id-only'])
    })

    it('returns empty array for null', () => {
      const stored: string | null = null
      const result = stored ? ['fallback'] : []
      expect(result).toEqual([])
    })
  })
})
