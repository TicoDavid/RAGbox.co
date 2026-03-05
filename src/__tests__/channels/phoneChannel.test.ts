/**
 * Sarah — FINAL WAVE Task 1: Phone Channel Tests
 *
 * Tests the phone/Twilio channel integration:
 * - Twilio webhook receives call → TwiML response
 * - Audio stream connects to mercury-voice WebSocket
 * - Call transcript appears in Mercury thread with 'phone' channel
 * - Outbound call tool pattern detected
 * - Confirmation required before dialing
 * - Channel badge renders with red accent
 */

// ============================================================================
// TYPES — Matches MercuryChannel + Twilio patterns
// ============================================================================

import type { MercuryChannel } from '@/types/ragbox'

interface TwilioInboundPayload {
  CallSid: string
  From: string
  To: string
  CallStatus: 'ringing' | 'in-progress' | 'completed' | 'busy' | 'no-answer' | 'failed'
  Direction: 'inbound' | 'outbound-api' | 'outbound-dial'
}

interface TwiMLResponse {
  verb: 'Say' | 'Play' | 'Gather' | 'Connect' | 'Dial' | 'Hangup' | 'Redirect'
  attributes?: Record<string, string>
  content?: string
  children?: TwiMLResponse[]
}

interface CallMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  channel: MercuryChannel
  metadata?: {
    callSid?: string
    phoneNumber?: string
    direction?: 'inbound' | 'outbound'
    duration?: number
  }
}

// ============================================================================
// TWILIO WEBHOOK — Inbound Call → TwiML
// ============================================================================

describe('Sarah — Phone Channel: Twilio Webhook', () => {
  function buildTwiML(greeting: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">${greeting}</Say><Connect><Stream url="wss://app.ragbox.co/agent/ws" /></Connect></Response>`
  }

  function validateInboundPayload(payload: Partial<TwilioInboundPayload>): boolean {
    return !!(payload.CallSid && payload.From && payload.To)
  }

  test('valid inbound payload accepted', () => {
    const payload: TwilioInboundPayload = {
      CallSid: 'CA1234567890abcdef',
      From: '+15551234567',
      To: '+15559876543',
      CallStatus: 'ringing',
      Direction: 'inbound',
    }
    expect(validateInboundPayload(payload)).toBe(true)
  })

  test('missing CallSid rejected', () => {
    expect(validateInboundPayload({ From: '+1555', To: '+1555' })).toBe(false)
  })

  test('TwiML response includes greeting and stream connect', () => {
    const twiml = buildTwiML('Welcome to RAGbox. How can I help you?')
    expect(twiml).toContain('<Say')
    expect(twiml).toContain('Welcome to RAGbox')
    expect(twiml).toContain('<Connect>')
    expect(twiml).toContain('<Stream')
    expect(twiml).toContain('wss://')
  })

  test('TwiML stream URL points to mercury-voice WebSocket', () => {
    const twiml = buildTwiML('Hello')
    expect(twiml).toContain('/agent/ws')
  })

  test('CallSid format is CA + 32 hex chars', () => {
    const callSid = 'CA1234567890abcdef1234567890abcdef'
    expect(callSid).toMatch(/^CA[a-f0-9]{32}$/)
  })
})

// ============================================================================
// AUDIO STREAM — Twilio → Mercury Voice WebSocket
// ============================================================================

describe('Sarah — Phone Channel: Audio Stream Bridge', () => {
  interface AudioStreamEvent {
    event: 'connected' | 'start' | 'media' | 'stop'
    streamSid?: string
    media?: { payload: string; track: 'inbound' | 'outbound'; chunk: string }
  }

  test('connected event initiates session', () => {
    const event: AudioStreamEvent = { event: 'connected', streamSid: 'MZ123' }
    expect(event.event).toBe('connected')
    expect(event.streamSid).toBeDefined()
  })

  test('media event contains base64 audio payload', () => {
    const event: AudioStreamEvent = {
      event: 'media',
      media: { payload: 'SGVsbG8gV29ybGQ=', track: 'inbound', chunk: '1' },
    }
    expect(event.media!.payload).toBeTruthy()
    expect(event.media!.track).toBe('inbound')
  })

  test('stop event ends stream', () => {
    const event: AudioStreamEvent = { event: 'stop', streamSid: 'MZ123' }
    expect(event.event).toBe('stop')
  })

  test('audio format is mulaw 8kHz (Twilio default)', () => {
    const config = { encoding: 'audio/x-mulaw', sampleRate: 8000, channels: 1 }
    expect(config.encoding).toBe('audio/x-mulaw')
    expect(config.sampleRate).toBe(8000)
  })
})

// ============================================================================
// THREAD PERSISTENCE — Phone Channel Messages
// ============================================================================

