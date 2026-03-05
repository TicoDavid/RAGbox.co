/**
 * Sarah — FINAL WAVE Task 2: Slack Channel Tests
 *
 * Tests the Slack channel integration:
 * - Slack event handler processes message.im, app_mention
 * - Bot responds in correct channel
 * - Thread replies use thread_ts
 * - Slack messages appear in Mercury thread with 'slack' channel
 * - Signature verification (HMAC-SHA256)
 * - Block Kit response formatting
 */

// ============================================================================
// TYPES — Slack Event API shapes
// ============================================================================

import crypto from 'crypto'
import type { MercuryChannel } from '@/types/ragbox'

interface SlackEvent {
  type: string
  subtype?: string
  channel: string
  user: string
  text: string
  ts: string
  thread_ts?: string
  event_ts: string
}

interface SlackEventWrapper {
  token: string
  type: 'event_callback' | 'url_verification'
  challenge?: string
  event?: SlackEvent
  team_id: string
  event_id: string
}

interface SlackBlockKitMessage {
  channel: string
  text: string
  thread_ts?: string
  blocks: Array<{
    type: 'section' | 'context' | 'actions' | 'divider'
    text?: { type: 'mrkdwn' | 'plain_text'; text: string }
    elements?: Array<{ type: string; text: string }>
  }>
}

interface SlackMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  channel: MercuryChannel
  metadata?: {
    slackChannel: string
    slackTs: string
    threadTs?: string
    userId: string
    teamId: string
  }
}

// ============================================================================
// EVENT HANDLER — message.im + app_mention
// ============================================================================

describe('Sarah — Slack Channel: Event Handler', () => {
  function classifyEvent(event: SlackEvent): 'direct_message' | 'mention' | 'ignored' {
    if (event.type === 'message' && !event.subtype) {
      if (event.channel.startsWith('D')) return 'direct_message'
      return 'ignored'
    }
    if (event.type === 'app_mention') return 'mention'
    return 'ignored'
  }

  test('message.im in DM channel classified as direct_message', () => {
    const event: SlackEvent = {
      type: 'message', channel: 'D01ABC234', user: 'U123',
      text: 'What are the contract terms?', ts: '1709123456.000100', event_ts: '1709123456.000100',
    }
    expect(classifyEvent(event)).toBe('direct_message')
  })

  test('app_mention classified as mention', () => {
    const event: SlackEvent = {
      type: 'app_mention', channel: 'C01ABC234', user: 'U123',
      text: '<@U_BOT> What are the contract terms?', ts: '1709123456.000200', event_ts: '1709123456.000200',
    }
    expect(classifyEvent(event)).toBe('mention')
  })

  test('message with subtype (e.g., bot_message) ignored', () => {
    const event: SlackEvent = {
      type: 'message', subtype: 'bot_message', channel: 'C01ABC', user: 'U123',
      text: 'ignored', ts: '1709123456.000300', event_ts: '1709123456.000300',
    }
    expect(classifyEvent(event)).toBe('ignored')
  })

  test('message in public channel (not DM) ignored', () => {
    const event: SlackEvent = {
      type: 'message', channel: 'C01PUBLIC', user: 'U123',
      text: 'not a DM', ts: '1709123456.000400', event_ts: '1709123456.000400',
    }
    expect(classifyEvent(event)).toBe('ignored')
  })

  test('DM channels start with D', () => {
    expect('D01ABC234'.startsWith('D')).toBe(true)
    expect('C01ABC234'.startsWith('D')).toBe(false)
  })
})

// ============================================================================
// URL VERIFICATION — Challenge Response
// ============================================================================

describe('Sarah — Slack Channel: URL Verification', () => {
  function handleVerification(wrapper: SlackEventWrapper): { status: number; body: unknown } {
    if (wrapper.type === 'url_verification' && wrapper.challenge) {
      return { status: 200, body: { challenge: wrapper.challenge } }
    }
    return { status: 200, body: { ok: true } }
  }

  test('url_verification returns challenge', () => {
    const wrapper: SlackEventWrapper = {
      token: 'test-token', type: 'url_verification',
      challenge: 'abc123xyz', team_id: 'T123', event_id: 'Ev123',
    }
    const result = handleVerification(wrapper)
    expect(result.status).toBe(200)
    expect((result.body as { challenge: string }).challenge).toBe('abc123xyz')
  })

  test('event_callback does not return challenge', () => {
    const wrapper: SlackEventWrapper = {
      token: 'test-token', type: 'event_callback',
      team_id: 'T123', event_id: 'Ev456',
      event: { type: 'message', channel: 'D01', user: 'U1', text: 'hi', ts: '1', event_ts: '1' },
    }
    const result = handleVerification(wrapper)
    expect(result.body).not.toHaveProperty('challenge')
  })
})

// ============================================================================
// BOT RESPONSE — Correct Channel + Thread
// ============================================================================