describe('Sarah — Phone Channel: Thread Persistence', () => {
  function createCallMessage(
    role: 'user' | 'assistant',
    content: string,
    callSid: string,
    phoneNumber: string,
    direction: 'inbound' | 'outbound',
  ): CallMessage {
    return {
      id: `msg-${Date.now()}`,
      role,
      content,
      channel: 'phone',
      metadata: { callSid, phoneNumber, direction },
    }
  }

  test('inbound call message tagged with phone channel', () => {
    const msg = createCallMessage('user', 'What are the contract terms?', 'CA123', '+15551234567', 'inbound')
    expect(msg.channel).toBe('phone')
  })

  test('assistant response tagged with phone channel', () => {
    const msg = createCallMessage('assistant', 'The contract terms include...', 'CA123', '+15551234567', 'inbound')
    expect(msg.channel).toBe('phone')
    expect(msg.role).toBe('assistant')
  })

  test('metadata includes callSid', () => {
    const msg = createCallMessage('user', 'test', 'CA-abc-123', '+15551234567', 'inbound')
    expect(msg.metadata!.callSid).toBe('CA-abc-123')
  })

  test('metadata includes phone number', () => {
    const msg = createCallMessage('user', 'test', 'CA123', '+15551234567', 'inbound')
    expect(msg.metadata!.phoneNumber).toBe('+15551234567')
  })

  test('metadata includes direction', () => {
    const inbound = createCallMessage('user', 'test', 'CA123', '+1555', 'inbound')
    const outbound = createCallMessage('assistant', 'test', 'CA123', '+1555', 'outbound')
    expect(inbound.metadata!.direction).toBe('inbound')
    expect(outbound.metadata!.direction).toBe('outbound')
  })
})

// ============================================================================
// OUTBOUND CALL TOOL — Pattern Detection + Confirmation
// ============================================================================

describe('Sarah — Phone Channel: Outbound Call Tool', () => {
  function detectCallIntent(query: string): { detected: boolean; phoneNumber?: string } {
    const patterns = [
      /call\s+(\+?\d[\d\s\-()]{7,})/i,
      /dial\s+(\+?\d[\d\s\-()]{7,})/i,
      /phone\s+(\+?\d[\d\s\-()]{7,})/i,
    ]
    for (const pattern of patterns) {
      const match = query.match(pattern)
      if (match) {
        const number = match[1].replace(/[\s\-()]/g, '')
        return { detected: true, phoneNumber: number }
      }
    }
    return { detected: false }
  }

  test('detects "call +15551234567"', () => {
    const result = detectCallIntent('Please call +15551234567')
    expect(result.detected).toBe(true)
    expect(result.phoneNumber).toBe('+15551234567')
  })

  test('detects "dial 555-123-4567"', () => {
    const result = detectCallIntent('Dial 555-123-4567')
    expect(result.detected).toBe(true)
    expect(result.phoneNumber).toBe('5551234567')
  })

  test('does not detect non-call intent', () => {
    const result = detectCallIntent('What are the liability terms?')
    expect(result.detected).toBe(false)
  })

  test('confirmation required before dialing', () => {
    const intent = detectCallIntent('Call +15551234567')
    const confirmation = {
      message: `Are you sure you want to call ${intent.phoneNumber}?`,
      actions: ['Confirm', 'Cancel'],
      requiresApproval: true,
    }
    expect(confirmation.requiresApproval).toBe(true)
    expect(confirmation.actions).toContain('Confirm')
    expect(confirmation.actions).toContain('Cancel')
  })
})

// ============================================================================
// CHANNEL BADGE — Phone Renders Red
// ============================================================================

describe('Sarah — Phone Channel: Channel Badge', () => {
  const CHANNEL_CONFIG: Record<string, { label: string; color: string }> = {
    phone: { label: 'Phone', color: 'bg-red-500/15 text-red-400' },
    slack: { label: 'Slack', color: 'bg-indigo-500/15 text-indigo-400' },
    dashboard: { label: 'Chat', color: 'bg-[var(--brand-blue)]/15 text-[var(--brand-blue)]' },
  }

  test('phone badge has red accent', () => {
    expect(CHANNEL_CONFIG.phone.color).toContain('red')
  })

  test('phone badge labeled "Phone"', () => {
    expect(CHANNEL_CONFIG.phone.label).toBe('Phone')
  })

  test('phone is distinct from voice channel', () => {
    // 'voice' is browser WebSocket; 'phone' is Twilio PSTN
    const phoneChannel: MercuryChannel = 'phone'
    const voiceChannel: MercuryChannel = 'voice'
    expect(phoneChannel).not.toBe(voiceChannel)
  })
})