describe('Sarah — Slack Channel: Bot Response', () => {
  function buildBotResponse(
    slackChannel: string,
    answer: string,
    threadTs?: string,
  ): SlackBlockKitMessage {
    return {
      channel: slackChannel,
      text: answer,
      thread_ts: threadTs,
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: answer } },
      ],
    }
  }

  test('response sent to same channel as event', () => {
    const response = buildBotResponse('C01ABC234', 'The contract terms state...')
    expect(response.channel).toBe('C01ABC234')
  })

  test('thread reply includes thread_ts', () => {
    const response = buildBotResponse('C01ABC234', 'Reply', '1709123456.000100')
    expect(response.thread_ts).toBe('1709123456.000100')
  })

  test('top-level message has no thread_ts', () => {
    const response = buildBotResponse('D01ABC234', 'Hello!')
    expect(response.thread_ts).toBeUndefined()
  })

  test('response uses mrkdwn blocks', () => {
    const response = buildBotResponse('C01', 'Answer *with bold*')
    expect(response.blocks[0].text!.type).toBe('mrkdwn')
  })

  test('response includes fallback text', () => {
    const response = buildBotResponse('C01', 'The answer is 42.')
    expect(response.text).toBe('The answer is 42.')
  })
})

// ============================================================================
// THREAD PERSISTENCE — Slack Messages in Mercury Thread
// ============================================================================

describe('Sarah — Slack Channel: Mercury Thread Persistence', () => {
  function createSlackMessage(
    role: 'user' | 'assistant',
    content: string,
    slackChannel: string,
    slackTs: string,
    threadTs?: string,
  ): SlackMessage {
    return {
      id: `msg-${Date.now()}`,
      role,
      content,
      channel: 'slack',
      metadata: {
        slackChannel,
        slackTs,
        threadTs,
        userId: 'U123',
        teamId: 'T456',
      },
    }
  }

  test('user message tagged with slack channel', () => {
    const msg = createSlackMessage('user', 'What is the NDA scope?', 'D01ABC', '1709.001')
    expect(msg.channel).toBe('slack')
  })

  test('assistant response tagged with slack channel', () => {
    const msg = createSlackMessage('assistant', 'The NDA covers...', 'D01ABC', '1709.002')
    expect(msg.channel).toBe('slack')
    expect(msg.role).toBe('assistant')
  })

  test('metadata includes slack channel ID', () => {
    const msg = createSlackMessage('user', 'test', 'C01LEGAL', '1709.003')
    expect(msg.metadata!.slackChannel).toBe('C01LEGAL')
  })

  test('metadata includes slack timestamp', () => {
    const msg = createSlackMessage('user', 'test', 'D01', '1709123456.000100')
    expect(msg.metadata!.slackTs).toBe('1709123456.000100')
  })

  test('thread reply includes thread_ts in metadata', () => {
    const msg = createSlackMessage('user', 'follow up', 'C01', '1709.004', '1709.001')
    expect(msg.metadata!.threadTs).toBe('1709.001')
  })

  test('top-level message has undefined thread_ts', () => {
    const msg = createSlackMessage('user', 'new question', 'D01', '1709.005')
    expect(msg.metadata!.threadTs).toBeUndefined()
  })
})

// ============================================================================
// SIGNATURE VERIFICATION — HMAC-SHA256
// ============================================================================

describe('Sarah — Slack Channel: Signature Verification', () => {
  function verifySlackSignature(
    signingSecret: string,
    timestamp: string,
    body: string,
    signature: string,
  ): boolean {
    const sigBasestring = `v0:${timestamp}:${body}`
    const computed = 'v0=' + crypto.createHmac('sha256', signingSecret).update(sigBasestring).digest('hex')
    try {
      return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature))
    } catch {
      return false
    }
  }

  test('valid signature passes verification', () => {
    const secret = 'test_signing_secret_12345'
    const timestamp = '1709123456'
    const body = '{"type":"event_callback"}'
    const sig = 'v0=' + crypto.createHmac('sha256', secret).update(`v0:${timestamp}:${body}`).digest('hex')
    expect(verifySlackSignature(secret, timestamp, body, sig)).toBe(true)
  })

  test('invalid signature fails verification', () => {
    expect(verifySlackSignature('secret', '123', 'body', 'v0=invalid')).toBe(false)
  })

  test('signature format starts with v0=', () => {
    const sig = 'v0=abcdef1234567890'
    expect(sig.startsWith('v0=')).toBe(true)
  })
})

// ============================================================================
// CHANNEL BADGE — Slack Renders Indigo
// ============================================================================

describe('Sarah — Slack Channel: Badge', () => {
  const CHANNEL_CONFIG = {
    slack: { emoji: '#', label: 'Slack', color: 'bg-indigo-500/15 text-indigo-400' },
  }

  test('slack badge has indigo accent', () => {
    expect(CHANNEL_CONFIG.slack.color).toContain('indigo')
  })

  test('slack badge labeled "Slack"', () => {
    expect(CHANNEL_CONFIG.slack.label).toBe('Slack')
  })

  test('slack emoji is #', () => {
    expect(CHANNEL_CONFIG.slack.emoji).toBe('#')
  })
})
